// src/auth/google-auth.service.ts
// Google Sign-In (OAuth 2.0 authorization-code flow) — the OAuth client comes from Settings (per server),
// so the flow is done with plain HTTPS calls instead of a passport strategy fixed at startup.
//
//  login: /auth/google/start → Google → /auth/google/callback → one-time code → /login?gcode=…
//         → POST /auth/google/exchange → the same tokens as a password login (stored by the page,
//         never put in a URL). Same email as an existing user → linked automatically (like RSM).
//         New Google account → PENDING user (READ_ONLY) waiting for IT Manager approval.
//  link:  Profile → POST /auth/google/link-ticket (signed in) → /auth/google/start?ticket=…
//         → callback links the Google account to that user (email may differ).

import { Injectable, Logger, UnauthorizedException, BadRequestException, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { AuthService } from './auth.service';
import { invalidateUserCache } from './user-cache';

interface GoogleUser {
  sub: string;
  email: string;
  givenName: string;
  familyName: string;
}

type PendingState = { mode: 'login' } | { mode: 'link'; userId: number };

const STATE_TTL_MS = 10 * 60 * 1000; // user may take a while on Google's account chooser
const TICKET_TTL_MS = 2 * 60 * 1000;
const CODE_TTL_MS = 60 * 1000;

/** Small in-memory one-time store (single backend instance) */
class OneTime<T> {
  private items = new Map<string, { value: T; expires: number }>();
  put(value: T, ttlMs: number) {
    this.sweep();
    const key = crypto.randomBytes(24).toString('base64url');
    this.items.set(key, { value, expires: Date.now() + ttlMs });
    return key;
  }
  take(key?: string | null): T | null {
    if (!key) return null;
    const item = this.items.get(key);
    this.items.delete(key);
    return item && item.expires > Date.now() ? item.value : null;
  }
  private sweep() {
    const now = Date.now();
    for (const [k, v] of this.items) if (v.expires <= now) this.items.delete(k);
  }
}

@Injectable()
export class GoogleAuthService {
  private readonly logger = new Logger(GoogleAuthService.name);
  private readonly states = new OneTime<PendingState>();
  private readonly linkTickets = new OneTime<number>();
  private readonly loginCodes = new OneTime<number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly auth: AuthService,
  ) {}

  /** Signed-in user asks to link Google — the browser then navigates with this ticket (no auth header on a navigation) */
  createLinkTicket(userId: number) {
    return { ticket: this.linkTickets.put(userId, TICKET_TTL_MS) };
  }

  /** URL of Google's consent screen, or the page to go back to when Google Sign-In is not set up */
  async startUrl(ticket?: string): Promise<string> {
    const cfg = await this.settings.getGoogleOAuthConfig();
    if (!cfg) return ticket ? '/dashboard/profile?google=not_configured' : '/login?google=not_configured';

    let state: PendingState = { mode: 'login' };
    if (ticket) {
      const userId = this.linkTickets.take(ticket);
      if (!userId) return '/dashboard/profile?google=expired';
      state = { mode: 'link', userId };
    }
    const params = new URLSearchParams({
      client_id: cfg.clientId,
      redirect_uri: cfg.redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state: this.states.put(state, STATE_TTL_MS),
      prompt: 'select_account',
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  }

  /** Google redirected back — returns the page (same origin) to send the browser to */
  async callback(code?: string, stateKey?: string, error?: string): Promise<string> {
    const state = this.states.take(stateKey);
    if (error) return state?.mode === 'link' ? '/dashboard/profile?google=cancelled' : '/login?google=cancelled';
    // Unknown / used state: on Android the installed app can receive the same callback twice (seen in RSM) —
    // the first request already did the work, so don't show an error page for the twin.
    if (!state || !code) return '/login?google=retry';

    let g: GoogleUser;
    try {
      g = await this.fetchGoogleUser(code);
    } catch (err) {
      this.logger.warn(`Google token exchange failed: ${(err as Error).message}`);
      return state.mode === 'link' ? '/dashboard/profile?google=error' : '/login?google=retry';
    }

    return state.mode === 'link' ? this.link(state.userId, g) : this.login(g);
  }

  /** One-time code from the callback → the same response as a password login */
  async exchange(code: string) {
    const userId = this.loginCodes.take(code);
    if (!userId) throw new UnauthorizedException('ลิงก์เข้าสู่ระบบด้วย Google หมดอายุ กรุณาลองใหม่');
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { roles: { select: { role: true } } } });
    if (!user || user.status !== UserStatus.ACTIVE) throw new UnauthorizedException('Account is not active');
    return this.auth.issueSession(user);
  }

  async unlink(userId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { googleId: true } });
    if (!user) throw new NotFoundException('User not found');
    if (!user.googleId) throw new BadRequestException('บัญชีนี้ยังไม่ได้เชื่อม Google');
    await this.prisma.user.update({ where: { id: userId }, data: { googleId: null, googleEmail: null } });
    invalidateUserCache(userId);
    return { message: 'ยกเลิกการเชื่อมบัญชี Google แล้ว' };
  }

  // ── internals ─────────────────────────────────────────────────────────────

  private async fetchGoogleUser(code: string): Promise<GoogleUser> {
    const cfg = await this.settings.getGoogleOAuthConfig();
    if (!cfg) throw new Error('Google Sign-In is not configured');

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
        redirect_uri: cfg.redirectUri,
        grant_type: 'authorization_code',
      }),
      signal: AbortSignal.timeout(15000),
    });
    const token: any = await tokenRes.json().catch(() => ({}));
    if (!tokenRes.ok || !token.access_token) throw new Error(token.error || `token HTTP ${tokenRes.status}`);

    const infoRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${token.access_token}` },
      signal: AbortSignal.timeout(15000),
    });
    const info: any = await infoRes.json().catch(() => ({}));
    if (!infoRes.ok || !info.sub || !info.email) throw new Error(`userinfo HTTP ${infoRes.status}`);
    if (info.email_verified === false) throw new Error('Google email is not verified');

    return {
      sub: String(info.sub),
      email: String(info.email).toLowerCase(),
      givenName: info.given_name || info.name || 'Google',
      familyName: info.family_name || 'User',
    };
  }

  private async link(userId: number, g: GoogleUser): Promise<string> {
    const owner = await this.prisma.user.findUnique({ where: { googleId: g.sub }, select: { id: true } });
    if (owner && owner.id !== userId) return '/dashboard/profile?google=taken';
    await this.prisma.user.update({ where: { id: userId }, data: { googleId: g.sub, googleEmail: g.email } });
    invalidateUserCache(userId);
    return '/dashboard/profile?google=linked';
  }

  private async login(g: GoogleUser): Promise<string> {
    const include = { roles: { select: { role: true } } } as const;
    let user = await this.prisma.user.findUnique({ where: { googleId: g.sub }, include });

    if (!user) {
      // Same email as an existing account → link it the first time (Google has verified the address)
      const byEmail = await this.prisma.user.findFirst({ where: { email: { equals: g.email, mode: 'insensitive' } }, include });
      if (byEmail) {
        user = await this.prisma.user.update({
          where: { id: byEmail.id },
          data: { googleId: g.sub, googleEmail: g.email },
          include,
        });
        invalidateUserCache(user.id);
      }
    }

    if (!user) {
      await this.createPendingUser(g);
      return '/login?google=pending';
    }

    if (user.status === UserStatus.LOCKED) {
      if (user.lockedUntil && user.lockedUntil > new Date()) return '/login?google=locked';
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { status: UserStatus.ACTIVE, failedLoginAttempts: 0 },
        include,
      });
    }
    if (user.status === UserStatus.PENDING) return '/login?google=pending';
    if (user.status !== UserStatus.ACTIVE) return '/login?google=inactive';

    return `/login?gcode=${encodeURIComponent(this.loginCodes.put(user.id, CODE_TTL_MS))}`;
  }

  /** New sign-up from Google — same as the register form: READ_ONLY + PENDING, IT Managers notified */
  private async createPendingUser(g: GoogleUser) {
    const base = g.email.split('@')[0].replace(/[^a-zA-Z0-9._-]/g, '') || 'user';
    let username = base;
    for (let i = 2; await this.prisma.user.findUnique({ where: { username }, select: { id: true } }); i++) {
      username = `${base}${i}`;
    }
    // No password (signs in with Google) — a random one; "ลืมรหัสผ่าน" can set a real one later
    const password = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
    const user = await this.prisma.user.create({
      data: {
        username,
        email: g.email,
        password,
        firstName: g.givenName,
        lastName: g.familyName,
        googleId: g.sub,
        googleEmail: g.email,
        status: UserStatus.PENDING,
        roles: { create: [{ role: 'READ_ONLY' }] },
      },
    });
    await this.auth.notifyITManagersAboutNewUser(user).catch((err) =>
      this.logger.error('Failed to notify IT Managers about a Google sign-up', err),
    );
  }
}

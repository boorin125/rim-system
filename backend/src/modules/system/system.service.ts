// src/modules/system/system.service.ts
//
// Settings › อัปเดตระบบ: talks to the rim-updater container (deploy/updater) on the app's Docker
// network. The updater does the work; this service only forwards SUPER_ADMIN requests, keeps the
// result of the last check and runs the nightly check.

import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  ConflictException,
  BadGatewayException,
  BadRequestException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { NotificationType, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';

const LAST_CHECK_KEY = 'update_last_check';
const NOTIFIED_KEY = 'update_notified_commit';

@Injectable()
export class SystemService {
  private readonly logger = new Logger(SystemService.name);
  private readonly url = (process.env.UPDATER_URL || 'http://rim-updater:3090').replace(/\/+$/, '');
  private readonly secret = process.env.UPDATER_SECRET || '';
  /** A check pulls the channel image (can take minutes) — it runs in the background. */
  private checking: Promise<void> | null = null;
  private lastCheckError: string | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  version() {
    return {
      version: process.env.RIM_VERSION || process.env.APP_VERSION || '1.0.0',
      commit: process.env.GIT_COMMIT && process.env.GIT_COMMIT !== 'unknown' ? process.env.GIT_COMMIT : null,
      buildDate: process.env.BUILD_DATE && process.env.BUILD_DATE !== 'unknown' ? process.env.BUILD_DATE : null,
    };
  }

  private async call(method: 'GET' | 'POST', path: string, body?: unknown) {
    if (!this.secret) throw new ServiceUnavailableException('ยังไม่ได้ติดตั้ง updater บนเครื่องนี้ (deploy/updater/setup-updater.sh)');
    let res: Response;
    try {
      res = await fetch(`${this.url}${path}`, {
        method,
        headers: { authorization: `Bearer ${this.secret}`, 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(path === '/check' ? 600_000 : 10_000),
      });
    } catch {
      throw new ServiceUnavailableException('ติดต่อ rim-updater ไม่ได้');
    }
    const data: any = await res.json().catch(() => ({}));
    if (res.status === 409) throw new ConflictException('กำลังอัปเดตอยู่');
    if (res.status === 400) throw new BadRequestException(data?.error || 'bad request');
    if (!res.ok) throw new BadGatewayException(data?.error || `updater ${res.status}`);
    return data;
  }

  private async getConfig(key: string) {
    const row = await this.prisma.systemConfig.findUnique({ where: { key } });
    return row?.value ?? null;
  }

  private async setConfig(key: string, value: string) {
    await this.prisma.systemConfig.upsert({
      where: { key },
      create: { key, value, category: 'system' },
      update: { value },
    });
  }

  private async lastCheck() {
    const raw = await this.getConfig(LAST_CHECK_KEY);
    try {
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  async overview() {
    const configured = !!this.secret;
    let status: any = null;
    let reachable = false;
    if (configured) {
      try {
        status = await this.call('GET', '/status');
        reachable = true;
      } catch {}
    }
    return {
      ...this.version(),
      configured,
      reachable,
      status,
      checking: !!this.checking,
      lastCheck: await this.lastCheck(),
      lastCheckError: this.lastCheckError,
    };
  }

  /** Start a check in the background; the screen polls overview() for the result. */
  startCheck() {
    if (!this.secret) throw new ServiceUnavailableException('ยังไม่ได้ติดตั้ง updater บนเครื่องนี้ (deploy/updater/setup-updater.sh)');
    if (!this.checking) {
      this.lastCheckError = null;
      this.checking = this.runCheck()
        .then(() => undefined)
        .catch((e) => {
          this.lastCheckError = e instanceof Error ? e.message : String(e);
        })
        .finally(() => {
          this.checking = null;
        });
    }
    return { started: true };
  }

  private async runCheck() {
    const result = await this.call('POST', '/check');
    await this.setConfig(LAST_CHECK_KEY, JSON.stringify({ at: new Date().toISOString(), result }));
    return result;
  }

  install(version: string, commit: string) {
    if (!/^\d+\.\d+\.\d+$/.test(String(version)) || !/^[0-9a-f]{7,40}$/.test(String(commit))) {
      throw new BadRequestException('version/commit');
    }
    return this.call('POST', '/update', { version, commit });
  }

  status() {
    return this.call('GET', '/status');
  }

  /** Nightly check — tell SUPER_ADMINs once per new build. */
  @Cron('0 0 * * *', { timeZone: 'Asia/Bangkok' })
  async nightlyCheck() {
    if (!this.secret) return;
    try {
      const result = await this.runCheck();
      if (!result?.available || !result.latest?.commit) return;
      if ((await this.getConfig(NOTIFIED_KEY)) === result.latest.commit) return;
      const admins = await this.prisma.user.findMany({
        where: { status: 'ACTIVE', roles: { some: { role: UserRole.SUPER_ADMIN } } },
        select: { id: true },
      });
      for (const a of admins) {
        await this.notifications
          .createNotification(
            a.id,
            NotificationType.SYSTEM_ALERT,
            `RIM เวอร์ชันใหม่ v${result.latest.version} พร้อมติดตั้ง`,
            `ติดตั้งได้ที่ ตั้งค่า › อัปเดตระบบ (ปัจจุบัน v${result.current?.version ?? '?'})`,
            undefined,
            '/dashboard/settings?tab=update',
          )
          .catch(() => {});
      }
      await this.setConfig(NOTIFIED_KEY, result.latest.commit);
    } catch (e) {
      this.logger.warn(`nightly update check failed: ${e instanceof Error ? e.message : e}`);
    }
  }
}

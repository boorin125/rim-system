import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as webpush from 'web-push';

@Injectable()
export class PushService implements OnModuleInit {
  private readonly logger = new Logger(PushService.name);

  constructor(private prisma: PrismaService) {}

  onModuleInit() {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const email = process.env.VAPID_EMAIL || 'mailto:admin@rim-system.com';

    if (!publicKey || !privateKey) {
      this.logger.warn('VAPID keys not configured — Web Push disabled');
      return;
    }

    webpush.setVapidDetails(email, publicKey, privateKey);
    this.logger.log('Web Push initialized');
  }

  /** Save or update push subscription for a user */
  async subscribe(userId: number, subscription: {
    endpoint: string;
    keys: { p256dh: string; auth: string };
    userAgent?: string;
  }) {
    return this.prisma.pushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      create: {
        userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        userAgent: subscription.userAgent,
      },
      update: {
        userId,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        userAgent: subscription.userAgent,
      },
    });
  }

  /** Remove subscription (user unsubscribes or browser invalidates) */
  async unsubscribe(endpoint: string) {
    await this.prisma.pushSubscription.deleteMany({ where: { endpoint } });
  }

  /** Remove all subscriptions for a user (on logout) */
  async unsubscribeAll(userId: number) {
    await this.prisma.pushSubscription.deleteMany({ where: { userId } });
  }

  /** Send web push to all subscriptions of a user */
  async sendToUser(userId: number, payload: {
    title: string;
    body: string;
    icon?: string;
    badge?: string;
    url?: string;
    tag?: string;
  }) {
    if (!process.env.VAPID_PUBLIC_KEY) return;

    const subscriptions = await this.prisma.pushSubscription.findMany({
      where: { userId },
    });

    if (subscriptions.length === 0) return;

    // Resolve org logo for notification icon
    let orgIcon = payload.icon;
    if (!orgIcon) {
      try {
        const logoSetting = await this.prisma.systemConfig.findUnique({ where: { key: 'organization_logo' } });
        if (logoSetting?.value) {
          const appUrl = (process.env.FRONTEND_URL || 'http://localhost').replace(/\/$/, '');
          orgIcon = `${appUrl}${logoSetting.value}`;
        }
      } catch {}
    }

    const message = JSON.stringify({
      title: payload.title,
      body: payload.body,
      icon: orgIcon || '/icons/icon-192x192.png',
      badge: orgIcon || '/icons/badge-72x72.png',
      url: payload.url || '/',
      tag: payload.tag || 'rim-notification',
    });

    const staleEndpoints: string[] = [];

    await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            message,
          );
        } catch (err: any) {
          // 404 / 410 = subscription expired or invalid → mark for removal
          if (err.statusCode === 404 || err.statusCode === 410) {
            staleEndpoints.push(sub.endpoint);
          } else {
            this.logger.warn(`Push failed for user ${userId}: ${err.message}`);
          }
        }
      }),
    );

    // Clean up stale subscriptions
    if (staleEndpoints.length > 0) {
      await this.prisma.pushSubscription.deleteMany({
        where: { endpoint: { in: staleEndpoints } },
      });
    }
  }

  /** Return VAPID public key (needed by browser to subscribe) */
  getPublicKey(): string {
    return process.env.VAPID_PUBLIC_KEY || '';
  }
}

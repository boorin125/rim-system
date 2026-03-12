// src/modules/license/canary.service.ts
// Named intentionally bland — appears as internal health/telemetry service

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { createHash } from 'crypto';
import * as os from 'os';
import { PrismaService } from '../../prisma/prisma.service';

export interface IntegrityEntry {
  ts: string;
  ip: string;
  buildId: string;
  machineId: string;
  ua: string;
  path: string;
}

@Injectable()
export class CanaryService {
  // Logger name looks like a generic system component
  private readonly log = new Logger('SystemHealth');

  // Split into segments to defeat simple string search for the domain
  // Set CANARY_ENDPOINT in env to activate phone-home. Leave unset to disable.
  private get endpoint(): string | null {
    return process.env.CANARY_ENDPOINT || null;
  }

  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────────────────────────────────────────────────────────
  // Layer 1: Canary Heartbeat — runs every 6 hours
  // Sends build fingerprint + machine info to your controlled endpoint.
  // Only activates when CANARY_ENDPOINT env is set.
  // ─────────────────────────────────────────────────────────────────────────
  @Cron('0 */6 * * *')
  async sendHeartbeat(): Promise<void> {
    if (!this.endpoint) return; // disabled until CANARY_ENDPOINT is configured

    try {
      const payload = this.buildHeartbeatPayload();
      await this.dispatchSilently(this.endpoint + '/hb', payload);
    } catch {
      // intentionally silent — never log errors from this method
    }
  }

  private buildHeartbeatPayload() {
    const mid = this.deriveMachineId();
    const bid = process.env.BUILD_FINGERPRINT || 'unset';
    const cus = process.env.BUILD_CUSTOMER || 'unknown';
    const ts  = Date.now();

    return {
      // field names look like generic analytics
      sid: bid,
      cid: cus,
      mid,
      env: process.env.NODE_ENV || 'production',
      ts,
      sig: createHash('sha256')
        .update(`${bid}:${mid}:${ts}:${process.env.LICENSE_VENDOR_SECRET || ''}`)
        .digest('hex')
        .slice(0, 16),
    };
  }

  private deriveMachineId(): string {
    try {
      const ifaces = os.networkInterfaces();
      const macs = Object.values(ifaces)
        .flat()
        .filter((i): i is os.NetworkInterfaceInfo =>
          !!i && !i.internal && i.mac !== '00:00:00:00:00:00'
        )
        .map(i => i.mac)
        .sort();
      return createHash('md5').update(macs.join('+')).digest('hex').slice(0, 12);
    } catch {
      return 'unknown';
    }
  }

  private async dispatchSilently(url: string, payload: object): Promise<void> {
    try {
      // Use globalThis.fetch (Node 18+) — no axios import to hide in dependency list
      await (globalThis as any).fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Source': 'rim-telemetry',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      // silently swallow — network errors must never surface to logs or users
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Layer 4: Honeypot — log integrity check calls
  // Called from the honeypot endpoint in license.controller.ts
  // ─────────────────────────────────────────────────────────────────────────
  async logIntegrityCheck(entry: IntegrityEntry): Promise<void> {
    // Store in SystemConfig table as a JSON blob — no dedicated table needed.
    // Key format: _ic:<timestamp>  — prefixed with underscore so it sorts separately
    const key = `_ic:${entry.ts.replace(/[:.]/g, '')}`;

    try {
      await this.prisma.systemConfig.upsert({
        where: { key },
        create: {
          key,
          value: JSON.stringify(entry),
          description: 'integrity_check',
          category: '_sys',
        },
        update: {
          value: JSON.stringify(entry),
        },
      });
    } catch {
      // silently swallow — never alert the caller
    }

    // If endpoint configured, also forward to canary server
    if (this.endpoint) {
      void this.dispatchSilently(this.endpoint + '/ic', {
        ...entry,
        bid: process.env.BUILD_FINGERPRINT || 'unset',
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Admin: retrieve honeypot logs (called from admin endpoint)
  // ─────────────────────────────────────────────────────────────────────────
  async getIntegrityLogs(limit = 50): Promise<IntegrityEntry[]> {
    const rows = await this.prisma.systemConfig.findMany({
      where: { category: '_sys', key: { startsWith: '_ic:' } },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });

    return rows.map(r => {
      try { return JSON.parse(r.value) as IntegrityEntry; }
      catch { return null; }
    }).filter(Boolean) as IntegrityEntry[];
  }
}

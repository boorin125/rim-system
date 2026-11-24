// src/modules/integration/rsm-client.service.ts
// RIM as a CALLER of RSM's Integration API (Store Lifecycle v1 §A3 → RSM §B1):
// GET {RSM_URL}/api/integration/v1/issues?task=… with the key RSM issued for this RIM server.
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { IntegrationService } from './integration.service';
import { publicBaseUrl } from './integration-domain';

export const RSM_API_KEY = 'integration_rsm_api_key';

export interface RsmIssueLine {
  itemCode?: string | null;
  itemName?: string | null;
  category?: string | null;
  brand?: string | null;
  model?: string | null;
  quantity?: number | null;
  serials?: string[] | null;
}
export interface RsmIssue {
  ticketNumber: string;
  status?: string;
  fulfilledAt?: string | null;
  kind?: string | null;
  owner?: string | null;
  lines: RsmIssueLine[];
}

@Injectable()
export class RsmClientService {
  private readonly logger = new Logger(RsmClientService.name);

  constructor(private readonly prisma: PrismaService, private readonly integration: IntegrationService) {}

  async hasKey() {
    const row = await this.prisma.systemConfig.findUnique({ where: { key: RSM_API_KEY } });
    return !!row?.value?.trim();
  }

  async setKey(raw: string | null | undefined) {
    const value = (raw || '').trim();
    if (value && !/^[A-Za-z0-9_\-.]{20,200}$/.test(value)) throw new BadRequestException('รูปแบบ API Key ของ RSM ไม่ถูกต้อง');
    await this.prisma.systemConfig.upsert({
      where: { key: RSM_API_KEY },
      create: { key: RSM_API_KEY, value, category: 'integration', isEncrypted: true, description: 'API key issued by RSM for this RIM server (RIM → RSM)' },
      update: { value },
    });
    return { hasRsmKey: !!value };
  }

  /** "ทดสอบการเชื่อมต่อ RSM" — RSM's GET /meta with this server's key */
  async testConnection() {
    const body = await this.get('/meta', '');
    return body?.data ?? body;
  }

  /** Issued (fulfilled) RSM tickets of a project task / incident — throws a readable BadRequest when not possible */
  async issuesFor(query: { task?: string; incident?: string }): Promise<RsmIssue[]> {
    const qs = new URLSearchParams(Object.entries(query).filter(([, v]) => !!v) as [string, string][]).toString();
    const body = await this.get('/issues', qs);
    const list = Array.isArray(body) ? body : Array.isArray(body?.data) ? body.data : [];
    return list.filter((t: any) => t && typeof t.ticketNumber === 'string').map((t: any) => ({ ...t, lines: Array.isArray(t.lines) ? t.lines : [] }));
  }

  private async get(pathname: string, qs: string): Promise<any> {
    const rsmUrl = await this.integration.getRsmUrl();
    if (!rsmUrl) throw new BadRequestException('ยังไม่ได้ตั้ง RSM URL (Settings › Integration)');
    const key = (await this.prisma.systemConfig.findUnique({ where: { key: RSM_API_KEY } }))?.value?.trim();
    if (!key) throw new BadRequestException('ยังไม่ได้ใส่ API Key ของ RSM (Settings › Integration)');

    const url = `${rsmUrl}/api/integration/v1${pathname}${qs ? `?${qs}` : ''}`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15_000);
    let res: Response;
    try {
      res = await fetch(url, {
        headers: { Authorization: `Bearer ${key}`, 'X-Integration-Caller': publicBaseUrl(), Accept: 'application/json' },
        signal: ctrl.signal,
      });
    } catch (err: any) {
      this.logger.warn(`RSM ${pathname} ${qs}: ${err?.message}`);
      throw new BadRequestException('เชื่อมต่อ RSM ไม่ได้ — ลองใหม่อีกครั้ง');
    } finally {
      clearTimeout(timer);
    }
    const body: any = await res.json().catch(() => null);
    if (!res.ok) {
      const msg = body?.error?.message || `HTTP ${res.status}`;
      this.logger.warn(`RSM ${pathname} ${qs}: ${res.status} ${msg}`);
      throw new BadRequestException(`RSM ตอบกลับผิดพลาด (${res.status}): ${msg}`);
    }
    return body;
  }
}

// src/modules/integration/integration.service.ts
// Integration API v1 — API keys (issue / revoke / authenticate), rate limit, audit log, RSM link setting,
// and the Incident object of spec §7.3.
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { createHash, randomBytes } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { isAllowedUrl, normalizeOrigin, ownDomain, publicBaseUrl } from './integration-domain';
import { repairIncidentWhere } from '../performance/repair-incident.where';

/** Scopes this server (RIM) provides — meta:read is always granted */
export const RIM_SCOPES = ['meta:read', 'incidents:read', 'projects:read', 'stats:read'] as const;
export type RimScope = (typeof RIM_SCOPES)[number];

const RSM_URL_KEY = 'integration_rsm_url';
const RATE_LIMIT_PER_MINUTE = 120;
const AUDIT_RETENTION_DAYS = 90;
const BASE62 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

/** "2026-11-22T14:05:00+07:00" — ISO-8601 with the Thai offset (spec §1) */
export function isoTh(d: Date | null | undefined): string | null {
  if (!d) return null;
  const t = new Date(d.getTime() + 7 * 3600_000).toISOString(); // shift, then relabel the offset
  return `${t.slice(0, 19)}+07:00`;
}

/** "2026-12-01" — the Thai calendar date */
export function dateTh(d: Date | null | undefined): string | null {
  return d ? new Date(d.getTime() + 7 * 3600_000).toISOString().slice(0, 10) : null;
}

/** "2026-11" — Thai calendar month of a timestamp */
const monthTh = (d: Date) => dateTh(d)!.slice(0, 7);
/** Trimmed value, empty → null (stats group on it) */
const val = (s: string | null | undefined) => (s && s.trim() ? s.trim() : null);
const MAX_STAT_MONTHS = 24;

/** from / to as "YYYY-MM" (both included, Thai months) → UTC instants [start, end). Default = last 6 months incl. this one */
function monthRange(fromRaw?: string, toRaw?: string) {
  const re = /^(\d{4})-(0[1-9]|1[0-2])$/;
  const idx = (s: string) => { const [, y, m] = s.match(re)!; return Number(y) * 12 + Number(m) - 1; };
  const label = (i: number) => `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`;
  for (const [n, v] of [['from', fromRaw], ['to', toRaw]] as const) {
    if (v && !re.test(v)) throw new BadRequestException(`${n} ต้องเป็นรูปแบบ YYYY-MM`);
  }
  const toI = toRaw ? idx(toRaw) : idx(monthTh(new Date()));
  const fromI = fromRaw ? idx(fromRaw) : toI - 5;
  if (fromI > toI) throw new BadRequestException('from ต้องไม่เกิน to');
  if (toI - fromI + 1 > MAX_STAT_MONTHS) throw new BadRequestException(`ช่วงเดือนสูงสุด ${MAX_STAT_MONTHS} เดือน`);
  // Thai midnight on the 1st = 17:00 UTC of the day before
  const instant = (i: number) => new Date(Date.UTC(Math.floor(i / 12), i % 12, 1) - 7 * 3600_000);
  return { from: label(fromI), to: label(toI), start: instant(fromI), end: instant(toI + 1) };
}

const lower = (s: string | null | undefined) => (s ? s.trim().toLowerCase() : null);
const fullName = (u: { firstName: string | null; lastName: string | null } | null | undefined) =>
  u ? [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || null : null;

@Injectable()
export class IntegrationService {
  private readonly logger = new Logger(IntegrationService.name);
  /** keyId → request timestamps of the last minute (in-memory sliding window, per backend instance) */
  private readonly hits = new Map<number, number[]>();

  constructor(private readonly prisma: PrismaService) {}

  // ── Status / settings ───────────────────────────────────────────────────

  status() {
    const own = ownDomain();
    return { baseUrl: publicBaseUrl(), ownDomain: own, enabled: !!own };
  }

  async getRsmUrl(): Promise<string | null> {
    const row = await this.prisma.systemConfig.findUnique({ where: { key: RSM_URL_KEY } });
    const url = row?.value?.trim() || null;
    // A stored URL that no longer passes the domain rule (e.g. the server moved domain) is not used
    return url && isAllowedUrl(url) ? url : null;
  }

  async setRsmUrl(raw: string | null | undefined) {
    const value = (raw || '').trim();
    let stored = '';
    if (value) {
      const own = ownDomain();
      if (!own) throw new BadRequestException('Integration ปิดอยู่ — URL ของเครื่องนี้ต้องเป็น https และเป็นโดเมน (ไม่ใช่ IP)');
      if (!isAllowedUrl(value, own)) throw new BadRequestException(`RSM URL ต้องเป็น https://*.${own} เท่านั้น`);
      stored = normalizeOrigin(value)!;
    }
    await this.prisma.systemConfig.upsert({
      where: { key: RSM_URL_KEY },
      create: { key: RSM_URL_KEY, value: stored, category: 'integration', description: 'RSM URL for the "เบิกอะไหล่ (RSM)" button' },
      update: { value: stored },
    });
    return { rsmUrl: stored || null };
  }

  /** For the incident page button (any logged-in user) — rsmUrl null = hide the button */
  async rsmLink() {
    const { baseUrl, enabled } = this.status();
    return { rsmUrl: enabled ? await this.getRsmUrl() : null, baseUrl };
  }

  async adminOverview() {
    const [keys, rsmUrl, rsmRow] = await Promise.all([
      this.listKeys(),
      this.getRsmUrl(),
      this.prisma.systemConfig.findUnique({ where: { key: RSM_URL_KEY } }),
    ]);
    return { ...this.status(), rsmUrl, rsmUrlStored: rsmRow?.value || null, scopes: RIM_SCOPES, keys };
  }

  // ── Keys ────────────────────────────────────────────────────────────────

  async listKeys() {
    const rows = await this.prisma.integrationApiKey.findMany({ orderBy: { createdAt: 'desc' } });
    return rows.map(({ keyHash, ...k }) => k);
  }

  async createKey(dto: { name: string; callerUrl: string; scopes?: string[] }, user: { id: number; name: string | null }) {
    const own = ownDomain();
    if (!own) throw new BadRequestException('Integration ปิดอยู่ — URL ของเครื่องนี้ต้องเป็น https และเป็นโดเมน (ไม่ใช่ IP / localhost)');
    const name = dto.name?.trim();
    if (!name) throw new BadRequestException('กรุณากรอกชื่อผู้เรียก');
    if (!isAllowedUrl(dto.callerUrl, own)) throw new BadRequestException(`Caller URL ต้องเป็น https://*.${own} เท่านั้น`);
    const callerUrl = normalizeOrigin(dto.callerUrl)!;

    const bad = (dto.scopes || []).filter((s) => !(RIM_SCOPES as readonly string[]).includes(s));
    if (bad.length) throw new BadRequestException(`scope ไม่รองรับ: ${bad.join(', ')}`);
    const scopes = [...new Set(['meta:read', ...(dto.scopes || [])])];

    // rk_<server-code>_<random 40> — server code = first label of this server's host (ws, ntt, rim-test …)
    const code = (new URL(publicBaseUrl()).hostname.split('.')[0] || 'rim').toLowerCase().replace(/[^a-z0-9]/g, '') || 'rim';
    const bytes = randomBytes(40);
    const random = Array.from(bytes, (b) => BASE62[b % 62]).join('');
    const key = `rk_${code}_${random}`;

    const row = await this.prisma.integrationApiKey.create({
      data: {
        name,
        callerUrl,
        keyHash: sha256(key),
        keyPrefix: key.slice(0, code.length + 8),
        scopes,
        createdById: user.id,
        createdByName: user.name,
      },
    });
    const { keyHash, ...item } = row;
    return { key, item }; // the full key is shown once — only its hash is stored
  }

  async revokeKey(id: number) {
    const row = await this.prisma.integrationApiKey.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('ไม่พบ API Key');
    if (row.revokedAt) return { id, revokedAt: row.revokedAt };
    const updated = await this.prisma.integrationApiKey.update({ where: { id }, data: { revokedAt: new Date() } });
    this.hits.delete(id);
    return { id, revokedAt: updated.revokedAt };
  }

  findKeyByToken(token: string) {
    return this.prisma.integrationApiKey.findUnique({ where: { keyHash: sha256(token) } });
  }

  touchKey(id: number, ip: string | null) {
    this.prisma.integrationApiKey
      .update({ where: { id }, data: { lastUsedAt: new Date(), lastUsedIp: ip } })
      .catch((err) => this.logger.warn(`touchKey #${id}: ${err?.message}`));
  }

  /** true = allowed; false = over RATE_LIMIT_PER_MINUTE in the last 60 s */
  takeRateToken(keyId: number): boolean {
    const now = Date.now();
    const recent = (this.hits.get(keyId) || []).filter((t) => now - t < 60_000);
    if (recent.length >= RATE_LIMIT_PER_MINUTE) {
      this.hits.set(keyId, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(keyId, recent);
    return true;
  }

  // ── Audit log ───────────────────────────────────────────────────────────

  audit(entry: { keyId: number | null; keyName: string | null; method: string; path: string; status: number; durationMs: number; ip: string | null }) {
    this.prisma.integrationAuditLog
      .create({ data: { ...entry, path: entry.path.slice(0, 500) } })
      .catch((err) => this.logger.warn(`audit log: ${err?.message}`));
  }

  recentLogs(limit = 200) {
    return this.prisma.integrationAuditLog.findMany({ orderBy: { id: 'desc' }, take: Math.min(Math.max(limit, 1), 200) });
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async pruneAuditLogs() {
    const before = new Date(Date.now() - AUDIT_RETENTION_DAYS * 86400_000);
    const { count } = await this.prisma.integrationAuditLog.deleteMany({ where: { createdAt: { lt: before } } });
    if (count) this.logger.log(`Pruned ${count} integration audit logs older than ${AUDIT_RETENTION_DAYS} days`);
  }

  // ── Meta / Incidents (spec §6, §7) ──────────────────────────────────────

  async meta(scopes: string[]) {
    const cfg = await this.prisma.systemConfig.findMany({
      where: { key: { in: ['pwa_app_name', 'organization_name'] } },
    });
    const m = Object.fromEntries(cfg.map((c) => [c.key, c.value?.trim()]));
    return {
      system: 'RIM',
      serverName: m['pwa_app_name'] || m['organization_name'] || 'RIM',
      baseUrl: publicBaseUrl(),
      version: process.env.RIM_VERSION || process.env.APP_VERSION || null,
      apiVersion: 'v1',
      scopes,
      time: isoTh(new Date()),
    };
  }

  async incidentByTicket(ticketNumber: string) {
    const t = (ticketNumber || '').trim();
    const incident = t
      ? await this.prisma.incident.findFirst({ where: { ticketNumber: { equals: t, mode: 'insensitive' } }, select: { id: true } })
      : null;
    if (!incident) throw new NotFoundException(`ไม่พบใบงาน ${t}`);
    const [obj] = await this.serializeIncidents([incident.id]);
    return obj;
  }

  async incidentsBySerial(serialRaw: string, role: string, page: number, pageSize: number) {
    const serial = (serialRaw || '').trim().toUpperCase();
    if (!serial) throw new BadRequestException('กรุณาระบุ Serial Number');
    if (!['removed', 'installed', 'any'].includes(role)) throw new BadRequestException('role ต้องเป็น removed, installed หรือ any');

    const removed = Prisma.sql`UPPER(TRIM(sp.old_serial_no)) = ${serial} OR UPPER(TRIM(sp.old_component_serial)) = ${serial}`;
    const installed = Prisma.sql`UPPER(TRIM(sp.new_serial_no)) = ${serial} OR UPPER(TRIM(sp.new_component_serial)) = ${serial}`;
    const partCond = role === 'removed' ? removed : role === 'installed' ? installed : Prisma.sql`${removed} OR ${installed}`;

    const equipmentMatch =
      role === 'any'
        ? Prisma.sql`
          UNION
          SELECT i.id, i.created_at FROM incidents i
          WHERE EXISTS (
            SELECT 1 FROM equipment e
            WHERE UPPER(TRIM(e.serial_number)) = ${serial}
              AND (e.id = i.equipment_id OR e.id = ANY(i.equipment_ids))
          )`
        : Prisma.empty;

    const rows = await this.prisma.$queryRaw<{ id: string; created_at: Date }[]>`
      SELECT i.id, i.created_at FROM incidents i
      WHERE EXISTS (SELECT 1 FROM spare_parts sp WHERE sp.incident_id = i.id AND (${partCond}))
      ${equipmentMatch}
      ORDER BY created_at DESC`;

    const total = rows.length;
    const slice = rows.slice((page - 1) * pageSize, page * pageSize).map((r) => r.id);
    return { data: await this.serializeIncidents(slice), page, pageSize, total };
  }

  // ── Projects / stores (Store Lifecycle v1 §A5, scope projects:read) ──────

  readonly storeSelect = {
    id: true, storeCode: true, name: true, storeType: true, storeStatus: true, openDate: true, closeDate: true, autoClose: true,
    address: true, province: true, postalCode: true, phone: true, lastPmAt: true,
    hostStore: { select: { storeCode: true, name: true } },
  } satisfies Prisma.StoreSelect;

  private storeObj(s: Prisma.StoreGetPayload<{ select: IntegrationService['storeSelect'] }>) {
    return {
      code: s.storeCode,
      name: s.name,
      type: s.storeType,
      status: s.storeStatus,
      openDate: dateTh(s.openDate),
      closeDate: dateTh(s.closeDate),
      autoClose: s.autoClose,
      address: s.address,
      province: s.province,
      postalCode: s.postalCode,
      phone: s.phone,
      lastPmAt: isoTh(s.lastPmAt),
      hostStore: s.storeType === 'EVENT' && s.hostStore ? { code: s.hostStore.storeCode, name: s.hostStore.name } : null,
    };
  }

  readonly taskInclude = {
    projectStore: { select: { project: { select: { id: true, name: true } }, store: { select: this.storeSelect } } },
    assignedTo: { select: { email: true, firstName: true, lastName: true, phone: true } },
  } satisfies Prisma.ProjectTaskInclude;

  private taskObj(t: Prisma.ProjectTaskGetPayload<{ include: IntegrationService['taskInclude'] }>) {
    return {
      ticketNo: t.ticketNo,
      url: `${publicBaseUrl()}/dashboard/projects/task/${t.id}`,
      project: { id: t.projectStore.project.id, name: t.projectStore.project.name },
      title: t.title,
      workType: t.workType,
      taskType: t.taskType,
      status: t.status,
      scheduledDate: isoTh(t.scheduledDate),
      checkInAt: isoTh(t.checkInAt),
      completedAt: isoTh(t.completedAt),
      verifiedAt: isoTh(t.verifiedAt),
      assignee: t.assignedTo
        ? { email: lower(t.assignedTo.email), name: fullName(t.assignedTo), phone: t.assignedTo.phone ?? null }
        : null,
      store: this.storeObj(t.projectStore.store),
    };
  }

  /** A5.1 — one project task with its install / closed-store items */
  async projectTaskByTicket(ticketNo: string) {
    const t = (ticketNo || '').trim();
    const task = t
      ? await this.prisma.projectTask.findFirst({
          where: { ticketNo: { equals: t, mode: 'insensitive' } },
          include: { ...this.taskInclude, installItems: { orderBy: { id: 'asc' } }, closeItems: { orderBy: { id: 'asc' } } },
        })
      : null;
    if (!task) throw new NotFoundException(`ไม่พบงาน ${t}`);

    const toStoreIds = [...new Set(task.closeItems.map((c) => c.toStoreId).filter(Boolean) as number[])];
    const toStores = new Map(
      (await this.prisma.store.findMany({ where: { id: { in: toStoreIds } }, select: { id: true, storeCode: true, name: true } }))
        .map((s) => [s.id, { code: s.storeCode, name: s.name }]),
    );
    return {
      ...this.taskObj(task),
      installItems: task.installItems.map((i) => ({
        pointName: i.pointName,
        itemName: i.itemName,
        category: i.category,
        brand: i.brand,
        model: i.model,
        serialNumber: i.serialNumber,
        source: i.source,
        rsmTicketNo: i.rsmTicketNo,
        rsmItemCode: i.rsmItemCode,
        outcome: i.outcome,
        note: i.note,
      })),
      closeItems: task.closeItems.map((c) => ({
        pointName: c.pointName,
        category: c.category,
        brand: c.brand,
        model: c.model,
        serialNumber: c.serialNumber,
        noSerial: c.noSerial,
        source: c.source,
        rsmTicketNo: c.rsmTicketNo,
        outcome: c.outcome,
        toStore: c.toStoreId ? toStores.get(c.toStoreId) ?? null : null,
        handedTo: c.handedTo,
        shipRef: c.shipRef,
        note: c.note,
      })),
    };
  }

  /**
   * A5.2 — project tasks (short form), newest change first.
   * status=COMPLETED also matches ACCEPTED: in RIM "accepted by Help Desk" is the verified end state (COMPLETED is its older name).
   */
  async projectTasks(q: { workType?: string; status?: string; since?: string }, page: number, pageSize: number) {
    const where: Prisma.ProjectTaskWhereInput = {};
    if (q.workType) {
      const types = q.workType.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
      where.workType = { in: types as any };
    }
    if (q.status) {
      const st = new Set(q.status.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean));
      if (st.has('COMPLETED')) st.add('ACCEPTED');
      where.status = { in: [...st] as any };
    }
    if (q.since) {
      const since = new Date(q.since);
      if (isNaN(since.getTime())) throw new BadRequestException('since ต้องเป็นวันเวลา ISO-8601');
      where.updatedAt = { gte: since };
    }
    const [total, rows] = await Promise.all([
      this.prisma.projectTask.count({ where }),
      this.prisma.projectTask.findMany({
        where,
        include: this.taskInclude,
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { data: rows.map((t) => this.taskObj(t)), page, pageSize, total };
  }

  /** A5.3 — a store and its current equipment (a store code reused by a later pop-up → the newest open one) */
  async storeByCode(code: string) {
    const c = (code || '').trim();
    const stores = c
      ? await this.prisma.store.findMany({
          where: { storeCode: { equals: c, mode: 'insensitive' } },
          select: this.storeSelect,
          orderBy: { id: 'desc' },
        })
      : [];
    const store = stores.find((s) => s.storeStatus !== 'PERMANENTLY_CLOSED') ?? stores[0];
    if (!store) throw new NotFoundException(`ไม่พบสาขา ${c}`);

    const equipment = await this.prisma.equipment.findMany({
      where: { storeId: store.id, status: { not: 'RETIRED' } },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
    // Last PM that confirmed each unit
    const pm = equipment.length
      ? await this.prisma.pmEquipmentRecord.findMany({
          where: { equipmentId: { in: equipment.map((e) => e.id) }, pmRecord: { performedAt: { not: null } } },
          select: { equipmentId: true, pmRecord: { select: { performedAt: true } } },
        })
      : [];
    const lastPm = new Map<number, Date>();
    for (const r of pm) {
      const d = r.pmRecord.performedAt!;
      const cur = lastPm.get(r.equipmentId);
      if (!cur || d > cur) lastPm.set(r.equipmentId, d);
    }
    return {
      ...this.storeObj(store),
      equipment: equipment.map((e) => ({
        pointName: e.name,
        category: e.category,
        brand: e.brand,
        model: e.model,
        serialNumber: e.serialNumber,
        status: e.status,
        source: e.source,
        rsmTicketNo: e.rsmTicketNo,
        updatedByPmAt: isoTh(lastPm.get(e.id)),
      })),
    };
  }

  // ── Stats (RIM Demand v1 §A, scope stats:read) — totals only: no customer / store / technician / ticket data ──

  /**
   * A2 — repair requests and real replacements per Thai calendar month.
   * Same incidents as Performance › Top 10 Category (repairIncidentWhere: no PM, no cancelled).
   */
  async repairStats(fromRaw?: string, toRaw?: string) {
    const { from, to, start, end } = monthRange(fromRaw, toRaw);
    const inRange = { gte: start, lt: end };
    const repair = repairIncidentWhere();

    const [incidents, parts] = await Promise.all([
      this.prisma.incident.findMany({
        where: { AND: [repair, { createdAt: inRange }] },
        select: { category: true, createdAt: true },
      }),
      this.prisma.sparePart.findMany({
        where: { createdAt: inRange, incident: repair },
        select: {
          repairType: true, createdAt: true, newBrand: true, newModel: true, componentName: true,
          oldEquipment: { select: { category: true, brand: true, model: true } },
          newEquipment: { select: { category: true } },
          parentEquipment: { select: { category: true } },
        },
      }),
    ]);

    const tally = <T extends Record<string, string | null>>(rows: { month: string; key: T }[]) => {
      const m = new Map<string, { month: string; key: T; count: number }>();
      for (const r of rows) {
        const k = JSON.stringify([r.month, r.key]);
        const cur = m.get(k);
        if (cur) cur.count++;
        else m.set(k, { ...r, count: 1 });
      }
      return [...m.values()]
        .map((v) => ({ month: v.month, ...v.key, count: v.count }))
        .sort((a, b) => (a.month === b.month ? b.count - a.count : a.month.localeCompare(b.month)));
    };

    const reports = tally(incidents.map((i) => ({ month: monthTh(i.createdAt), key: { category: val(i.category) } })));
    const replacements = tally(
      parts
        .filter((p) => p.repairType === 'EQUIPMENT_REPLACEMENT')
        .map((p) => {
          // Brand / model of the unit put in; when neither was recorded, those of the unit taken out
          const hasNew = !!(val(p.newBrand) || val(p.newModel));
          return {
            month: monthTh(p.createdAt),
            key: {
              category: val(p.oldEquipment?.category) ?? val(p.newEquipment?.category),
              brand: hasNew ? val(p.newBrand) : val(p.oldEquipment?.brand),
              model: hasNew ? val(p.newModel) : val(p.oldEquipment?.model),
            },
          };
        }),
    );
    const components = tally(
      parts
        .filter((p) => p.repairType === 'COMPONENT_REPLACEMENT')
        .map((p) => ({
          month: monthTh(p.createdAt),
          key: { category: val(p.parentEquipment?.category), component: val(p.componentName) },
        })),
    );
    return { from, to, generatedAt: isoTh(new Date()), reports, replacements, components };
  }

  /** A3 — units in service now (ACTIVE / MAINTENANCE) per category / brand / model, in stores that are not closed */
  async installedBase() {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6); // same rule as PM isWithin6Months
    const openStore: Prisma.StoreWhereInput = { storeStatus: { not: 'PERMANENTLY_CLOSED' } };

    const [total, pmWithin6Months, units] = await Promise.all([
      this.prisma.store.count({ where: openStore }),
      this.prisma.store.count({ where: { ...openStore, lastPmAt: { gt: sixMonthsAgo } } }),
      this.prisma.equipment.findMany({
        where: { status: { in: ['ACTIVE', 'MAINTENANCE'] }, store: openStore },
        select: { category: true, brand: true, model: true },
      }),
    ]);
    const m = new Map<string, { category: string | null; brand: string | null; model: string | null; count: number }>();
    for (const u of units) {
      const row = { category: val(u.category), brand: val(u.brand), model: val(u.model) };
      const k = JSON.stringify(row);
      const cur = m.get(k);
      if (cur) cur.count++;
      else m.set(k, { ...row, count: 1 });
    }
    return {
      generatedAt: isoTh(new Date()),
      stores: { total, pmWithin6Months },
      rows: [...m.values()].sort((a, b) => b.count - a.count),
    };
  }

  /** Incident objects (spec §7.3) in the order of `ids` */
  private async serializeIncidents(ids: string[]) {
    if (!ids.length) return [];
    const incidents = await this.prisma.incident.findMany({
      where: { id: { in: ids } },
      include: {
        store: { select: { storeCode: true, name: true, address: true, province: true, postalCode: true, phone: true } },
        assignee: { select: { email: true, firstName: true, lastName: true, phone: true } },
        spareParts: {
          orderBy: [{ roundNumber: 'asc' }, { id: 'asc' }],
          include: { oldEquipment: { select: { id: true, category: true, brand: true, model: true } } },
        },
      },
    });

    // Reporter (Incident.reportedBy is a plain user id)
    const reporterIds = [...new Set(incidents.map((i) => i.reportedBy).filter(Boolean))];
    const reporters = new Map(
      (await this.prisma.user.findMany({ where: { id: { in: reporterIds } }, select: { id: true, email: true, firstName: true, lastName: true } }))
        .map((u) => [u.id, u]),
    );

    // Equipment of each incident (equipmentId + equipmentIds)
    const equipIds = [...new Set(incidents.flatMap((i) => [i.equipmentId, ...(i.equipmentIds || [])]).filter(Boolean) as number[])];
    const equipment = new Map(
      (await this.prisma.equipment.findMany({
        where: { id: { in: equipIds } },
        select: { id: true, name: true, category: true, brand: true, model: true, serialNumber: true },
      })).map((e) => [e.id, e]),
    );

    // Brand / model of the removed unit as it was before the incident updated it (same as the public incident page)
    const oldEquipIds = incidents.flatMap((i) => i.spareParts.map((sp) => sp.oldEquipmentId)).filter(Boolean) as number[];
    const logs = oldEquipIds.length
      ? await this.prisma.equipmentLog.findMany({
          where: { source: 'INCIDENT', sourceId: { in: ids }, equipmentId: { in: oldEquipIds } },
          select: { equipmentId: true, sourceId: true, oldValue: true },
          orderBy: { createdAt: 'asc' },
        })
      : [];
    const firstOld = new Map<string, any>();
    for (const l of logs) {
      const k = `${l.sourceId}:${l.equipmentId}`;
      if (!firstOld.has(k)) firstOld.set(k, l.oldValue);
    }

    const base = publicBaseUrl();
    const byId = new Map(
      incidents.map((i) => {
        const reporter = reporters.get(i.reportedBy);
        const eqIds = [...new Set([i.equipmentId, ...(i.equipmentIds || [])].filter(Boolean) as number[])];
        return [
          i.id,
          {
            ticketNumber: i.ticketNumber,
            url: `${base}/dashboard/incidents/${i.id}`,
            status: i.status,
            category: i.category,
            jobType: i.jobType,
            priority: i.priority,
            title: i.title,
            description: i.description,
            resolutionNote: i.resolutionNote,
            incidentDate: isoTh(i.incidentDate),
            createdAt: isoTh(i.createdAt),
            resolvedAt: isoTh(i.resolvedAt),
            store: {
              code: i.store?.storeCode ?? i.storeCode ?? null,
              name: i.store?.name ?? i.storeName ?? null,
              address: i.store?.address ?? null,
              province: i.store?.province ?? null,
              postalCode: i.store?.postalCode ?? null,
              phone: i.store?.phone ?? null,
            },
            technician: i.assignee
              ? { email: lower(i.assignee.email), name: fullName(i.assignee), phone: i.assignee.phone ?? null }
              : null,
            reportedBy: reporter ? { email: lower(reporter.email), name: fullName(reporter) } : null,
            equipment: eqIds
              .map((id) => equipment.get(id))
              .filter(Boolean)
              .map((e) => ({ name: e.name, category: e.category, brand: e.brand, model: e.model, serialNumber: e.serialNumber })),
            spareParts: i.spareParts.map((sp) => {
              const logOld = sp.oldEquipmentId ? firstOld.get(`${i.id}:${sp.oldEquipmentId}`) : null;
              const oe = sp.oldEquipment;
              return {
                round: sp.roundNumber,
                repairType: sp.repairType,
                deviceName: sp.deviceName,
                oldSerialNo: sp.oldSerialNo?.trim() || null,
                newSerialNo: sp.newSerialNo?.trim() || null,
                newBrand: sp.newBrand,
                newModel: sp.newModel,
                componentName: sp.componentName,
                oldComponentSerial: sp.oldComponentSerial?.trim() || null,
                newComponentSerial: sp.newComponentSerial?.trim() || null,
                oldEquipment: oe
                  ? {
                      category: oe.category,
                      brand: logOld && logOld.brand !== undefined ? logOld.brand : oe.brand,
                      model: logOld && logOld.model !== undefined ? logOld.model : oe.model,
                    }
                  : null,
                notes: sp.notes,
                createdAt: isoTh(sp.createdAt),
              };
            }),
          },
        ];
      }),
    );
    return ids.map((id) => byId.get(id)).filter(Boolean);
  }
}

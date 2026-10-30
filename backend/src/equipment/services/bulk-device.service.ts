import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AuditAction,
  AuditModule,
  EquipmentLogAction,
  EquipmentLogSource,
  EquipmentStatus,
} from '@prisma/client';
import { AuditTrailService } from '../../modules/audit-trail/audit-trail.service';
import { syncOpenPmEquipment, findOpenPmPhotoLock, PM_EQUIPMENT_STATUSES } from '../../modules/pm/pm-sync.helper';
import { BulkDeviceDto, BulkDeviceRowDto } from '../dto/bulk-device.dto';

/**
 * Add / update devices in many stores from one Excel file (IT_MANAGER) — see memory project-bulk-device-plan.
 * - A device is matched by (store, Device Name) — case-insensitive, trimmed, RETIRED included
 * - Blank cell = keep the old value, "-" = clear it (new devices: both mean empty)
 * - S/N uniqueness is judged on the batch's final state, so S/N swapped between devices pass
 */

type Fields = {
  category: string;
  serialNumber: string | null;
  ipAddress: string | null;
  brand: string | null;
  model: string | null;
  purchaseDate: Date | null;
  warrantyExpiry: Date | null;
  status: EquipmentStatus;
};

const COMPARED: Array<keyof Fields> = [
  'category', 'brand', 'model', 'serialNumber', 'ipAddress', 'purchaseDate', 'warrantyExpiry', 'status',
];
const STATUSES = Object.values(EquipmentStatus) as string[];
const CLEAR = '-';

export type BulkDeviceAction = 'create' | 'update' | 'unchanged' | 'error';

export interface BulkDeviceRowResult {
  index: number; // position in the request's rows
  row: number | null; // Excel row number
  storeCode: string;
  storeName: string | null;
  name: string;
  action: BulkDeviceAction;
  message?: string;
  changes?: string[];
}

interface Planned extends BulkDeviceRowResult {
  storeId?: number;
  existing?: any;
  data?: Fields;
}

const norm = (s?: string | null) => (s ?? '').trim().toLowerCase();
const dayKey = (d?: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
const valueKey = (v: unknown) => (v instanceof Date ? dayKey(v) : (v ?? null));

/** Excel cell → keep (undefined) / clear (null) / value */
function cell(raw: string | undefined): string | null | undefined {
  const v = (raw ?? '').trim();
  if (!v) return undefined;
  return v === CLEAR ? null : v;
}

function parseDay(v: string, label: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || isNaN(Date.parse(v))) {
    throw new Error(`${label} "${v}" ไม่ถูกต้อง (ใช้รูปแบบ YYYY-MM-DD)`);
  }
  return new Date(v);
}

@Injectable()
export class BulkDeviceService {
  constructor(
    private prisma: PrismaService,
    private auditTrailService: AuditTrailService,
  ) {}

  async preview(dto: BulkDeviceDto) {
    const rows = await this.plan(dto);
    return { summary: this.summarize(rows), rows: rows.map((r) => this.publicRow(r)) };
  }

  async apply(dto: BulkDeviceDto, userId: number) {
    // Re-plan on the server: data may have changed since the preview
    const rows = await this.plan(dto);
    const fail = (r: Planned, err: any) => {
      r.action = 'error';
      r.message = `บันทึกไม่สำเร็จ: ${err?.code === 'P2002' ? 'S/N ซ้ำกับอุปกรณ์อื่น' : err?.message ?? 'Unknown error'}`;
    };

    // 1. Updates that change S/N go together: free every old S/N first, then write — swaps never collide
    const snMovers = rows.filter((r) => r.action === 'update' && r.changes?.includes('serialNumber'));
    if (snMovers.length) {
      try {
        await this.prisma.$transaction(
          async (tx) => {
            await tx.equipment.updateMany({
              where: { id: { in: snMovers.map((r) => r.existing.id) } },
              data: { serialNumber: null },
            });
            for (const r of snMovers) await this.writeUpdate(tx, r, userId);
          },
          { timeout: 120_000, maxWait: 10_000 },
        );
      } catch (err) {
        snMovers.forEach((r) => fail(r, err));
      }
    }

    // 2. Other updates, then new devices (may take an S/N freed in step 1) — one transaction each
    for (const r of rows.filter((x) => x.action === 'update' && !snMovers.includes(x))) {
      try {
        await this.prisma.$transaction((tx) => this.writeUpdate(tx, r, userId));
      } catch (err) {
        fail(r, err);
      }
    }
    for (const r of rows.filter((x) => x.action === 'create')) {
      try {
        await this.prisma.$transaction((tx) => this.writeCreate(tx, r, userId));
      } catch (err) {
        fail(r, err);
      }
    }

    const summary = this.summarize(rows);
    const touched = rows.filter((r) => r.action === 'create' || r.action === 'update').map((r) => r.storeId);
    try {
      await syncOpenPmEquipment(this.prisma, touched);
    } catch (err) {
      console.error('[PM Sync] Failed after bulk device import:', err);
    }
    try {
      await this.auditTrailService.logDirect({
        module: AuditModule.EQUIPMENT,
        action: AuditAction.IMPORT,
        entityType: 'Equipment',
        entityId: 'bulk-device',
        userId,
        description: `นำเข้าอุปกรณ์หลายสาขาจาก Excel — สร้างใหม่ ${summary.create}, อัปเดต ${summary.update}, ไม่เปลี่ยน ${summary.unchanged}, ไม่สำเร็จ ${summary.error}`,
        newValue: summary,
      });
    } catch (_) {}

    return { summary, rows: rows.map((r) => this.publicRow(r)) };
  }

  // ─────────────────────────────────────────────────────────────

  private async plan(dto: BulkDeviceDto): Promise<Planned[]> {
    const codes = Array.from(new Set(dto.rows.map((r) => (r.storeCode ?? '').trim()).filter(Boolean)));
    const stores = codes.length
      ? await this.prisma.store.findMany({
          where: { storeCode: { in: codes, mode: 'insensitive' } },
          select: { id: true, storeCode: true, name: true },
        })
      : [];
    const storeByCode = new Map(stores.map((s) => [s.storeCode.toUpperCase(), s]));

    // Every device of these stores, grouped by (store, name)
    const inStores = stores.length
      ? await this.prisma.equipment.findMany({ where: { storeId: { in: stores.map((s) => s.id) } } })
      : [];
    const byKey = new Map<string, typeof inStores>();
    for (const e of inStores) {
      const key = `${e.storeId}|${norm(e.name)}`;
      byKey.set(key, [...(byKey.get(key) ?? []), e]);
    }

    // Category must be one the system knows (settings list, or already used on equipment) — spelled as stored
    const categoryByNorm = new Map<string, string>();
    const [settingCats, usedCats] = await Promise.all([
      this.prisma.incidentCategory.findMany({ where: { isActive: true }, select: { name: true } }),
      this.prisma.equipment.findMany({ distinct: ['category'], select: { category: true } }),
    ]);
    for (const c of usedCats) if (c.category) categoryByNorm.set(norm(c.category), c.category);
    for (const c of settingCats) categoryByNorm.set(norm(c.name), c.name);

    const seen = new Set<string>();
    const rows: Planned[] = dto.rows.map((r: BulkDeviceRowDto, index) => {
      const code = (r.storeCode ?? '').trim();
      const name = (r.name ?? '').trim();
      const store = storeByCode.get(code.toUpperCase());
      const row: Planned = {
        index,
        row: typeof r.row === 'number' ? r.row : null,
        storeCode: store?.storeCode ?? code,
        storeName: store?.name ?? null,
        name,
        action: 'error',
      };
      const error = (message: string) => ({ ...row, message });

      if (!code) return error('ไม่ได้ระบุ Store Code');
      if (!store) return error(`ไม่พบรหัสสาขา "${code}" ในระบบ`);
      if (!name || name === CLEAR) return error('ไม่ได้ระบุ Device Name');
      row.storeId = store.id;

      const key = `${store.id}|${norm(name)}`;
      if (seen.has(key)) return error(`"${name}" ของสาขานี้อยู่ในไฟล์ซ้ำ`);
      seen.add(key);

      const matches = byKey.get(key) ?? [];
      if (matches.length > 1) {
        return error(`สาขานี้มี "${name}" อยู่ ${matches.length} เครื่อง — เปลี่ยนชื่อให้ไม่ซ้ำ (เช่น ${name}#2) ก่อน`);
      }
      const existing = matches[0];

      // Category: blank = keep (new devices must have one); "-" cannot clear it
      const catCell = cell(r.category);
      let category: string;
      if (catCell === undefined || catCell === null) {
        if (catCell === null) return error('Category ลบไม่ได้ (ต้องมีค่า)');
        if (!existing) return error('อุปกรณ์ใหม่ต้องระบุ Category');
        category = existing.category;
      } else {
        const known = categoryByNorm.get(norm(catCell));
        if (!known) return error(`ไม่มี Category "${catCell}" ในระบบ`);
        category = known;
      }

      // Status: blank = keep / ACTIVE for new
      const statusCell = cell(r.status)?.toUpperCase();
      if (statusCell && !STATUSES.includes(statusCell)) return error(`สถานะ "${r.status}" ไม่ถูกต้อง (${STATUSES.join(', ')})`);

      // Other fields: blank = keep, "-" = clear
      const pick = (raw: string | undefined, old: any) => {
        const v = cell(raw);
        return v === undefined ? (old ?? null) : v;
      };
      let data: Fields;
      try {
        const day = (raw: string | undefined, old: Date | null | undefined, label: string) => {
          const v = cell(raw);
          return v === undefined ? (old ?? null) : v === null ? null : parseDay(v, label);
        };
        data = {
          category,
          serialNumber: pick(r.serialNumber, existing?.serialNumber),
          ipAddress: pick(r.ipAddress, existing?.ipAddress),
          brand: pick(r.brand, existing?.brand),
          model: pick(r.model, existing?.model),
          purchaseDate: day(r.purchaseDate, existing?.purchaseDate, 'Purchase Date'),
          warrantyExpiry: day(r.warrantyExpiry, existing?.warrantyExpiry, 'Warranty Expiry'),
          status: (statusCell ?? existing?.status ?? EquipmentStatus.ACTIVE) as EquipmentStatus,
        };
      } catch (err: any) {
        return error(err.message);
      }
      if (data.serialNumber && data.serialNumber.length < 3) return error('Serial Number ต้องมีอย่างน้อย 3 ตัวอักษร');

      row.data = data;
      if (!existing) return { ...row, action: 'create' };
      const changes = COMPARED.filter((k) => valueKey(existing[k]) !== valueKey(data[k]));
      return { ...row, existing, action: changes.length ? 'update' : 'unchanged', changes };
    });

    await this.checkSerials(rows);
    await this.checkPmLocks(rows);
    return rows;
  }

  /** S/N must be unique in the batch's FINAL state: a S/N freed by another row of the batch is fine (swap) */
  private async checkSerials(rows: Planned[]) {
    const fail = (r: Planned, message: string) => {
      r.action = 'error';
      r.message = message;
    };
    const where = (r: Planned) => `${r.storeCode} ${r.name}`;
    // A failed row keeps its old S/N, which may block a row that counted on it — repeat until stable
    for (let pass = 0; pass < 20; pass++) {
      const active = rows.filter((r) => r.action !== 'error' && r.data);
      const claims = new Map<string, Planned[]>();
      for (const r of active) {
        const sn = r.data.serialNumber;
        if (sn) claims.set(sn.toUpperCase(), [...(claims.get(sn.toUpperCase()) ?? []), r]);
      }

      let failed = false;
      for (const list of claims.values()) {
        if (list.length < 2) continue;
        const all = list.map(where).join(', ');
        list.forEach((r) => fail(r, `S/N ${r.data.serialNumber} ซ้ำกันในไฟล์ (${all})`));
        failed = true;
      }
      if (failed) continue;
      if (claims.size === 0) return;

      const holders = await this.prisma.equipment.findMany({
        where: { serialNumber: { in: Array.from(claims.keys()), mode: 'insensitive' } },
        select: { id: true, name: true, serialNumber: true, store: { select: { storeCode: true } } },
      });
      const finalSn = new Map(
        active.filter((r) => r.existing).map((r) => [r.existing.id as number, r.data.serialNumber?.toUpperCase() ?? null]),
      );
      for (const h of holders) {
        const key = (h.serialNumber ?? '').toUpperCase();
        const r = claims.get(key)?.[0];
        if (!r || r.action === 'error') continue;
        if (r.existing?.id === h.id) continue; // keeps its own S/N
        if (finalSn.has(h.id) && finalSn.get(h.id) !== key) continue; // the holder gives it up in this batch
        fail(r, `S/N ${r.data.serialNumber} ใช้อยู่กับ "${h.name}" สาขา ${h.store?.storeCode ?? '-'}`);
        failed = true;
      }
      if (!failed) return;
    }
  }

  /** Taking a device out of service while an open PM job has its photos is blocked (same rule as edit) */
  private async checkPmLocks(rows: Planned[]) {
    for (const r of rows) {
      if (r.action !== 'update' || !r.changes?.includes('status')) continue;
      const leavesPm =
        PM_EQUIPMENT_STATUSES.includes(r.existing.status) && !PM_EQUIPMENT_STATUSES.includes(r.data.status);
      if (!leavesPm) continue;
      const ticket = await findOpenPmPhotoLock(this.prisma, r.existing.id);
      if (ticket) {
        r.action = 'error';
        r.message = `อุปกรณ์ถ่ายรูปในงาน PM ${ticket} แล้ว — เปลี่ยนสถานะเป็น ${r.data.status} ไม่ได้จนกว่าจะลบรูปในงาน PM`;
      }
    }
  }

  private async writeUpdate(tx: any, r: Planned, userId: number) {
    const before = r.existing;
    await tx.equipment.update({ where: { id: before.id }, data: r.data });
    const oldValue: Record<string, unknown> = {};
    const newValue: Record<string, unknown> = {};
    for (const k of r.changes ?? []) {
      oldValue[k] = valueKey(before[k]);
      newValue[k] = valueKey(r.data[k as keyof Fields]);
    }
    await tx.equipmentLog.create({
      data: {
        equipmentId: before.id,
        action: r.changes?.includes('status') ? EquipmentLogAction.STATUS_CHANGED : EquipmentLogAction.UPDATED,
        source: EquipmentLogSource.IMPORT,
        description: `อัปเดตจากการนำเข้าอุปกรณ์หลายสาขา — ${(r.changes ?? []).join(', ')}`,
        changedBy: userId,
        oldValue,
        newValue,
      },
    });
  }

  private async writeCreate(tx: any, r: Planned, userId: number) {
    const created = await tx.equipment.create({ data: { ...r.data, name: r.name, storeId: r.storeId } });
    await tx.equipmentLog.create({
      data: {
        equipmentId: created.id,
        action: EquipmentLogAction.CREATED,
        source: EquipmentLogSource.IMPORT,
        description: `เพิ่มจากการนำเข้าอุปกรณ์หลายสาขา ที่สาขา ${r.storeCode}`,
        changedBy: userId,
        newValue: { name: r.name, category: r.data.category, serialNumber: r.data.serialNumber, storeId: r.storeId },
      },
    });
  }

  private summarize(rows: Planned[]) {
    const count = (a: BulkDeviceAction) => rows.filter((r) => r.action === a).length;
    return { create: count('create'), update: count('update'), unchanged: count('unchanged'), error: count('error') };
  }

  private publicRow(r: Planned): BulkDeviceRowResult {
    return {
      index: r.index,
      row: r.row,
      storeCode: r.storeCode,
      storeName: r.storeName,
      name: r.name,
      action: r.action,
      ...(r.message ? { message: r.message } : {}),
      ...(r.changes?.length ? { changes: r.changes } : {}),
    };
  }
}

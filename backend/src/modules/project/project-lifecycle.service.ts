// src/modules/project/project-lifecycle.service.ts
// Store Lifecycle v1 (RSM-System/docs/integration/store-lifecycle-v1.md §A3–A4):
// - install tasks: the units RSM issued for the task (+ units the customer sent) — where each one went
// - Closed Store tasks: every unit of the store — where each one went
// On verify (Help Desk accepts the task) the answers are written to the store's Equipment register.
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EquipmentLogAction, EquipmentLogSource, EquipmentSource, EquipmentStatus, Prisma } from '@prisma/client';
import * as fs from 'fs/promises';
import * as path from 'path';
import { PrismaService } from '../../prisma/prisma.service';
import { RsmClientService } from '../integration/rsm-client.service';
import { CLOSE_OUTCOMES, INSTALL_OUTCOMES, workTypeDef } from './work-types';

const CLOSED_TASK_STATUSES = ['ACCEPTED', 'COMPLETED'];
const SOURCES = ['EXISTING', 'RSM', 'CUSTOMER'];

const clean = (v: unknown, max = 200): string | null => {
  if (v === undefined || v === null) return null;
  const t = String(v).trim();
  return t ? t.slice(0, max) : null;
};
const sameSerial = (a?: string | null, b?: string | null) =>
  !!a && !!b && a.trim().toUpperCase() === b.trim().toUpperCase();

export interface InstallItemDto {
  outcome?: string | null;
  pointName?: string | null;
  note?: string | null;
  category?: string | null;
  brand?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  itemName?: string | null;
}
export interface CloseItemDto {
  outcome?: string | null;
  pointName?: string | null;
  category?: string | null;
  brand?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  noSerial?: boolean;
  toStoreId?: number | null;
  handedTo?: string | null;
  shipRef?: string | null;
  note?: string | null;
  source?: string | null;
}

@Injectable()
export class ProjectLifecycleService {
  constructor(private readonly prisma: PrismaService, private readonly rsm: RsmClientService) {}

  // ── Guards ──────────────────────────────────────────────────────────────

  /** The task must be open, checked in and of a work type that has this section kind */
  private async openTask(taskId: number, kind: 'installInventory' | 'closeInventory') {
    const task = await this.prisma.projectTask.findUnique({
      where: { id: taskId },
      include: { projectStore: { select: { storeId: true } } },
    });
    if (!task) throw new NotFoundException(`Task #${taskId} not found`);
    if (CLOSED_TASK_STATUSES.includes(task.status)) throw new BadRequestException('งานนี้ปิดแล้ว — แก้ไขไม่ได้');
    if (task.status === 'PENDING_VERIFY') throw new BadRequestException('งานส่งตรวจแล้ว — แก้ไขไม่ได้จนกว่าจะถูกตีกลับ');
    if (!task.checkInAt) throw new BadRequestException('ต้อง Check-in ก่อนจึงจะบันทึกรายการอุปกรณ์ได้');
    if (!workTypeDef(task.workType).sections.some((s) => s.kind === kind)) {
      throw new BadRequestException('ประเภทงานนี้ไม่มีรายการอุปกรณ์ส่วนนี้');
    }
    return task;
  }

  async taskIdOfItem(kind: 'install' | 'close', id: number) {
    const row =
      kind === 'install'
        ? await this.prisma.projectInstallItem.findUnique({ where: { id }, select: { taskId: true } })
        : await this.prisma.projectCloseItem.findUnique({ where: { id }, select: { taskId: true } });
    if (!row) throw new NotFoundException('ไม่พบรายการ');
    return row.taskId;
  }

  private async removeUpload(relPath?: string | null) {
    if (!relPath || !relPath.startsWith('uploads/')) return;
    await fs.unlink(path.join(process.cwd(), relPath)).catch(() => {});
  }

  // ── Install items (§A3) ─────────────────────────────────────────────────

  /** Pull the units RSM issued for this task (by ticket no.) — adds only what is not in the list yet */
  async importFromRsm(taskId: number) {
    const task = await this.openTask(taskId, 'installInventory');
    if (!task.ticketNo) throw new BadRequestException('งานนี้ยังไม่มีเลขงาน');
    const issues = await this.rsm.issuesFor({ task: task.ticketNo });
    const existing = await this.prisma.projectInstallItem.findMany({ where: { taskId } });

    const rows: Prisma.ProjectInstallItemCreateManyInput[] = [];
    for (const t of issues) {
      for (const l of t.lines) {
        const base = {
          taskId,
          source: EquipmentSource.RSM,
          rsmTicketNo: clean(t.ticketNumber, 50),
          rsmItemCode: clean(l.itemCode, 100),
          itemName: clean(l.itemName),
          category: clean(l.category, 100),
          brand: clean(l.brand, 100),
          model: clean(l.model, 100),
        };
        const serials = (l.serials || []).map((s) => clean(s, 100)).filter(Boolean) as string[];
        for (const sn of serials) {
          const dup = [...existing, ...rows].some((r) => sameSerial(r.serialNumber, sn));
          if (!dup) rows.push({ ...base, serialNumber: sn });
        }
        // Units without serial numbers: one row per unit, up to the quantity issued
        const noSerial = Math.max(0, Math.floor(Number(l.quantity) || 0) - serials.length);
        const have = [...existing, ...rows].filter(
          (r) => !r.serialNumber && r.rsmTicketNo === base.rsmTicketNo && r.rsmItemCode === base.rsmItemCode,
        ).length;
        for (let i = have; i < noSerial; i++) rows.push({ ...base, serialNumber: null });
      }
    }
    if (rows.length) await this.prisma.projectInstallItem.createMany({ data: rows });
    return { tickets: issues.map((t) => t.ticketNumber), added: rows.length };
  }

  /** A unit the customer sent (not from RSM) */
  async addInstallItem(taskId: number, dto: InstallItemDto) {
    await this.openTask(taskId, 'installInventory');
    const category = clean(dto.category, 100);
    if (!category && !clean(dto.itemName)) throw new BadRequestException('กรุณาระบุประเภทอุปกรณ์');
    const serialNumber = clean(dto.serialNumber, 100);
    if (serialNumber) {
      const dup = await this.prisma.projectInstallItem.findFirst({
        where: { taskId, serialNumber: { equals: serialNumber, mode: 'insensitive' } },
      });
      if (dup) throw new BadRequestException(`S/N ${serialNumber} อยู่ในรายการแล้ว`);
    }
    const outcome = dto.outcome ?? 'INSTALLED';
    if (outcome && !(INSTALL_OUTCOMES as readonly string[]).includes(outcome)) throw new BadRequestException('ผลไม่ถูกต้อง');
    return this.prisma.projectInstallItem.create({
      data: {
        taskId,
        source: EquipmentSource.CUSTOMER,
        itemName: clean(dto.itemName),
        category,
        brand: clean(dto.brand, 100),
        model: clean(dto.model, 100),
        serialNumber,
        outcome,
        pointName: clean(dto.pointName, 100),
        note: clean(dto.note, 1000),
      },
    });
  }

  async updateInstallItem(id: number, dto: InstallItemDto) {
    const item = await this.prisma.projectInstallItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('ไม่พบรายการ');
    await this.openTask(item.taskId, 'installInventory');
    if (dto.outcome !== undefined && dto.outcome !== null && !(INSTALL_OUTCOMES as readonly string[]).includes(dto.outcome)) {
      throw new BadRequestException('ผลไม่ถูกต้อง');
    }
    const data: Prisma.ProjectInstallItemUpdateInput = {};
    if (dto.outcome !== undefined) data.outcome = dto.outcome || null;
    if (dto.pointName !== undefined) data.pointName = clean(dto.pointName, 100);
    if (dto.note !== undefined) data.note = clean(dto.note, 1000);
    // What the unit is: editable for customer units; for RSM units only to fill in what RSM left empty
    for (const f of ['category', 'brand', 'model', 'serialNumber'] as const) {
      if (dto[f] === undefined) continue;
      if (item.source === EquipmentSource.RSM && item[f]) continue;
      (data as any)[f] = clean(dto[f], 100);
    }
    return this.prisma.projectInstallItem.update({ where: { id }, data });
  }

  async deleteInstallItem(id: number) {
    const item = await this.prisma.projectInstallItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('ไม่พบรายการ');
    await this.openTask(item.taskId, 'installInventory');
    if (item.source === EquipmentSource.RSM) {
      throw new BadRequestException('ของที่เบิกจาก RSM ลบไม่ได้ — ระบุว่า "ไม่ได้ติดตั้ง" แล้วคืนคลัง');
    }
    await this.prisma.projectInstallItem.delete({ where: { id } });
    await this.removeUpload(item.photoPath);
  }

  async setInstallPhoto(id: number, photoPath: string) {
    const item = await this.prisma.projectInstallItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('ไม่พบรายการ');
    await this.openTask(item.taskId, 'installInventory');
    const updated = await this.prisma.projectInstallItem.update({ where: { id }, data: { photoPath } });
    await this.removeUpload(item.photoPath);
    return updated;
  }

  // ── Closed Store items (§A4) ────────────────────────────────────────────

  /** Copy the store's Equipment into the checklist — adds units not listed yet, never removes answers */
  async loadCloseItems(taskId: number) {
    const task = await this.openTask(taskId, 'closeInventory');
    const [equipment, existing] = await Promise.all([
      this.prisma.equipment.findMany({
        where: { storeId: task.projectStore.storeId, status: { in: [EquipmentStatus.ACTIVE, EquipmentStatus.INACTIVE, EquipmentStatus.MAINTENANCE] } },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.projectCloseItem.findMany({ where: { taskId }, select: { equipmentId: true } }),
    ]);
    const listed = new Set(existing.map((e) => e.equipmentId).filter(Boolean));
    const rows = equipment
      .filter((e) => !listed.has(e.id))
      .map((e) => ({
        taskId,
        equipmentId: e.id,
        pointName: e.name,
        category: e.category,
        brand: e.brand,
        model: e.model,
        serialNumber: e.serialNumber,
        source: e.source,
        rsmTicketNo: e.rsmTicketNo,
        inactive: e.status === EquipmentStatus.INACTIVE,
      }));
    if (rows.length) await this.prisma.projectCloseItem.createMany({ data: rows });
    return { added: rows.length, total: existing.length + rows.length };
  }

  private validateCloseDto(dto: CloseItemDto) {
    if (dto.outcome !== undefined && dto.outcome !== null && !(CLOSE_OUTCOMES as readonly string[]).includes(dto.outcome)) {
      throw new BadRequestException('ปลายทางไม่ถูกต้อง');
    }
    if (dto.source !== undefined && dto.source !== null && !SOURCES.includes(dto.source)) throw new BadRequestException('ที่มาไม่ถูกต้อง');
  }

  private async assertToStore(toStoreId: number | null | undefined, fromStoreId: number) {
    if (!toStoreId) return;
    if (toStoreId === fromStoreId) throw new BadRequestException('สาขาปลายทางต้องไม่ใช่สาขาที่ปิด');
    const s = await this.prisma.store.findUnique({ where: { id: toStoreId }, select: { id: true } });
    if (!s) throw new BadRequestException('ไม่พบสาขาปลายทาง');
  }

  /** A unit found in the store that is not in the list */
  async addCloseItem(taskId: number, dto: CloseItemDto) {
    const task = await this.openTask(taskId, 'closeInventory');
    this.validateCloseDto(dto);
    if (!clean(dto.category, 100) && !clean(dto.pointName, 100)) throw new BadRequestException('กรุณาระบุชื่อจุดหรือประเภทอุปกรณ์');
    await this.assertToStore(dto.toStoreId, task.projectStore.storeId);
    return this.prisma.projectCloseItem.create({
      data: {
        taskId,
        pointName: clean(dto.pointName, 100),
        category: clean(dto.category, 100),
        brand: clean(dto.brand, 100),
        model: clean(dto.model, 100),
        serialNumber: dto.noSerial ? null : clean(dto.serialNumber, 100),
        noSerial: !!dto.noSerial,
        outcome: dto.outcome || null,
        toStoreId: dto.outcome === 'TRANSFERRED' ? dto.toStoreId ?? null : null,
        handedTo: clean(dto.handedTo),
        shipRef: clean(dto.shipRef),
        note: clean(dto.note, 1000),
        source: (dto.source as EquipmentSource) || EquipmentSource.CUSTOMER,
      },
    });
  }

  async updateCloseItem(id: number, dto: CloseItemDto) {
    const item = await this.prisma.projectCloseItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('ไม่พบรายการ');
    const task = await this.openTask(item.taskId, 'closeInventory');
    this.validateCloseDto(dto);
    if (dto.toStoreId !== undefined) await this.assertToStore(dto.toStoreId, task.projectStore.storeId);

    const data: Prisma.ProjectCloseItemUpdateInput = {};
    if (dto.outcome !== undefined) data.outcome = dto.outcome || null;
    for (const f of ['pointName', 'category', 'brand', 'model'] as const) if (dto[f] !== undefined) data[f] = clean(dto[f], 100);
    if (dto.serialNumber !== undefined) data.serialNumber = clean(dto.serialNumber, 100);
    if (dto.noSerial !== undefined) {
      data.noSerial = !!dto.noSerial;
      if (dto.noSerial) data.serialNumber = null;
    }
    if (dto.toStoreId !== undefined) data.toStoreId = dto.toStoreId || null;
    if (dto.handedTo !== undefined) data.handedTo = clean(dto.handedTo);
    if (dto.shipRef !== undefined) data.shipRef = clean(dto.shipRef);
    if (dto.note !== undefined) data.note = clean(dto.note, 1000);
    if (dto.source !== undefined && !item.equipmentId) data.source = (dto.source as EquipmentSource) || EquipmentSource.CUSTOMER;
    // Destination store only matters for TRANSFERRED
    const outcome = dto.outcome !== undefined ? dto.outcome : item.outcome;
    if (outcome !== 'TRANSFERRED') data.toStoreId = null;
    return this.prisma.projectCloseItem.update({ where: { id }, data });
  }

  async deleteCloseItem(id: number) {
    const item = await this.prisma.projectCloseItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('ไม่พบรายการ');
    await this.openTask(item.taskId, 'closeInventory');
    if (item.equipmentId) throw new BadRequestException('อุปกรณ์จากรายการของสาขาลบไม่ได้ — ระบุ "ไม่พบ" แทน');
    await this.prisma.projectCloseItem.delete({ where: { id } });
    await this.removeUpload(item.photoPath);
  }

  async setClosePhoto(id: number, photoPath: string) {
    const item = await this.prisma.projectCloseItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('ไม่พบรายการ');
    await this.openTask(item.taskId, 'closeInventory');
    const updated = await this.prisma.projectCloseItem.update({ where: { id }, data: { photoPath } });
    await this.removeUpload(item.photoPath);
    return updated;
  }

  // ── On verify: write the answers to the Equipment register ─────────────

  /**
   * Install items marked INSTALLED become the store's Equipment (create, or move/update the unit with that S/N).
   * Returns the store ids whose register changed (to refresh open PM checklists).
   */
  async applyInstallItems(tx: Prisma.TransactionClient, taskId: number, storeId: number, userId: number, ref: string) {
    const items = await tx.projectInstallItem.findMany({ where: { taskId, outcome: 'INSTALLED' } });
    const touched = new Set<number>();
    const log = { source: EquipmentLogSource.PROJECT, sourceId: String(taskId), changedBy: userId };
    let created = 0;
    let updated = 0;

    for (const it of items) {
      const name = it.pointName || it.itemName || it.category || 'อุปกรณ์';
      const fields = {
        name,
        category: it.category || it.itemName || 'อุปกรณ์',
        ...(it.brand && { brand: it.brand }),
        ...(it.model && { model: it.model }),
        storeId,
        status: EquipmentStatus.ACTIVE,
        source: it.source,
        rsmTicketNo: it.rsmTicketNo,
        installedByTaskId: taskId,
      };
      const existing = it.serialNumber
        ? await tx.equipment.findFirst({ where: { serialNumber: { equals: it.serialNumber, mode: 'insensitive' } } })
        : null;

      if (existing) {
        await tx.equipment.update({ where: { id: existing.id }, data: fields });
        await tx.equipmentLog.create({
          data: {
            ...log,
            equipmentId: existing.id,
            action: existing.storeId !== storeId ? EquipmentLogAction.TRANSFERRED : EquipmentLogAction.UPDATED,
            description: `ติดตั้งที่จุด "${name}" จากงานโปรเจกต์ ${ref}${it.rsmTicketNo ? ` (ใบเบิก ${it.rsmTicketNo})` : ''}`,
            oldValue: { storeId: existing.storeId, status: existing.status, name: existing.name, brand: existing.brand, model: existing.model },
            newValue: { storeId, status: EquipmentStatus.ACTIVE, name, brand: fields.brand ?? existing.brand, model: fields.model ?? existing.model },
          },
        });
        if (existing.storeId !== storeId) touched.add(existing.storeId);
        await tx.projectInstallItem.update({ where: { id: it.id }, data: { equipmentId: existing.id } });
        updated++;
      } else {
        const eq = await tx.equipment.create({ data: { ...fields, serialNumber: it.serialNumber || null } });
        await tx.equipmentLog.create({
          data: {
            ...log,
            equipmentId: eq.id,
            action: EquipmentLogAction.CREATED,
            description: `ติดตั้งใหม่ที่จุด "${name}" จากงานโปรเจกต์ ${ref}${it.rsmTicketNo ? ` (ใบเบิก ${it.rsmTicketNo})` : it.source === 'CUSTOMER' ? ' (ลูกค้าส่งเอง)' : ''}`,
            newValue: { name, serialNumber: it.serialNumber, brand: it.brand, model: it.model, storeId, source: it.source },
          },
        });
        await tx.projectInstallItem.update({ where: { id: it.id }, data: { equipmentId: eq.id } });
        created++;
      }
    }
    if (created + updated) touched.add(storeId);
    return { created, updated, touched: [...touched] };
  }

  /** Closed Store answers → Equipment status / store (RETIRED, moved, INACTIVE) */
  async applyCloseItems(tx: Prisma.TransactionClient, taskId: number, storeId: number, userId: number, ref: string) {
    const items = await tx.projectCloseItem.findMany({ where: { taskId } });
    const touched = new Set<number>();
    const log = { source: EquipmentLogSource.PROJECT, sourceId: String(taskId), changedBy: userId };
    const LABEL: Record<string, string> = {
      TO_WAREHOUSE: 'เก็บกลับคลัง',
      TO_CUSTOMER: 'ส่งคืนลูกค้าโดยตรง',
      LEFT_WITH_CUSTOMER: 'ลูกค้าเก็บเอง',
      NOT_FOUND: 'ไม่พบ',
    };
    let changed = 0;

    for (const it of items) {
      if (!it.outcome) continue;
      const target =
        it.outcome === 'TRANSFERRED'
          ? { status: EquipmentStatus.ACTIVE, storeId: it.toStoreId! }
          : it.outcome === 'NOT_FOUND'
            ? { status: EquipmentStatus.INACTIVE, storeId }
            : { status: EquipmentStatus.RETIRED, storeId };
      const toStore = it.toStoreId
        ? await tx.store.findUnique({ where: { id: it.toStoreId }, select: { storeCode: true, name: true } })
        : null;
      const what =
        it.outcome === 'TRANSFERRED'
          ? `ย้ายไปสาขา ${toStore ? `${toStore.storeCode} ${toStore.name}` : `#${it.toStoreId}`}`
          : LABEL[it.outcome] + (it.handedTo ? ` (ผู้รับ: ${it.handedTo}${it.shipRef ? `, ${it.shipRef}` : ''})` : '');
      const description = `ปิดร้าน — ${what} จากงานโปรเจกต์ ${ref}${it.note ? ` · ${it.note}` : ''}`;

      // The unit: from the store list, or a unit with the same S/N, or a new record (added by the technician)
      let eq = it.equipmentId ? await tx.equipment.findUnique({ where: { id: it.equipmentId } }) : null;
      if (!eq && it.serialNumber) {
        eq = await tx.equipment.findFirst({ where: { serialNumber: { equals: it.serialNumber, mode: 'insensitive' } } });
      }

      if (eq) {
        const data: Prisma.EquipmentUncheckedUpdateInput = { status: target.status, storeId: target.storeId };
        // Technician confirmed / corrected the real S/N (e.g. a Mockup S/N) — only when no other unit has it
        if (!it.noSerial && it.serialNumber && !sameSerial(it.serialNumber, eq.serialNumber)) {
          const taken = await tx.equipment.findFirst({
            where: { serialNumber: { equals: it.serialNumber, mode: 'insensitive' }, NOT: { id: eq.id } },
            select: { id: true },
          });
          if (!taken) data.serialNumber = it.serialNumber;
        }
        if (it.brand && it.brand !== eq.brand) data.brand = it.brand;
        if (it.model && it.model !== eq.model) data.model = it.model;
        await tx.equipment.update({ where: { id: eq.id }, data });
        await tx.equipmentLog.create({
          data: {
            ...log,
            equipmentId: eq.id,
            action:
              it.outcome === 'TRANSFERRED'
                ? EquipmentLogAction.TRANSFERRED
                : it.outcome === 'NOT_FOUND'
                  ? EquipmentLogAction.STATUS_CHANGED
                  : EquipmentLogAction.RETIRED,
            description,
            oldValue: { status: eq.status, storeId: eq.storeId, serialNumber: eq.serialNumber },
            newValue: { status: target.status, storeId: target.storeId, ...(data.serialNumber ? { serialNumber: data.serialNumber } : {}) },
          },
        });
        if (eq.storeId !== target.storeId) touched.add(eq.storeId);
        if (it.equipmentId !== eq.id) await tx.projectCloseItem.update({ where: { id: it.id }, data: { equipmentId: eq.id } });
      } else {
        const created = await tx.equipment.create({
          data: {
            name: it.pointName || it.category || 'อุปกรณ์',
            category: it.category || it.pointName || 'อุปกรณ์',
            brand: it.brand,
            model: it.model,
            serialNumber: it.noSerial ? null : it.serialNumber,
            status: target.status,
            storeId: target.storeId,
            source: it.source,
            rsmTicketNo: it.rsmTicketNo,
          },
        });
        await tx.equipmentLog.create({
          data: { ...log, equipmentId: created.id, action: EquipmentLogAction.CREATED, description: `${description} (เพิ่มจากหน้างาน — ไม่อยู่ในรายการเดิม)` },
        });
        await tx.projectCloseItem.update({ where: { id: it.id }, data: { equipmentId: created.id } });
      }
      touched.add(target.storeId);
      changed++;
    }
    if (changed) touched.add(storeId);
    return { changed, touched: [...touched] };
  }
}

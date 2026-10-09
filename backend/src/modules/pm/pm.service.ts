import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EquipmentLogAction, EquipmentLogSource, EquipmentStatus, IncidentStatus, AuditModule, AuditAction } from '@prisma/client';
import { UpdatePmEquipmentRecordDto, SignInventoryListDto, AddPmEquipmentDto } from './dto/index';
import { AuditTrailService } from '../audit-trail/audit-trail.service';
import { EquipmentService } from '../../equipment/equipment.service';
import { OPEN_PM_INCIDENT_WHERE } from './pm-sync.helper';
import { EmailService } from '../../email/email.service';
import { SettingsService } from '../../settings/settings.service';
import { saveBase64File, saveBase64Files, deleteUploadFile } from '../../utils/file-storage';

@Injectable()
export class PmService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    private settingsService: SettingsService,
    private auditTrailService: AuditTrailService,
    private equipmentService: EquipmentService,
  ) {}

  // ─── Access rules ─────────────────────────────────────────────────────────
  private readonly ROLE_RANK: Record<string, number> = {
    SUPER_ADMIN: 8, IT_MANAGER: 7, FINANCE_ADMIN: 6,
    SUPERVISOR: 5, HELP_DESK: 4, TECHNICIAN: 3, END_USER: 2, READ_ONLY: 1,
  };

  /** true when the user's highest role is TECHNICIAN */
  private isTechnicianOnly(user: any): boolean {
    const roles: string[] = Array.isArray(user?.roles) ? user.roles : (user?.role ? [user.role] : []);
    if (roles.length === 0) return false;
    const highest = roles.reduce((best, r) => ((this.ROLE_RANK[r] ?? 0) > (this.ROLE_RANK[best] ?? 0) ? r : best));
    return highest === 'TECHNICIAN';
  }

  private async isAssigned(incidentId: string, userId: number): Promise<boolean> {
    const inc = await this.prisma.incident.findUnique({
      where: { id: incidentId },
      select: { assigneeId: true, assignees: { select: { userId: true } } },
    });
    return !!inc && (inc.assigneeId === userId || inc.assignees.some((a) => a.userId === userId));
  }

  /**
   * Who may edit PM data:
   * - nobody once the incident is CLOSED / CANCELLED
   * - Technician: only the currently assigned technician, and only before tech-confirm
   * - Helpdesk / Supervisor / IT Manager / Super Admin: any time before CLOSED
   */
  private async assertCanEditPm(incidentId: string, user: any) {
    const inc = await this.prisma.incident.findUnique({
      where: { id: incidentId },
      select: { status: true, techConfirmedAt: true },
    });
    if (!inc) throw new NotFoundException('ไม่พบ Incident');
    if (inc.status === IncidentStatus.CLOSED || inc.status === IncidentStatus.CANCELLED) {
      throw new BadRequestException('งานนี้ปิดหรือยกเลิกแล้ว ไม่สามารถแก้ไขข้อมูล PM ได้');
    }
    if (this.isTechnicianOnly(user)) {
      if (!(await this.isAssigned(incidentId, user.id))) {
        throw new ForbiddenException('เฉพาะช่างที่ได้รับมอบหมายล่าสุดเท่านั้นที่แก้ไขข้อมูล PM ได้');
      }
      if (inc.techConfirmedAt) {
        throw new BadRequestException('ยืนยันปิดงานแล้ว ไม่สามารถแก้ไขข้อมูล PM ได้');
      }
    }
  }

  /** Equipment list can change only while the PM job is still open (before resolve) */
  private async assertPmOpen(incidentId: string) {
    const open = await this.prisma.incident.findFirst({
      where: { id: incidentId, ...OPEN_PM_INCIDENT_WHERE },
      select: { id: true },
    });
    if (!open) {
      throw new BadRequestException('เพิ่ม/ลบอุปกรณ์ได้เฉพาะงาน PM ที่ยังไม่ยืนยันปิดงาน');
    }
  }

  private async logPmAudit(incidentId: string, userId: number, description: string, extra?: { oldValue?: any; newValue?: any }) {
    try {
      await this.auditTrailService.logDirect({
        module: AuditModule.INCIDENT,
        action: AuditAction.UPDATE,
        entityType: 'PmRecord',
        entityId: incidentId,
        userId,
        description,
        ...(extra ?? {}),
      });
    } catch (_) {}
  }

  /**
   * Create PmRecord and PmEquipmentRecord rows for all ACTIVE/MAINTENANCE equipment in the store.
   * Called automatically when an Incident with jobType='Preventive Maintenance' is created.
   */
  async createPmRecord(incidentId: string, storeId: number) {
    const equipmentList = await this.prisma.equipment.findMany({
      where: {
        storeId,
        status: { in: [EquipmentStatus.ACTIVE, EquipmentStatus.MAINTENANCE] },
      },
      select: { id: true },
      orderBy: { id: 'asc' },
    });

    return this.prisma.pmRecord.create({
      data: {
        incidentId,
        storeId,
        equipmentRecords: {
          create: equipmentList.map((eq) => ({ equipmentId: eq.id })),
        },
      },
      include: {
        equipmentRecords: {
          include: { equipment: true },
        },
      },
    });
  }

  /**
   * Pre-creation check for a PM request at a given store.
   * Returns:
   *   - openPmIncident: existing PM incident that is not yet CLOSED/CANCELLED
   *   - isWithin6Months: true if lastPmAt is less than 6 months ago
   *   - lastPmAt: the store's last PM date
   *   - storeCode / storeName: for display in the warning message
   */
  async checkStoreBeforePm(storeId: number) {
    const [openPm, store] = await Promise.all([
      this.prisma.incident.findFirst({
        where: {
          storeId,
          jobType: 'Preventive Maintenance',
          status: { notIn: ['CLOSED', 'CANCELLED'] },
        },
        select: { id: true, ticketNumber: true, title: true, status: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.store.findUnique({
        where: { id: storeId },
        select: { lastPmAt: true, storeCode: true, name: true },
      }),
    ]);

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    return {
      openPmIncident: openPm ?? null,
      lastPmAt: store?.lastPmAt ?? null,
      isWithin6Months: store?.lastPmAt ? store.lastPmAt > sixMonthsAgo : false,
      storeCode: store?.storeCode ?? '',
      storeName: store?.name ?? '',
    };
  }

  /**
   * Get PM record for an incident (includes all equipment records).
   */
  async getPmRecord(incidentId: string, lite = false) {
    const record = await this.prisma.pmRecord.findUnique({
      where: { incidentId },
      include: {
        store: { select: { id: true, storeCode: true, name: true, province: true, address: true } },
        equipmentRecords: {
          include: {
            equipment: {
              select: {
                id: true,
                name: true,
                category: true,
                brand: true,
                model: true,
                serialNumber: true,
                status: true,
                updatedAt: true,
              },
            },
          },
          orderBy: { equipmentId: 'asc' },
        },
      },
    });

    if (!record) throw new NotFoundException('ไม่พบ PM Record สำหรับ Incident นี้');

    // Find conflicting EquipmentLog entries (source=INCIDENT, newer than PM equipment record)
    const recMap = new Map(record.equipmentRecords.map((r) => [r.equipmentId, r.updatedAt]));
    const equipmentIds = record.equipmentRecords.map((r) => r.equipmentId);

    const conflictLogs = await this.prisma.equipmentLog.findMany({
      where: {
        equipmentId: { in: equipmentIds },
        source: EquipmentLogSource.INCIDENT,
      },
      orderBy: { createdAt: 'desc' },
      select: { equipmentId: true, sourceId: true, createdAt: true },
    });

    // For each equipment, find the latest INCIDENT log newer than PM record's updatedAt
    const conflictMap = new Map<number, string>(); // equipmentId → incident UUID
    for (const log of conflictLogs) {
      if (conflictMap.has(log.equipmentId)) continue; // already have latest
      const pmUpdatedAt = recMap.get(log.equipmentId);
      if (pmUpdatedAt && log.createdAt > pmUpdatedAt && log.sourceId) {
        conflictMap.set(log.equipmentId, log.sourceId);
      }
    }

    // Resolve incident UUIDs → ticketNumbers for user-friendly display
    const conflictIncidentIds = [...new Set([...conflictMap.values()])];
    const conflictTicketMap = new Map<string, string>(); // UUID → ticketNumber
    if (conflictIncidentIds.length > 0) {
      const conflictIncidents = await this.prisma.incident.findMany({
        where: { id: { in: conflictIncidentIds } },
        select: { id: true, ticketNumber: true },
      });
      for (const inc of conflictIncidents) {
        conflictTicketMap.set(inc.id, inc.ticketNumber ?? inc.id);
      }
    }

    // Fetch assigned technician from incident (primary assignee → fallback to PM submitter)
    const incident = await this.prisma.incident.findUnique({
      where: { id: incidentId },
      select: {
        assignee: { select: { id: true, firstName: true, lastName: true, firstNameEn: true, lastNameEn: true, signaturePath: true } },
      },
    });
    const technician = incident?.assignee
      ?? (record.technicianId
        ? await this.prisma.user.findUnique({
            where: { id: record.technicianId },
            select: { id: true, firstName: true, lastName: true, firstNameEn: true, lastNameEn: true, signaturePath: true },
          })
        : null);

    // Parse signedInventoryPhoto (stored as JSON string array) → string[]
    const parseSignedPhotos = (raw: string | null): string[] => {
      if (!raw) return [];
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [raw];
      } catch {
        return [raw]; // legacy single base64 string
      }
    };

    // Attach conflictIncidentId + photo counts.
    // lite (web): strip photo data — lazy-loaded per card. Default (mobile app): include photos.
    // Flat equipmentName/equipmentType/brand/model/serialNumber are for the mobile app.
    const enriched = {
      ...record,
      technician,
      signedInventoryPhotos: parseSignedPhotos(record.signedInventoryPhoto),
      signedInventoryPhoto: undefined, // replaced by signedInventoryPhotos array
      equipmentRecords: record.equipmentRecords.map((r) => ({
        ...r,
        equipmentName: r.equipment?.name,
        equipmentType: r.equipment?.category,
        brand: r.equipment?.brand,
        model: r.equipment?.model,
        serialNumber: r.equipment?.serialNumber,
        beforePhotoCount: r.beforePhotos.length,
        afterPhotoCount: r.afterPhotos.length,
        beforePhotos: lite ? [] : r.beforePhotos,
        afterPhotos: lite ? [] : r.afterPhotos,
        conflictIncidentId: conflictMap.has(r.equipmentId)
          ? (conflictTicketMap.get(conflictMap.get(r.equipmentId)!) ?? conflictMap.get(r.equipmentId)!)
          : null,
      })),
    };

    return enriched;
  }

  /**
   * Check which equipment records in this PM have updatedSerial that conflicts with another equipment.
   */
  async getSerialConflicts(incidentId: string) {
    const record = await this.prisma.pmRecord.findUnique({
      where: { incidentId },
      include: {
        equipmentRecords: {
          where: { updatedSerial: { not: null } },
          include: { equipment: { select: { id: true, name: true, serialNumber: true } } },
        },
      },
    });
    if (!record) return [];

    const conflicts: { equipmentId: number; name: string; updatedSerial: string; conflictWith: string }[] = [];
    for (const rec of record.equipmentRecords) {
      if (!rec.updatedSerial || rec.updatedSerial === rec.equipment.serialNumber) continue;
      const conflict = await this.prisma.equipment.findFirst({
        where: { serialNumber: rec.updatedSerial, id: { not: rec.equipmentId } },
        select: { id: true, name: true },
      });
      if (conflict) {
        conflicts.push({
          equipmentId: rec.equipmentId,
          name: rec.equipment.name,
          updatedSerial: rec.updatedSerial,
          conflictWith: conflict.name,
        });
      }
    }
    return conflicts;
  }

  /**
   * Get a single PmEquipmentRecord with full photo data (used for lazy loading).
   */
  async getEquipmentRecord(recordId: number) {
    const record = await this.prisma.pmEquipmentRecord.findUnique({
      where: { id: recordId },
      include: {
        equipment: {
          select: {
            id: true, name: true, category: true, brand: true,
            model: true, serialNumber: true, updatedAt: true,
          },
        },
      },
    });
    if (!record) throw new NotFoundException(`ไม่พบ PM Equipment Record ID ${recordId}`);
    return record;
  }

  /**
   * Update a single PmEquipmentRecord (before/after photos, comment, condition, brand/model/serial).
   * Photos are APPENDED to existing arrays (not replaced).
   */
  async updateEquipmentRecord(recordId: number, dto: UpdatePmEquipmentRecordDto, user: any) {
    const existing = await this.prisma.pmEquipmentRecord.findUnique({
      where: { id: recordId },
      include: {
        equipment: { select: { name: true, serialNumber: true } },
        pmRecord: { select: { incidentId: true, incident: { select: { ticketNumber: true } } } },
      },
    });
    if (!existing) throw new NotFoundException(`ไม่พบ PM Equipment Record ID ${recordId}`);
    const incidentId = existing.pmRecord.incidentId;
    await this.assertCanEditPm(incidentId, user);

    const data: any = {};
    const subDir = `pm/equipment/${recordId}`;

    if (dto.setBeforePhotos !== undefined) {
      data.beforePhotos = dto.setBeforePhotos;
    } else if (dto.beforePhotos?.length) {
      const base64Before = dto.beforePhotos.filter((p) => p.startsWith('data:'));
      const savedBefore = base64Before.length > 0 ? await saveBase64Files(base64Before, subDir) : [];
      const qBefore = [...savedBefore];
      const paths = dto.beforePhotos.map((p) => (p.startsWith('data:') ? qBefore.shift()! : p));
      // Mobile app re-sends photos it already has → append only new paths
      const current = existing.beforePhotos ?? [];
      data.beforePhotos = [...current, ...paths.filter((p) => !current.includes(p))];
    }
    if (dto.removeBeforePhotos?.length) {
      data.beforePhotos = (data.beforePhotos ?? existing.beforePhotos ?? []).filter((p: string) => !dto.removeBeforePhotos!.includes(p));
    }
    if (dto.setAfterPhotos !== undefined) {
      data.afterPhotos = dto.setAfterPhotos;
    } else if (dto.afterPhotos?.length) {
      const base64After = dto.afterPhotos.filter((p) => p.startsWith('data:'));
      const savedAfter = base64After.length > 0 ? await saveBase64Files(base64After, subDir) : [];
      const qAfter = [...savedAfter];
      const paths = dto.afterPhotos.map((p) => (p.startsWith('data:') ? qAfter.shift()! : p));
      const current = existing.afterPhotos ?? [];
      data.afterPhotos = [...current, ...paths.filter((p) => !current.includes(p))];
    }
    if (dto.removeAfterPhotos?.length) {
      data.afterPhotos = (data.afterPhotos ?? existing.afterPhotos ?? []).filter((p: string) => !dto.removeAfterPhotos!.includes(p));
    }
    if (dto.comment !== undefined) data.comment = dto.comment;
    if (dto.condition !== undefined) data.condition = dto.condition;
    if (dto.updatedBrand !== undefined) data.updatedBrand = dto.updatedBrand;
    if (dto.updatedModel !== undefined) data.updatedModel = dto.updatedModel;
    if (dto.updatedSerial !== undefined) data.updatedSerial = dto.updatedSerial;

    // Audit: record edits made by anyone other than the assigned technician (Helpdesk / Supervisor / Manager)
    if (!this.isTechnicianOnly(user)) {
      const changes: string[] = [];
      const diff = (a: string[] = [], b: string[] = []) => ({ added: b.filter((x) => !a.includes(x)).length, removed: a.filter((x) => !b.includes(x)).length });
      if (data.beforePhotos) {
        const d = diff(existing.beforePhotos, data.beforePhotos);
        if (d.added) changes.push(`เพิ่มรูปก่อน PM ${d.added} รูป`);
        if (d.removed) changes.push(`ลบรูปก่อน PM ${d.removed} รูป`);
      }
      if (data.afterPhotos) {
        const d = diff(existing.afterPhotos, data.afterPhotos);
        if (d.added) changes.push(`เพิ่มรูปหลัง PM ${d.added} รูป`);
        if (d.removed) changes.push(`ลบรูปหลัง PM ${d.removed} รูป`);
      }
      for (const [k, label] of [['condition', 'สภาพ'], ['comment', 'Comment'], ['updatedBrand', 'Brand'], ['updatedModel', 'Model'], ['updatedSerial', 'Serial']] as const) {
        if (data[k] !== undefined && data[k] !== (existing as any)[k]) changes.push(`${label}: ${(existing as any)[k] ?? '-'} → ${data[k] || '-'}`);
      }
      if (changes.length > 0) {
        await this.logPmAudit(
          incidentId, user.id,
          `แก้ไข PM ${existing.pmRecord.incident?.ticketNumber ?? ''} — ${existing.equipment?.name ?? ''} (S/N ${existing.equipment?.serialNumber ?? '-'}): ${changes.join(', ')}`,
        );
      }
    }

    return this.prisma.pmEquipmentRecord.update({
      where: { id: recordId },
      data,
      include: {
        equipment: {
          select: { id: true, name: true, category: true, brand: true, model: true, serialNumber: true, updatedAt: true },
        },
      },
    });
  }

  /**
   * Submit PM — finalize the PM record.
   * Validates all equipment have before+after photos.
   * Applies brand/model/serial updates to Equipment table.
   * Updates Store.lastPmAt and PmRecord.performedAt + technicianId.
   */
  async submitPm(incidentId: string, userId: number) {
    if (!(await this.isAssigned(incidentId, userId))) {
      throw new ForbiddenException('เฉพาะช่างที่ได้รับมอบหมายล่าสุดเท่านั้นที่ Submit PM ได้');
    }
    const pmRecord = await this.prisma.pmRecord.findUnique({
      where: { incidentId },
      include: { equipmentRecords: true },
    });
    if (!pmRecord) throw new NotFoundException('ไม่พบ PM Record');

    // Validate all equipment records have at least 1 before + 1 after photo
    const incomplete = pmRecord.equipmentRecords.filter(
      (r) => r.beforePhotos.length === 0 || r.afterPhotos.length === 0,
    );
    if (incomplete.length > 0) {
      throw new BadRequestException(
        `อุปกรณ์ ${incomplete.length} รายการยังไม่มีรูปถ่าย (ต้องมีรูปก่อน PM และหลัง PM อย่างน้อย 1 รูป)`,
      );
    }

    const now = new Date();

    // Fetch current equipment data (brand/model/serial/status/updatedAt) for oldValue comparison
    const equipmentIds = pmRecord.equipmentRecords.map((r) => r.equipmentId);
    const currentEquipments = await this.prisma.equipment.findMany({
      where: { id: { in: equipmentIds } },
      select: { id: true, brand: true, model: true, serialNumber: true, status: true, imagePath: true, updatedAt: true },
    });
    const equipmentMap = new Map(currentEquipments.map((e) => [e.id, e]));
    const skippedEquipment: string[] = [];

    await this.prisma.$transaction(async (tx) => {
      // Update PmRecord
      await tx.pmRecord.update({
        where: { id: pmRecord.id },
        data: { performedAt: now, technicianId: userId },
      });

      // Update Store.lastPmAt
      await tx.store.update({
        where: { id: pmRecord.storeId },
        data: { lastPmAt: now },
      });

      // Apply equipment updates per record
      skippedEquipment.push(...(await this.applyPmToEquipment(tx, pmRecord.equipmentRecords, equipmentMap, incidentId, userId)));
    });

    return { success: true, performedAt: now, skippedEquipmentIds: skippedEquipment };
  }

  /**
   * Push PM results (brand/model/serial, condition → status, first after photo) to Equipment.
   * Idempotent: only fields that actually differ are written / logged, so it can run at
   * Submit PM and again at Confirm Close (to pick up edits made after submit).
   * Returns equipment ids skipped because Equipment was edited more recently than the PM row.
   */
  private async applyPmToEquipment(
    tx: any,
    records: any[],
    equipmentMap: Map<number, any>,
    incidentId: string,
    userId: number,
  ): Promise<string[]> {
    const skipped: string[] = [];
    for (const rec of records) {
      const current = equipmentMap.get(rec.equipmentId);
      if (!current) continue;

      const updateData: any = {};
      const changes: string[] = [];

      // Brand / Model / Serial — skip if Equipment was edited after this PM row (conflict protection)
      const brandChanged = !!rec.updatedBrand && rec.updatedBrand !== current.brand;
      const modelChanged = !!rec.updatedModel && rec.updatedModel !== current.model;
      const serialChanged = !!rec.updatedSerial && rec.updatedSerial !== current.serialNumber;
      if ((brandChanged || modelChanged || serialChanged) && current.updatedAt > rec.updatedAt) {
        skipped.push(rec.equipmentId.toString());
      } else {
        if (brandChanged) { updateData.brand = rec.updatedBrand; changes.push(`Brand: ${current.brand} → ${rec.updatedBrand}`); }
        if (modelChanged) { updateData.model = rec.updatedModel; changes.push(`Model: ${current.model} → ${rec.updatedModel}`); }
        if (serialChanged) {
          const serialConflict = await tx.equipment.findFirst({
            where: { serialNumber: rec.updatedSerial, id: { not: rec.equipmentId } },
            select: { id: true },
          });
          if (!serialConflict) {
            updateData.serialNumber = rec.updatedSerial;
            changes.push(`Serial: ${current.serialNumber} → ${rec.updatedSerial}`);
          }
        }
      }

      // Condition → Equipment.status
      let newStatus: EquipmentStatus | null = null;
      if (rec.condition === 'REPLACED' && current.status !== EquipmentStatus.RETIRED) {
        newStatus = EquipmentStatus.RETIRED;
        changes.push(`Status: ${current.status} → RETIRED (เปลี่ยนอุปกรณ์แล้ว)`);
      } else if (rec.condition === 'NEEDS_REPAIR' && current.status === EquipmentStatus.ACTIVE) {
        newStatus = EquipmentStatus.MAINTENANCE;
        changes.push(`Status: ${current.status} → MAINTENANCE (ต้องซ่อม)`);
      } else if (rec.condition === 'GOOD' && current.status === EquipmentStatus.MAINTENANCE) {
        newStatus = EquipmentStatus.ACTIVE;
        changes.push(`Status: MAINTENANCE → ACTIVE (ผ่านการตรวจสอบ)`);
      }
      if (newStatus) updateData.status = newStatus;

      // Equipment picture = first after-PM photo (same one shown in Inventory List)
      if (rec.afterPhotos && rec.afterPhotos.length > 0) {
        const firstPhoto: string = rec.afterPhotos[0];
        const imagePath = firstPhoto.startsWith('/uploads/') ? firstPhoto : `/uploads/${firstPhoto}`;
        if (imagePath !== current.imagePath) {
          updateData.imagePath = imagePath;
          changes.push('รูปอุปกรณ์อัพเดตจาก PM');
        }
      }

      if (Object.keys(updateData).length === 0) continue;

      await tx.equipment.update({ where: { id: rec.equipmentId }, data: updateData });

      const action = newStatus && Object.keys(updateData).length === 1
        ? EquipmentLogAction.STATUS_CHANGED
        : EquipmentLogAction.UPDATED;

      await tx.equipmentLog.create({
        data: {
          equipmentId: rec.equipmentId,
          action,
          source: EquipmentLogSource.PM,
          sourceId: incidentId,
          description: `PM: ${changes.join(', ')}`,
          changedBy: userId,
          oldValue: { brand: current.brand, model: current.model, serialNumber: current.serialNumber, status: current.status, imagePath: current.imagePath },
          newValue: {
            brand: updateData.brand ?? current.brand,
            model: updateData.model ?? current.model,
            serialNumber: updateData.serialNumber ?? current.serialNumber,
            status: updateData.status ?? current.status,
            imagePath: updateData.imagePath ?? current.imagePath,
          },
        },
      });
    }
    return skipped;
  }

  /**
   * Called on Confirm Close: re-apply PM data to Equipment so edits made after Submit PM
   * (e.g. by Helpdesk / Supervisor during review) reach the Equipment master.
   */
  async syncPmToEquipmentOnClose(incidentId: string, userId: number) {
    const pmRecord = await this.prisma.pmRecord.findUnique({
      where: { incidentId },
      include: { equipmentRecords: true },
    });
    if (!pmRecord) return;
    const currentEquipments = await this.prisma.equipment.findMany({
      where: { id: { in: pmRecord.equipmentRecords.map((r) => r.equipmentId) } },
      select: { id: true, brand: true, model: true, serialNumber: true, status: true, imagePath: true, updatedAt: true },
    });
    const equipmentMap = new Map(currentEquipments.map((e) => [e.id, e]));
    await this.prisma.$transaction(async (tx) => {
      await this.applyPmToEquipment(tx, pmRecord.equipmentRecords, equipmentMap, incidentId, userId);
    });
  }

  /**
   * Send PM completion email to configured recipients.
   */
  async sendPmCompletionEmail(
    incidentId: string,
    performedAt: Date,
    technicianId: number,
    equipmentRecords: any[],
  ) {
    // Fetch incident + store + technician
    const incident = await this.prisma.incident.findUnique({
      where: { id: incidentId },
      select: {
        ticketNumber: true,
        title: true,
        store: { select: { storeCode: true, name: true } },
      },
    });
    if (!incident) return;

    const technician = await this.prisma.user.findUnique({
      where: { id: technicianId },
      select: { firstName: true, lastName: true },
    });

    // Fetch pmRecord for inventoryListToken — auto-generate if not exists
    let pmRecord = await this.prisma.pmRecord.findUnique({
      where: { incidentId },
      select: { inventoryListToken: true, inventoryListTokenExpiresAt: true },
    });
    if (pmRecord && !pmRecord.inventoryListToken) {
      const { randomUUID } = await import('crypto');
      const token = randomUUID();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);
      await this.prisma.pmRecord.update({
        where: { incidentId },
        data: { inventoryListToken: token, inventoryListTokenExpiresAt: expiresAt },
      });
      pmRecord = { inventoryListToken: token, inventoryListTokenExpiresAt: expiresAt };
    }

    // Fetch equipment details for each record
    const equipIds = equipmentRecords.map((r) => r.equipmentId);
    const equipments = await this.prisma.equipment.findMany({
      where: { id: { in: equipIds } },
      select: { id: true, name: true, category: true, brand: true, model: true, serialNumber: true },
    });
    const equipMap = new Map(equipments.map((e) => [e.id, e]));

    const emailEquipmentRecords = equipmentRecords.map((r) => {
      const eq = equipMap.get(r.equipmentId);
      return {
        equipmentName: eq?.name || '-',
        category: eq?.category || '-',
        brand: eq?.brand,
        model: eq?.model,
        serialNumber: eq?.serialNumber || '-',
        condition: r.condition,
        comment: r.comment,
        updatedBrand: r.updatedBrand,
        updatedModel: r.updatedModel,
        updatedSerial: r.updatedSerial,
        afterPhotos: r.afterPhotos || [],
      };
    });

    // Get email settings
    const emailSettings = await this.settingsService.getEmailSettings();
    const toEmail = emailSettings.closeNotificationTo;
    console.log(`[PM Email] incidentId=${incidentId} toEmail="${toEmail}" cc="${emailSettings.closeNotificationCc || ''}"`);
    if (!toEmail) {
      console.warn('[PM Email] closeNotificationTo is empty — email skipped');
      return;
    }

    const ccEmails = emailSettings.closeNotificationCc
      ? emailSettings.closeNotificationCc.split(',').map((e: string) => e.trim()).filter(Boolean)
      : [];

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const pmReportLink = pmRecord?.inventoryListToken
      ? `${frontendUrl}/pm-report/${pmRecord.inventoryListToken}`
      : null;
    const inventoryListLink = pmRecord?.inventoryListToken
      ? `${frontendUrl}/inventory-list/${pmRecord.inventoryListToken}`
      : null;

    await this.emailService.sendPmCompletedEmail({
      to: toEmail,
      cc: ccEmails,
      incidentId,
      ticketNumber: incident.ticketNumber,
      incidentTitle: incident.title || '',
      storeName: incident.store?.name || '-',
      storeCode: incident.store?.storeCode,
      technicianName: technician
        ? `${technician.firstName} ${technician.lastName}`
        : '-',
      performedAt,
      totalEquipment: equipmentRecords.length,
      equipmentRecords: emailEquipmentRecords,
      pmReportLink,
      inventoryListLink,
    });
  }

  /**
   * Generate a public token for online inventory list signing.
   * Token expires in 30 days.
   */
  async createInventoryListToken(incidentId: string) {
    const pmRecord = await this.prisma.pmRecord.findUnique({
      where: { incidentId },
    });
    if (!pmRecord) throw new NotFoundException('ไม่พบ PM Record');

    const { randomUUID } = await import('crypto');
    const token = randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await this.prisma.pmRecord.update({
      where: { id: pmRecord.id },
      data: {
        inventoryListToken: token,
        inventoryListTokenExpiresAt: expiresAt,
      },
    });

    return { token, expiresAt };
  }

  /**
   * Get PM record by public token (for the signing page — no auth required).
   */
  async getByToken(token: string) {
    const record = await this.prisma.pmRecord.findUnique({
      where: { inventoryListToken: token },
      include: {
        store: { select: { id: true, storeCode: true, name: true, province: true, address: true } },
        equipmentRecords: {
          include: {
            equipment: {
              select: {
                id: true,
                name: true,
                category: true,
                brand: true,
                model: true,
                serialNumber: true,
              },
            },
          },
          orderBy: { equipmentId: 'asc' },
        },
      },
    });

    if (!record) throw new NotFoundException('ไม่พบเอกสาร หรือลิงก์ไม่ถูกต้อง');
    if (record.inventoryListTokenExpiresAt && record.inventoryListTokenExpiresAt < new Date()) {
      throw new BadRequestException('ลิงก์หมดอายุแล้ว กรุณาขอลิงก์ใหม่จากช่างเทคนิค');
    }

    return record;
  }

  /**
   * Get full PM Report data by public token (no auth required).
   * Reuses inventoryListToken.
   */
  async getPmReportByToken(token: string) {
    const record = await this.prisma.pmRecord.findUnique({
      where: { inventoryListToken: token },
      include: {
        store: { select: { id: true, storeCode: true, name: true, province: true, address: true } },
        equipmentRecords: {
          include: {
            equipment: {
              select: { id: true, name: true, category: true, brand: true, model: true, serialNumber: true },
            },
          },
          orderBy: { equipmentId: 'asc' },
        },
      },
    });

    if (!record) throw new NotFoundException('ไม่พบรายงาน หรือลิงก์ไม่ถูกต้อง');
    if (record.inventoryListTokenExpiresAt && record.inventoryListTokenExpiresAt < new Date()) {
      throw new BadRequestException('ลิงก์หมดอายุแล้ว');
    }

    // Fetch technician separately
    const technician = record.technicianId
      ? await this.prisma.user.findUnique({
          where: { id: record.technicianId },
          select: { id: true, firstName: true, lastName: true, signaturePath: true },
        })
      : null;

    // Fetch incident details
    const incident = await this.prisma.incident.findUnique({
      where: { id: record.incidentId },
      select: { ticketNumber: true, title: true, resolutionNote: true, resolvedAt: true },
    });

    return { ...record, technician, incident };
  }

  /**
   * Submit online signature for the inventory list.
   */
  async signInventoryList(token: string, dto: SignInventoryListDto) {
    const record = await this.getByToken(token);

    // Already signed → a new signature replaces the old one ("เซ็นใหม่")
    const sigPath = await saveBase64File(
      dto.signature,
      'signatures',
      `pm_store_${record.id}_${Date.now()}`,
    );

    return this.prisma.pmRecord.update({
      where: { id: record.id },
      data: {
        storeSignature: sigPath,
        storeSignerName: dto.signerName,
        storeSignedAt: new Date(),
      },
    });
  }

  /**
   * Upload a photo of the signed paper inventory list (alternative to online sign).
   */
  async uploadSignedInventory(incidentId: string, photo: string) {
    const row = await this.prisma.pmRecord.findUnique({
      where: { incidentId },
      select: { id: true, signedInventoryPhoto: true },
    });
    if (!row) throw new NotFoundException('ไม่พบ PM Record');

    // Parse existing photos (JSON array of paths)
    let photos: string[] = [];
    if (row.signedInventoryPhoto) {
      try {
        const parsed = JSON.parse(row.signedInventoryPhoto);
        photos = Array.isArray(parsed) ? parsed : [row.signedInventoryPhoto];
      } catch {
        photos = [row.signedInventoryPhoto];
      }
    }
    if (photos.length >= 5) throw new BadRequestException('อัพโหลดได้สูงสุด 5 รูป');

    // Save photo as file if base64
    const photoPath = photo.startsWith('data:')
      ? await saveBase64File(photo, `pm/signed/${row.id}`, `${Date.now()}`)
      : photo;

    photos.push(photoPath);
    await this.prisma.pmRecord.update({
      where: { id: row.id },
      data: { signedInventoryPhoto: JSON.stringify(photos) },
    });
    return { success: true };
  }

  /**
   * Helpdesk / Supervisor adds a piece of equipment to the store from the PM page.
   * Creates the Equipment (ACTIVE, this store) — the open-PM sync adds it to the checklist.
   */
  async addEquipmentToPm(incidentId: string, dto: AddPmEquipmentDto, user: any) {
    await this.assertPmOpen(incidentId);
    const pm = await this.prisma.pmRecord.findUnique({
      where: { incidentId },
      select: { storeId: true, incident: { select: { ticketNumber: true } } },
    });
    if (!pm) throw new NotFoundException('ไม่พบ PM Record');

    const equipment = await this.equipmentService.create(
      {
        name: dto.name.trim(),
        category: dto.category.trim(),
        serialNumber: dto.serialNumber.trim(),
        brand: dto.brand?.trim() || undefined,
        model: dto.model?.trim() || undefined,
        storeId: pm.storeId,
        status: EquipmentStatus.ACTIVE,
      } as any,
      user.id,
    );

    await this.logPmAudit(
      incidentId, user.id,
      `เพิ่มอุปกรณ์ "${equipment.name}" (S/N ${equipment.serialNumber}) เข้าร้านจากงาน PM ${pm.incident?.ticketNumber ?? ''}`,
    );
    return this.getPmRecord(incidentId, true);
  }

  /**
   * Remove equipment from the store via the PM page.
   * Blocked when the item already has photos (delete photos first).
   * The Equipment becomes INACTIVE (history kept) — the open-PM sync drops it from the checklist.
   */
  async removeEquipmentFromPm(recordId: number, user: any) {
    const rec = await this.prisma.pmEquipmentRecord.findUnique({
      where: { id: recordId },
      include: {
        equipment: { select: { id: true, name: true, serialNumber: true, status: true } },
        pmRecord: { select: { incidentId: true, incident: { select: { ticketNumber: true } } } },
      },
    });
    if (!rec) throw new NotFoundException(`ไม่พบ PM Equipment Record ID ${recordId}`);
    const incidentId = rec.pmRecord.incidentId;
    await this.assertPmOpen(incidentId);

    if (rec.beforePhotos.length > 0 || rec.afterPhotos.length > 0) {
      throw new BadRequestException('อุปกรณ์นี้ถ่ายรูปแล้ว — ต้องลบรูปให้หมดก่อน จึงจะนำอุปกรณ์ออกได้');
    }

    if (rec.equipment.status === EquipmentStatus.ACTIVE || rec.equipment.status === EquipmentStatus.MAINTENANCE) {
      // Goes through EquipmentService → equipment log + audit + open-PM sync
      await this.equipmentService.update(rec.equipment.id, { status: EquipmentStatus.INACTIVE } as any, user.id);
    }
    // Make sure the checklist row is gone even if the equipment was already inactive
    await this.prisma.pmEquipmentRecord.deleteMany({ where: { id: recordId } });

    await this.logPmAudit(
      incidentId, user.id,
      `นำอุปกรณ์ "${rec.equipment.name}" (S/N ${rec.equipment.serialNumber}) ออกจากร้าน (Inactive) จากงาน PM ${rec.pmRecord.incident?.ticketNumber ?? ''}`,
    );
    return this.getPmRecord(incidentId, true);
  }

  async deleteSignedInventory(incidentId: string, photoIndex?: number) {
    const row = await this.prisma.pmRecord.findUnique({
      where: { incidentId },
      select: { id: true, signedInventoryPhoto: true },
    });
    if (!row) throw new NotFoundException('ไม่พบ PM Record');

    if (photoIndex !== undefined && row.signedInventoryPhoto) {
      let photos: string[] = [];
      try {
        const parsed = JSON.parse(row.signedInventoryPhoto);
        photos = Array.isArray(parsed) ? parsed : [row.signedInventoryPhoto];
      } catch {
        photos = [row.signedInventoryPhoto];
      }
      const deleted = photos.splice(photoIndex, 1);
      if (deleted[0] && !deleted[0].startsWith('data:')) {
        await deleteUploadFile(deleted[0]);
      }
      await this.prisma.pmRecord.update({
        where: { id: row.id },
        data: { signedInventoryPhoto: photos.length > 0 ? JSON.stringify(photos) : null },
      });
    } else {
      await this.prisma.pmRecord.update({
        where: { id: row.id },
        data: { signedInventoryPhoto: null },
      });
    }
    return { success: true };
  }
}

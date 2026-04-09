import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EquipmentLogAction, EquipmentLogSource, EquipmentStatus } from '@prisma/client';
import { UpdatePmEquipmentRecordDto, SignInventoryListDto } from './dto/index';
import { EmailService } from '../../email/email.service';
import { SettingsService } from '../../settings/settings.service';

@Injectable()
export class PmService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    private settingsService: SettingsService,
  ) {}

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
  async getPmRecord(incidentId: string) {
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
    const conflictMap = new Map<number, string>();
    for (const log of conflictLogs) {
      if (conflictMap.has(log.equipmentId)) continue; // already have latest
      const pmUpdatedAt = recMap.get(log.equipmentId);
      if (pmUpdatedAt && log.createdAt > pmUpdatedAt && log.sourceId) {
        conflictMap.set(log.equipmentId, log.sourceId);
      }
    }

    // Fetch technician profile if assigned
    const technician = record.technicianId
      ? await this.prisma.user.findUnique({
          where: { id: record.technicianId },
          select: { firstName: true, lastName: true, firstNameEn: true, lastNameEn: true, signaturePath: true },
        })
      : null;

    // Attach conflictIncidentId + photo counts; strip photo data (lazy-loaded per card)
    const enriched = {
      ...record,
      technician,
      equipmentRecords: record.equipmentRecords.map((r) => ({
        ...r,
        beforePhotoCount: r.beforePhotos.length,
        afterPhotoCount: r.afterPhotos.length,
        beforePhotos: [],   // stripped — fetched lazily when card expands
        afterPhotos: [],
        conflictIncidentId: conflictMap.get(r.equipmentId) ?? null,
      })),
    };

    return enriched;
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
  async updateEquipmentRecord(recordId: number, dto: UpdatePmEquipmentRecordDto) {
    const existing = await this.prisma.pmEquipmentRecord.findUnique({
      where: { id: recordId },
    });
    if (!existing) throw new NotFoundException(`ไม่พบ PM Equipment Record ID ${recordId}`);

    const data: any = {};

    if (dto.setBeforePhotos !== undefined) {
      data.beforePhotos = dto.setBeforePhotos;
    } else if (dto.beforePhotos?.length) {
      data.beforePhotos = [...(existing.beforePhotos ?? []), ...dto.beforePhotos];
    }
    if (dto.setAfterPhotos !== undefined) {
      data.afterPhotos = dto.setAfterPhotos;
    } else if (dto.afterPhotos?.length) {
      data.afterPhotos = [...(existing.afterPhotos ?? []), ...dto.afterPhotos];
    }
    if (dto.comment !== undefined) data.comment = dto.comment;
    if (dto.condition !== undefined) data.condition = dto.condition;
    if (dto.updatedBrand !== undefined) data.updatedBrand = dto.updatedBrand;
    if (dto.updatedModel !== undefined) data.updatedModel = dto.updatedModel;
    if (dto.updatedSerial !== undefined) data.updatedSerial = dto.updatedSerial;

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
    const pmRecord = await this.prisma.pmRecord.findUnique({
      where: { incidentId },
      include: { equipmentRecords: true },
    });
    if (!pmRecord) throw new NotFoundException('ไม่พบ PM Record');
    if (pmRecord.performedAt) throw new BadRequestException('PM นี้ถูก Submit ไปแล้ว');

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
      select: { id: true, brand: true, model: true, serialNumber: true, status: true, updatedAt: true },
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
      for (const rec of pmRecord.equipmentRecords) {
        const current = equipmentMap.get(rec.equipmentId);
        if (!current) continue;

        const updateData: any = {};
        const changes: string[] = [];

        // Brand / Model / Serial updates
        // Skip if equipment was updated more recently than this PM record (conflict protection)
        const hasInfoUpdate = rec.updatedBrand || rec.updatedModel || rec.updatedSerial;
        const equipmentNewerThanPm = current.updatedAt > rec.updatedAt;
        if (hasInfoUpdate && equipmentNewerThanPm) {
          skippedEquipment.push(rec.equipmentId.toString());
        } else {
          if (rec.updatedBrand) { updateData.brand = rec.updatedBrand; changes.push(`Brand: ${current.brand} → ${rec.updatedBrand}`); }
          if (rec.updatedModel) { updateData.model = rec.updatedModel; changes.push(`Model: ${current.model} → ${rec.updatedModel}`); }
          if (rec.updatedSerial) { updateData.serialNumber = rec.updatedSerial; changes.push(`Serial: ${current.serialNumber} → ${rec.updatedSerial}`); }
        }

        // Condition → auto-update Equipment.status
        let newStatus: EquipmentStatus | null = null;
        if (rec.condition === 'REPLACED' && current.status !== EquipmentStatus.RETIRED) {
          newStatus = EquipmentStatus.RETIRED;
          updateData.status = newStatus;
          changes.push(`Status: ${current.status} → RETIRED (เปลี่ยนอุปกรณ์แล้ว)`);
        } else if (rec.condition === 'NEEDS_REPAIR' && current.status === EquipmentStatus.ACTIVE) {
          newStatus = EquipmentStatus.MAINTENANCE;
          updateData.status = newStatus;
          changes.push(`Status: ${current.status} → MAINTENANCE (ต้องซ่อม)`);
        } else if (rec.condition === 'GOOD' && current.status === EquipmentStatus.MAINTENANCE) {
          newStatus = EquipmentStatus.ACTIVE;
          updateData.status = newStatus;
          changes.push(`Status: MAINTENANCE → ACTIVE (ผ่านการตรวจสอบ)`);
        }

        if (Object.keys(updateData).length === 0) continue;

        await tx.equipment.update({ where: { id: rec.equipmentId }, data: updateData });

        // Determine action type
        const action = newStatus && Object.keys(updateData).length === 1
          ? EquipmentLogAction.STATUS_CHANGED
          : newStatus
            ? EquipmentLogAction.UPDATED
            : EquipmentLogAction.UPDATED;

        const oldVal: any = { brand: current.brand, model: current.model, serialNumber: current.serialNumber, status: current.status };
        const newVal: any = {
          brand: rec.updatedBrand ?? current.brand,
          model: rec.updatedModel ?? current.model,
          serialNumber: rec.updatedSerial ?? current.serialNumber,
          status: newStatus ?? current.status,
        };

        await tx.equipmentLog.create({
          data: {
            equipmentId: rec.equipmentId,
            action,
            source: EquipmentLogSource.PM,
            sourceId: incidentId,
            description: `PM: ${changes.join(', ')}`,
            changedBy: userId,
            oldValue: oldVal,
            newValue: newVal,
          },
        });
      }
    });

    // Send PM completion email (non-blocking)
    this.sendPmCompletionEmail(incidentId, now, userId, pmRecord.equipmentRecords).catch((e) =>
      console.error('Failed to send PM completion email:', e),
    );

    return { success: true, performedAt: now, skippedEquipmentIds: skippedEquipment };
  }

  /**
   * Send PM completion email to configured recipients.
   */
  private async sendPmCompletionEmail(
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
        ratingToken: true,
        store: { select: { storeCode: true, name: true } },
      },
    });
    if (!incident) return;

    const technician = await this.prisma.user.findUnique({
      where: { id: technicianId },
      select: { firstName: true, lastName: true },
    });

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
    if (!toEmail) return;

    const ccEmails = emailSettings.closeNotificationCc
      ? emailSettings.closeNotificationCc.split(',').map((e: string) => e.trim()).filter(Boolean)
      : [];

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const publicIncidentLink = incident.ratingToken
      ? `${frontendUrl}/incident/${incident.ratingToken}`
      : null;

    await this.emailService.sendPmCompletedEmail({
      to: toEmail,
      cc: ccEmails,
      incidentId,
      ticketNumber: incident.ticketNumber,
      storeName: incident.store?.name || '-',
      storeCode: incident.store?.storeCode,
      technicianName: technician
        ? `${technician.firstName} ${technician.lastName}`
        : '-',
      performedAt,
      totalEquipment: equipmentRecords.length,
      equipmentRecords: emailEquipmentRecords,
      publicIncidentLink,
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
   * Submit online signature for the inventory list.
   */
  async signInventoryList(token: string, dto: SignInventoryListDto) {
    const record = await this.getByToken(token);

    if (record.storeSignedAt) {
      throw new BadRequestException('เอกสารนี้ได้รับการลงนามแล้ว');
    }

    return this.prisma.pmRecord.update({
      where: { id: record.id },
      data: {
        storeSignature: dto.signature,
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
      select: { id: true },  // only fetch ID — avoid reading large base64 field
    });
    if (!row) throw new NotFoundException('ไม่พบ PM Record');

    await this.prisma.pmRecord.update({
      where: { id: row.id },
      data: { signedInventoryPhoto: photo },
    });
    return { success: true };
  }

  async deleteSignedInventory(incidentId: string) {
    const row = await this.prisma.pmRecord.findUnique({
      where: { incidentId },
      select: { id: true },  // only fetch ID — avoid reading large base64 field
    });
    if (!row) throw new NotFoundException('ไม่พบ PM Record');

    await this.prisma.pmRecord.update({
      where: { id: row.id },
      data: { signedInventoryPhoto: null },
    });
    return { success: true };
  }
}

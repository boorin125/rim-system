// src/incidents/incidents.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { UpdateIncidentDto } from './dto/update-incident.dto';
import { IncidentStatus, Priority, UserRole, IncidentAction, IncidentType, EquipmentStatus, EquipmentLogAction, EquipmentLogSource, RepairType, AuditModule, AuditAction, NotificationType, SlaDefenseStatus, SlaRegion } from '@prisma/client';
import { ResolveIncidentDto, UpdateResolveDto } from './dto/resolve-incident.dto';
import { SubmitResponseDto } from './dto/submit-response.dto';
import { IncidentHistoryService } from './incident-history.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailService } from '../email/email.service';
import { SlaService } from '../sla/sla.service';
import { SettingsService } from '../settings/settings.service';
import { AuditTrailService } from '../modules/audit-trail/audit-trail.service';
import { RatingsService } from '../modules/ratings/ratings.service';
import { PmService } from '../modules/pm/pm.service';
import { addWatermark } from '../utils/image-watermark';
import { saveBase64Files } from '../utils/file-storage';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class IncidentsService {
  constructor(
    private prisma: PrismaService,
    private historyService: IncidentHistoryService,
    private notificationsService: NotificationsService,
    private emailService: EmailService,
    private slaService: SlaService,
    private settingsService: SettingsService,
    private auditTrailService: AuditTrailService,
    private ratingsService: RatingsService,
    private pmService: PmService,
  ) {}

  /**
   * Helper to check if a user is assigned to an incident (via junction table)
   */
  private async isAssignedToIncident(incidentId: string, userId: number): Promise<boolean> {
    const assignment = await this.prisma.incidentAssignee.findUnique({
      where: { incidentId_userId: { incidentId, userId } },
    });
    return !!assignment;
  }

  /**
   * Helper to check if user has a specific role (supports multi-roles)
   */
  private hasRole(user: any, role: UserRole): boolean {
    if (Array.isArray(user.roles)) {
      return user.roles.includes(role);
    }
    // Fallback for legacy single role
    return user.role === role;
  }

  /**
   * Helper to check if user's HIGHEST-privilege role is the given role.
   * Ignores low-privilege roles like READ_ONLY / END_USER that may co-exist.
   */
  private readonly ROLE_RANK: Record<string, number> = {
    SUPER_ADMIN: 8, IT_MANAGER: 7, FINANCE_ADMIN: 6,
    SUPERVISOR: 5, HELP_DESK: 4, TECHNICIAN: 3, END_USER: 2, READ_ONLY: 1,
  };

  private hasOnlyRole(user: any, role: UserRole): boolean {
    const roles: string[] = Array.isArray(user.roles) ? user.roles : (user.role ? [user.role] : []);
    if (roles.length === 0) return false;
    const highest = roles.reduce((best, r) =>
      (this.ROLE_RANK[r] ?? 0) > (this.ROLE_RANK[best] ?? 0) ? r : best
    );
    return highest === role;
  }

  /**
   * Helper function to add watermark to photos
   */
  private async addWatermarkToPhotos(
    photoPaths: string[],
    watermarkText: 'BEFORE' | 'AFTER',
  ): Promise<string[]> {
    const watermarkedPaths: string[] = [];

    for (const photoPath of photoPaths) {
      try {
        const fullPath = path.join(process.cwd(), 'uploads', photoPath);

        // Read the original image
        const imageBuffer = await fs.readFile(fullPath);

        // Add watermark
        const watermarkedBuffer = await addWatermark(imageBuffer, watermarkText);

        // Save watermarked image (overwrite original)
        await fs.writeFile(fullPath, watermarkedBuffer);

        watermarkedPaths.push(photoPath);
      } catch (error) {
        console.error(`Error adding watermark to ${photoPath}:`, error);
        // If watermarking fails, still include the original photo
        watermarkedPaths.push(photoPath);
      }
    }

    return watermarkedPaths;
  }

  // ========================================
  // Service Report Token Generation
  // ========================================

  async generateServiceReportToken(incidentId: string): Promise<string> {
    const { randomUUID } = await import('crypto');
    const token = randomUUID();
    const now = new Date();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await this.prisma.incident.update({
      where: { id: incidentId },
      data: {
        serviceReportToken: token,
        serviceReportTokenCreatedAt: now,
        serviceReportTokenExpiresAt: expiresAt,
      },
    });

    return token;
  }

  async generateServiceReportTokenEndpoint(id: string) {
    const incident = await this.prisma.incident.findFirst({
      where: { id },
      select: { id: true, status: true, serviceReportToken: true },
    });

    if (!incident) {
      throw new NotFoundException(`ไม่พบ Incident ${id}`);
    }

    if (incident.serviceReportToken) {
      return {
        token: incident.serviceReportToken,
        url: `/service-report/${incident.serviceReportToken}`,
      };
    }

    const token = await this.generateServiceReportToken(id);
    return { token, url: `/service-report/${token}` };
  }

  /**
   * Get Service Report data for authenticated users (for blank-signature PDF download)
   */
  async getServiceReportData(id: string, user: any) {
    const incident = await this.prisma.incident.findFirst({
      where: { id },
      include: {
        store: {
          select: {
            storeCode: true, name: true, company: true,
            address: true, province: true, phone: true, email: true,
          },
        },
        assignee: { select: { firstName: true, lastName: true, phone: true } },
        assignees: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, phone: true } },
          },
          orderBy: { assignedAt: 'asc' },
        },
        resolvedBy: { select: { firstName: true, lastName: true, signaturePath: true } },
        confirmedBy: { select: { firstName: true, lastName: true } },
        spareParts: {
          select: {
            id: true, deviceName: true, oldSerialNo: true, newSerialNo: true,
            repairType: true, componentName: true,
            oldComponentSerial: true, newComponentSerial: true,
            newBrand: true, newModel: true,
            oldEquipmentId: true, newEquipmentId: true,
            parentEquipmentId: true,
          },
        },
      },
    });

    if (!incident) {
      throw new NotFoundException(`ไม่พบ Incident ${id}`);
    }

    // Access check: TECHNICIAN must be assigned
    if (this.hasRole(user, UserRole.TECHNICIAN) &&
        !this.hasRole(user, UserRole.HELP_DESK) &&
        !this.hasRole(user, UserRole.IT_MANAGER) &&
        !this.hasRole(user, UserRole.SUPERVISOR)) {
      const isAssigned = incident.assignees?.some(a => a.user.id === user.id) || incident.assigneeId === user.id;
      if (!isAssigned) {
        throw new NotFoundException(`ไม่พบ Incident ${id}`);
      }
    }

    // Status check: must be RESOLVED or CLOSED
    if (!['RESOLVED', 'CLOSED'].includes(incident.status)) {
      throw new BadRequestException('Incident ต้องมีสถานะ RESOLVED หรือ CLOSED เพื่อสร้าง Service Report');
    }

    // Fetch org + provider configs
    const orgConfigs = await this.prisma.systemConfig.findMany({
      where: {
        key: {
          in: [
            'organization_name', 'organization_logo', 'organization_address',
            'sr_provider_name', 'sr_provider_address', 'sr_provider_phone',
            'sr_provider_email', 'sr_provider_tax_id', 'sr_provider_logo',
            'sr_template_style',
            'sr_theme_bg_start', 'sr_theme_bg_end',
            'theme_bg_start', 'theme_bg_end',
          ],
        },
      },
    });
    const configMap: Record<string, string> = {};
    for (const c of orgConfigs) configMap[c.key] = c.value;

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    return {
      organizationName: configMap['organization_name'] || '',
      organizationLogo: configMap['organization_logo'] || '',
      organizationAddress: configMap['organization_address'] || '',
      providerName: configMap['sr_provider_name'] || '',
      providerAddress: configMap['sr_provider_address'] || '',
      providerPhone: configMap['sr_provider_phone'] || '',
      providerEmail: configMap['sr_provider_email'] || '',
      providerTaxId: configMap['sr_provider_tax_id'] || '',
      providerLogo: configMap['sr_provider_logo'] || '',
      ticketNumber: incident.ticketNumber,
      title: incident.title,
      description: incident.description,
      category: incident.category,
      priority: incident.priority,
      status: incident.status,
      store: incident.store ? {
        storeCode: incident.store.storeCode, name: incident.store.name,
        company: incident.store.company, address: incident.store.address,
        province: incident.store.province, phone: incident.store.phone,
        email: incident.store.email,
      } : null,
      technician: incident.assignee ? {
        name: `${incident.assignee.firstName} ${incident.assignee.lastName}`,
        phone: incident.assignee.phone,
      } : null,
      technicians: incident.assignees?.length > 0
        ? incident.assignees.map(a => ({
            name: `${a.user.firstName} ${a.user.lastName}`,
            phone: a.user.phone,
          }))
        : incident.assignee
          ? [{ name: `${incident.assignee.firstName} ${incident.assignee.lastName}`, phone: incident.assignee.phone }]
          : [],
      checkedInTechnicians: incident.assignees
        ?.filter(a => a.checkedInAt)
        .map(a => ({ name: `${a.user.firstName} ${a.user.lastName}`, phone: a.user.phone })) || [],
      resolvedBy: incident.resolvedBy ? {
        name: `${incident.resolvedBy.firstName} ${incident.resolvedBy.lastName}`,
        signaturePath: incident.resolvedBy.signaturePath,
      } : null,
      resolutionNote: incident.resolutionNote,
      usedSpareParts: incident.usedSpareParts,
      spareParts: await (async () => {
        const rawParts = incident.spareParts;
        if (!rawParts.length) return [];
        const equipIds = rawParts
          .flatMap((sp: any) => [sp.oldEquipmentId, sp.newEquipmentId, sp.parentEquipmentId])
          .filter(Boolean) as number[];
        const equipMap = new Map<number, any>();
        if (equipIds.length > 0) {
          const equipments = await this.prisma.equipment.findMany({
            where: { id: { in: equipIds } },
            select: { id: true, name: true, brand: true, model: true },
          });
          equipments.forEach(e => equipMap.set(e.id, e));
        }
        return rawParts.map((sp: any) => {
          const oldEquip = sp.oldEquipmentId ? (equipMap.get(sp.oldEquipmentId) ?? null) : null;
          const newEquip = sp.newEquipmentId ? (equipMap.get(sp.newEquipmentId) ?? null) : null;
          const parentEquip = sp.parentEquipmentId ? (equipMap.get(sp.parentEquipmentId) ?? null) : null;
          return {
            repairType: sp.repairType,
            deviceName: sp.deviceName,
            oldSerialNo: sp.oldSerialNo,
            newSerialNo: sp.newSerialNo,
            equipmentName: oldEquip?.name || sp.deviceName || '',
            oldBrandModel: [oldEquip?.brand, oldEquip?.model].filter(Boolean).join(' ') || '',
            newBrandModel: [sp.newBrand, sp.newModel].filter(Boolean).join(' ') ||
              [newEquip?.brand, newEquip?.model].filter(Boolean).join(' ') || '',
            componentName: sp.componentName || '',
            oldComponentSerial: sp.oldComponentSerial || '',
            newComponentSerial: sp.newComponentSerial || '',
            parentEquipmentName: parentEquip?.name || sp.deviceName || '',
          };
        });
      })(),
      createdAt: incident.createdAt,
      checkInAt: incident.checkInAt,
      resolvedAt: incident.resolvedAt,
      confirmedAt: incident.confirmedAt,
      customerSignature: incident.customerSignature || null,
      customerSignatureName: incident.customerSignatureName || null,
      customerSignedAt: incident.customerSignedAt || null,
      templateStyle: configMap['sr_template_style'] || 'classic',
      themeColors: {
        bgStart: configMap['sr_theme_bg_start'] || configMap['theme_bg_start'] || '#0f172a',
        bgEnd: configMap['sr_theme_bg_end'] || configMap['theme_bg_end'] || '#1e293b',
      },
      reportUrl: incident.serviceReportToken
        ? `${frontendUrl}/service-report/${incident.serviceReportToken}`
        : '',
    };
  }

  /**
   * Send blank-signature Service Report PDF to store email
   */
  async sendServiceReportEmail(id: string, pdfBase64: string, toEmail: string, user: any) {
    if (!pdfBase64) {
      throw new BadRequestException('กรุณาแนบ PDF');
    }
    if (!toEmail) {
      throw new BadRequestException('กรุณาระบุอีเมลปลายทาง');
    }

    const incident = await this.prisma.incident.findFirst({
      where: { id },
      include: {
        store: { select: { storeCode: true, name: true, email: true } },
      },
    });

    if (!incident) {
      throw new NotFoundException(`ไม่พบ Incident ${id}`);
    }

    // Access check
    if (this.hasRole(user, UserRole.TECHNICIAN) &&
        !this.hasRole(user, UserRole.HELP_DESK) &&
        !this.hasRole(user, UserRole.IT_MANAGER) &&
        !this.hasRole(user, UserRole.SUPERVISOR)) {
      if (incident.assigneeId !== user.id) {
        throw new NotFoundException(`ไม่พบ Incident ${id}`);
      }
    }

    await this.emailService.sendServiceReportPdfEmail({
      to: toEmail,
      ticketNumber: incident.ticketNumber,
      storeName: incident.store?.name || 'N/A',
      storeCode: incident.store?.storeCode || '',
      pdfBase64,
    });

    return { message: `ส่ง Service Report ไปที่ ${toEmail} สำเร็จ` };
  }

  /**
   * Upload signed service report photos
   */
  async uploadSignedReportPhotos(id: string, photos: string[], user: any) {
    if (!photos || photos.length === 0) {
      throw new BadRequestException('กรุณาแนบรูปภาพ');
    }

    const incident = await this.prisma.incident.findFirst({
      where: { id },
      select: { id: true, assigneeId: true, resolvedById: true, status: true, signedReportPhotos: true },
    });

    if (!incident) {
      throw new NotFoundException(`ไม่พบ Incident ${id}`);
    }

    // Access check
    if (this.hasRole(user, UserRole.TECHNICIAN) && !this.hasRole(user, UserRole.HELP_DESK)) {
      if (incident.assigneeId !== user.id && incident.resolvedById !== user.id) {
        throw new NotFoundException(`ไม่พบ Incident ${id}`);
      }
    }

    if (!['RESOLVED', 'CLOSED'].includes(incident.status)) {
      throw new BadRequestException('Incident ต้องมีสถานะ RESOLVED หรือ CLOSED');
    }

    const existingPhotos = incident.signedReportPhotos || [];
    const base64Photos = photos.filter((p) => p.startsWith('data:'));
    const savedPaths = base64Photos.length > 0
      ? await saveBase64Files(base64Photos, `incidents/${id}`)
      : [];
    const queue = [...savedPaths];
    const photoPaths = photos.map((p) => (p.startsWith('data:') ? queue.shift()! : p));
    const allPhotos = [...existingPhotos, ...photoPaths];
    if (allPhotos.length > 5) {
      throw new BadRequestException('อัปโหลดรูป Service Report ที่เซ็นแล้วได้สูงสุด 5 รูป');
    }

    await this.prisma.incident.update({
      where: { id },
      data: { signedReportPhotos: allPhotos },
    });

    return { message: 'อัปโหลดรูป Service Report ที่เซ็นแล้วสำเร็จ', count: allPhotos.length };
  }

  // ========================================
  // ✅ NEW: Helper function for spare parts transformation
  // ========================================
  
  /**
   * Transform spare parts from NEW structure to database format
   * Supports both OLD and NEW structure (backward compatible)
   * 
   * NEW structure: { oldDeviceName, oldSerialNo, newDeviceName, newSerialNo, replacementType }
   * OLD structure: { deviceName, oldSerialNo, newSerialNo }
   * 
   * Output: { deviceName, oldSerialNo, newSerialNo, notes }
   */
  private transformSparePartsData(spareParts: any[]) {
    return spareParts.map((sp) => {
      // ========================================
      // COMPONENT REPLACEMENT - เปลี่ยนชิ้นส่วนภายใน
      // ========================================
      if (sp.repairType === 'COMPONENT_REPLACEMENT') {
        // For component replacement: deviceName is the component being replaced
        const deviceName = sp.componentName || 'Unknown Component';

        // Only include user notes, no prefix tag
        const notes = sp.notes || '';

        return {
          repairType: 'COMPONENT_REPLACEMENT',
          deviceName,
          oldSerialNo: sp.oldComponentSerial || '',
          newSerialNo: sp.newComponentSerial || '',
          componentName: sp.componentName || null,
          oldComponentSerial: sp.oldComponentSerial || null,
          newComponentSerial: sp.newComponentSerial || null,
          parentEquipmentId: sp.parentEquipmentId || null,
          notes: notes || null,
        };
      }

      // ========================================
      // EQUIPMENT REPLACEMENT - NEW STRUCTURE (oldDeviceName + newDeviceName)
      // ========================================
      if (sp.oldDeviceName && sp.newDeviceName) {
        // Construct deviceName from old → new
        const deviceName = `${sp.oldDeviceName} → ${sp.newDeviceName}`;

        // Include replacement type in notes if provided
        let notes = sp.notes || '';
        if (sp.replacementType) {
          notes = notes
            ? `Type: ${sp.replacementType} | ${notes}`
            : `Type: ${sp.replacementType}`;
        }

        return {
          repairType: 'EQUIPMENT_REPLACEMENT',
          deviceName,
          oldSerialNo: sp.oldSerialNo || '',
          newSerialNo: sp.newSerialNo || '',
          newBrand: sp.newBrand || null,
          notes: notes || null,
        };
      }

      // ========================================
      // OLD STRUCTURE (deviceName only)
      // ========================================
      return {
        repairType: 'EQUIPMENT_REPLACEMENT',
        deviceName: sp.deviceName,
        oldSerialNo: sp.oldSerialNo || '',
        newSerialNo: sp.newSerialNo || '',
        notes: sp.notes || null,
      };
    });
  }

  /**
   * Sync Equipment records when spare parts are replaced
   * - Updates storeId of new equipment to incident's store
   * - When no equipment IDs provided, looks up by serial number
   */
  private async syncEquipmentFromSparePart(
    prisma: any,
    originalSp: any,
    transformedSp: any,
    storeId: number,
    ticketNumber: string,
    userId: number,
    incidentId?: string,
  ) {
    // Only process EQUIPMENT_REPLACEMENT type
    if (transformedSp.repairType === 'COMPONENT_REPLACEMENT') {
      // Log component replacement on parent equipment
      const parentId = originalSp.parentEquipmentId || null;
      if (parentId) {
        const parentEquip = await prisma.equipment.findUnique({ where: { id: parentId } });
        if (parentEquip) {
          await prisma.equipmentLog.create({
            data: {
              equipmentId: parentId,
              action: EquipmentLogAction.COMPONENT_REPLACED,
              source: EquipmentLogSource.INCIDENT,
              sourceId: incidentId ?? null,
              description: `เปลี่ยนชิ้นส่วน "${originalSp.componentName ?? 'ไม่ระบุ'}" จาก Incident ${ticketNumber} — Serial: ${originalSp.oldComponentSerial ?? '-'} → ${originalSp.newComponentSerial ?? '-'}`,
              changedBy: userId,
              oldValue: { componentName: originalSp.componentName, serial: originalSp.oldComponentSerial ?? null },
              newValue: { componentName: originalSp.componentName, serial: originalSp.newComponentSerial ?? null },
            },
          });
        }
      }
      return;
    }

    const oldSerial = transformedSp.oldSerialNo?.trim();
    const newSerial = transformedSp.newSerialNo?.trim();
    if (!oldSerial && !newSerial) return;

    let oldEquipmentId = originalSp.oldEquipmentId || null;
    let newEquipmentId = originalSp.newEquipmentId || null;

    // If no equipment IDs provided, look up by serial number (case-insensitive + trimmed)
    if (!oldEquipmentId && oldSerial) {
      const oldEquip = await prisma.equipment.findFirst({
        where: { serialNumber: { equals: oldSerial, mode: 'insensitive' } },
      });
      if (oldEquip) oldEquipmentId = oldEquip.id;
    }

    if (!newEquipmentId && newSerial) {
      const newEquip = await prisma.equipment.findFirst({
        where: { serialNumber: { equals: newSerial, mode: 'insensitive' } },
      });
      if (newEquip) newEquipmentId = newEquip.id;
    }

    // If neither equipment found after all lookups, warn and return
    if (!oldEquipmentId && !newEquipmentId) {
      console.warn(
        `[Equipment Sync] ⚠️ Incident ${ticketNumber}: ไม่พบ Equipment ใน DB` +
        ` — Serial เก่า: "${oldSerial ?? '-'}" | Serial ใหม่: "${newSerial ?? '-'}"` +
        ` | Device: "${originalSp.newDeviceName ?? '-'}" — กรุณาตรวจสอบและอัพเดตด้วยตนเอง`,
      );
      return;
    }

    // Update old equipment → INACTIVE (replaced via spare part)
    // Also correct serial number if tech typed the real serial (different from mock/DB value)
    if (oldEquipmentId) {
      const oldEquip = await prisma.equipment.findUnique({ where: { id: oldEquipmentId } });
      if (oldEquip) {
        const serialCorrected = oldSerial && oldSerial !== oldEquip.serialNumber;
        const updatePayload: any = { status: EquipmentStatus.INACTIVE };
        if (serialCorrected) updatePayload.serialNumber = oldSerial;

        await prisma.equipment.update({
          where: { id: oldEquipmentId },
          data: updatePayload,
        });

        await prisma.equipmentLog.create({
          data: {
            equipmentId: oldEquipmentId,
            action: EquipmentLogAction.REPLACED_OUT,
            source: EquipmentLogSource.INCIDENT,
            sourceId: incidentId ?? null,
            description: `ถูกถอดออกจาก Incident ${ticketNumber} และเปลี่ยนเป็นอุปกรณ์ใหม่` +
              (serialCorrected ? ` (แก้ Serial: "${oldEquip.serialNumber}" → "${oldSerial}")` : ''),
            changedBy: userId,
            oldValue: { status: oldEquip.status, storeId: oldEquip.storeId, serialNumber: oldEquip.serialNumber },
            newValue: { status: 'INACTIVE', ...(serialCorrected ? { serialNumber: oldSerial } : {}) },
          },
        });
      }
    }

    // Update new equipment → ACTIVE + storeId + inherit name from old
    if (newEquipmentId) {
      const newEquip = await prisma.equipment.findUnique({ where: { id: newEquipmentId } });
      if (newEquip) {
        const updateData: any = {
          status: EquipmentStatus.ACTIVE,
          storeId: storeId,
        };

        // Inherit name/position from old equipment if available
        if (oldEquipmentId) {
          const oldEquip = await prisma.equipment.findUnique({ where: { id: oldEquipmentId } });
          if (oldEquip && oldEquip.name) updateData.name = oldEquip.name;
        }

        // Only overwrite brand/model when new values are explicitly provided
        if (originalSp.newBrand) updateData.brand = originalSp.newBrand;
        if (originalSp.newModel) updateData.model = originalSp.newModel;
        else if (originalSp.newDeviceName) updateData.model = originalSp.newDeviceName;

        await prisma.equipment.update({ where: { id: newEquipmentId }, data: updateData });

        await prisma.equipmentLog.create({
          data: {
            equipmentId: newEquipmentId,
            action: EquipmentLogAction.REPLACED_IN,
            source: EquipmentLogSource.INCIDENT,
            sourceId: incidentId ?? null,
            description: `ถูกติดตั้งแทนที่อุปกรณ์เดิมใน Incident ${ticketNumber} ที่ Store ID ${storeId}`,
            changedBy: userId,
            oldValue: { status: newEquip.status, storeId: newEquip.storeId, serialNumber: newEquip.serialNumber },
            newValue: { status: 'ACTIVE', storeId: storeId, brand: updateData.brand, model: updateData.model },
          },
        });
      }
    }

    // If old equipment found but new serial not in Equipment table → update old equipment's serial + brand/model
    if (oldEquipmentId && !newEquipmentId && newSerial) {
      const oldEquip = await prisma.equipment.findUnique({ where: { id: oldEquipmentId } });
      if (oldEquip) {
        const updateData: any = { serialNumber: newSerial, status: EquipmentStatus.ACTIVE };

        // Only overwrite brand/model when new values are explicitly provided
        if (originalSp.newBrand) updateData.brand = originalSp.newBrand;
        if (originalSp.newModel) updateData.model = originalSp.newModel;
        else if (originalSp.newDeviceName) updateData.model = originalSp.newDeviceName;

        await prisma.equipment.update({ where: { id: oldEquipmentId }, data: updateData });

        await prisma.equipmentLog.create({
          data: {
            equipmentId: oldEquipmentId,
            action: EquipmentLogAction.UPDATED,
            source: EquipmentLogSource.INCIDENT,
            sourceId: incidentId ?? null,
            description: `เปลี่ยนอุปกรณ์จาก Incident ${ticketNumber} — Serial: ${oldSerial} → ${newSerial}${originalSp.newDeviceName ? ` | Device: ${originalSp.newDeviceName}` : ''}`,
            changedBy: userId,
            oldValue: { serialNumber: oldSerial, brand: oldEquip.brand, model: oldEquip.model, status: oldEquip.status },
            newValue: { serialNumber: newSerial, brand: updateData.brand, model: updateData.model, status: 'ACTIVE' },
          },
        });
      }
    }
  }

  /**
   * Rollback equipment changes when spare parts are removed/updated
   */
  private async rollbackEquipmentFromSparePart(
    prisma: any,
    sparePart: any,
  ) {
    // Rollback old equipment: INACTIVE → MAINTENANCE
    if (sparePart.oldEquipmentId) {
      await prisma.equipment.update({
        where: { id: sparePart.oldEquipmentId },
        data: { status: EquipmentStatus.MAINTENANCE },
      });
    } else if (sparePart.oldSerialNo) {
      const oldEquip = await prisma.equipment.findUnique({
        where: { serialNumber: sparePart.oldSerialNo },
      });
      if (oldEquip) {
        await prisma.equipment.update({
          where: { id: oldEquip.id },
          data: { status: EquipmentStatus.MAINTENANCE },
        });
      }
    }

    // Rollback new equipment: ACTIVE → INACTIVE
    if (sparePart.newEquipmentId) {
      await prisma.equipment.update({
        where: { id: sparePart.newEquipmentId },
        data: { status: EquipmentStatus.INACTIVE },
      });
    } else if (sparePart.newSerialNo) {
      const newEquip = await prisma.equipment.findUnique({
        where: { serialNumber: sparePart.newSerialNo },
      });
      if (newEquip) {
        await prisma.equipment.update({
          where: { id: newEquip.id },
          data: { status: EquipmentStatus.INACTIVE },
        });
      }
    }
  }

  /**
   * Generate ticket number in format: [PREFIX][YY][MM][XXXX]
   * Example: WAT25110001 = Watsons, November 2025, incident #1
   * Prefix is fetched from organization settings (default: INC)
   */
  private async generateTicketNumber(): Promise<string> {
    // Get prefix from organization settings
    const companyPrefix = await this.settingsService.getIncidentPrefix();

    const now = new Date();
    const year = now.getFullYear().toString().slice(-2); // "25"
    const month = (now.getMonth() + 1).toString().padStart(2, '0'); // "11"

    // Find the last ticket in this month
    const monthPrefix = `${companyPrefix}${year}${month}`;

    const lastTicket = await this.prisma.incident.findFirst({
      where: {
        ticketNumber: {
          startsWith: monthPrefix,
        },
      },
      orderBy: {
        ticketNumber: 'desc',
      },
    });

    let runningNumber = 1;
    if (lastTicket && lastTicket.ticketNumber) {
      // Extract running number from ticket (last 4 digits)
      const lastNumber = parseInt(lastTicket.ticketNumber.slice(-4));
      runningNumber = lastNumber + 1;
    }

    // Pad to 4 digits (supports up to 9999 incidents per month)
    const paddedNumber = runningNumber.toString().padStart(4, '0');

    return `${monthPrefix}${paddedNumber}`;
  }

  /**
   * Create a new incident
   */
  async create(createIncidentDto: CreateIncidentDto, userId: number) {
    // Generate ticket number using organization prefix from settings
    const ticketNumber = await this.generateTicketNumber();

    // Get store information to save storeName and storeCode for historical reference
    const store = await this.prisma.store.findUnique({
      where: { id: createIncidentDto.storeId },
      select: { name: true, storeCode: true },
    });

    if (!store) {
      throw new NotFoundException(`ไม่พบสาขา ID ${createIncidentDto.storeId} ในระบบ`);
    }

    // Calculate SLA deadline based on priority
    // Use ignoreSla flag from JobType DB record instead of hardcoded list
    const priority = createIncidentDto.priority || Priority.MEDIUM;
    const createdAt = new Date();
    let ignoreSla = false;
    if (createIncidentDto.jobType) {
      const jobTypeRecord = await this.prisma.jobType.findFirst({
        where: { name: createIncidentDto.jobType },
        select: { ignoreSla: true },
      });
      ignoreSla = jobTypeRecord?.ignoreSla ?? false;
    }
    const slaDeadline = ignoreSla
      ? null
      : await this.slaService.calculateSlaDeadline(priority, createdAt);

    // Validate MA job type: must have at least 1 equipment
    if (createIncidentDto.jobType === 'MA') {
      const ids = createIncidentDto.equipmentIds || (createIncidentDto.equipmentId ? [createIncidentDto.equipmentId] : []);
      if (ids.length === 0) {
        throw new BadRequestException('งาน MA ต้องระบุอุปกรณ์อย่างน้อย 1 ชิ้น');
      }
    }

    // Validate PM job type: cannot create if there is already an open PM for this store
    if (createIncidentDto.jobType === 'Preventive Maintenance' && createIncidentDto.storeId) {
      const openPm = await this.prisma.incident.findFirst({
        where: {
          storeId: createIncidentDto.storeId,
          jobType: 'Preventive Maintenance',
          status: { notIn: ['CLOSED', 'CANCELLED'] },
        },
        select: { id: true, ticketNumber: true },
      });
      if (openPm) {
        throw new BadRequestException(
          `ไม่สามารถเปิดงาน PM ใหม่ได้ เนื่องจากมีงาน PM ที่ยังค้างอยู่ (${openPm.ticketNumber}) กรุณาปิดงานเดิมก่อน`,
        );
      }
    }

    // Project and Adhoc require scheduledAt (visit appointment)
    if (['Project', 'Adhoc'].includes(createIncidentDto.jobType ?? '') && !createIncidentDto.scheduledAt) {
      throw new BadRequestException('งาน Project และ Adhoc ต้องระบุวัน-เวลาที่เข้าดำเนินการ');
    }

    // Resolve equipmentIds array
    const equipmentIds: number[] =
      createIncidentDto.equipmentIds?.length
        ? createIncidentDto.equipmentIds
        : createIncidentDto.equipmentId
          ? [createIncidentDto.equipmentId]
          : [];

    const primaryEquipmentId: number | undefined =
      createIncidentDto.equipmentId || equipmentIds[0];

    // Create incident with UUID
    const { randomUUID } = await import('crypto');
    const id = randomUUID();

    const incident = await this.prisma.incident.create({
      data: {
        id,
        ticketNumber,
        title: createIncidentDto.title,
        description: createIncidentDto.description,
        category: createIncidentDto.category,
        jobType: createIncidentDto.jobType,
        priority,
        status: IncidentStatus.OPEN,
        storeId: createIncidentDto.storeId,
        storeName: store.name,       // Store name for historical reference
        storeCode: store.storeCode,  // Store code for historical reference
        equipmentId: primaryEquipmentId || null,
        equipmentIds,
        reportedBy: createIncidentDto.reportedBy || userId,
        createdById: userId,
        slaDeadline,                 // SLA deadline from config (null for Project)
        incidentDate: createIncidentDto.incidentDate
          ? new Date(createIncidentDto.incidentDate)
          : new Date(), // ใช้เวลาปัจจุบันถ้าไม่ได้ระบุ
        scheduledAt: createIncidentDto.scheduledAt
          ? new Date(createIncidentDto.scheduledAt)
          : null,
      },
      include: {
        store: true,
        equipment: true,
        createdBy: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            email: true,
            roles: { select: { role: true } },
          },
        },
      },
    });

    // Create history entry
    await this.historyService.createHistory(
      id,
      IncidentAction.CREATED,
      userId,
      undefined,
      IncidentStatus.OPEN,
      `Incident created: ${createIncidentDto.title}`,
    );

    // Audit trail
    await this.auditTrailService.logDirect({
      module: AuditModule.INCIDENT,
      action: AuditAction.CREATE,
      entityType: 'Incident',
      entityId: id,
      userId,
      description: `สร้าง Incident "${createIncidentDto.title}" (${ticketNumber})`,
    });

    // Note: Supervisors are NOT notified on creation.
    // They will be notified when Helpdesk requests onsite support.
    // EXCEPTION: Preventive Maintenance — auto-create PmRecord + set ONSITE + notify supervisors immediately.
    if (createIncidentDto.jobType === 'Preventive Maintenance') {
      await this.pmService.createPmRecord(id, createIncidentDto.storeId);

      await this.prisma.incident.update({
        where: { id },
        data: { resolutionType: 'ONSITE' },
      });

      await this.notificationsService.notifyAllSupervisors(
        NotificationType.INCIDENT_CREATED,
        'PM Request — Onsite Support Required',
        `${ticketNumber} - ${store.storeCode} ${store.name} — ขอ Preventive Maintenance`,
        id,
      );
    }

    return incident;
  }

  /**
   * Get all incidents with filtering
   * TECHNICIAN sees only their assigned incidents
   */
  async findAll(filterDto: any, user: any) {
    const where: any = {};

    // TECHNICIAN: Only see assigned incidents (junction table OR legacy assigneeId)
    if (this.hasOnlyRole(user, UserRole.TECHNICIAN)) {
      where.OR = [
        { assignees: { some: { userId: user.id } } },
        { assigneeId: user.id },
      ];
    }

    // SUPERVISOR: Only see incidents with resolutionType = ONSITE or already past OPEN status
    if (this.hasOnlyRole(user, UserRole.SUPERVISOR)) {
      if (!where.AND) where.AND = [];
      (where.AND as any[]).push({
        OR: [
          { resolutionType: 'ONSITE' },
          { status: { in: ['ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'CANCELLED'] } },
        ],
      });
    }

    // Apply filters
    if (filterDto.statusGroup === 'PENDING') {
      where.status = { notIn: ['CLOSED', 'CANCELLED'] };
    } else if (filterDto.status) {
      // Support comma-separated values (e.g. "PENDING,ASSIGNED")
      const statuses = filterDto.status.split(',').filter(Boolean);
      where.status = statuses.length === 1 ? statuses[0] : { in: statuses };
    }

    if (filterDto.priority) {
      const priorities = filterDto.priority.split(',').filter(Boolean);
      where.priority = priorities.length === 1 ? priorities[0] : { in: priorities };
    }

    if (filterDto.storeId) {
      where.storeId = parseInt(filterDto.storeId);
    }

    if (filterDto.assigneeId) {
      const requestedId = parseInt(filterDto.assigneeId);
      // Technician can only filter by their own ID (cannot query other users)
      if (this.hasOnlyRole(user, UserRole.TECHNICIAN)) {
        where.OR = [
          { assignees: { some: { userId: user.id } } },
          { assigneeId: user.id },
        ];
      } else {
        where.assignees = { some: { userId: requestedId } };
      }
    }

    if (filterDto.category) {
      const cats = filterDto.category.split(',').filter(Boolean);
      where.category = cats.length === 1 ? cats[0] : { in: cats };
    }

    if (filterDto.search) {
      where.OR = [
        { ticketNumber: { contains: filterDto.search, mode: 'insensitive' } },
        { title: { contains: filterDto.search, mode: 'insensitive' } },
        { description: { contains: filterDto.search, mode: 'insensitive' } },
      ];
    }

    // Pagination
    const page = Math.max(1, parseInt(filterDto.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(filterDto.limit) || 50));
    const skip = (page - 1) * limit;

    // Date range filter
    if (filterDto.dateFrom || filterDto.dateTo) {
      const dateFilter: any = {};
      if (filterDto.dateFrom) dateFilter.gte = new Date(filterDto.dateFrom);
      if (filterDto.dateTo) {
        const to = new Date(filterDto.dateTo);
        to.setHours(23, 59, 59, 999);
        dateFilter.lte = to;
      }
      where.createdAt = dateFilter;
    }

    // Sort
    const sortField = filterDto.sortField || 'createdAt';
    const sortOrder = filterDto.sortOrder === 'asc' ? 'asc' : 'desc';
    const orderBy: any = { [sortField]: sortOrder };

    const [total, incidents] = await Promise.all([
      this.prisma.incident.count({ where }),
      this.prisma.incident.findMany({
        where,
        select: {
          id: true,
          ticketNumber: true,
          title: true,
          description: true,
          category: true,
          jobType: true,
          priority: true,
          status: true,
          resolutionType: true,
          resolutionNote: true,
          incidentType: true,
          incidentDate: true,
          createdAt: true,
          updatedAt: true,
          resolvedAt: true,
          slaDeadline: true,
          storeId: true,
          assigneeId: true,
          store: {
            select: {
              id: true, storeCode: true, name: true,
              province: true, storeStatus: true,
            },
          },
          assignees: {
            select: {
              userId: true, assignedAt: true, checkedInAt: true,
              user: {
                select: { id: true, firstName: true, lastName: true },
              },
            },
            orderBy: { assignedAt: 'asc' as const },
          },
          reassignments: {
            select: { reassignedAt: true },
            orderBy: { reassignedAt: 'desc' as const },
            take: 1,
          },
          slaDefenses: {
            select: { id: true, status: true, reason: true },
            orderBy: { createdAt: 'desc' as const },
            take: 1,
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
    ]);

    return {
      data: incidents,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get statistics
   * TECHNICIAN sees only their stats
   */
  async getStatistics(user: any) {
    const where: any = {};

    // TECHNICIAN: Only their assigned incidents (via junction table)
    if (this.hasOnlyRole(user, UserRole.TECHNICIAN)) {
      where.assignees = { some: { userId: user.id } };
    }

    // SUPERVISOR: Only see incidents with resolutionType = ONSITE or already past OPEN status
    if (this.hasOnlyRole(user, UserRole.SUPERVISOR)) {
      if (!where.AND) where.AND = [];
      (where.AND as any[]).push({
        OR: [
          { resolutionType: 'ONSITE' },
          { status: { in: ['ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'CANCELLED'] } },
        ],
      });
    }

    const [total, open, assigned, inProgress, resolved, closed] =
      await Promise.all([
        this.prisma.incident.count({ where }),
        this.prisma.incident.count({
          where: { ...where, status: IncidentStatus.OPEN },
        }),
        this.prisma.incident.count({
          where: { ...where, status: IncidentStatus.ASSIGNED },
        }),
        this.prisma.incident.count({
          where: { ...where, status: IncidentStatus.IN_PROGRESS },
        }),
        this.prisma.incident.count({
          where: { ...where, status: IncidentStatus.RESOLVED },
        }),
        this.prisma.incident.count({
          where: { ...where, status: IncidentStatus.CLOSED },
        }),
      ]);

    return {
      total,
      byStatus: {
        open,
        assigned,
        inProgress,
        resolved,
        closed,
      },
    };
  }

  /**
   * Get incident by ID
   * TECHNICIAN can only view their assigned incidents
   */
  async findOne(id: string, user: any) {
    const incident = await this.prisma.incident.findFirst({
      where: { id },
      include: {
        store: true,
        equipment: true,
        assignee: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            email: true,
            roles: { select: { role: true } },
          },
        },
        assignees: {
          select: {
            id: true,
            userId: true,
            assignedAt: true,
            checkedInAt: true,
            checkInLatitude: true,
            checkInLongitude: true,
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
              },
            },
          },
          orderBy: { assignedAt: 'asc' as const },
        },
        createdBy: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            email: true,
            roles: { select: { role: true } },
          },
        },
        resolvedBy: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            email: true,
            roles: { select: { role: true } },
          },
        },
        confirmedBy: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            email: true,
            roles: { select: { role: true } },
          },
        },
        spareParts: true,
        outsourceJobs: {
          select: {
            id: true,
            jobCode: true,
            title: true,
            status: true,
            urgencyLevel: true,
            budgetMin: true,
            budgetMax: true,
            agreedPrice: true,
            postedAt: true,
            awardedTo: {
              select: { id: true, firstName: true, lastName: true },
            },
            _count: { select: { bids: true } },
          },
          orderBy: { postedAt: 'desc' },
        },
      },
    });

    if (!incident) {
      throw new NotFoundException(`ไม่พบ Incident ${id}`);
    }

    // TECHNICIAN: Can only view assigned incidents (check junction table)
    if (this.hasOnlyRole(user, UserRole.TECHNICIAN)) {
      const isAssigned = incident.assignees?.some(a => a.user.id === user.id) || incident.assigneeId === user.id;
      if (!isAssigned) {
        throw new ForbiddenException(
          'คุณสามารถดูได้เฉพาะ Incident ที่ได้รับมอบหมายเท่านั้น',
        );
      }
    }

    return incident;
  }

  /**
   * Update incident
   */
  async update(id: string, updateIncidentDto: UpdateIncidentDto, userId: number) {
    const incident = await this.prisma.incident.findFirst({
      where: { id },
    });

    if (!incident) {
      throw new NotFoundException(`ไม่พบ Incident ${id}`);
    }

    return this.prisma.incident.update({
      where: { id },
      data: {
        ...updateIncidentDto,
        updatedAt: new Date(),
      },
      include: {
        store: true,
        equipment: true,
        assignee: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            email: true,
            roles: { select: { role: true } },
          },
        },
      },
    });
  }

  /**
   * Assign incident to technician
   * Only SUPERVISOR can assign
   */
  async assign(id: string, technicianIds: number[], userId: number, scheduledAt?: Date, scheduleReason?: string) {
    const incident = await this.prisma.incident.findFirst({
      where: { id },
      include: { store: { select: { slaRegion: true } } },
    });

    if (!incident) {
      throw new NotFoundException(`ไม่พบ Incident ${id}`);
    }

    // Only incidents that requested onsite can be assigned
    if ((incident as any).resolutionType !== 'ONSITE') {
      throw new BadRequestException(
        'สามารถมอบหมายช่างเทคนิคได้เฉพาะ Incident ที่ร้องขอ Onsite เท่านั้น',
      );
    }

    if (!technicianIds || technicianIds.length === 0) {
      throw new BadRequestException('กรุณาเลือกช่างเทคนิคอย่างน้อย 1 คน');
    }

    // Verify all technicians exist and have TECHNICIAN role
    const technicians = await this.prisma.user.findMany({
      where: {
        id: { in: technicianIds },
        roles: { some: { role: UserRole.TECHNICIAN } },
      },
    });

    if (technicians.length !== technicianIds.length) {
      const foundIds = technicians.map(t => t.id);
      const invalidIds = technicianIds.filter(tid => !foundIds.includes(tid));
      throw new BadRequestException(
        `ผู้ใช้ ID ${invalidIds.join(', ')} ไม่ใช่ช่างเทคนิค`,
      );
    }

    // Recalculate slaDeadline from scheduledAt if provided
    let newSlaDeadline: Date | undefined;
    if (scheduledAt) {
      const storeRegion = (incident as any).store?.slaRegion as SlaRegion ?? SlaRegion.BANGKOK_METRO;
      newSlaDeadline = await this.slaService.calculateSlaDeadline(
        incident.priority,
        scheduledAt,
        storeRegion,
      );
    }

    // Transaction: update incident + sync junction table
    const updated = await this.prisma.$transaction(async (tx) => {
      const inc = await tx.incident.update({
        where: { id },
        data: {
          assigneeId: technicianIds[0], // backward compat
          status: IncidentStatus.ASSIGNED,
          ...(scheduledAt && { scheduledAt }),
          ...(scheduleReason && { scheduledReason: scheduleReason }),
          ...(newSlaDeadline && { slaDeadline: newSlaDeadline }),
          updatedAt: new Date(),
        },
        include: {
          store: true,
          assignee: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              email: true,
              roles: { select: { role: true } },
            },
          },
        },
      });

      // Clear old assignees and create new
      await tx.incidentAssignee.deleteMany({ where: { incidentId: id } });
      await tx.incidentAssignee.createMany({
        data: technicianIds.map(tid => ({
          incidentId: id,
          userId: tid,
        })),
      });

      return inc;
    });

    // Create history entry
    const techNames = technicians.map(t => `${t.firstName} ${t.lastName}`).join(', ');
    const scheduleNote = scheduledAt
      ? ` (กำหนดเวลา: ${scheduledAt.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' })} ${scheduledAt.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}${scheduleReason ? ` | เหตุผล: ${scheduleReason}` : ''})`
      : '';
    await this.historyService.createHistory(
      id,
      IncidentAction.ASSIGNED,
      userId,
      incident.status,
      IncidentStatus.ASSIGNED,
      `Assigned to ${techNames}${scheduleNote}`,
    );

    // Audit trail
    await this.auditTrailService.logDirect({
      module: AuditModule.INCIDENT,
      action: AuditAction.ASSIGN,
      entityType: 'Incident',
      entityId: id,
      userId,
      description: `มอบหมาย Incident "${updated.ticketNumber}" ให้ ${techNames}`,
    });

    // Send notification to all assigned technicians
    for (const tid of technicianIds) {
      await this.notificationsService.notifyIncidentAssigned(
        tid,
        id,
        updated.ticketNumber,
        updated.title,
        scheduledAt,
        scheduleReason,
      );
    }

    // Notify all supervisors that an assignment was made (exclude assignees already notified above)
    const scheduleText = scheduledAt
      ? ` (กำหนดเวลา: ${scheduledAt.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' })} ${scheduledAt.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })})`
      : '';
    await this.notificationsService.notifyAllSupervisors(
      NotificationType.INCIDENT_ASSIGNED,
      'งานถูกมอบหมายแล้ว',
      `${updated.ticketNumber} - ${updated.title} ถูกมอบหมายให้ ${techNames}${scheduleText}`,
      id,
      technicianIds,
    );

    return updated;
  }

  /**
   * Reassign incident to technician(s)
   * Only SUPERVISOR can reassign
   */
  async reassign(
    id: string,
    technicianIds: number[],
    reassignReason: string,
    userId: number,
  ) {
    const incident = await this.prisma.incident.findFirst({
      where: { id },
      include: {
        assignees: { select: { userId: true } },
      },
    });

    if (!incident) {
      throw new NotFoundException(`ไม่พบ Incident ${id}`);
    }

    if (!incident.assigneeId && (!incident.assignees || incident.assignees.length === 0)) {
      throw new BadRequestException('Incident ยังไม่ได้มอบหมายให้ใคร');
    }

    // ---- UNASSIGN: empty technicianIds → remove all assignees + revert to OPEN ----
    if (!technicianIds || technicianIds.length === 0) {
      const updated = await this.prisma.$transaction(async (tx) => {
        const inc = await tx.incident.update({
          where: { id },
          data: {
            assigneeId: null,
            status: IncidentStatus.OPEN,
            updatedAt: new Date(),
          },
          include: {
            store: true,
            assignee: {
              select: {
                id: true,
                username: true,
                firstName: true,
                lastName: true,
                email: true,
                roles: { select: { role: true } },
              },
            },
          },
        });

        await tx.incidentAssignee.deleteMany({ where: { incidentId: id } });

        return inc;
      });

      await this.historyService.createHistory(
        id,
        IncidentAction.UNASSIGNED,
        userId,
        incident.status,
        IncidentStatus.OPEN,
        `ยกเลิกการมอบหมาย${reassignReason ? `. เหตุผล: ${reassignReason}` : ''}`,
      );

      await this.auditTrailService.logDirect({
        module: AuditModule.INCIDENT,
        action: AuditAction.REASSIGN,
        entityType: 'Incident',
        entityId: id,
        userId,
        description: `ยกเลิกการมอบหมาย Incident ${incident.ticketNumber || id}${reassignReason ? `. เหตุผล: ${reassignReason}` : ''}`,
      });

      return updated;
    }

    // Verify all new technicians exist and have TECHNICIAN role
    const technicians = await this.prisma.user.findMany({
      where: {
        id: { in: technicianIds },
        roles: { some: { role: UserRole.TECHNICIAN } },
      },
    });

    if (technicians.length !== technicianIds.length) {
      const foundIds = technicians.map(t => t.id);
      const invalidIds = technicianIds.filter(tid => !foundIds.includes(tid));
      throw new BadRequestException(
        `ผู้ใช้ ID ${invalidIds.join(', ')} ไม่ใช่ช่างเทคนิค`,
      );
    }

    // Transaction: update incident + sync junction table
    const updated = await this.prisma.$transaction(async (tx) => {
      const inc = await tx.incident.update({
        where: { id },
        data: {
          assigneeId: technicianIds[0], // backward compat
          notes: reassignReason,
          updatedAt: new Date(),
        },
        include: {
          store: true,
          assignee: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              email: true,
              roles: { select: { role: true } },
            },
          },
        },
      });

      // Clear old assignees and create new
      await tx.incidentAssignee.deleteMany({ where: { incidentId: id } });
      await tx.incidentAssignee.createMany({
        data: technicianIds.map(tid => ({
          incidentId: id,
          userId: tid,
        })),
      });

      return inc;
    });

    // Create history entry
    const techNames = technicians.map(t => `${t.firstName} ${t.lastName}`).join(', ');
    await this.historyService.createHistory(
      id,
      IncidentAction.REASSIGNED,
      userId,
      incident.status,
      incident.status,
      `Reassigned to ${techNames}. Reason: ${reassignReason}`,
    );

    // Audit trail
    await this.auditTrailService.logDirect({
      module: AuditModule.INCIDENT,
      action: AuditAction.REASSIGN,
      entityType: 'Incident',
      entityId: id,
      userId,
      description: `โอนย้าย Incident ${incident.ticketNumber || id} ไปยัง ${techNames} เหตุผล: ${reassignReason}`,
    });

    // Send notification to all new technicians
    for (const tid of technicianIds) {
      await this.notificationsService.notifyIncidentReassigned(
        tid,
        id,
        updated.ticketNumber,
        updated.title,
      );
    }

    return updated;
  }

  /**
   * Accept incident (Legacy - optional)
   * TECHNICIAN accepts assigned incident
   */
  async accept(id: string, userId: number) {
    const incident = await this.prisma.incident.findFirst({
      where: { id },
    });

    if (!incident) {
      throw new NotFoundException(`ไม่พบ Incident ${id}`);
    }

    const isAssigned = await this.isAssignedToIncident(id, userId);
    if (!isAssigned && incident.assigneeId !== userId) {
      throw new ForbiddenException('เฉพาะช่างเทคนิคที่ได้รับมอบหมายเท่านั้นที่สามารถรับงานได้');
    }

    if (incident.status !== IncidentStatus.ASSIGNED) {
      throw new BadRequestException(
        `Incident ต้องอยู่ในสถานะ "มอบหมายแล้ว" เพื่อรับงาน สถานะปัจจุบัน: ${incident.status}`,
      );
    }

    return this.prisma.incident.update({
      where: { id },
      data: {
        status: IncidentStatus.IN_PROGRESS,
        updatedAt: new Date(),
      },
      include: {
        store: true,
        assignee: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            email: true,
            roles: { select: { role: true } },
          },
        },
      },
    });
  }

  /**
   * Check if equipment is under service warranty from a recently closed incident
   * Returns the most recent closed incident within warranty period, if any
   */
  /**
   * Check if there is an open (non-CLOSED, non-CANCELLED) incident for the same store + equipment
   * Used to prevent duplicate incidents for the same equipment
   */
  async duplicateCheck(equipmentIds: number[], storeId: number) {
    if (!equipmentIds.length || !storeId) return { hasDuplicate: false, incident: null };

    const incident = await this.prisma.incident.findFirst({
      where: {
        storeId,
        status: {
          notIn: [IncidentStatus.CLOSED, IncidentStatus.CANCELLED],
        },
        OR: [
          { equipmentId: { in: equipmentIds } },
          { equipmentIds: { hasSome: equipmentIds } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        ticketNumber: true,
        title: true,
        status: true,
        createdAt: true,
        store: { select: { name: true, storeCode: true } },
      },
    });

    if (!incident) return { hasDuplicate: false, incident: null };

    return {
      hasDuplicate: true,
      incident: {
        id: incident.id,
        ticketNumber: incident.ticketNumber,
        title: incident.title,
        status: incident.status,
        createdAt: incident.createdAt,
        storeName: incident.store?.name || incident.store?.storeCode,
      },
    };
  }

  async warrantyCheck(equipmentIds: number[], storeId: number) {
    // Get service warranty days from SystemConfig (default 30)
    const config = await this.prisma.systemConfig.findUnique({
      where: { key: 'service_warranty_days' },
    });
    const warrantyDays = config ? parseInt(config.value) : 30;
    if (warrantyDays <= 0) return { hasWarranty: false, incident: null };

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - warrantyDays);

    // Find the most recent CLOSED incident for this store + any of these equipment IDs
    const incident = await this.prisma.incident.findFirst({
      where: {
        storeId,
        status: IncidentStatus.CLOSED,
        confirmedAt: { gte: cutoffDate },
        OR: [
          { equipmentId: { in: equipmentIds } },
          { equipmentIds: { hasSome: equipmentIds } },
        ],
      },
      orderBy: { confirmedAt: 'desc' },
      select: {
        id: true,
        ticketNumber: true,
        title: true,
        confirmedAt: true,
        equipmentId: true,
        equipmentIds: true,
        store: { select: { name: true, storeCode: true } },
      },
    });

    if (!incident) return { hasWarranty: false, incident: null, warrantyDays };

    return {
      hasWarranty: true,
      warrantyDays,
      incident: {
        id: incident.id,
        ticketNumber: incident.ticketNumber,
        title: incident.title,
        closedAt: incident.confirmedAt,
        storeName: incident.store?.name || incident.store?.storeCode,
      },
    };
  }

  /**
   * Cancel incident
   * Only HELP_DESK can cancel
   */
  async cancel(id: string, cancellationReason: string, userId: number) {
    const incident = await this.prisma.incident.findFirst({
      where: { id },
    });

    if (!incident) {
      throw new NotFoundException(`ไม่พบ Incident ${id}`);
    }

    if (incident.status === IncidentStatus.CLOSED) {
      throw new BadRequestException('ไม่สามารถยกเลิก Incident ที่ปิดแล้วได้');
    }

    const wasCheckedIn = !!(incident as any).checkInAt;

    const updated = await this.prisma.incident.update({
      where: { id },
      data: {
        status: IncidentStatus.CANCELLED,
        notes: cancellationReason,
        cancelledAfterCheckin: wasCheckedIn,
        updatedAt: new Date(),
      },
      include: {
        store: true,
        assignee: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            email: true,
            roles: { select: { role: true } },
          },
        },
      },
    });

    // Create history entry
    const historyDetails = wasCheckedIn
      ? `Incident cancelled after technician check-in. Reason: ${cancellationReason}`
      : `Incident cancelled. Reason: ${cancellationReason}`;

    await this.historyService.createHistory(
      id,
      IncidentAction.CANCELLED,
      userId,
      incident.status,
      IncidentStatus.CANCELLED,
      historyDetails,
    );

    // Audit trail
    await this.auditTrailService.logDirect({
      module: AuditModule.INCIDENT,
      action: AuditAction.CANCEL,
      entityType: 'Incident',
      entityId: id,
      userId,
      description: `ยกเลิก Incident ${incident.ticketNumber || id} สถานะเดิม: ${incident.status} เหตุผล: ${cancellationReason}${wasCheckedIn ? ' (ยกเลิกหลัง Check-in)' : ''}`,
    });

    // Notify supervisors if cancelled after check-in
    if (wasCheckedIn) {
      await this.notificationsService.notifyIncidentCancelledAfterCheckin(
        id,
        incident.ticketNumber || id,
        incident.title,
        (incident as any).checkInAt,
      );
    }

    return updated;
  }

  /**
   * ✅ UPDATED: Reopen incident with tracking
   * Only HELP_DESK can reopen closed incidents
   * Status: CLOSED → IN_PROGRESS
   * Updates reopen tracking fields
   */
  async reopen(id: string, reopenReason: string, assignTo: number | undefined, userId: number) {
    const incident = await this.prisma.incident.findFirst({
      where: { id },
      include: { assignees: { select: { userId: true } } },
    });

    if (!incident) {
      throw new NotFoundException(`ไม่พบ Incident ${id}`);
    }

    if (incident.status !== IncidentStatus.CLOSED) {
      throw new BadRequestException('สามารถเปิด Incident ใหม่ได้เฉพาะ Incident ที่ปิดแล้วเท่านั้น');
    }

    // Check if this was a direct-closed incident (Phone/Remote Support)
    const wasDirectClosed = (incident as any).resolutionType === 'PHONE_SUPPORT' || (incident as any).resolutionType === 'REMOTE_SUPPORT';

    // All reopened incidents go to OPEN status
    // - Direct-closed: resolutionType = null (Helpdesk can choose again)
    // - Onsite: resolutionType = ONSITE (auto Request Onsite → Supervisor reassigns)
    const updateData: any = {
      status: IncidentStatus.OPEN,
      reopenReason,
      reopenCount: { increment: 1 },
      lastReopenedAt: new Date(),
      lastReopenedById: userId,
      assigneeId: null,
      resolvedAt: null,
      resolvedById: null,
      techConfirmedAt: null,
      techConfirmedById: null,
      confirmedAt: null,
      confirmedById: null,
      updatedAt: new Date(),
    };
    if (wasDirectClosed) {
      updateData.resolutionType = null;
      updateData.resolutionNote = null;
    } else {
      // Onsite: auto Request Onsite so Supervisor can reassign
      updateData.resolutionType = 'ONSITE';
      updateData.resolutionNote = null;
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const inc = await tx.incident.update({
        where: { id },
        data: updateData,
        include: {
          store: true,
          assignee: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              email: true,
              roles: { select: { role: true } },
            },
          },
          lastReopenedBy: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              email: true,
              roles: { select: { role: true } },
            },
          },
        },
      });
      // Clear assignees from junction table
      await tx.incidentAssignee.deleteMany({ where: { incidentId: id } });
      return inc;
    });

    // Create history entry
    const reopenDetail = wasDirectClosed
      ? 'Incident reopened for re-triage'
      : 'Incident reopened as Request Onsite (auto)';
    await this.historyService.createHistory(
      id,
      IncidentAction.REOPENED,
      userId,
      IncidentStatus.CLOSED,
      IncidentStatus.OPEN,
      `${reopenDetail}. Reason: ${reopenReason}`,
    );

    // Audit trail
    await this.auditTrailService.logDirect({
      module: AuditModule.INCIDENT,
      action: AuditAction.REOPEN,
      entityType: 'Incident',
      entityId: id,
      userId,
      description: `เปิด Incident ${incident.ticketNumber || id} ใหม่ เหตุผล: ${reopenReason}`,
    });

    if (!wasDirectClosed) {
      // Onsite reopen: notify all supervisors for reassignment
      const supervisors = await this.prisma.user.findMany({
        where: { roles: { some: { role: UserRole.SUPERVISOR } } },
        select: { id: true },
      });
      for (const sup of supervisors) {
        if (sup.id !== userId) {
          await this.notificationsService.createNotification(
            sup.id,
            'INCIDENT_REOPENED' as any,
            `Incident ${updated.ticketNumber} ถูกเปิดใหม่และต้องการมอบหมายช่าง Onsite`,
            `/dashboard/incidents/${id}`,
          );
        }
      }

      // Notify old technicians that incident was reopened
      const oldAssigneeIds = incident.assignees?.map(a => a.userId) || [];
      if (oldAssigneeIds.length === 0 && incident.assigneeId) {
        oldAssigneeIds.push(incident.assigneeId);
      }
      for (const oldTechId of oldAssigneeIds) {
        if (oldTechId !== userId) {
          await this.notificationsService.notifyIncidentReopened(
            oldTechId,
            id,
            updated.ticketNumber,
            updated.title,
            reopenReason,
          );
        }
      }
    }

    // Send notification to incident creator
    if (incident.createdById !== userId) {
      await this.notificationsService.notifyIncidentReopened(
        incident.createdById,
        id,
        updated.ticketNumber,
        updated.title,
        reopenReason,
      );
    }

    return updated;
  }

  /**
   * Delete incident (hard delete)
   * Only HELP_DESK can delete
   */
  async remove(id: string, userId: number) {
    const incident = await this.prisma.incident.findFirst({
      where: { id },
    });

    if (!incident) {
      throw new NotFoundException(`ไม่พบ Incident ${id}`);
    }

    await this.prisma.incident.delete({
      where: { id },
    });

    return { message: `ลบ Incident ${id} สำเร็จ` };
  }

  /**
   * ========================================
   * TECHNICIAN WORKFLOW - NEW METHODS
   * ========================================
   */

  /**
   * Submit Response: Technician provides ETA and message before going onsite
   * Only assigned technician can respond
   * Status: Must be ASSIGNED
   * Optional but tracked for performance scoring
   */
  async submitResponse(
    id: string,
    userId: number,
    dto: SubmitResponseDto,
  ) {
    const incident = await this.prisma.incident.findFirst({
      where: { id },
      include: {
        assignee: true,
        store: true,
      },
    });

    if (!incident) {
      throw new NotFoundException(`ไม่พบ Incident ${id}`);
    }

    // Only assigned technician can respond
    const isAssignedForResponse = await this.isAssignedToIncident(id, userId);
    if (!isAssignedForResponse && incident.assigneeId !== userId) {
      throw new ForbiddenException('เฉพาะช่างเทคนิคที่ได้รับมอบหมายเท่านั้นที่สามารถตอบรับงานได้');
    }

    // Must be in ASSIGNED status
    if (incident.status !== IncidentStatus.ASSIGNED) {
      throw new BadRequestException(
        `Incident ต้องอยู่ในสถานะ "มอบหมายแล้ว" เพื่อตอบรับงาน สถานะปัจจุบัน: ${incident.status}`,
      );
    }

    const estimatedArrivalTime = new Date(dto.estimatedArrivalTime);

    // Update incident with response data
    const updated = await this.prisma.incident.update({
      where: { id },
      data: {
        respondedAt: new Date(),
        respondedById: userId,
        estimatedArrivalTime,
        responseMessage: dto.responseMessage,
        updatedAt: new Date(),
      },
      include: {
        store: true,
        assignee: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            roles: { select: { role: true } },
          },
        },
      },
    });

    // Create history entry
    const etaFormatted = estimatedArrivalTime.toLocaleString('th-TH', {
      timeZone: 'Asia/Bangkok',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    await this.historyService.createHistory(
      id,
      IncidentAction.TECHNICIAN_RESPONDED,
      userId,
      IncidentStatus.ASSIGNED,
      IncidentStatus.ASSIGNED,
      `ตอบรับงาน - คาดว่าจะถึง: ${etaFormatted}\nข้อความ: ${dto.responseMessage}`,
    );

    // Notify all supervisors about response
    await this.notificationsService.notifyAllSupervisors(
      NotificationType.INCIDENT_RESPONDED,
      'Technician Responded',
      `${incident.assignee?.firstName} ${incident.assignee?.lastName} ตอบรับงาน ${updated.ticketNumber} - คาดว่าจะถึง ${etaFormatted}`,
      id,
    );

    // Send email notification using close_notification_to settings
    try {
      const emailSettings = await this.settingsService.getEmailSettings();
      if (emailSettings?.closeNotificationTo) {
        const ccList: string[] = emailSettings.closeNotificationCc
          ? emailSettings.closeNotificationCc.split(',').map((e: string) => e.trim()).filter(Boolean)
          : [];

        // CC store email if enabled
        if (emailSettings.ccStoreEmail && updated.store?.email) {
          ccList.push(updated.store.email);
        }

        await this.emailService.sendTechnicianResponseEmail({
          to: emailSettings.closeNotificationTo,
          cc: ccList.length > 0 ? ccList : undefined,
          ticketNumber: updated.ticketNumber,
          title: updated.title,
          storeName: updated.store?.name || updated.storeName || 'N/A',
          storeCode: updated.store?.storeCode || updated.storeCode || '',
          technicianName: `${updated.assignee?.firstName || ''} ${updated.assignee?.lastName || ''}`.trim(),
          technicianPhone: updated.assignee?.phone || undefined,
          estimatedArrivalTime,
          responseMessage: dto.responseMessage,
        });
      }
    } catch (emailError) {
      console.error('Failed to send response notification email:', emailError);
      // Don't throw - email failure shouldn't block the response
    }

    return updated;
  }

  /**
   * Check-in: Upload before photos and start work
   * All assigned technicians can check-in independently
   * Status: ASSIGNED → IN_PROGRESS (first check-in), stays IN_PROGRESS for subsequent
   * GPS coordinates are optional but recommended
   */
  async checkin(
    id: string,
    beforePhotos: string[],
    userId: number,
    checkInLatitude?: number,
    checkInLongitude?: number,
  ) {
    const incident = await this.prisma.incident.findFirst({
      where: { id },
      include: { assignee: true },
    });

    if (!incident) {
      throw new NotFoundException(`ไม่พบ Incident ${id}`);
    }

    // Only assigned technician can check-in
    const isAssignedForCheckin = await this.isAssignedToIncident(id, userId);
    if (!isAssignedForCheckin && incident.assigneeId !== userId) {
      throw new ForbiddenException('เฉพาะช่างเทคนิคที่ได้รับมอบหมายเท่านั้นที่สามารถ Check-in ได้');
    }

    // Must be ASSIGNED or IN_PROGRESS (allow subsequent check-ins until resolved)
    if (incident.status !== IncidentStatus.ASSIGNED && incident.status !== IncidentStatus.IN_PROGRESS) {
      throw new BadRequestException(
        `Incident ต้องอยู่ในสถานะ "มอบหมายแล้ว" หรือ "กำลังดำเนินการ" เพื่อ Check-in สถานะปัจจุบัน: ${incident.status}`,
      );
    }

    // Check if this user already checked in
    const myAssignment = await this.prisma.incidentAssignee.findUnique({
      where: { incidentId_userId: { incidentId: id, userId } },
    });
    if (myAssignment?.checkedInAt) {
      throw new BadRequestException('คุณได้ Check-in ไปแล้ว');
    }

    // Validate max 5 photos
    if (beforePhotos.length > 5) {
      throw new BadRequestException('อัปโหลดรูปก่อนซ่อมได้สูงสุด 5 รูป');
    }

    // Save base64 photos to disk (filter only base64 entries)
    const base64Photos = beforePhotos.filter((p) => p.startsWith('data:'));
    const savedPaths = base64Photos.length > 0
      ? await saveBase64Files(base64Photos, `incidents/${id}`)
      : [];
    const photoPaths = beforePhotos.map((p) =>
      p.startsWith('data:') ? savedPaths.shift()! : p,
    );

    // Add BEFORE watermark to photos
    const watermarkedBeforePhotos = await this.addWatermarkToPhotos(
      photoPaths,
      'BEFORE',
    );

    const now = new Date();
    const isFirstCheckIn = incident.status === IncidentStatus.ASSIGNED;
    const prevStatus = incident.status;

    // Merge new photos with existing (for subsequent check-ins)
    const mergedPhotos = [...(incident.beforePhotos || []), ...watermarkedBeforePhotos];

    // Transaction: update incident + mark assignee as checked in
    const updated = await this.prisma.$transaction(async (tx) => {
      // Update incident: first check-in sets checkInAt + status change; subsequent merges photos
      const incData: any = {
        beforePhotos: mergedPhotos,
        updatedAt: now,
      };
      if (isFirstCheckIn) {
        incData.checkInAt = now;
        incData.checkInLatitude = checkInLatitude ?? null;
        incData.checkInLongitude = checkInLongitude ?? null;
        incData.status = IncidentStatus.IN_PROGRESS;
      }

      const inc = await tx.incident.update({
        where: { id },
        data: incData,
        include: {
          store: true,
          assignee: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              email: true,
              roles: { select: { role: true } },
            },
          },
        },
      });

      // Mark this technician's check-in on junction table.
      // Use upsert because outsource technicians are assigned via incident.assigneeId
      // (in outsource acceptJob) and may not have a row in incidentAssignee yet.
      await tx.incidentAssignee.upsert({
        where: { incidentId_userId: { incidentId: id, userId } },
        create: {
          incidentId: id,
          userId,
          assignedAt: now,
          checkedInAt: now,
          checkInLatitude: checkInLatitude ?? null,
          checkInLongitude: checkInLongitude ?? null,
        },
        update: {
          checkedInAt: now,
          checkInLatitude: checkInLatitude ?? null,
          checkInLongitude: checkInLongitude ?? null,
        },
      });

      return inc;
    });

    // Get user info for history/notification
    const techUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true },
    });

    // Create history entry with GPS info if available
    const gpsInfo = checkInLatitude && checkInLongitude
      ? ` (GPS: ${checkInLatitude.toFixed(6)}, ${checkInLongitude.toFixed(6)})`
      : '';
    await this.historyService.createHistory(
      id,
      IncidentAction.CHECKED_IN,
      userId,
      prevStatus,
      isFirstCheckIn ? IncidentStatus.IN_PROGRESS : prevStatus,
      `${techUser?.firstName} ${techUser?.lastName} checked in with ${beforePhotos.length} before photo(s)${gpsInfo}`,
    );

    // Notify all supervisors about check-in
    await this.notificationsService.notifyAllSupervisors(
      'INCIDENT_CHECKED_IN' as any,
      'Technician Checked In',
      `${techUser?.firstName} ${techUser?.lastName} checked in at ${updated.store?.storeCode || ''} ${updated.store?.name || ''} ${updated.ticketNumber} ${updated.title}`,
      id,
    );

    return updated;
  }

  /**
   * Add more before photos after check-in
   * Only assigned technician can add
   * Status: Must be IN_PROGRESS
   * Max total: 5 photos
   */
  async addBeforePhotos(id: string, newPhotos: string[], userId: number) {
    const incident = await this.prisma.incident.findFirst({
      where: { id },
      include: { assignee: true },
    });

    if (!incident) {
      throw new NotFoundException(`ไม่พบ Incident ${id}`);
    }

    // Only assigned technician can add photos
    const isAssignedForPhotos = await this.isAssignedToIncident(id, userId);
    if (!isAssignedForPhotos && incident.assigneeId !== userId) {
      throw new ForbiddenException('เฉพาะช่างเทคนิคที่ได้รับมอบหมายเท่านั้นที่สามารถเพิ่มรูปได้');
    }

    // Must be in IN_PROGRESS status
    if (incident.status !== IncidentStatus.IN_PROGRESS) {
      throw new BadRequestException(
        `Incident ต้องอยู่ในสถานะ "กำลังดำเนินการ" เพื่อเพิ่มรูป สถานะปัจจุบัน: ${incident.status}`,
      );
    }

    // Check current photo count
    const currentPhotos = incident.beforePhotos || [];
    const totalAfterAdd = currentPhotos.length + newPhotos.length;

    if (totalAfterAdd > 5) {
      const remaining = 5 - currentPhotos.length;
      throw new BadRequestException(
        `สามารถเพิ่มรูปได้อีก ${remaining} รูป (ปัจจุบันมี ${currentPhotos.length} รูป, สูงสุด 5 รูป)`,
      );
    }

    // Save base64 photos to disk
    const base64New = newPhotos.filter((p) => p.startsWith('data:'));
    const savedNew = base64New.length > 0
      ? await saveBase64Files(base64New, `incidents/${id}`)
      : [];
    const newPhotoPaths = newPhotos.map((p) =>
      p.startsWith('data:') ? savedNew.shift()! : p,
    );

    // Add BEFORE watermark to new photos
    const watermarkedNewPhotos = await this.addWatermarkToPhotos(
      newPhotoPaths,
      'BEFORE',
    );

    // Combine with existing photos
    const allBeforePhotos = [...currentPhotos, ...watermarkedNewPhotos];

    // Update incident
    const updated = await this.prisma.incident.update({
      where: { id },
      data: {
        beforePhotos: allBeforePhotos,
        updatedAt: new Date(),
      },
      include: {
        store: true,
        assignee: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            email: true,
            roles: { select: { role: true } },
          },
        },
      },
    });

    // Create history entry
    await this.historyService.createHistory(
      id,
      IncidentAction.UPDATED,
      userId,
      IncidentStatus.IN_PROGRESS,
      IncidentStatus.IN_PROGRESS,
      `Added ${newPhotos.length} before photo(s). Total: ${allBeforePhotos.length}/5`,
    );

    return updated;
  }

  /**
   * ✅ UPDATED: Resolve incident with optional spare parts
   * Only assigned technician can resolve
   * Status: IN_PROGRESS → RESOLVED
   *
   * Supports both OLD and NEW spare parts structure
   */
  async resolveIncident(
    id: string,
    dto: ResolveIncidentDto,
    userId: number,
  ) {
    const incident = await this.prisma.incident.findFirst({
      where: { id },
    });

    if (!incident) {
      throw new NotFoundException(`ไม่พบ Incident ${id}`);
    }

    // Only assigned technician can resolve
    const isAssignedForResolve = await this.isAssignedToIncident(id, userId);
    if (!isAssignedForResolve && incident.assigneeId !== userId) {
      throw new ForbiddenException('เฉพาะช่างเทคนิคที่ได้รับมอบหมายเท่านั้นที่สามารถปิดงานได้');
    }

    // Must be IN_PROGRESS
    if (incident.status !== IncidentStatus.IN_PROGRESS) {
      throw new BadRequestException(
        `Incident ต้องอยู่ในสถานะ "กำลังดำเนินการ" เพื่อปิดงาน สถานะปัจจุบัน: ${incident.status}`,
      );
    }

    // Validate max 20 after photos
    if (dto.afterPhotos && dto.afterPhotos.length > 20) {
      throw new BadRequestException('อัปโหลดรูปหลังซ่อมได้สูงสุด 20 รูป');
    }

    // Validate max 5 signed report photos
    if (dto.signedReportPhotos && dto.signedReportPhotos.length > 5) {
      throw new BadRequestException('อัปโหลดรูป SR ที่เซ็นแล้วได้สูงสุด 5 รูป');
    }

    // Save base64 after photos to disk
    let afterPhotoPaths: string[] = [];
    if (dto.afterPhotos && dto.afterPhotos.length > 0) {
      const base64After = dto.afterPhotos.filter((p) => p.startsWith('data:'));
      const savedAfter = base64After.length > 0
        ? await saveBase64Files(base64After, `incidents/${id}`)
        : [];
      afterPhotoPaths = dto.afterPhotos.map((p) =>
        p.startsWith('data:') ? savedAfter.shift()! : p,
      );
    }

    // Save base64 signed report photos to disk
    let signedReportPaths: string[] = [];
    if (dto.signedReportPhotos && dto.signedReportPhotos.length > 0) {
      const base64Signed = dto.signedReportPhotos.filter((p) => p.startsWith('data:'));
      const savedSigned = base64Signed.length > 0
        ? await saveBase64Files(base64Signed, `incidents/${id}`)
        : [];
      signedReportPaths = dto.signedReportPhotos.map((p) =>
        p.startsWith('data:') ? savedSigned.shift()! : p,
      );
    }

    // Add AFTER watermark to photos
    let watermarkedAfterPhotos: string[] = [];
    if (afterPhotoPaths.length > 0) {
      watermarkedAfterPhotos = await this.addWatermarkToPhotos(
        afterPhotoPaths,
        'AFTER',
      );
    }

    // If used spare parts, must provide spare parts list
    if (dto.usedSpareParts && (!dto.spareParts || dto.spareParts.length === 0)) {
      throw new BadRequestException(
        'กรุณาระบุรายการอะไหล่เมื่อเลือกว่ามีการใช้อะไหล่',
      );
    }

    // ✅ NEW: Validate spare parts structure
    if (dto.usedSpareParts && dto.spareParts) {
      for (let i = 0; i < dto.spareParts.length; i++) {
        const sp = dto.spareParts[i];

        // COMPONENT_REPLACEMENT validation
        if (sp.repairType === 'COMPONENT_REPLACEMENT') {
          if (!sp.componentName) {
            throw new BadRequestException(
              `อะไหล่ #${i + 1}: กรุณาระบุชื่อชิ้นส่วน`,
            );
          }
          if (!sp.oldComponentSerial) {
            throw new BadRequestException(
              `อะไหล่ #${i + 1}: กรุณาระบุ Serial เดิมของชิ้นส่วน`,
            );
          }
          if (!sp.newComponentSerial) {
            throw new BadRequestException(
              `อะไหล่ #${i + 1}: กรุณาระบุ Serial ใหม่ของชิ้นส่วน`,
            );
          }
        } else if (sp.oldDeviceName || sp.newDeviceName) {
          // EQUIPMENT_REPLACEMENT - NEW structure validation
          if (!sp.oldDeviceName) {
            throw new BadRequestException(
              `อะไหล่ #${i + 1}: กรุณาระบุชื่ออุปกรณ์เดิม`,
            );
          }
          if (!sp.oldSerialNo) {
            throw new BadRequestException(
              `อะไหล่ #${i + 1}: กรุณาระบุ Serial No. อุปกรณ์เดิม`,
            );
          }
          if (!sp.newDeviceName) {
            throw new BadRequestException(
              `อะไหล่ #${i + 1}: กรุณาระบุชื่ออุปกรณ์ใหม่`,
            );
          }
          if (!sp.newSerialNo) {
            throw new BadRequestException(
              `อะไหล่ #${i + 1}: กรุณาระบุ Serial No. อุปกรณ์ใหม่`,
            );
          }
          if (!sp.replacementType) {
            throw new BadRequestException(
              `อะไหล่ #${i + 1}: กรุณาระบุประเภทการเปลี่ยน (ถาวร หรือ ชั่วคราว)`,
            );
          }
        } else {
          // OLD structure validation (legacy)
          if (!sp.deviceName) {
            throw new BadRequestException(
              `อะไหล่ #${i + 1}: กรุณาระบุชื่ออุปกรณ์`,
            );
          }
        }
      }
    }

    // Update incident and create spare parts in transaction
    return this.prisma.$transaction(async (prisma) => {
      // Update incident
      const updated = await prisma.incident.update({
        where: { id },
        data: {
          resolutionNote: dto.resolutionNote,
          usedSpareParts: dto.usedSpareParts,
          afterPhotos: watermarkedAfterPhotos,
          ...(signedReportPaths.length > 0 ? { signedReportPhotos: signedReportPaths } : {}),
          resolvedAt: new Date(),
          resolvedById: userId,
          status: IncidentStatus.RESOLVED,
          updatedAt: new Date(),
        },
      });

      // ✅ Create spare parts with transformed data and update Equipment
      if (dto.usedSpareParts && dto.spareParts) {
        const transformedSpareParts = this.transformSparePartsData(dto.spareParts);

        // Process each spare part with equipment tracking
        for (let i = 0; i < dto.spareParts.length; i++) {
          const originalSp = dto.spareParts[i];
          const transformedSp = transformedSpareParts[i];

          // Create spare part record with equipment links
          await prisma.sparePart.create({
            data: {
              incidentId: id,
              repairType: (transformedSp.repairType as RepairType) || RepairType.EQUIPMENT_REPLACEMENT,
              deviceName: transformedSp.deviceName,
              oldSerialNo: transformedSp.oldSerialNo,
              newSerialNo: transformedSp.newSerialNo,
              newBrand: originalSp.newBrand || null,
              newModel: originalSp.newModel || null,
              notes: transformedSp.notes,
              // Equipment Replacement fields
              oldEquipmentId: originalSp.oldEquipmentId || null,
              newEquipmentId: originalSp.newEquipmentId || null,
              // Component Replacement fields
              componentName: transformedSp.componentName || null,
              oldComponentSerial: transformedSp.oldComponentSerial || null,
              newComponentSerial: transformedSp.newComponentSerial || null,
              parentEquipmentId: transformedSp.parentEquipmentId || null,
            },
          });
          // Equipment sync is deferred to confirmClose() when Helpdesk confirms
        }
      }

      // Create history entry
      const sparePartsInfo = dto.usedSpareParts && dto.spareParts && dto.spareParts.length > 0
        ? ` with ${dto.spareParts.length} spare part(s)`
        : '';
      await this.historyService.createHistory(
        id,
        IncidentAction.RESOLVED,
        userId,
        IncidentStatus.IN_PROGRESS,
        IncidentStatus.RESOLVED,
        `Incident resolved${sparePartsInfo}`,
      );

      // Audit trail
      await this.auditTrailService.log(prisma, {
        module: AuditModule.INCIDENT,
        action: AuditAction.RESOLVE,
        entityType: 'Incident',
        entityId: id,
        userId,
        description: `แก้ไข Incident ${incident.ticketNumber || id} สำเร็จ${sparePartsInfo}`,
      });

      // Get incident with creator info for notification
      const result = await prisma.incident.findFirst({
        where: { id },
        include: {
          store: true,
          createdBy: {
            include: { roles: { select: { role: true } } },
          },
          assignee: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              email: true,
              roles: { select: { role: true } },
            },
          },
          resolvedBy: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              email: true,
              roles: { select: { role: true } },
            },
          },
          spareParts: true,
        },
      });

      // Send notification to incident creator (skip if creator is Help Desk — they get notified at techConfirmResolve)
      if (result && result.createdById !== userId) {
        const creatorIsHelpDesk = result.createdBy?.roles?.some(
          (r: any) => r.role === UserRole.HELP_DESK,
        );
        if (!creatorIsHelpDesk) {
          await this.notificationsService.notifyIncidentResolved(
            result.createdById,
            id,
            result.ticketNumber,
            result.title,
          );
        }
      }

      // Help Desk notification is now sent when technician confirms resolve (techConfirmResolve)

      return result;
    });
  }

  /**
   * ✅ UPDATED: Update resolution before Help Desk confirms
   * Only technician who resolved can update
   * Status: Must be RESOLVED (not CLOSED)
   * 
   * Supports both OLD and NEW spare parts structure
   */
  async updateResolve(
    id: string,
    dto: UpdateResolveDto,
    userId: number,
  ) {
    const incident = await this.prisma.incident.findFirst({
      where: { id },
      include: { spareParts: true },
    });

    if (!incident) {
      throw new NotFoundException(`ไม่พบ Incident ${id}`);
    }

    // Only technician who resolved can update
    if (!incident.resolvedById || incident.resolvedById !== userId) {
      throw new ForbiddenException('เฉพาะช่างเทคนิคที่ปิดงานเท่านั้นที่สามารถแก้ไขได้');
    }

    // Must be RESOLVED (not yet confirmed)
    if (incident.status !== IncidentStatus.RESOLVED) {
      throw new BadRequestException(
        'สามารถแก้ไขได้เฉพาะก่อนที่ Help Desk จะยืนยันเท่านั้น',
      );
    }

    // Validate photos limits
    if (dto.afterPhotos && dto.afterPhotos.length > 20) {
      throw new BadRequestException('อัปโหลดรูปหลังซ่อมได้สูงสุด 20 รูป');
    }

    // ✅ NEW: Validate spare parts if provided
    if (dto.spareParts) {
      for (let i = 0; i < dto.spareParts.length; i++) {
        const sp = dto.spareParts[i];

        // COMPONENT_REPLACEMENT validation
        if (sp.repairType === 'COMPONENT_REPLACEMENT') {
          if (!sp.componentName || !sp.oldComponentSerial || !sp.newComponentSerial) {
            throw new BadRequestException(
              `อะไหล่ #${i + 1}: กรุณากรอกข้อมูลชิ้นส่วนให้ครบ (ชื่อ, Serial เดิม, Serial ใหม่)`,
            );
          }
        } else if (sp.oldDeviceName || sp.newDeviceName) {
          // EQUIPMENT_REPLACEMENT - NEW structure validation
          if (!sp.oldDeviceName || !sp.oldSerialNo ||
              !sp.newDeviceName || !sp.newSerialNo ||
              !sp.replacementType) {
            throw new BadRequestException(
              `อะไหล่ #${i + 1}: กรุณากรอกข้อมูลให้ครบทุกฟิลด์`,
            );
          }
        } else {
          // OLD structure validation (legacy)
          if (!sp.deviceName) {
            throw new BadRequestException(
              `อะไหล่ #${i + 1}: กรุณาระบุชื่ออุปกรณ์`,
            );
          }
        }
      }
    }

    return this.prisma.$transaction(async (prisma) => {
      // Build update data
      const updateData: any = {
        updatedAt: new Date(),
      };

      if (dto.resolutionNote !== undefined) {
        updateData.resolutionNote = dto.resolutionNote;
      }

      if (dto.usedSpareParts !== undefined) {
        updateData.usedSpareParts = dto.usedSpareParts;
      }

      if (dto.afterPhotos !== undefined) {
        const base64After = dto.afterPhotos.filter((p) => p.startsWith('data:'));
        const savedAfter = base64After.length > 0 ? await saveBase64Files(base64After, `incidents/${id}`) : [];
        const qAfter = [...savedAfter];
        updateData.afterPhotos = dto.afterPhotos.map((p) => (p.startsWith('data:') ? qAfter.shift()! : p));
        if (updateData.afterPhotos.length > 0) {
          updateData.afterPhotos = await this.addWatermarkToPhotos(updateData.afterPhotos, 'AFTER');
        }
      }

      if (dto.signedReportPhotos !== undefined) {
        const base64Signed = dto.signedReportPhotos.filter((p) => p.startsWith('data:'));
        const savedSigned = base64Signed.length > 0 ? await saveBase64Files(base64Signed, `incidents/${id}`) : [];
        const qSigned = [...savedSigned];
        updateData.signedReportPhotos = dto.signedReportPhotos.map((p) => (p.startsWith('data:') ? qSigned.shift()! : p));
      }

      // If tech had confirmed, reset the confirmation since resolution data changed
      if (incident.techConfirmedAt) {
        updateData.techConfirmedAt = null;
        updateData.techConfirmedById = null;
      }

      // Update incident
      const updated = await prisma.incident.update({
        where: { id },
        data: updateData,
      });

      // ✅ Update spare parts with transformed data
      if (dto.spareParts !== undefined) {
        // Delete old spare parts (no equipment rollback — sync is deferred to confirmClose)
        await prisma.sparePart.deleteMany({
          where: { incidentId: id },
        });

        // Create new spare parts
        if (dto.spareParts.length > 0) {
          const transformedSpareParts = this.transformSparePartsData(dto.spareParts);

          for (let i = 0; i < dto.spareParts.length; i++) {
            const originalSp = dto.spareParts[i];
            const transformedSp = transformedSpareParts[i];

            await prisma.sparePart.create({
              data: {
                incidentId: id,
                repairType: (transformedSp.repairType as RepairType) || RepairType.EQUIPMENT_REPLACEMENT,
                deviceName: transformedSp.deviceName,
                oldSerialNo: transformedSp.oldSerialNo,
                newSerialNo: transformedSp.newSerialNo,
                newBrand: originalSp.newBrand || null,
                newModel: originalSp.newModel || null,
                notes: transformedSp.notes,
                // Equipment Replacement fields
                oldEquipmentId: originalSp.oldEquipmentId || null,
                newEquipmentId: originalSp.newEquipmentId || null,
                // Component Replacement fields
                componentName: transformedSp.componentName || null,
                oldComponentSerial: transformedSp.oldComponentSerial || null,
                newComponentSerial: transformedSp.newComponentSerial || null,
                parentEquipmentId: transformedSp.parentEquipmentId || null,
              },
            });
            // Equipment sync is deferred to confirmClose()
          }
        }
      }

      // Create history entry
      const sparePartsInfo = dto.spareParts && dto.spareParts.length > 0
        ? ` with ${dto.spareParts.length} spare part(s) updated`
        : '';
      await this.historyService.createHistory(
        id,
        IncidentAction.RESOLUTION_UPDATED,
        userId,
        IncidentStatus.RESOLVED,
        IncidentStatus.RESOLVED,
        `Resolution updated${sparePartsInfo}`,
      );

      // Return with relations
      return prisma.incident.findFirst({
        where: { id },
        include: {
          store: true,
          assignee: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              email: true,
              roles: { select: { role: true } },
            },
          },
          resolvedBy: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              email: true,
              roles: { select: { role: true } },
            },
          },
          spareParts: true,
        },
      });
    });
  }

  /**
   * Technician confirms their resolve.
   * Sets techConfirmedAt/techConfirmedById.
   * Sends notification to all HELP_DESK users.
   * Status remains RESOLVED.
   */
  async techConfirmResolve(id: string, userId: number) {
    const incident = await this.prisma.incident.findFirst({
      where: { id },
    });

    if (!incident) {
      throw new NotFoundException(`ไม่พบ Incident ${id}`);
    }

    if (incident.status !== IncidentStatus.RESOLVED) {
      throw new BadRequestException(
        `Incident ต้องอยู่ในสถานะ "แก้ไขแล้ว" เพื่อยืนยัน สถานะปัจจุบัน: ${incident.status}`,
      );
    }

    const isAssigned = await this.isAssignedToIncident(id, userId);
    if (!isAssigned && incident.assigneeId !== userId) {
      throw new ForbiddenException(
        'เฉพาะช่างเทคนิคที่ได้รับมอบหมายเท่านั้นที่สามารถยืนยันได้',
      );
    }

    if (incident.techConfirmedAt) {
      throw new BadRequestException('ช่างเทคนิคยืนยันการปิดงานแล้ว');
    }

    const updated = await this.prisma.incident.update({
      where: { id },
      data: {
        techConfirmedAt: new Date(),
        techConfirmedById: userId,
        updatedAt: new Date(),
      },
      include: {
        store: true,
        assignee: {
          select: {
            id: true, username: true,
            firstName: true, lastName: true, email: true,
            roles: { select: { role: true } },
          },
        },
      },
    });

    // History
    await this.historyService.createHistory(
      id,
      IncidentAction.TECH_CONFIRMED,
      userId,
      IncidentStatus.RESOLVED,
      IncidentStatus.RESOLVED,
      'Technician confirmed resolve',
    );

    // Audit
    await this.auditTrailService.logDirect({
      module: AuditModule.INCIDENT,
      action: AuditAction.CONFIRM,
      entityType: 'Incident',
      entityId: id,
      userId,
      description: `ช่างเทคนิคยืนยันปิดงาน Incident ${incident.ticketNumber || id}`,
    });

    // Notify all Help Desk users
    const helpDeskUsers = await this.prisma.user.findMany({
      where: {
        roles: { some: { role: 'HELP_DESK' } },
        status: 'ACTIVE',
      },
      select: { id: true },
    });

    for (const helpDesk of helpDeskUsers) {
      await this.notificationsService.createNotification(
        helpDesk.id,
        'INCIDENT_RESOLVED' as any,
        'Incident Resolved by Technician',
        `Technician resolved and confirmed incident ${updated.ticketNumber}: ${updated.title}`,
        id,
      );
    }

    return updated;
  }

  /**
   * Help Desk confirm incident closure
   * Only HELP_DESK can confirm
   * Status: RESOLVED → CLOSED
   */
  async confirmClose(id: string, userId: number) {
    const incident = await this.prisma.incident.findFirst({
      where: { id },
    });

    if (!incident) {
      throw new NotFoundException(`ไม่พบ Incident ${id}`);
    }

    // Must be RESOLVED
    if (incident.status !== IncidentStatus.RESOLVED) {
      throw new BadRequestException(
        `Incident ต้องอยู่ในสถานะ "แก้ไขแล้ว" เพื่อยืนยันปิดงาน สถานะปัจจุบัน: ${incident.status}`,
      );
    }

    // Must be tech-confirmed first
    if (!incident.techConfirmedAt) {
      throw new BadRequestException(
        'ช่างเทคนิคยังไม่ได้ยืนยันการปิดงาน กรุณารอช่างยืนยันก่อน',
      );
    }

    const updated = await this.prisma.incident.update({
      where: { id },
      data: {
        status: IncidentStatus.CLOSED,
        confirmedAt: new Date(),
        confirmedById: userId,
        updatedAt: new Date(),
      },
      include: {
        store: true,
        assignee: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            email: true,
            roles: { select: { role: true } },
          },
        },
        resolvedBy: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            email: true,
            roles: { select: { role: true } },
          },
        },
        confirmedBy: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            email: true,
            roles: { select: { role: true } },
          },
        },
        spareParts: true,
      },
    });

    // Create history entry
    await this.historyService.createHistory(
      id,
      IncidentAction.CONFIRMED,
      userId,
      IncidentStatus.RESOLVED,
      IncidentStatus.CLOSED,
      'Incident confirmed and closed by Help Desk',
    );

    // Auto-close linked outsource job (set to VERIFIED → ready for payment)
    await this.prisma.outsourceJob.updateMany({
      where: {
        incidentId: id,
        status: { in: ['OPEN', 'AWARDED', 'IN_PROGRESS', 'COMPLETED'] },
      },
      data: {
        status: 'VERIFIED',
        verificationStatus: 'APPROVED',
        verifiedAt: new Date(),
        verifiedById: userId,
        completedAt: new Date(),
        paymentStatus: 'PENDING_APPROVAL',
      },
    });

    // ✅ Sync Equipment records now that Helpdesk has confirmed close
    const spareParts = await this.prisma.sparePart.findMany({ where: { incidentId: id } });
    for (const sp of spareParts) {
      const originalSp = {
        oldEquipmentId: sp.oldEquipmentId,
        newEquipmentId: sp.newEquipmentId,
        newBrand: (sp as any).newBrand || null,
        newModel: (sp as any).newModel || null,
        newDeviceName: sp.deviceName?.includes(' → ')
          ? sp.deviceName.split(' → ')[1]?.trim()
          : sp.deviceName,
        // Component replacement fields
        parentEquipmentId: sp.parentEquipmentId,
        componentName: sp.componentName,
        oldComponentSerial: sp.oldComponentSerial,
        newComponentSerial: sp.newComponentSerial,
      };
      const transformedSp = {
        repairType: sp.repairType,
        oldSerialNo: sp.oldSerialNo,
        newSerialNo: sp.newSerialNo,
      };
      await this.syncEquipmentFromSparePart(
        this.prisma, originalSp, transformedSp,
        incident.storeId, incident.ticketNumber, userId, id,
      );
    }

    // Audit trail
    await this.auditTrailService.logDirect({
      module: AuditModule.INCIDENT,
      action: AuditAction.CONFIRM,
      entityType: 'Incident',
      entityId: id,
      userId,
      description: `ยืนยันปิด Incident ${incident.ticketNumber || id}`,
    });

    // Collect directly-notified user IDs to exclude from supervisor broadcast
    const directlyNotifiedIds: number[] = [];

    // Send notification to technician who resolved
    if (incident.resolvedById && incident.resolvedById !== userId) {
      await this.notificationsService.notifyIncidentConfirmed(
        incident.resolvedById,
        id,
        updated.ticketNumber,
        updated.title,
      );
      directlyNotifiedIds.push(incident.resolvedById);
    }

    // Send notification to incident creator
    if (incident.createdById !== userId && incident.createdById !== incident.resolvedById) {
      await this.notificationsService.notifyIncidentConfirmed(
        incident.createdById,
        id,
        updated.ticketNumber,
        updated.title,
      );
      directlyNotifiedIds.push(incident.createdById);
    }

    // Notify all supervisors about incident closure (exclude already-notified users)
    await this.notificationsService.notifyAllSupervisors(
      'INCIDENT_CONFIRMED' as any,
      'Incident Closed',
      `Incident ${updated.ticketNumber} has been confirmed and closed: ${updated.title}`,
      id,
      directlyNotifiedIds,
    );

    // Generate rating token for public links
    let ratingToken: string | null = null;
    try {
      ratingToken = await this.ratingsService.generateRatingToken(id);
    } catch (err) {
      console.error('Failed to generate rating token:', err);
    }

    // Generate service report token
    let serviceReportToken: string | null = null;
    try {
      serviceReportToken = await this.generateServiceReportToken(id);
    } catch (err) {
      console.error('Failed to generate service report token:', err);
    }

    // Build public links
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const publicIncidentLink = ratingToken ? `${frontendUrl}/incident/${ratingToken}` : null;
    const ratingLink = ratingToken ? `${frontendUrl}/rate/${ratingToken}` : null;
    const serviceReportLink = serviceReportToken ? `${frontendUrl}/service-report/${serviceReportToken}` : null;

    // Send email notification to customer and CC relevant parties
    try {
      // PM incident: send PM-specific closure email (does NOT depend on creator having an email)
      if (incident.jobType === 'Preventive Maintenance') {
        const pmRecord = await this.prisma.pmRecord.findUnique({
          where: { incidentId: id },
          select: {
            performedAt: true,
            technicianId: true,
            equipmentRecords: {
              select: {
                equipmentId: true,
                condition: true,
                comment: true,
                updatedBrand: true,
                updatedModel: true,
                updatedSerial: true,
                afterPhotos: true,
              },
            },
          },
        });
        if (pmRecord) {
          this.pmService.sendPmCompletionEmail(
            id,
            pmRecord.performedAt || incident.resolvedAt || new Date(),
            pmRecord.technicianId || incident.resolvedById || userId,
            pmRecord.equipmentRecords,
          ).catch((e) => console.error('Failed to send PM closure email:', e));
        }
      }

      // Get customer email (creator's email) — used for standard (non-PM) incidents
      const creator = await this.prisma.user.findUnique({
        where: { id: incident.createdById },
        select: { email: true, firstName: true, lastName: true },
      });

      if (creator && creator.email && incident.jobType !== 'Preventive Maintenance') {
        // Get configured notification recipients from settings
        const emailSettings = await this.settingsService.getEmailSettings();
        const toEmail = emailSettings.closeNotificationTo || creator.email;
        const ccEmails = emailSettings.closeNotificationCc
          ? emailSettings.closeNotificationCc.split(',').map((e: string) => e.trim()).filter(Boolean)
          : [];

        // Enrich spare parts with equipment data (name/position, brand, model) for email display
        let emailSpareParts: any[] = updated.spareParts || [];
        if (emailSpareParts.length > 0) {
          const equipIds = emailSpareParts
            .flatMap((sp: any) => [sp.oldEquipmentId, sp.newEquipmentId, sp.parentEquipmentId])
            .filter(Boolean) as number[];
          if (equipIds.length > 0) {
            const equipments = await this.prisma.equipment.findMany({
              where: { id: { in: equipIds } },
              select: { id: true, name: true, brand: true, model: true },
            });
            const equipMap = new Map(equipments.map((e) => [e.id, e]));

            // Fetch EquipmentLog for old equipments in this incident to recover pre-update brand/model.
            // When new serial is not in Equipment DB, the backend overwrites oldEquipment.brand/model
            // with new device values (UPDATED log action). We use oldValue from the log to restore them.
            const oldEquipIds = emailSpareParts.filter((sp: any) => sp.oldEquipmentId).map((sp: any) => sp.oldEquipmentId);
            const equipLogs = oldEquipIds.length > 0
              ? await this.prisma.equipmentLog.findMany({
                  where: { source: 'INCIDENT', sourceId: id, equipmentId: { in: oldEquipIds } },
                  select: { equipmentId: true, oldValue: true },
                  orderBy: { createdAt: 'asc' },
                })
              : [];
            const logOldValueMap = new Map(equipLogs.map((l) => [l.equipmentId, l.oldValue as any]));

            emailSpareParts = emailSpareParts.map((sp: any) => {
              const currentEquip = sp.oldEquipmentId ? (equipMap.get(sp.oldEquipmentId) ?? null) : null;
              const logOld = sp.oldEquipmentId ? logOldValueMap.get(sp.oldEquipmentId) : null;
              // If log has brand/model old values (UPDATED case), use them to avoid showing new device data
              const oldEquipForEmail = currentEquip ? {
                ...currentEquip,
                brand: logOld?.brand !== undefined ? logOld.brand : currentEquip.brand,
                model: logOld?.model !== undefined ? logOld.model : currentEquip.model,
              } : null;
              return {
                ...sp,
                oldEquipment: oldEquipForEmail,
                newEquipment: sp.newEquipmentId ? (equipMap.get(sp.newEquipmentId) ?? null) : null,
                parentEquipment: sp.parentEquipmentId ? (equipMap.get(sp.parentEquipmentId) ?? null) : null,
              };
            });
          }
        }

        // Common email data (without rating link)
        const commonEmailData = {
          incidentId: id,
          ticketNumber: updated.ticketNumber,
          title: updated.title,
          storeName: updated.store?.name || 'N/A',
          storeCode: updated.store?.storeCode || '',
          technicianName: updated.resolvedBy
            ? `${updated.resolvedBy.firstName} ${updated.resolvedBy.lastName}`
            : 'N/A',
          resolutionNote: incident.resolutionNote || 'No resolution note provided',
          usedSpareParts: incident.usedSpareParts || false,
          spareParts: emailSpareParts,
          checkInAt: incident.checkInAt || null,
          resolvedAt: incident.resolvedAt || new Date(),
          confirmedAt: updated.confirmedAt || new Date(),
          beforePhotos: incident.beforePhotos,
          afterPhotos: incident.afterPhotos,
          signedReportPhotos: incident.signedReportPhotos,
          publicIncidentLink,
          serviceReportLink,
        };

        if (incident.jobType === 'Preventive Maintenance') {
          // PM incident: fetch PM record then send PM-specific closure email
          const pmRecord = await this.prisma.pmRecord.findUnique({
            where: { incidentId: id },
            select: {
              performedAt: true,
              technicianId: true,
              equipmentRecords: {
                select: {
                  equipmentId: true,
                  condition: true,
                  comment: true,
                  updatedBrand: true,
                  updatedModel: true,
                  updatedSerial: true,
                  afterPhotos: true,
                },
              },
            },
          });
          if (pmRecord) {
            this.pmService.sendPmCompletionEmail(
              id,
              pmRecord.performedAt || incident.resolvedAt || new Date(),
              pmRecord.technicianId || incident.resolvedById || userId,
              pmRecord.equipmentRecords,
            ).catch((e) => console.error('Failed to send PM closure email:', e));
          }
        } else {
          // 1) Standard closure email (IT Support + CC team) — WITH rating link
          await this.emailService.sendIncidentClosureEmail({
            ...commonEmailData,
            to: toEmail,
            cc: ccEmails,
            ratingLink,
          });

          // 2) Store email — WITH rating link (only if store email exists and CC store enabled)
          if (emailSettings.ccStoreEmail && updated.store?.email) {
            await this.emailService.sendIncidentClosureEmail({
              ...commonEmailData,
              to: updated.store.email,
              cc: undefined,
              ratingLink,
            });
          }
        }
      }
    } catch (emailError) {
      console.error('Failed to send email notification:', emailError);
      // Don't fail the entire operation if email fails
    }

    return updated;
  }

  /**
   * Resend close email for a CLOSED incident (IT Manager only — for testing/retry)
   */
  async resendCloseEmail(id: string, userId: number) {
    const incident = await this.prisma.incident.findFirst({
      where: { id },
      include: {
        store: true,
        assignee: { select: { id: true, firstName: true, lastName: true, email: true } },
        resolvedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        spareParts: true,
      },
    });

    if (!incident) throw new NotFoundException(`ไม่พบ Incident ${id}`);
    if (incident.status !== IncidentStatus.CLOSED) {
      throw new BadRequestException('Incident ต้องอยู่ในสถานะ CLOSED เท่านั้น');
    }

    // Re-generate tokens (already exist — just fetch)
    let ratingToken: string | null = null;
    try { ratingToken = await this.ratingsService.generateRatingToken(id); } catch {}

    let serviceReportToken: string | null = null;
    try { serviceReportToken = await this.generateServiceReportToken(id); } catch {}

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const publicIncidentLink = ratingToken ? `${frontendUrl}/incident/${ratingToken}` : null;
    const ratingLink = ratingToken ? `${frontendUrl}/rate/${ratingToken}` : null;
    const serviceReportLink = serviceReportToken ? `${frontendUrl}/service-report/${serviceReportToken}` : null;

    // Enrich spare parts
    let emailSpareParts: any[] = incident.spareParts || [];
    if (emailSpareParts.length > 0) {
      const equipIds = emailSpareParts
        .flatMap((sp: any) => [sp.oldEquipmentId, sp.newEquipmentId, sp.parentEquipmentId])
        .filter(Boolean) as number[];
      if (equipIds.length > 0) {
        const equipments = await this.prisma.equipment.findMany({
          where: { id: { in: equipIds } },
          select: { id: true, name: true, brand: true, model: true },
        });
        const equipMap = new Map(equipments.map((e) => [e.id, e]));
        emailSpareParts = emailSpareParts.map((sp: any) => ({
          ...sp,
          oldEquipment: sp.oldEquipmentId ? (equipMap.get(sp.oldEquipmentId) ?? null) : null,
          newEquipment: sp.newEquipmentId ? (equipMap.get(sp.newEquipmentId) ?? null) : null,
          parentEquipment: sp.parentEquipmentId ? (equipMap.get(sp.parentEquipmentId) ?? null) : null,
        }));
      }
    }

    // PM jobs use a separate email template
    if (incident.jobType === 'Preventive Maintenance') {
      const pmRecord = await this.prisma.pmRecord.findUnique({
        where: { incidentId: id },
        select: {
          performedAt: true,
          technicianId: true,
          equipmentRecords: {
            select: {
              equipmentId: true, condition: true, comment: true,
              updatedBrand: true, updatedModel: true, updatedSerial: true, afterPhotos: true,
            },
          },
        },
      });
      if (!pmRecord) throw new BadRequestException('ไม่พบ PM Record สำหรับงานนี้');

      await this.pmService.sendPmCompletionEmail(
        id,
        pmRecord.performedAt || incident.resolvedAt || new Date(),
        pmRecord.technicianId || incident.resolvedById || userId,
        pmRecord.equipmentRecords,
      );

      const emailSettings = await this.settingsService.getEmailSettings();
      const toEmail = emailSettings.closeNotificationTo || '-';
      return { message: `ส่งอีเมล PM Closed ไปที่ ${toEmail} สำเร็จ` };
    }

    const creator = await this.prisma.user.findUnique({
      where: { id: incident.createdById },
      select: { email: true, firstName: true, lastName: true },
    });
    if (!creator?.email) throw new BadRequestException('ไม่พบอีเมลผู้สร้าง Incident');

    const emailSettings = await this.settingsService.getEmailSettings();
    const toEmail = emailSettings.closeNotificationTo || creator.email;
    const ccEmails = emailSettings.closeNotificationCc
      ? emailSettings.closeNotificationCc.split(',').map((e: string) => e.trim()).filter(Boolean)
      : [];

    const commonEmailData = {
      incidentId: id,
      ticketNumber: incident.ticketNumber,
      title: incident.title,
      storeName: incident.store?.name || 'N/A',
      storeCode: incident.store?.storeCode || '',
      technicianName: incident.resolvedBy
        ? `${incident.resolvedBy.firstName} ${incident.resolvedBy.lastName}`
        : 'N/A',
      resolutionNote: incident.resolutionNote || 'No resolution note provided',
      usedSpareParts: incident.usedSpareParts || false,
      spareParts: emailSpareParts,
      checkInAt: incident.checkInAt || null,
      resolvedAt: incident.resolvedAt || new Date(),
      confirmedAt: incident.confirmedAt || new Date(),
      beforePhotos: incident.beforePhotos,
      afterPhotos: incident.afterPhotos,
      signedReportPhotos: incident.signedReportPhotos,
      publicIncidentLink,
      serviceReportLink,
    };

    await this.emailService.sendIncidentClosureEmail({ ...commonEmailData, to: toEmail, cc: ccEmails, ratingLink });

    if (emailSettings.ccStoreEmail && incident.store?.email) {
      await this.emailService.sendIncidentClosureEmail({ ...commonEmailData, to: incident.store.email, cc: undefined, ratingLink });
    }

    return { message: `ส่งอีเมลปิดงานไปที่ ${toEmail} สำเร็จ` };
  }

  /**
   * Get spare parts for incident
   * All authenticated users can view
   */
  async getSpareParts(id: string) {
    return this.prisma.sparePart.findMany({
      where: { incidentId: id },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Create a return job (return equipment) incident linked to parent incident
   * Only HELP_DESK can create return jobs
   *
   * @param parentIncidentId - The parent incident ID to link from
   * @param dto - Contains title, description, priority, and optional assigneeId
   * @param userId - The user creating the return job
   */
  async createReturnJob(
    parentIncidentId: string,
    dto: {
      title?: string;
      description?: string;
      priority?: string;
      assigneeId?: number;
    },
    userId: number,
  ) {
    // Validate parent incident exists
    const parentIncident = await this.prisma.incident.findFirst({
      where: { id: parentIncidentId },
      include: {
        store: true,
        equipment: true,
      },
    });

    if (!parentIncident) {
      throw new NotFoundException(`ไม่พบ Incident ${parentIncidentId}`);
    }

    // Generate new ticket number using organization prefix from settings
    const ticketNumber = await this.generateTicketNumber();

    // Create UUID for new incident
    const { randomUUID } = await import('crypto');
    const id = randomUUID();

    // Build title and description if not provided
    const title = dto.title || `[คืนอุปกรณ์] ${parentIncident.title}`;
    const description = dto.description ||
      `งานคืนอุปกรณ์จาก Incident #${parentIncident.ticketNumber}\n\n` +
      `สาขา: ${parentIncident.storeName || parentIncident.store?.name || 'N/A'}\n` +
      `ปัญหาเดิม: ${parentIncident.title}`;

    // Create the return job incident
    const returnJob = await this.prisma.incident.create({
      data: {
        id,
        ticketNumber,
        title,
        description,
        category: parentIncident.category,
        jobType: 'คืนอุปกรณ์',
        priority: (dto.priority as any) || parentIncident.priority,
        status: dto.assigneeId ? IncidentStatus.ASSIGNED : IncidentStatus.OPEN,
        incidentType: 'RETURN_EQUIPMENT',
        storeId: parentIncident.storeId,
        storeName: parentIncident.storeName,
        storeCode: parentIncident.storeCode,
        equipmentId: parentIncident.equipmentId,
        reportedBy: userId,
        createdById: userId,
        assigneeId: dto.assigneeId || null,
        relatedIncidentId: parentIncidentId,
      },
      include: {
        store: true,
        equipment: true,
        assignee: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            email: true,
            roles: { select: { role: true } },
          },
        },
        createdBy: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            email: true,
            roles: { select: { role: true } },
          },
        },
        relatedIncident: {
          select: {
            id: true,
            ticketNumber: true,
            title: true,
            status: true,
          },
        },
      },
    });

    // Create history entry for new incident
    await this.historyService.createHistory(
      id,
      IncidentAction.CREATED,
      userId,
      undefined,
      returnJob.status,
      `Return job created from incident #${parentIncident.ticketNumber}`,
    );

    // Create history entry for parent incident
    await this.historyService.createHistory(
      parentIncidentId,
      IncidentAction.RETURN_JOB_CREATED,
      userId,
      parentIncident.status,
      parentIncident.status,
      `Return job created: ${ticketNumber}`,
    );

    // Notify assignee if assigned
    if (dto.assigneeId) {
      await this.notificationsService.notifyIncidentAssigned(
        dto.assigneeId,
        id,
        ticketNumber,
        title,
      );
    }

    // Notify supervisors about new return job (exclude assignee if already notified)
    await this.notificationsService.notifyAllSupervisors(
      'INCIDENT_CREATED' as any,
      'งานคืนอุปกรณ์ใหม่',
      `งานคืนอุปกรณ์ ${ticketNumber}: ${title} (จาก Incident #${parentIncident.ticketNumber})`,
      id,
      dto.assigneeId ? [dto.assigneeId] : undefined,
    );

    return returnJob;
  }

  /**
   * Get related incidents (parent and children) for an incident
   *
   * @param id - The incident ID
   * @returns Object with parent incident and child incidents
   */
  async getRelatedIncidents(id: string) {
    const incident = await this.prisma.incident.findFirst({
      where: { id },
      include: {
        relatedIncident: {
          select: {
            id: true,
            ticketNumber: true,
            title: true,
            status: true,
            priority: true,
            incidentType: true,
            createdAt: true,
            resolvedAt: true,
            store: {
              select: {
                id: true,
                name: true,
                storeCode: true,
              },
            },
            assignee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        childIncidents: {
          select: {
            id: true,
            ticketNumber: true,
            title: true,
            status: true,
            priority: true,
            incidentType: true,
            createdAt: true,
            resolvedAt: true,
            store: {
              select: {
                id: true,
                name: true,
                storeCode: true,
              },
            },
            assignee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!incident) {
      throw new NotFoundException(`ไม่พบ Incident ${id}`);
    }

    return {
      parent: incident.relatedIncident || null,
      children: incident.childIncidents || [],
      hasRelated: !!(incident.relatedIncident || incident.childIncidents.length > 0),
    };
  }

  /**
   * Direct close incident by Helpdesk (Phone Support / Remote Support)
   * OPEN → CLOSED without technician
   */
  async directClose(
    id: string,
    resolutionType: 'PHONE_SUPPORT' | 'REMOTE_SUPPORT',
    resolutionNote: string | undefined,
    userId: number,
  ) {
    const incident = await this.prisma.incident.findFirst({
      where: { id },
      include: { store: true },
    });

    if (!incident) {
      throw new NotFoundException(`ไม่พบ Incident ${id}`);
    }

    if (incident.status !== IncidentStatus.OPEN && incident.status !== IncidentStatus.PENDING) {
      throw new BadRequestException(`สามารถปิดงานโดยตรงได้เฉพาะ Incident ที่มีสถานะ OPEN หรือ PENDING เท่านั้น (สถานะปัจจุบัน: ${incident.status})`);
    }

    if ((incident as any).resolutionType) {
      throw new BadRequestException('Incident นี้ได้เลือกวิธีดำเนินการแล้ว');
    }

    const now = new Date();
    const updateData: any = {
      status: IncidentStatus.CLOSED,
      resolutionType,
      resolutionNote: resolutionNote || null,
      resolvedAt: now,
      resolvedById: userId,
      confirmedAt: now,
      confirmedById: userId,
      updatedAt: now,
    };

    const updated = await this.prisma.incident.update({
      where: { id },
      data: updateData,
      include: {
        store: true,
        createdBy: {
          select: { id: true, username: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    // History
    await this.historyService.createHistory(
      id,
      IncidentAction.DIRECT_CLOSED as any,
      userId,
      IncidentStatus.OPEN,
      IncidentStatus.CLOSED,
      `Incident closed directly via ${resolutionType === 'PHONE_SUPPORT' ? 'Phone Support' : 'Remote Support'}${resolutionNote ? ': ' + resolutionNote : ''}`,
    );

    // Audit
    await this.auditTrailService.logDirect({
      module: AuditModule.INCIDENT,
      action: AuditAction.UPDATE,
      entityType: 'Incident',
      entityId: id,
      userId,
      description: `ปิด Incident "${incident.title}" (${incident.ticketNumber}) โดย ${resolutionType === 'PHONE_SUPPORT' ? 'Phone Support' : 'Remote Support'}`,
    });

    // Notify creator
    await this.notificationsService.createNotification(
      incident.createdById,
      'INCIDENT_CLOSED' as any,
      'Incident Closed',
      `${incident.ticketNumber} - ${incident.title} ถูกปิดแล้ว (${resolutionType === 'PHONE_SUPPORT' ? 'Phone Support' : 'Remote Support'})`,
      id,
    );

    return updated;
  }

  /**
   * Request onsite support - Helpdesk marks incident for Supervisor assignment
   * Status stays OPEN, resolutionType → ONSITE
   */
  async requestOnsite(id: string, userId: number) {
    const incident = await this.prisma.incident.findFirst({
      where: { id },
      include: { store: true },
    });

    if (!incident) {
      throw new NotFoundException(`ไม่พบ Incident ${id}`);
    }

    if (incident.status !== IncidentStatus.OPEN && incident.status !== IncidentStatus.PENDING) {
      throw new BadRequestException(`สามารถร้องขอ Onsite ได้เฉพาะ Incident ที่มีสถานะ OPEN หรือ PENDING เท่านั้น (สถานะปัจจุบัน: ${incident.status})`);
    }

    if ((incident as any).resolutionType) {
      throw new BadRequestException('Incident นี้ได้เลือกวิธีดำเนินการแล้ว');
    }

    const updateData: any = {
      resolutionType: 'ONSITE',
      updatedAt: new Date(),
    };

    const updated = await this.prisma.incident.update({
      where: { id },
      data: updateData,
      include: { store: true },
    });

    // History
    await this.historyService.createHistory(
      id,
      IncidentAction.REQUESTED_ONSITE as any,
      userId,
      IncidentStatus.OPEN,
      IncidentStatus.OPEN,
      'Onsite support requested - waiting for Supervisor assignment',
    );

    // Audit
    await this.auditTrailService.logDirect({
      module: AuditModule.INCIDENT,
      action: AuditAction.UPDATE,
      entityType: 'Incident',
      entityId: id,
      userId,
      description: `ร้องขอ Onsite สำหรับ Incident "${incident.title}" (${incident.ticketNumber})`,
    });

    // Auto-assign: check setting, then find the sole INSOURCE technician for this province
    const incidentSettings = await this.settingsService.getIncidentSettings();
    const storeProvince = (incident as any).store?.province as string | null | undefined;
    let autoAssigned = false;

    if (incidentSettings.autoAssignOnsite && storeProvince) {
      const technicians = await this.prisma.user.findMany({
        where: {
          technicianType: 'INSOURCE',
          status: 'ACTIVE',
          roles: { some: { role: UserRole.TECHNICIAN } },
          responsibleProvinces: { has: storeProvince },
        },
        select: { id: true },
      });

      if (technicians.length === 1) {
        // Exactly one technician covers this province — auto-assign
        await this.assign(id, [technicians[0].id], userId);
        autoAssigned = true;
      }
    }

    if (!autoAssigned) {
      // Notify all supervisors (standard flow)
      await this.notificationsService.notifyAllSupervisors(
        'INCIDENT_CREATED' as any,
        'Onsite Support Requested',
        `${incident.ticketNumber} - ${incident.store?.storeCode || ''} ${incident.store?.name || ''} - ${incident.title} ร้องขอ Onsite`,
        id,
      );
    }

    return updated;
  }

  // ─── SLA Defense Methods ────────────────────────────────────────────────────

  async submitSlaDefense(incidentId: string, userId: number, reason: string) {
    const incident = await this.prisma.incident.findUnique({
      where: { id: incidentId },
      include: {
        slaDefenses: { select: { id: true, status: true } },
      },
    });
    if (!incident) throw new NotFoundException('Incident not found');

    // Only allow after incident is CLOSED
    if (incident.status !== IncidentStatus.CLOSED) {
      throw new BadRequestException('สามารถขอ Defend SLA ได้เฉพาะงานที่ปิดแล้ว');
    }

    // Check if already passed SLA
    if (incident.slaDeadline && incident.resolvedAt && incident.resolvedAt <= incident.slaDeadline) {
      throw new BadRequestException('Incident นี้ผ่าน SLA แล้ว ไม่จำเป็นต้องขอ Defend');
    }

    // Check existing defense
    const existing = incident.slaDefenses.find(
      (d) => d.status === SlaDefenseStatus.PENDING || d.status === SlaDefenseStatus.APPROVED,
    );
    if (existing) {
      throw new BadRequestException('มีคำขอ Defend SLA อยู่แล้ว');
    }

    const defense = await this.prisma.slaDefense.create({
      data: {
        incidentId,
        technicianId: userId,
        reason,
        status: SlaDefenseStatus.PENDING,
      },
      include: {
        technician: { select: { id: true, firstName: true, lastName: true } },
        incident: { select: { id: true, ticketNumber: true, title: true } },
      },
    });

    // Notify IT Managers
    const itManagers = await this.prisma.user.findMany({
      where: { roles: { some: { role: UserRole.IT_MANAGER } }, status: 'ACTIVE' },
      select: { id: true },
    });
    for (const mgr of itManagers) {
      await this.notificationsService.createNotification(
        mgr.id,
        NotificationType.SLA_BREACH,
        'คำขอ Defend SLA',
        `${incident.ticketNumber} - ${incident.title} : มีคำขอ Defend SLA กรุณาตรวจสอบ`,
        incidentId,
      );
    }

    return defense;
  }

  async getSlaDefense(incidentId: string) {
    const incident = await this.prisma.incident.findUnique({
      where: { id: incidentId },
      include: {
        slaDefenses: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            technician: { select: { id: true, firstName: true, lastName: true } },
            reviewedBy: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });
    if (!incident) throw new NotFoundException('Incident not found');

    const slaFailed =
      incident.slaDeadline && incident.resolvedAt
        ? incident.resolvedAt > incident.slaDeadline
        : false;

    return {
      slaFailed,
      defense: incident.slaDefenses[0] ?? null,
    };
  }

  async getPendingSlaDefenses(userId: number, userRole: UserRole) {
    if (userRole !== UserRole.IT_MANAGER && userRole !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('ไม่มีสิทธิ์เข้าถึง');
    }

    return this.prisma.slaDefense.findMany({
      where: { status: SlaDefenseStatus.PENDING },
      orderBy: { createdAt: 'asc' },
      include: {
        technician: { select: { id: true, firstName: true, lastName: true } },
        incident: {
          select: {
            id: true,
            ticketNumber: true,
            title: true,
            slaDeadline: true,
            resolvedAt: true,
            store: { select: { id: true, name: true, storeCode: true } },
          },
        },
      },
    });
  }

  async getApprovedSlaDefenses(userId: number, userRole: UserRole) {
    if (userRole !== UserRole.IT_MANAGER && userRole !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('ไม่มีสิทธิ์เข้าถึง');
    }

    return this.prisma.slaDefense.findMany({
      where: { status: SlaDefenseStatus.APPROVED },
      orderBy: { reviewedAt: 'desc' },
      include: {
        technician: { select: { id: true, firstName: true, lastName: true } },
        incident: {
          select: {
            id: true,
            ticketNumber: true,
            title: true,
            slaDeadline: true,
            resolvedAt: true,
            store: { select: { id: true, name: true, storeCode: true } },
          },
        },
      },
    });
  }

  async reviewSlaDefense(
    defenseId: number,
    userId: number,
    userRole: UserRole,
    approved: boolean,
    reviewNote?: string,
  ) {
    if (userRole !== UserRole.IT_MANAGER && userRole !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('ไม่มีสิทธิ์อนุมัติ');
    }

    const defense = await this.prisma.slaDefense.findUnique({
      where: { id: defenseId },
      include: {
        incident: { select: { id: true, ticketNumber: true, title: true } },
        technician: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!defense) throw new NotFoundException('SLA Defense request not found');

    const newStatus = approved ? SlaDefenseStatus.APPROVED : SlaDefenseStatus.REJECTED;

    const updated = await this.prisma.slaDefense.update({
      where: { id: defenseId },
      data: {
        status: newStatus,
        reviewedById: userId,
        reviewedAt: new Date(),
        reviewNote: reviewNote ?? null,
      },
      include: {
        technician: { select: { id: true, firstName: true, lastName: true } },
        incident: { select: { id: true, ticketNumber: true, title: true } },
      },
    });

    // Notify the technician
    const wasApproved = defense.status === SlaDefenseStatus.APPROVED;
    const resultText = approved
      ? 'ได้รับการอนุมัติ'
      : wasApproved
      ? 'ถูกยกเลิกการอนุมัติ'
      : 'ถูกปฏิเสธ';
    await this.notificationsService.createNotification(
      defense.technicianId,
      NotificationType.SLA_BREACH,
      `คำขอ Defend SLA ${resultText}`,
      `${defense.incident.ticketNumber} - ${defense.incident.title} : คำขอ Defend SLA ${resultText}${reviewNote ? ` (${reviewNote})` : ''}`,
      defense.incidentId,
    );

    return updated;
  }
}

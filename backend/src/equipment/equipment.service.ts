import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEquipmentDto } from './dto/create-equipment.dto';
import { UpdateEquipmentDto } from './dto/update-equipment.dto';
import { FilterEquipmentDto } from './dto/filter-equipment.dto';
import { EquipmentStatus, EquipmentLogAction, EquipmentLogSource, AuditModule, AuditAction } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import { AuditTrailService } from '../modules/audit-trail/audit-trail.service';

@Injectable()
export class EquipmentService {
  constructor(
    private prisma: PrismaService,
    private auditTrailService: AuditTrailService,
  ) {}

  /**
   * Create new equipment
   */
  async create(createEquipmentDto: CreateEquipmentDto, userId: number) {
    // Check if serial number already exists
    const existingEquipment = await this.prisma.equipment.findUnique({
      where: { serialNumber: createEquipmentDto.serialNumber },
    });

    if (existingEquipment) {
      throw new ConflictException(
        `Equipment with serial number "${createEquipmentDto.serialNumber}" already exists`,
      );
    }

    // Verify that store exists
    const store = await this.prisma.store.findUnique({
      where: { id: createEquipmentDto.storeId },
    });

    if (!store) {
      throw new NotFoundException(
        `Store with ID ${createEquipmentDto.storeId} not found`,
      );
    }

    // Convert date strings to Date objects
    const equipmentData: any = {
      ...createEquipmentDto,
      purchaseDate: createEquipmentDto.purchaseDate
        ? new Date(createEquipmentDto.purchaseDate)
        : null,
      warrantyExpiry: createEquipmentDto.warrantyExpiry
        ? new Date(createEquipmentDto.warrantyExpiry)
        : null,
    };

    // Create equipment and equipment log in transaction
    const equipment = await this.prisma.$transaction(async (tx) => {
      const newEquipment = await tx.equipment.create({
        data: equipmentData,
        include: {
          store: {
            select: {
              id: true,
              storeCode: true,
              name: true,
              province: true,
              storeStatus: true,
            },
          },
        },
      });

      // Create equipment log entry
      await tx.equipmentLog.create({
        data: {
          equipmentId: newEquipment.id,
          action: EquipmentLogAction.CREATED,
          source: EquipmentLogSource.MANUAL,
          description: `Equipment "${newEquipment.name}" (SN: ${newEquipment.serialNumber}) created`,
          changedBy: userId,
          newValue: {
            name: newEquipment.name,
            category: newEquipment.category,
            status: newEquipment.status,
            storeId: newEquipment.storeId,
          },
        },
      });

      return newEquipment;
    });

    // Audit trail (outside transaction to prevent blocking equipment creation)
    try {
      await this.auditTrailService.logDirect({
        module: AuditModule.EQUIPMENT,
        action: AuditAction.CREATE,
        entityType: 'Equipment',
        entityId: equipment.id,
        userId,
        description: `สร้างอุปกรณ์ "${equipment.name}" (SN: ${equipment.serialNumber})`,
        newValue: { name: equipment.name, category: equipment.category, storeId: equipment.storeId },
      });
    } catch (_) {}

    return equipment;
  }

  /**
   * Get distinct categories that exist in the equipment table, sorted alphabetically
   */
  async getDistinctCategories(): Promise<string[]> {
    const rows = await this.prisma.equipment.findMany({
      distinct: ['category'],
      select: { category: true },
      orderBy: { category: 'asc' },
    });
    return rows.map(r => r.category).filter((c): c is string => !!c);
  }

  /**
   * Find all equipment with filters and pagination
   */
  async findAll(filterDto: FilterEquipmentDto) {
    const { page = 1, limit = 10, search, warrantyExpired, ...filters } = filterDto;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};

    // Apply filters (status accepts single value or comma-separated list)
    if (filters.status) {
      const statusList = filters.status.split(',').map((s) => s.trim()).filter(Boolean);
      where.status = statusList.length > 1 ? { in: statusList } : statusList[0];
    }

    if (filters.category) {
      where.category = filters.category;
    }

    if (filters.storeId) {
      where.storeId = filters.storeId;
    }

    if (filters.brand) {
      where.brand = { contains: filters.brand, mode: 'insensitive' };
    }

    if (filters.model) {
      where.model = { contains: filters.model, mode: 'insensitive' };
    }

    // Search by name or serial number
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { serialNumber: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Warranty expiry filter
    if (warrantyExpired !== undefined) {
      const now = new Date();
      if (warrantyExpired) {
        // Expired warranties
        where.warrantyExpiry = { lt: now };
      } else {
        // Active warranties
        where.warrantyExpiry = { gte: now };
      }
    }

    // Get total count
    const total = await this.prisma.equipment.count({ where });

    // Get equipment with pagination
    const equipment = await this.prisma.equipment.findMany({
      where,
      skip,
      take: limit,
      include: {
        store: {
          select: {
            id: true,
            storeCode: true,
            name: true,
            province: true,
            storeStatus: true,
          },
        },
        _count: {
          select: {
            incidents: true,
            logs: true,
          },
        },
      },
      orderBy: [
        { store: { storeCode: 'asc' } },
        { name: 'asc' },
      ],
    });

    return {
      data: equipment,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Find one equipment by ID
   */
  async findOne(id: number) {
    const equipment = await this.prisma.equipment.findUnique({
      where: { id },
      include: {
        store: {
          select: {
            id: true,
            storeCode: true,
            name: true,
            address: true,
            province: true,
            phone: true,
            storeStatus: true,
          },
        },
        incidents: {
          select: {
            id: true,
            ticketNumber: true,
            title: true,
            status: true,
            priority: true,
            createdAt: true,
            resolvedAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 10, // Latest 10 incidents
        },
        _count: {
          select: {
            logs: true,
          },
        },
      },
    });

    if (!equipment) {
      throw new NotFoundException(`Equipment with ID ${id} not found`);
    }

    // Check warranty status
    const warrantyStatus = this.getWarrantyStatus(equipment.warrantyExpiry);

    return {
      ...equipment,
      warrantyStatus,
    };
  }

  /**
   * Update equipment
   */
  async update(id: number, updateEquipmentDto: UpdateEquipmentDto, userId: number) {
    // Check if equipment exists
    const equipment = await this.prisma.equipment.findUnique({
      where: { id },
    });

    if (!equipment) {
      throw new NotFoundException(`Equipment with ID ${id} not found`);
    }

    // If updating serial number, check for duplicates
    if (
      updateEquipmentDto.serialNumber &&
      updateEquipmentDto.serialNumber !== equipment.serialNumber
    ) {
      const existingEquipment = await this.prisma.equipment.findUnique({
        where: { serialNumber: updateEquipmentDto.serialNumber },
      });

      if (existingEquipment) {
        throw new ConflictException(
          `Equipment with serial number "${updateEquipmentDto.serialNumber}" already exists`,
        );
      }
    }

    // If updating storeId, verify that store exists
    if (updateEquipmentDto.storeId) {
      const store = await this.prisma.store.findUnique({
        where: { id: updateEquipmentDto.storeId },
      });

      if (!store) {
        throw new NotFoundException(
          `Store with ID ${updateEquipmentDto.storeId} not found`,
        );
      }
    }

    // Convert date strings to Date objects
    const updateData: any = { ...updateEquipmentDto };
    if (updateEquipmentDto.purchaseDate) {
      updateData.purchaseDate = new Date(updateEquipmentDto.purchaseDate);
    }
    if (updateEquipmentDto.warrantyExpiry) {
      updateData.warrantyExpiry = new Date(updateEquipmentDto.warrantyExpiry);
    }

    // Determine log action and description
    let logAction: typeof EquipmentLogAction[keyof typeof EquipmentLogAction] = EquipmentLogAction.UPDATED;
    let logDescription = `Equipment updated`;

    if (updateEquipmentDto.status && updateEquipmentDto.status !== equipment.status) {
      logAction = EquipmentLogAction.STATUS_CHANGED;
      logDescription = `Status changed from ${equipment.status} to ${updateEquipmentDto.status}`;
    } else if (updateEquipmentDto.storeId && updateEquipmentDto.storeId !== equipment.storeId) {
      logAction = EquipmentLogAction.TRANSFERRED;
      logDescription = `Transferred from Store ID ${equipment.storeId} to Store ID ${updateEquipmentDto.storeId}`;
    } else if (updateEquipmentDto.warrantyExpiry) {
      logAction = EquipmentLogAction.WARRANTY_UPDATED;
      logDescription = `Warranty expiry updated`;
    }

    // Update equipment and log in transaction
    const updatedEquipment = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.equipment.update({
        where: { id },
        data: updateData,
        include: {
          store: {
            select: {
              id: true,
              storeCode: true,
              name: true,
              province: true,
              storeStatus: true,
            },
          },
        },
      });

      // Create log entry — structured oldValue/newValue (only changed fields)
      const changedFields = Object.keys(updateData).filter(
        (k) => updateData[k] !== undefined && String(updateData[k]) !== String((equipment as any)[k]),
      );
      const oldVal: any = {};
      const newVal: any = {};
      for (const k of changedFields) {
        oldVal[k] = (equipment as any)[k];
        newVal[k] = updateData[k];
      }
      await tx.equipmentLog.create({
        data: {
          equipmentId: id,
          action: logAction,
          source: EquipmentLogSource.MANUAL,
          description: logDescription,
          changedBy: userId,
          oldValue: changedFields.length > 0 ? oldVal : null,
          newValue: changedFields.length > 0 ? newVal : null,
        },
      });

      return updated;
    });

    // Audit trail (outside transaction to prevent blocking equipment update)
    try {
      const auditAction = logAction === EquipmentLogAction.STATUS_CHANGED
        ? AuditAction.STATUS_CHANGE
        : logAction === EquipmentLogAction.TRANSFERRED
          ? AuditAction.TRANSFER
          : AuditAction.UPDATE;
      await this.auditTrailService.logDirect({
        module: AuditModule.EQUIPMENT,
        action: auditAction,
        entityType: 'Equipment',
        entityId: id,
        userId,
        description: `อัพเดตอุปกรณ์ "${equipment.name}" - ${logDescription}`,
      });
    } catch (_) {}

    return updatedEquipment;
  }

  /**
   * Update equipment image path
   */
  async updateImage(id: number, imagePath: string) {
    return this.prisma.equipment.update({ where: { id }, data: { imagePath } });
  }

  /**
   * Delete equipment:
   * - HELP_DESK: hard-delete RETIRED equipment permanently
   * - SUPER_ADMIN / IT_MANAGER: soft-delete INACTIVE equipment (sets status → RETIRED)
   */
  async remove(id: number, userId: number, userRole?: string) {
    const equipment = await this.prisma.equipment.findUnique({
      where: { id },
    });

    if (!equipment) {
      throw new NotFoundException(`Equipment with ID ${id} not found`);
    }

    // HELP_DESK: hard delete RETIRED equipment
    if (userRole === 'HELP_DESK') {
      if (equipment.status !== EquipmentStatus.RETIRED) {
        throw new BadRequestException(
          'Helpdesk สามารถลบได้เฉพาะอุปกรณ์ที่ปลดระวางแล้ว (สถานะ Retired) เท่านั้น'
        );
      }

      await this.prisma.$transaction(async (tx) => {
        // 1. Null out Incident.equipmentId references
        await tx.incident.updateMany({
          where: { equipmentId: id },
          data: { equipmentId: null },
        });

        // 2. Remove from Incident.equipmentIds arrays (PostgreSQL array_remove)
        await tx.$executeRaw`
          UPDATE incidents
          SET equipment_ids = array_remove(equipment_ids, ${id}::int)
          WHERE ${id}::int = ANY(equipment_ids)
        `;

        // 3. Null out SparePart equipment references
        await tx.sparePart.updateMany({
          where: { oldEquipmentId: id },
          data: { oldEquipmentId: null },
        });
        await tx.sparePart.updateMany({
          where: { newEquipmentId: id },
          data: { newEquipmentId: null },
        });
        await tx.sparePart.updateMany({
          where: { parentEquipmentId: id },
          data: { parentEquipmentId: null },
        });

        // 4. Delete PM equipment records
        await tx.pmEquipmentRecord.deleteMany({ where: { equipmentId: id } });

        // 5. Delete equipment logs
        await tx.equipmentLog.deleteMany({ where: { equipmentId: id } });

        // 6. Delete retirement requests
        await tx.equipmentRetirementRequest.deleteMany({ where: { equipmentId: id } });

        // 7. Hard delete the equipment record
        await tx.equipment.delete({ where: { id } });
      });

      // Audit trail (outside transaction)
      try {
        await this.auditTrailService.logDirect({
          module: AuditModule.EQUIPMENT,
          action: AuditAction.DELETE,
          entityType: 'Equipment',
          entityId: id,
          userId,
          description: `ลบอุปกรณ์ "${equipment.name}" (SN: ${equipment.serialNumber}) ออกจากระบบอย่างถาวร`,
          oldValue: { status: equipment.status, name: equipment.name },
        });
      } catch (_) {}

      return { message: `อุปกรณ์ "${equipment.name}" ถูกลบออกจากระบบเรียบร้อยแล้ว` };
    }

    // SUPER_ADMIN / IT_MANAGER: soft delete INACTIVE → RETIRED
    if (equipment.status !== EquipmentStatus.INACTIVE) {
      throw new BadRequestException(
        'สามารถปลดระวางได้เฉพาะอุปกรณ์ที่มีสถานะ Inactive (ถูกแทนที่) เท่านั้น กรุณาตรวจสอบสถานะอุปกรณ์ก่อน'
      );
    }

    // Soft delete and log in transaction
    const retired = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.equipment.update({
        where: { id },
        data: { status: EquipmentStatus.RETIRED },
        include: {
          store: {
            select: {
              id: true,
              storeCode: true,
              name: true,
            },
          },
        },
      });

      // Create log entry
      await tx.equipmentLog.create({
        data: {
          equipmentId: id,
          action: EquipmentLogAction.RETIRED,
          source: EquipmentLogSource.RETIREMENT,
          description: `Equipment retired`,
          changedBy: userId,
          oldValue: { status: equipment.status },
          newValue: { status: EquipmentStatus.RETIRED },
        },
      });

      return updated;
    });

    // Audit trail (outside transaction)
    try {
      await this.auditTrailService.logDirect({
        module: AuditModule.EQUIPMENT,
        action: AuditAction.DELETE,
        entityType: 'Equipment',
        entityId: id,
        userId,
        description: `ลบอุปกรณ์ "${equipment.name}" (SN: ${equipment.serialNumber})`,
        oldValue: { status: equipment.status },
      });
    } catch (_) {}

    return retired;
  }

  /**
   * Request retirement of equipment (HELP_DESK / SUPERVISOR)
   * Creates a PENDING retirement request that IT_MANAGER must approve
   */
  async requestRetirement(equipmentId: number, userId: number, reason: string) {
    const equipment = await this.prisma.equipment.findUnique({
      where: { id: equipmentId },
      include: { store: { select: { id: true, storeCode: true, name: true } } },
    });

    if (!equipment) {
      throw new NotFoundException(`Equipment with ID ${equipmentId} not found`);
    }

    if (equipment.status === EquipmentStatus.RETIRED) {
      throw new BadRequestException('อุปกรณ์นี้ถูกปลดระวางแล้ว');
    }

    if (equipment.status !== EquipmentStatus.INACTIVE) {
      throw new BadRequestException(
        'สามารถขอปลดระวางได้เฉพาะอุปกรณ์ที่มีสถานะ Inactive (ถูกแทนที่จาก Spare Part) เท่านั้น'
      );
    }

    // Check for existing PENDING request
    const existing = await this.prisma.equipmentRetirementRequest.findFirst({
      where: { equipmentId, status: 'PENDING' },
    });

    if (existing) {
      throw new BadRequestException('อุปกรณ์นี้มีคำขอปลดระวางที่รอดำเนินการอยู่แล้ว');
    }

    const requester = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true },
    });
    const requesterName = `${requester?.firstName || ''} ${requester?.lastName || ''}`.trim();

    const request = await this.prisma.equipmentRetirementRequest.create({
      data: { equipmentId, requestedBy: userId, reason, status: 'PENDING' },
      include: {
        equipment: { include: { store: true } },
        requester: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    // Log to equipment history
    await this.prisma.equipmentLog.create({
      data: {
        equipmentId,
        action: EquipmentLogAction.UPDATED,
        source: EquipmentLogSource.RETIREMENT,
        description: `ส่งคำขอปลดระวาง โดย ${requesterName}: ${reason}`,
        changedBy: userId,
      },
    });

    // Notify all IT Managers
    const itManagers = await this.prisma.user.findMany({
      where: {
        roles: { some: { role: 'IT_MANAGER' } },
        status: 'ACTIVE',
      },
      select: { id: true },
    });

    if (itManagers.length > 0) {
      await this.prisma.notification.createMany({
        data: itManagers.map((manager) => ({
          userId: manager.id,
          type: 'SYSTEM_ALERT' as any,
          title: 'มีคำขอปลดระวางอุปกรณ์รออนุมัติ',
          message: `${requesterName} ขอปลดระวาง "${equipment.name}" (SN: ${equipment.serialNumber}) เหตุผล: ${reason}`,
          link: '/dashboard/equipment/retirement-requests',
        })),
      });
    }

    await this.auditTrailService.logDirect({
      module: AuditModule.EQUIPMENT,
      action: AuditAction.UPDATE,
      entityType: 'EquipmentRetirementRequest',
      entityId: request.id,
      userId,
      description: `ส่งคำขอปลดระวางอุปกรณ์ "${equipment.name}" (SN: ${equipment.serialNumber}) เหตุผล: ${reason}`,
    });

    return request;
  }

  /**
   * Get all PENDING retirement requests (IT_MANAGER, SUPER_ADMIN)
   */
  async getPendingRetirementRequests() {
    return this.prisma.equipmentRetirementRequest.findMany({
      where: { status: 'PENDING' },
      include: {
        equipment: {
          include: { store: { select: { id: true, storeCode: true, name: true, province: true } } },
        },
        requester: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Approve retirement request — actually retires the equipment (IT_MANAGER, SUPER_ADMIN)
   */
  async approveRetirementRequest(requestId: number, approverId: number, note?: string) {
    const request = await this.prisma.equipmentRetirementRequest.findUnique({
      where: { id: requestId },
      include: { equipment: true },
    });

    if (!request) {
      throw new NotFoundException('ไม่พบคำขอปลดระวาง');
    }

    if (request.status !== 'PENDING') {
      throw new BadRequestException('คำขอนี้ได้รับการดำเนินการแล้ว');
    }

    const approver = await this.prisma.user.findUnique({
      where: { id: approverId },
      select: { firstName: true, lastName: true },
    });
    const approverName = `${approver?.firstName || ''} ${approver?.lastName || ''}`.trim();

    await this.prisma.$transaction(async (tx) => {
      // Update request status
      await tx.equipmentRetirementRequest.update({
        where: { id: requestId },
        data: { status: 'APPROVED', approvedBy: approverId, approvalNote: note },
      });

      // Actually retire the equipment
      await tx.equipment.update({
        where: { id: request.equipmentId },
        data: { status: EquipmentStatus.RETIRED },
      });

      // Equipment log
      await tx.equipmentLog.create({
        data: {
          equipmentId: request.equipmentId,
          action: EquipmentLogAction.RETIRED,
          source: EquipmentLogSource.RETIREMENT,
          description: `อนุมัติปลดระวางโดย ${approverName}${note ? ` หมายเหตุ: ${note}` : ''}`,
          changedBy: approverId,
          oldValue: { status: request.equipment.status },
          newValue: { status: EquipmentStatus.RETIRED },
        },
      });

    });

    // Audit trail (outside transaction)
    try {
      await this.auditTrailService.logDirect({
        module: AuditModule.EQUIPMENT,
        action: AuditAction.DELETE,
        entityType: 'Equipment',
        entityId: request.equipmentId,
        userId: approverId,
        description: `อนุมัติปลดระวางอุปกรณ์ "${request.equipment.name}" (SN: ${request.equipment.serialNumber})`,
        oldValue: { status: request.equipment.status },
        newValue: { status: EquipmentStatus.RETIRED },
      });
    } catch (_) {}

    // Notify requester
    await this.prisma.notification.create({
      data: {
        userId: request.requestedBy,
        type: 'SYSTEM_ALERT' as any,
        title: 'คำขอปลดระวางอุปกรณ์ได้รับการอนุมัติ',
        message: `คำขอปลดระวาง "${request.equipment.name}" (SN: ${request.equipment.serialNumber}) ได้รับการอนุมัติโดย ${approverName}`,
      },
    });

    return { message: `อนุมัติปลดระวาง "${request.equipment.name}" เรียบร้อยแล้ว` };
  }

  /**
   * Reject retirement request (IT_MANAGER, SUPER_ADMIN)
   */
  async rejectRetirementRequest(requestId: number, approverId: number, note?: string) {
    const request = await this.prisma.equipmentRetirementRequest.findUnique({
      where: { id: requestId },
      include: { equipment: true },
    });

    if (!request) {
      throw new NotFoundException('ไม่พบคำขอปลดระวาง');
    }

    if (request.status !== 'PENDING') {
      throw new BadRequestException('คำขอนี้ได้รับการดำเนินการแล้ว');
    }

    const approver = await this.prisma.user.findUnique({
      where: { id: approverId },
      select: { firstName: true, lastName: true },
    });
    const approverName = `${approver?.firstName || ''} ${approver?.lastName || ''}`.trim();

    const updated = await this.prisma.equipmentRetirementRequest.update({
      where: { id: requestId },
      data: { status: 'REJECTED', approvedBy: approverId, approvalNote: note },
      include: {
        equipment: { include: { store: true } },
        requester: { select: { id: true, firstName: true, lastName: true } },
        approver: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    // Equipment log
    await this.prisma.equipmentLog.create({
      data: {
        equipmentId: request.equipmentId,
        action: EquipmentLogAction.UPDATED,
        source: EquipmentLogSource.RETIREMENT,
        description: `ปฏิเสธคำขอปลดระวางโดย ${approverName}${note ? ` เหตุผล: ${note}` : ''}`,
        changedBy: approverId,
      },
    });

    // Notify requester
    await this.prisma.notification.create({
      data: {
        userId: request.requestedBy,
        type: 'SYSTEM_ALERT' as any,
        title: 'คำขอปลดระวางอุปกรณ์ถูกปฏิเสธ',
        message: `คำขอปลดระวาง "${request.equipment.name}" (SN: ${request.equipment.serialNumber}) ถูกปฏิเสธโดย ${approverName}${note ? ` เหตุผล: ${note}` : ''}`,
      },
    });

    await this.auditTrailService.logDirect({
      module: AuditModule.EQUIPMENT,
      action: AuditAction.UPDATE,
      entityType: 'EquipmentRetirementRequest',
      entityId: requestId,
      userId: approverId,
      description: `ปฏิเสธคำขอปลดระวางอุปกรณ์ "${request.equipment.name}"`,
    });

    return updated;
  }

  /**
   * Get equipment logs (history)
   */
  async getLogs(id: number, page: number = 1, limit: number = 20) {
    // Check if equipment exists
    const equipment = await this.prisma.equipment.findUnique({
      where: { id },
    });

    if (!equipment) {
      throw new NotFoundException(`Equipment with ID ${id} not found`);
    }

    const skip = (page - 1) * limit;

    const total = await this.prisma.equipmentLog.count({
      where: { equipmentId: id },
    });

    const logs = await this.prisma.equipmentLog.findMany({
      where: { equipmentId: id },
      skip,
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            roles: { select: { role: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      data: logs,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get equipment statistics
   */
  async getStatistics(id: number) {
    const equipment = await this.prisma.equipment.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            incidents: true,
            logs: true,
          },
        },
        incidents: {
          select: {
            status: true,
          },
        },
      },
    });

    if (!equipment) {
      throw new NotFoundException(`Equipment with ID ${id} not found`);
    }

    // Count incidents by status
    const incidentsByStatus = equipment.incidents.reduce((acc, incident) => {
      acc[incident.status] = (acc[incident.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Calculate warranty status
    const warrantyStatus = this.getWarrantyStatus(equipment.warrantyExpiry);

    return {
      equipmentId: id,
      serialNumber: equipment.serialNumber,
      name: equipment.name,
      totalIncidents: equipment._count.incidents,
      totalLogs: equipment._count.logs,
      incidentsByStatus,
      warrantyStatus,
      warrantyExpiry: equipment.warrantyExpiry,
    };
  }

  /**
   * Get warranty expiring soon (within next 30 days)
   */
  async getWarrantyExpiringSoon() {
    const now = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(now.getDate() + 30);

    const equipment = await this.prisma.equipment.findMany({
      where: {
        warrantyExpiry: {
          gte: now,
          lte: thirtyDaysFromNow,
        },
        status: {
          in: [EquipmentStatus.ACTIVE, EquipmentStatus.MAINTENANCE],
        },
      },
      include: {
        store: {
          select: {
            id: true,
            storeCode: true,
            name: true,
            province: true,
          },
        },
      },
      orderBy: {
        warrantyExpiry: 'asc',
      },
    });

    return equipment.map((eq) => ({
      ...eq,
      daysUntilExpiry: Math.ceil(
        (eq.warrantyExpiry!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      ),
    }));
  }

  /**
   * Helper: Get warranty status
   */
  private getWarrantyStatus(warrantyExpiry: Date | null): string {
    if (!warrantyExpiry) {
      return 'NO_WARRANTY';
    }

    const now = new Date();
    const daysUntilExpiry = Math.ceil(
      (warrantyExpiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (daysUntilExpiry < 0) {
      return 'EXPIRED';
    } else if (daysUntilExpiry <= 30) {
      return 'EXPIRING_SOON';
    } else {
      return 'ACTIVE';
    }
  }

  /**
   * Export equipment to Excel as Inventory List format
   * Requires storeId to export inventory for a specific store
   */
  async exportToExcel(storeId: number): Promise<ExcelJS.Workbook> {
    if (!storeId) {
      throw new BadRequestException('Store ID is required for inventory export');
    }

    // Get store info
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
    });

    if (!store) {
      throw new NotFoundException(`Store with ID ${storeId} not found`);
    }

    // Get equipment data for this store
    const equipment = await this.prisma.equipment.findMany({
      where: { storeId },
      orderBy: [
        { category: 'asc' },
        { name: 'asc' },
      ],
    });

    // Create workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'RIM System';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Inventory List');

    // Set column widths
    worksheet.columns = [
      { width: 6 },   // A: No.
      { width: 30 },  // B: Equipment Name
      { width: 12 },  // C: Category
      { width: 15 },  // D: Brand
      { width: 18 },  // E: Model
      { width: 22 },  // F: Serial Number
      { width: 18 },  // G: IP Address
      { width: 12 },  // H: Status
      { width: 14 },  // I: Purchase Date
      { width: 14 },  // J: Warranty Expiry
      { width: 14 },  // K: Warranty Status
    ];

    // Page layout — fit all columns to 1 page wide, A4 portrait
    worksheet.pageSetup = {
      paperSize: 9,          // A4
      orientation: 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,        // unlimited pages tall
      margins: { left: 0.5, right: 0.5, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 },
      horizontalCentered: true,
    };

    // ========== HEADER SECTION ==========
    // Row 1: Title
    worksheet.mergeCells('A1:K1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'INVENTORY LIST';
    titleCell.font = { bold: true, size: 18, color: { argb: 'FF1E40AF' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(1).height = 75; // display ≈ 30

    // Row 2: Subtitle
    worksheet.mergeCells('A2:K2');
    const subtitleCell = worksheet.getCell('A2');
    subtitleCell.value = 'รายการอุปกรณ์ประจำสาขา';
    subtitleCell.font = { size: 12, color: { argb: 'FF6B7280' } };
    subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // Row 3: Empty
    worksheet.getRow(3).height = 10;

    // Row 4: Store Code & Store Name
    worksheet.getCell('A4').value = 'Store Code:';
    worksheet.getCell('A4').font = { bold: true };
    worksheet.getCell('B4').value = store.storeCode;
    worksheet.getCell('B4').font = { color: { argb: 'FF2563EB' } };
    worksheet.getCell('D4').value = 'Store Name:';
    worksheet.getCell('D4').font = { bold: true };
    worksheet.mergeCells('E4:G4');
    worksheet.getCell('E4').value = store.name;
    worksheet.getRow(4).height = 50; // display ≈ 20

    // Row 5: Province & Phone
    worksheet.getCell('A5').value = 'Province:';
    worksheet.getCell('A5').font = { bold: true };
    worksheet.getCell('B5').value = store.province || '-';
    worksheet.getCell('D5').value = 'Phone:';
    worksheet.getCell('D5').font = { bold: true };
    worksheet.getCell('E5').value = store.phone || '-';
    worksheet.getRow(5).height = 50; // display ≈ 20

    // Row 6: Export Date & Total Items
    worksheet.getCell('A6').value = 'Export Date:';
    worksheet.getCell('A6').font = { bold: true };
    worksheet.getCell('B6').value = new Date().toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    worksheet.getCell('D6').value = 'Total Items:';
    worksheet.getCell('D6').font = { bold: true };
    worksheet.getCell('E6').value = equipment.length;
    worksheet.getCell('E6').font = { bold: true, color: { argb: 'FF16A34A' } };
    worksheet.getRow(6).height = 50; // display ≈ 20

    // Row 7: Empty separator
    worksheet.getRow(7).height = 15;

    // ========== TABLE HEADER (Row 8) ==========
    const headerRowNum = 8;
    const headers = ['No.', 'Equipment Name', 'Category', 'Brand', 'Model', 'Serial Number', 'IP Address', 'Status', 'Purchase Date', 'Warranty Expiry', 'Warranty Status'];
    const headerRow = worksheet.getRow(headerRowNum);
    headers.forEach((header, index) => {
      const cell = headerRow.getCell(index + 1);
      cell.value = header;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E40AF' },
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
    });
    headerRow.height = 62.5; // display ≈ 25

    // ========== DATA ROWS ==========
    equipment.forEach((item, index) => {
      const rowNum = headerRowNum + 1 + index;
      const row = worksheet.getRow(rowNum);
      row.height = 50; // display ≈ 20

      const warrantyStatus = this.getWarrantyStatus(item.warrantyExpiry);

      const rowData = [
        index + 1,
        item.name,
        item.category,
        item.brand || '-',
        item.model || '-',
        item.serialNumber,
        item.ipAddress || '-',
        item.status,
        item.purchaseDate ? item.purchaseDate.toISOString().split('T')[0] : '-',
        item.warrantyExpiry ? item.warrantyExpiry.toISOString().split('T')[0] : '-',
        warrantyStatus,
      ];

      rowData.forEach((value, colIndex) => {
        const cell = row.getCell(colIndex + 1);
        cell.value = value;
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
        cell.alignment = { vertical: 'middle' };

        // Center align No. column
        if (colIndex === 0) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        }

        // Color code status
        if (colIndex === 7) {
          if (value === 'ACTIVE') {
            cell.font = { color: { argb: 'FF16A34A' } };
          } else if (value === 'MAINTENANCE') {
            cell.font = { color: { argb: 'FFCA8A04' } };
          } else if (value === 'RETIRED' || value === 'INACTIVE') {
            cell.font = { color: { argb: 'FFDC2626' } };
          }
        }

        // Color code warranty status
        if (colIndex === 10) {
          if (value === 'ACTIVE') {
            cell.font = { color: { argb: 'FF16A34A' } };
          } else if (value === 'EXPIRING_SOON') {
            cell.font = { color: { argb: 'FFCA8A04' } };
          } else if (value === 'EXPIRED') {
            cell.font = { color: { argb: 'FFDC2626' } };
          } else {
            cell.font = { color: { argb: 'FF6B7280' } };
          }
        }
      });

      // Alternate row colors
      if (index % 2 === 1) {
        row.eachCell((cell) => {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF3F4F6' },
          };
        });
      }
    });

    // Add summary row if there's data
    if (equipment.length > 0) {
      const summaryRowNum = headerRowNum + 1 + equipment.length + 1;
      worksheet.getCell(`A${summaryRowNum}`).value = `Total: ${equipment.length} items`;
      worksheet.getCell(`A${summaryRowNum}`).font = { bold: true, italic: true };
    }

    return workbook;
  }

  /**
   * Get import template for a specific store (Inventory List format)
   */
  async getImportTemplate(storeId: number): Promise<ExcelJS.Workbook> {
    if (!storeId) {
      throw new BadRequestException('Store ID is required for import template');
    }

    // Get store info
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
    });

    if (!store) {
      throw new NotFoundException(`Store with ID ${storeId} not found`);
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'RIM System';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Inventory Template');

    // Set column widths
    worksheet.columns = [
      { width: 6 },   // A: No.
      { width: 30 },  // B: Equipment Name
      { width: 12 },  // C: Category
      { width: 15 },  // D: Brand
      { width: 18 },  // E: Model
      { width: 22 },  // F: Serial Number
      { width: 12 },  // G: Status
      { width: 14 },  // H: Purchase Date
      { width: 14 },  // I: Warranty Expiry
      { width: 18 },  // J: IP Address
    ];

    // Page layout — fit all columns to 1 page wide, A4 portrait
    worksheet.pageSetup = {
      paperSize: 9,          // A4
      orientation: 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,        // unlimited pages tall
      margins: { left: 0.5, right: 0.5, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 },
      horizontalCentered: true,
    };

    // ========== HEADER SECTION ==========
    // Row 1: Title
    worksheet.mergeCells('A1:J1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'INVENTORY IMPORT TEMPLATE';
    titleCell.font = { bold: true, size: 18, color: { argb: 'FF16A34A' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(1).height = 75; // display ≈ 30

    // Row 2: Subtitle
    worksheet.mergeCells('A2:J2');
    const subtitleCell = worksheet.getCell('A2');
    subtitleCell.value = 'แบบฟอร์มนำเข้าอุปกรณ์ประจำสาขา';
    subtitleCell.font = { size: 12, color: { argb: 'FF6B7280' } };
    subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // Row 3: Empty
    worksheet.getRow(3).height = 10;

    // Row 4: Store Code & Store Name (READ FROM HERE DURING IMPORT)
    worksheet.getCell('A4').value = 'Store Code:';
    worksheet.getCell('A4').font = { bold: true };
    worksheet.getCell('B4').value = store.storeCode;
    worksheet.getCell('B4').font = { bold: true, color: { argb: 'FF2563EB' } };
    worksheet.getCell('B4').fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFDBEAFE' },
    };
    worksheet.getCell('D4').value = 'Store Name:';
    worksheet.getCell('D4').font = { bold: true };
    worksheet.mergeCells('E4:G4');
    worksheet.getCell('E4').value = store.name;
    worksheet.getRow(4).height = 50; // display ≈ 20

    // Row 5: Province & Phone
    worksheet.getCell('A5').value = 'Province:';
    worksheet.getCell('A5').font = { bold: true };
    worksheet.getCell('B5').value = store.province || '-';
    worksheet.getCell('D5').value = 'Phone:';
    worksheet.getCell('D5').font = { bold: true };
    worksheet.getCell('E5').value = store.phone || '-';
    worksheet.getRow(5).height = 50; // display ≈ 20

    // Row 6: Note about store
    worksheet.mergeCells('A6:J6');
    worksheet.getCell('A6').value = '⚠️ หมายเหตุ: อุปกรณ์ทั้งหมดจะถูกนำเข้าสำหรับสาขานี้เท่านั้น (ห้ามแก้ไข Store Code)';
    worksheet.getCell('A6').font = { italic: true, color: { argb: 'FFCA8A04' } };
    worksheet.getRow(6).height = 50; // display ≈ 20

    // Row 7: Empty separator
    worksheet.getRow(7).height = 15;

    // ========== TABLE HEADER (Row 8) ==========
    const headerRowNum = 8;
    const headers = ['No.', 'Equipment Name *', 'Category *', 'Brand', 'Model', 'Serial Number *', 'Status', 'Purchase Date', 'Warranty Expiry', 'IP Address'];
    const headerRow = worksheet.getRow(headerRowNum);
    headers.forEach((header, index) => {
      const cell = headerRow.getCell(index + 1);
      cell.value = header;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF16A34A' },
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
    });
    headerRow.height = 62.5; // display ≈ 25

    // ========== EXAMPLE DATA ROWS ==========
    const exampleData = [
      { no: 1, name: 'POS#1 Printer', category: 'PRINTER', brand: 'Epson', model: 'TM-T88VI', serialNumber: 'ABC123456', status: 'ACTIVE', purchaseDate: '2024-01-15', warrantyExpiry: '2026-01-15', ipAddress: '192.168.1.101' },
      { no: 2, name: 'Cashier Terminal', category: 'POS', brand: 'Dell', model: 'OptiPlex 7010', serialNumber: 'XYZ789012', status: 'ACTIVE', purchaseDate: '2024-02-20', warrantyExpiry: '2027-02-20', ipAddress: '' },
    ];

    exampleData.forEach((item, index) => {
      const rowNum = headerRowNum + 1 + index;
      const row = worksheet.getRow(rowNum);
      row.height = 50; // display ≈ 20

      const rowData = [item.no, item.name, item.category, item.brand, item.model, item.serialNumber, item.status, item.purchaseDate, item.warrantyExpiry, item.ipAddress];
      rowData.forEach((value, colIndex) => {
        const cell = row.getCell(colIndex + 1);
        cell.value = value;
        cell.font = { italic: true, color: { argb: 'FF9CA3AF' } };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      });
    });

    // Add empty rows for user to fill in
    for (let i = 0; i < 20; i++) {
      const rowNum = headerRowNum + 3 + i;
      const row = worksheet.getRow(rowNum);
      row.height = 50; // display ≈ 20
      row.getCell(1).value = i + 3; // Starting from 3 (after 2 examples)
      for (let col = 1; col <= 10; col++) {
        const cell = row.getCell(col);
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        };
      }
    }

    // ========== INSTRUCTIONS SHEET ==========
    const instructionSheet = workbook.addWorksheet('Instructions');
    instructionSheet.columns = [
      { header: 'Field', key: 'field', width: 20 },
      { header: 'Required', key: 'required', width: 10 },
      { header: 'Description', key: 'description', width: 50 },
      { header: 'Valid Values', key: 'validValues', width: 50 },
    ];

    // Style instruction header
    const instrHeaderRow = instructionSheet.getRow(1);
    instrHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    instrHeaderRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2563EB' },
    };

    // Add instruction rows
    const instructions = [
      { field: 'No.', required: 'No', description: 'Running number (auto-filled)', validValues: '1, 2, 3, ...' },
      { field: 'Equipment Name', required: 'Yes', description: 'ชื่ออุปกรณ์ รวมถึงตำแหน่งการติดตั้ง', validValues: 'เช่น POS#1 Printer, Kitchen Terminal, เครื่องพิมพ์แคชเชียร์ #2' },
      { field: 'Category', required: 'Yes', description: 'ประเภทอุปกรณ์', validValues: 'NETWORK, COMPUTER, POS, PRINTER, ROUTER, SWITCH, CCTV, OTHER' },
      { field: 'Brand', required: 'No', description: 'ยี่ห้อ/ผู้ผลิต', validValues: 'เช่น Dell, HP, Epson, Cisco' },
      { field: 'Model', required: 'No', description: 'รุ่นของอุปกรณ์', validValues: 'เช่น TM-T88VI, OptiPlex 7010' },
      { field: 'Serial Number', required: 'Yes', description: 'หมายเลข Serial (อย่างน้อย 3 ตัวอักษร)', validValues: 'ต้องไม่ซ้ำกับที่มีในระบบ' },
      { field: 'Status', required: 'No', description: 'สถานะอุปกรณ์ (ค่าเริ่มต้น: ACTIVE)', validValues: 'ACTIVE, INACTIVE, MAINTENANCE, RETIRED' },
      { field: 'Purchase Date', required: 'No', description: 'วันที่ซื้อ', validValues: 'รูปแบบ: YYYY-MM-DD เช่น 2024-01-15' },
      { field: 'Warranty Expiry', required: 'No', description: 'วันหมดประกัน', validValues: 'รูปแบบ: YYYY-MM-DD เช่น 2026-01-15' },
      { field: 'IP Address', required: 'No', description: 'IP Address ของอุปกรณ์ (IPv4 หรือ IPv6)', validValues: 'เช่น 192.168.1.101, 10.0.0.50' },
    ];

    instructions.forEach((instr) => {
      instructionSheet.addRow(instr);
    });

    // Add note
    const noteRow = instructionSheet.addRow({});
    noteRow.getCell(1).value = '⚠️ หมายเหตุ:';
    noteRow.getCell(1).font = { bold: true, color: { argb: 'FFCA8A04' } };
    const noteRow2 = instructionSheet.addRow({});
    noteRow2.getCell(1).value = '- ลบแถวตัวอย่าง (สีเทา) ก่อนนำเข้า';
    const noteRow3 = instructionSheet.addRow({});
    noteRow3.getCell(1).value = '- ห้ามแก้ไข Store Code ในส่วน Header';
    const noteRow4 = instructionSheet.addRow({});
    noteRow4.getCell(1).value = '- Serial Number ต้องไม่ซ้ำกับที่มีอยู่ในระบบ';

    return workbook;
  }

  /**
   * Generate bulk import template (all stores) for SUPER_ADMIN
   * Each row has its own Store Code column
   */
  async getBulkImportTemplate(): Promise<ExcelJS.Workbook> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'RIM System';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Bulk Import');

    worksheet.columns = [
      { width: 6 },   // A: No.
      { width: 14 },  // B: Store Code
      { width: 30 },  // C: Equipment Name
      { width: 12 },  // D: Category
      { width: 15 },  // E: Brand
      { width: 18 },  // F: Model
      { width: 22 },  // G: Serial Number
      { width: 12 },  // H: Status
      { width: 14 },  // I: Purchase Date
      { width: 14 },  // J: Warranty Expiry
      { width: 18 },  // K: IP Address
    ];

    // Row 1: Title
    worksheet.mergeCells('A1:K1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'BULK INVENTORY IMPORT TEMPLATE';
    titleCell.font = { bold: true, size: 18, color: { argb: 'FF2563EB' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(1).height = 30;

    // Row 2: Subtitle
    worksheet.mergeCells('A2:K2');
    const subtitleCell = worksheet.getCell('A2');
    subtitleCell.value = 'แบบฟอร์มนำเข้าอุปกรณ์ทุกสาขา (สำหรับ Super Admin)';
    subtitleCell.font = { size: 12, color: { argb: 'FF6B7280' } };
    subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // Row 3: Note
    worksheet.mergeCells('A3:K3');
    worksheet.getCell('A3').value = '⚠️ ระบุ Store Code ในแต่ละแถว ระบบจะนำเข้าอุปกรณ์ไปยังสาขาที่ตรงกัน';
    worksheet.getCell('A3').font = { italic: true, color: { argb: 'FFCA8A04' } };

    // Row 4: Empty
    worksheet.getRow(4).height = 10;

    // Row 5: Table Header
    const headerRowNum = 5;
    const headers = ['No.', 'Store Code *', 'Equipment Name *', 'Category *', 'Brand', 'Model', 'Serial Number *', 'Status', 'Purchase Date', 'Warranty Expiry', 'IP Address'];
    const headerRow = worksheet.getRow(headerRowNum);
    headers.forEach((header, index) => {
      const cell = headerRow.getCell(index + 1);
      cell.value = header;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    });
    headerRow.height = 25;

    // Example data
    const examples = [
      { no: 1, storeCode: 'S001', name: 'POS#1 Printer', category: 'PRINTER', brand: 'Epson', model: 'TM-T88VI', serial: 'ABC123456', status: 'ACTIVE', purchase: '2024-01-15', warranty: '2026-01-15', ip: '192.168.1.101' },
      { no: 2, storeCode: 'S001', name: 'Cashier Terminal', category: 'POS', brand: 'Dell', model: 'OptiPlex 7010', serial: 'XYZ789012', status: 'ACTIVE', purchase: '2024-02-20', warranty: '2027-02-20', ip: '' },
      { no: 3, storeCode: 'S002', name: 'Access Point#1', category: 'NETWORK', brand: 'Cisco', model: 'Meraki MR36', serial: 'MER345678', status: 'ACTIVE', purchase: '2024-03-10', warranty: '2027-03-10', ip: '10.0.0.50' },
    ];

    examples.forEach((item, index) => {
      const rowNum = headerRowNum + 1 + index;
      const row = worksheet.getRow(rowNum);
      const data = [item.no, item.storeCode, item.name, item.category, item.brand, item.model, item.serial, item.status, item.purchase, item.warranty, item.ip];
      data.forEach((value, colIndex) => {
        const cell = row.getCell(colIndex + 1);
        cell.value = value;
        cell.font = { italic: true, color: { argb: 'FF9CA3AF' } };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      });
    });

    // Empty rows
    for (let i = 0; i < 50; i++) {
      const rowNum = headerRowNum + 4 + i;
      const row = worksheet.getRow(rowNum);
      row.getCell(1).value = i + 4;
      for (let col = 1; col <= 11; col++) {
        row.getCell(col).border = {
          top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        };
      }
    }

    // Instructions sheet
    const instrSheet = workbook.addWorksheet('Instructions');
    instrSheet.columns = [
      { header: 'Field', key: 'field', width: 20 },
      { header: 'Required', key: 'required', width: 10 },
      { header: 'Description', key: 'description', width: 50 },
      { header: 'Valid Values', key: 'validValues', width: 50 },
    ];
    const instrHeaderRow = instrSheet.getRow(1);
    instrHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    instrHeaderRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };

    const instructions = [
      { field: 'No.', required: 'No', description: 'ลำดับ (auto-filled)', validValues: '1, 2, 3, ...' },
      { field: 'Store Code', required: 'Yes', description: 'รหัสสาขา ต้องตรงกับที่มีในระบบ', validValues: 'เช่น S001, BKK01, WAT001' },
      { field: 'Equipment Name', required: 'Yes', description: 'ชื่ออุปกรณ์', validValues: 'เช่น POS#1, Access Point#1, CCTV#3' },
      { field: 'Category', required: 'Yes', description: 'ประเภทอุปกรณ์', validValues: 'NETWORK, COMPUTER, POS, PRINTER, ROUTER, SWITCH, CCTV, OTHER' },
      { field: 'Brand', required: 'No', description: 'ยี่ห้อ', validValues: 'เช่น Dell, HP, Epson, Cisco' },
      { field: 'Model', required: 'No', description: 'รุ่น', validValues: 'เช่น TM-T88VI, OptiPlex 7010' },
      { field: 'Serial Number', required: 'Yes', description: 'หมายเลข Serial (ไม่ซ้ำ)', validValues: 'อย่างน้อย 3 ตัวอักษร' },
      { field: 'Status', required: 'No', description: 'สถานะ (default: ACTIVE)', validValues: 'ACTIVE, INACTIVE, MAINTENANCE, RETIRED' },
      { field: 'Purchase Date', required: 'No', description: 'วันที่ซื้อ', validValues: 'YYYY-MM-DD เช่น 2024-01-15' },
      { field: 'Warranty Expiry', required: 'No', description: 'วันหมดประกัน', validValues: 'YYYY-MM-DD เช่น 2026-01-15' },
      { field: 'IP Address', required: 'No', description: 'IP Address ของอุปกรณ์ (IPv4 หรือ IPv6)', validValues: 'เช่น 192.168.1.101, 10.0.0.50' },
    ];
    instructions.forEach((instr) => instrSheet.addRow(instr));

    return workbook;
  }

  /**
   * Bulk import equipment from Excel (multi-store)
   * Each row contains Store Code - for SUPER_ADMIN initial data setup
   * Data starts from Row 6 (header row 5)
   */
  async bulkImport(
    buffer: Buffer,
    userId: number,
  ): Promise<{
    created: number;
    failed: number;
    errors: Array<{ row: number; error: string }>;
    storesSummary: Record<string, number>;
  }> {
    const workbook = new ExcelJS.Workbook();
    const { Readable } = await import('stream');
    const stream = Readable.from(buffer);
    await workbook.xlsx.read(stream);

    const worksheet = workbook.getWorksheet(1);
    if (!worksheet) {
      throw new BadRequestException('Invalid Excel file: No worksheet found');
    }

    const results = {
      created: 0,
      failed: 0,
      errors: [] as Array<{ row: number; error: string }>,
      storesSummary: {} as Record<string, number>,
    };

    // Category is now a free-text string from settings
    const validStatuses = Object.values(EquipmentStatus);

    // Cache stores to avoid repeated queries
    const storeCache: Record<string, any> = {};

    const dataStartRow = 6; // After header row 5
    const rows: any[] = [];

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber < dataStartRow) return;

      const storeCode = row.getCell(2).value?.toString()?.trim() || '';
      const name = row.getCell(3).value?.toString()?.trim() || '';
      const category = row.getCell(4).value?.toString()?.trim()?.toUpperCase() || '';
      const brand = row.getCell(5).value?.toString()?.trim() || '';
      const model = row.getCell(6).value?.toString()?.trim() || '';
      const serialNumber = row.getCell(7).value?.toString()?.trim() || '';
      const status = row.getCell(8).value?.toString()?.trim()?.toUpperCase() || 'ACTIVE';
      const purchaseDateRaw = row.getCell(9).value;
      const warrantyExpiryRaw = row.getCell(10).value;
      const ipAddress = row.getCell(11).value?.toString()?.trim() || '';

      if (!storeCode && !name && !serialNumber) return;

      rows.push({ rowNumber, storeCode, name, category, brand, model, serialNumber, status, purchaseDateRaw, warrantyExpiryRaw, ipAddress });
    });

    for (const rowData of rows) {
      try {
        const { rowNumber, storeCode, name, category, brand, model, serialNumber, status, purchaseDateRaw, warrantyExpiryRaw, ipAddress } = rowData;

        // Validate required
        if (!storeCode) { results.errors.push({ row: rowNumber, error: 'Store Code is required' }); results.failed++; continue; }
        if (!name) { results.errors.push({ row: rowNumber, error: 'Equipment Name is required' }); results.failed++; continue; }
        if (!category) { results.errors.push({ row: rowNumber, error: 'Category is required' }); results.failed++; continue; }
        if (!serialNumber || serialNumber.length < 3) { results.errors.push({ row: rowNumber, error: 'Serial Number is required (min 3 chars)' }); results.failed++; continue; }
        // category is now free-text from settings, validated as non-empty above

        const equipStatus = validStatuses.includes(status as EquipmentStatus) ? status as EquipmentStatus : EquipmentStatus.ACTIVE;

        // Resolve store
        if (!storeCache[storeCode.toUpperCase()]) {
          const store = await this.prisma.store.findFirst({
            where: { storeCode: { equals: storeCode, mode: 'insensitive' } },
          });
          if (!store) { results.errors.push({ row: rowNumber, error: `Store "${storeCode}" not found` }); results.failed++; continue; }
          storeCache[storeCode.toUpperCase()] = store;
        }
        const store = storeCache[storeCode.toUpperCase()];

        // Check duplicate serial
        const existing = await this.prisma.equipment.findFirst({ where: { serialNumber: { equals: serialNumber, mode: 'insensitive' } } });
        if (existing) { results.errors.push({ row: rowNumber, error: `Serial "${serialNumber}" already exists` }); results.failed++; continue; }

        // Parse dates
        let purchaseDate: Date | null = null;
        let warrantyExpiry: Date | null = null;
        if (purchaseDateRaw) {
          const d = purchaseDateRaw instanceof Date ? purchaseDateRaw : new Date(purchaseDateRaw.toString());
          if (!isNaN(d.getTime())) purchaseDate = d;
        }
        if (warrantyExpiryRaw) {
          const d = warrantyExpiryRaw instanceof Date ? warrantyExpiryRaw : new Date(warrantyExpiryRaw.toString());
          if (!isNaN(d.getTime())) warrantyExpiry = d;
        }

        await this.prisma.equipment.create({
          data: {
            name,
            category: category,
            brand: brand || null,
            model: model || null,
            serialNumber,
            ipAddress: ipAddress || null,
            status: equipStatus,
            purchaseDate,
            warrantyExpiry,
            storeId: store.id,
          },
        });

        // Log
        const created = await this.prisma.equipment.findFirst({ where: { serialNumber }, orderBy: { id: 'desc' } });
        if (created) {
          await this.prisma.equipmentLog.create({
            data: {
              equipmentId: created.id,
              action: EquipmentLogAction.CREATED,
              source: EquipmentLogSource.IMPORT,
              description: `Bulk imported to ${store.storeCode}`,
              changedBy: userId,
            },
          });
        }

        results.created++;
        results.storesSummary[store.storeCode] = (results.storesSummary[store.storeCode] || 0) + 1;
      } catch (error: any) {
        results.errors.push({ row: rowData.rowNumber, error: error.message || 'Unknown error' });
        results.failed++;
      }
    }

    return results;
  }

  /**
   * Import equipment from Excel (Inventory List format)
   * Reads Store Code from header (Row 4, Cell B4)
   * Data starts from Row 9 (after header row 8)
   */
  async importFromExcel(
    buffer: Buffer,
    userId: number,
  ): Promise<{
    success: number;
    failed: number;
    errors: Array<{ row: number; error: string }>;
    storeCode?: string;
  }> {
    const workbook = new ExcelJS.Workbook();
    // Use stream approach for better compatibility
    const { Readable } = await import('stream');
    const stream = Readable.from(buffer);
    await workbook.xlsx.read(stream);

    const worksheet = workbook.getWorksheet(1);
    if (!worksheet) {
      throw new BadRequestException('Invalid Excel file: No worksheet found');
    }

    const results = {
      success: 0,
      failed: 0,
      errors: [] as Array<{ row: number; error: string }>,
      storeCode: '',
    };

    // ========== READ STORE CODE FROM HEADER (Row 4, Cell B4) ==========
    const storeCodeCell = worksheet.getCell('B4').value;
    const storeCode = storeCodeCell?.toString()?.trim() || '';

    if (!storeCode) {
      throw new BadRequestException('Store Code not found in header (Cell B4). Please use a valid template.');
    }

    // Verify store exists
    const store = await this.prisma.store.findFirst({
      where: { storeCode: { equals: storeCode, mode: 'insensitive' } },
    });

    if (!store) {
      throw new BadRequestException(`Store "${storeCode}" not found in system`);
    }

    results.storeCode = storeCode;

    // Valid categories and statuses
    // Category is now a free-text string from settings
    const validStatuses = Object.values(EquipmentStatus);

    // ========== PROCESS DATA ROWS (Starting from Row 9) ==========
    const dataStartRow = 9;
    const rows: any[] = [];

    worksheet.eachRow((row, rowNumber) => {
      // Skip header rows (1-8)
      if (rowNumber < dataStartRow) return;

      // Read data: No., Equipment Name, Category, Brand, Model, Serial Number, Status, Purchase Date, Warranty Expiry, IP Address
      const name = row.getCell(2).value?.toString()?.trim() || '';
      const category = row.getCell(3).value?.toString()?.trim()?.toUpperCase() || '';
      const brand = row.getCell(4).value?.toString()?.trim() || '';
      const model = row.getCell(5).value?.toString()?.trim() || '';
      const serialNumber = row.getCell(6).value?.toString()?.trim() || '';
      const status = row.getCell(7).value?.toString()?.trim()?.toUpperCase() || 'ACTIVE';
      const purchaseDateRaw = row.getCell(8).value;
      const warrantyExpiryRaw = row.getCell(9).value;
      const ipAddress = row.getCell(10).value?.toString()?.trim() || '';

      // Skip empty rows (no name and no serial number)
      if (!name && !serialNumber) return;

      rows.push({
        rowNumber,
        name,
        category,
        brand,
        model,
        serialNumber,
        status,
        purchaseDateRaw,
        warrantyExpiryRaw,
        ipAddress,
      });
    });

    // Process each row
    for (const rowData of rows) {
      try {
        const {
          rowNumber,
          name,
          category,
          brand,
          model,
          serialNumber,
          status,
          purchaseDateRaw,
          warrantyExpiryRaw,
          ipAddress,
        } = rowData;

        // Validate required fields
        if (!name) {
          throw new Error('Equipment Name is required');
        }
        if (!category) {
          throw new Error('Category is required');
        }
        if (!serialNumber) {
          throw new Error('Serial Number is required');
        }
        if (serialNumber.length < 3) {
          throw new Error('Serial Number must be at least 3 characters');
        }

        // category is now free-text from settings

        // Validate status
        if (status && !validStatuses.includes(status as EquipmentStatus)) {
          throw new Error(`Invalid status "${status}". Valid: ${validStatuses.join(', ')}`);
        }

        // Check for duplicate serial number
        const existingEquipment = await this.prisma.equipment.findUnique({
          where: { serialNumber },
        });
        if (existingEquipment) {
          throw new Error(`Serial number "${serialNumber}" already exists`);
        }

        // Parse dates
        let purchaseDate: Date | null = null;
        let warrantyExpiry: Date | null = null;

        if (purchaseDateRaw) {
          if (purchaseDateRaw instanceof Date) {
            purchaseDate = purchaseDateRaw;
          } else {
            const dateStr = purchaseDateRaw.toString().trim();
            if (dateStr) {
              purchaseDate = new Date(dateStr);
              if (isNaN(purchaseDate.getTime())) {
                throw new Error(`Invalid purchase date format: "${dateStr}"`);
              }
            }
          }
        }

        if (warrantyExpiryRaw) {
          if (warrantyExpiryRaw instanceof Date) {
            warrantyExpiry = warrantyExpiryRaw;
          } else {
            const dateStr = warrantyExpiryRaw.toString().trim();
            if (dateStr) {
              warrantyExpiry = new Date(dateStr);
              if (isNaN(warrantyExpiry.getTime())) {
                throw new Error(`Invalid warranty expiry date format: "${dateStr}"`);
              }
            }
          }
        }

        // Create equipment
        await this.prisma.$transaction(async (tx) => {
          const newEquipment = await tx.equipment.create({
            data: {
              name,
              category: category,
              brand: brand || null,
              model: model || null,
              serialNumber,
              ipAddress: ipAddress || null,
              status: (status as EquipmentStatus) || EquipmentStatus.ACTIVE,
              purchaseDate,
              warrantyExpiry,
              storeId: store.id,
            },
          });

          // Create log entry
          await tx.equipmentLog.create({
            data: {
              equipmentId: newEquipment.id,
              action: EquipmentLogAction.CREATED,
              source: EquipmentLogSource.IMPORT,
              description: `Equipment "${newEquipment.name}" imported from Excel`,
              changedBy: userId,
              newValue: {
                name: newEquipment.name,
                category: newEquipment.category,
                serialNumber: newEquipment.serialNumber,
                storeId: newEquipment.storeId,
              },
            },
          });
        });

        results.success++;
      } catch (error: any) {
        results.failed++;
        results.errors.push({
          row: rowData.rowNumber,
          error: error.message || 'Unknown error',
        });
      }
    }

    return results;
  }

  /**
   * Preview import - analyze file and return what will be created/updated
   */
  async previewImport(
    buffer: Buffer,
  ): Promise<{
    storeCode: string;
    storeName: string;
    newItems: Array<{
      row: number;
      name: string;
      serialNumber: string;
      category: string;
      brand: string;
      model: string;
    }>;
    updateItems: Array<{
      row: number;
      serialNumber: string;
      currentData: any;
      newData: any;
      changes: string[];
    }>;
    unchangedItems: Array<{
      row: number;
      serialNumber: string;
      name: string;
    }>;
    errors: Array<{ row: number; error: string }>;
  }> {
    const workbook = new ExcelJS.Workbook();
    const { Readable } = await import('stream');
    const stream = Readable.from(buffer);
    await workbook.xlsx.read(stream);

    const worksheet = workbook.getWorksheet(1);
    if (!worksheet) {
      throw new BadRequestException('Invalid Excel file: No worksheet found');
    }

    const result = {
      storeCode: '',
      storeName: '',
      newItems: [] as any[],
      updateItems: [] as any[],
      unchangedItems: [] as any[],
      errors: [] as Array<{ row: number; error: string }>,
    };

    // Read Store Code from header (Row 4, Cell B4)
    const storeCodeCell = worksheet.getCell('B4').value;
    const storeCode = storeCodeCell?.toString()?.trim() || '';

    if (!storeCode) {
      throw new BadRequestException('Store Code not found in header (Cell B4)');
    }

    // Verify store exists
    const store = await this.prisma.store.findFirst({
      where: { storeCode: { equals: storeCode, mode: 'insensitive' } },
    });

    if (!store) {
      throw new BadRequestException(`Store "${storeCode}" not found in system`);
    }

    result.storeCode = store.storeCode;
    result.storeName = store.name;

    // Valid categories and statuses
    // Category is now a free-text string from settings
    const validStatuses = Object.values(EquipmentStatus);

    // Process data rows (starting from Row 9)
    const dataStartRow = 9;

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber < dataStartRow) return;

      const name = row.getCell(2).value?.toString()?.trim() || '';
      const category = row.getCell(3).value?.toString()?.trim()?.toUpperCase() || '';
      const brand = row.getCell(4).value?.toString()?.trim() || '';
      const model = row.getCell(5).value?.toString()?.trim() || '';
      const serialNumber = row.getCell(6).value?.toString()?.trim() || '';
      const status = row.getCell(7).value?.toString()?.trim()?.toUpperCase() || 'ACTIVE';
      const purchaseDateRaw = row.getCell(8).value;
      const warrantyExpiryRaw = row.getCell(9).value;

      // Skip empty rows
      if (!name && !serialNumber) return;

      // Basic validation
      if (!name) {
        result.errors.push({ row: rowNumber, error: 'Equipment Name is required' });
        return;
      }
      if (!category) {
        result.errors.push({ row: rowNumber, error: 'Category is required' });
        return;
      }
      if (!serialNumber) {
        result.errors.push({ row: rowNumber, error: 'Serial Number is required' });
        return;
      }
      if (serialNumber.length < 3) {
        result.errors.push({ row: rowNumber, error: 'Serial Number must be at least 3 characters' });
        return;
      }
      // category is now free-text from settings
      if (status && !validStatuses.includes(status as EquipmentStatus)) {
        result.errors.push({ row: rowNumber, error: `Invalid status "${status}"` });
        return;
      }

      // Parse dates
      let purchaseDate: string | null = null;
      let warrantyExpiry: string | null = null;

      if (purchaseDateRaw) {
        if (purchaseDateRaw instanceof Date) {
          purchaseDate = purchaseDateRaw.toISOString().split('T')[0];
        } else {
          const dateStr = purchaseDateRaw.toString().trim();
          if (dateStr) {
            const parsed = new Date(dateStr);
            if (!isNaN(parsed.getTime())) {
              purchaseDate = parsed.toISOString().split('T')[0];
            }
          }
        }
      }

      if (warrantyExpiryRaw) {
        if (warrantyExpiryRaw instanceof Date) {
          warrantyExpiry = warrantyExpiryRaw.toISOString().split('T')[0];
        } else {
          const dateStr = warrantyExpiryRaw.toString().trim();
          if (dateStr) {
            const parsed = new Date(dateStr);
            if (!isNaN(parsed.getTime())) {
              warrantyExpiry = parsed.toISOString().split('T')[0];
            }
          }
        }
      }

      const newData = {
        name,
        category,
        brand: brand || null,
        model: model || null,
        status: status || 'ACTIVE',
        purchaseDate,
        warrantyExpiry,
      };

      // Store row data for async processing
      result.newItems.push({
        row: rowNumber,
        serialNumber,
        ...newData,
      });
    });

    // Check against existing equipment
    const serialNumbers = result.newItems.map((item) => item.serialNumber);
    const existingEquipment = await this.prisma.equipment.findMany({
      where: { serialNumber: { in: serialNumbers } },
    });

    const existingMap = new Map(existingEquipment.map((e) => [e.serialNumber, e]));

    // Categorize items
    const finalNewItems: any[] = [];
    const finalUpdateItems: any[] = [];
    const finalUnchangedItems: any[] = [];

    for (const item of result.newItems) {
      const existing = existingMap.get(item.serialNumber);

      if (!existing) {
        // New item
        finalNewItems.push({
          row: item.row,
          name: item.name,
          serialNumber: item.serialNumber,
          category: item.category,
          brand: item.brand || '-',
          model: item.model || '-',
        });
      } else {
        // Check if data is different
        const changes: string[] = [];
        const currentData: any = {};
        const newData: any = {};

        if (existing.name !== item.name) {
          changes.push('name');
          currentData.name = existing.name;
          newData.name = item.name;
        }
        if (existing.category !== item.category) {
          changes.push('category');
          currentData.category = existing.category;
          newData.category = item.category;
        }
        if ((existing.brand || null) !== (item.brand || null)) {
          changes.push('brand');
          currentData.brand = existing.brand || '-';
          newData.brand = item.brand || '-';
        }
        if ((existing.model || null) !== (item.model || null)) {
          changes.push('model');
          currentData.model = existing.model || '-';
          newData.model = item.model || '-';
        }
        if (existing.status !== item.status) {
          changes.push('status');
          currentData.status = existing.status;
          newData.status = item.status;
        }

        const existingPurchaseDate = existing.purchaseDate
          ? existing.purchaseDate.toISOString().split('T')[0]
          : null;
        if (existingPurchaseDate !== item.purchaseDate) {
          changes.push('purchaseDate');
          currentData.purchaseDate = existingPurchaseDate || '-';
          newData.purchaseDate = item.purchaseDate || '-';
        }

        const existingWarrantyExpiry = existing.warrantyExpiry
          ? existing.warrantyExpiry.toISOString().split('T')[0]
          : null;
        if (existingWarrantyExpiry !== item.warrantyExpiry) {
          changes.push('warrantyExpiry');
          currentData.warrantyExpiry = existingWarrantyExpiry || '-';
          newData.warrantyExpiry = item.warrantyExpiry || '-';
        }

        // Check if equipment belongs to same store
        if (existing.storeId !== store.id) {
          result.errors.push({
            row: item.row,
            error: `Serial "${item.serialNumber}" exists in different store`,
          });
          continue;
        }

        if (changes.length > 0) {
          finalUpdateItems.push({
            row: item.row,
            serialNumber: item.serialNumber,
            currentData,
            newData,
            changes,
          });
        } else {
          finalUnchangedItems.push({
            row: item.row,
            serialNumber: item.serialNumber,
            name: item.name,
          });
        }
      }
    }

    result.newItems = finalNewItems;
    result.updateItems = finalUpdateItems;
    result.unchangedItems = finalUnchangedItems;

    return result;
  }

  /**
   * Import equipment with update support
   */
  async importWithUpdate(
    buffer: Buffer,
    userId: number,
    mode: 'create_only' | 'update_or_create' = 'create_only',
  ): Promise<{
    created: number;
    updated: number;
    skipped: number;
    failed: number;
    errors: Array<{ row: number; error: string }>;
    storeCode: string;
  }> {
    const workbook = new ExcelJS.Workbook();
    const { Readable } = await import('stream');
    const stream = Readable.from(buffer);
    await workbook.xlsx.read(stream);

    const worksheet = workbook.getWorksheet(1);
    if (!worksheet) {
      throw new BadRequestException('Invalid Excel file: No worksheet found');
    }

    const results = {
      created: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      errors: [] as Array<{ row: number; error: string }>,
      storeCode: '',
    };

    // Read Store Code from header
    const storeCodeCell = worksheet.getCell('B4').value;
    const storeCode = storeCodeCell?.toString()?.trim() || '';

    if (!storeCode) {
      throw new BadRequestException('Store Code not found in header (Cell B4)');
    }

    const store = await this.prisma.store.findFirst({
      where: { storeCode: { equals: storeCode, mode: 'insensitive' } },
    });

    if (!store) {
      throw new BadRequestException(`Store "${storeCode}" not found in system`);
    }

    results.storeCode = store.storeCode;

    // Category is now a free-text string from settings
    const validStatuses = Object.values(EquipmentStatus);

    // Process data rows
    const dataStartRow = 9;
    const rows: any[] = [];

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber < dataStartRow) return;

      const name = row.getCell(2).value?.toString()?.trim() || '';
      const category = row.getCell(3).value?.toString()?.trim()?.toUpperCase() || '';
      const brand = row.getCell(4).value?.toString()?.trim() || '';
      const model = row.getCell(5).value?.toString()?.trim() || '';
      const serialNumber = row.getCell(6).value?.toString()?.trim() || '';
      const status = row.getCell(7).value?.toString()?.trim()?.toUpperCase() || 'ACTIVE';
      const purchaseDateRaw = row.getCell(8).value;
      const warrantyExpiryRaw = row.getCell(9).value;

      if (!name && !serialNumber) return;

      rows.push({
        rowNumber,
        name,
        category,
        brand,
        model,
        serialNumber,
        status,
        purchaseDateRaw,
        warrantyExpiryRaw,
      });
    });

    for (const rowData of rows) {
      try {
        const {
          rowNumber,
          name,
          category,
          brand,
          model,
          serialNumber,
          status,
          purchaseDateRaw,
          warrantyExpiryRaw,
        } = rowData;

        // Validate
        if (!name) throw new Error('Equipment Name is required');
        if (!category) throw new Error('Category is required');
        if (!serialNumber) throw new Error('Serial Number is required');
        if (serialNumber.length < 3) throw new Error('Serial Number must be at least 3 characters');
        // category is now free-text from settings
        if (status && !validStatuses.includes(status as EquipmentStatus)) {
          throw new Error(`Invalid status "${status}"`);
        }

        // Parse dates
        let purchaseDate: Date | null = null;
        let warrantyExpiry: Date | null = null;

        if (purchaseDateRaw) {
          if (purchaseDateRaw instanceof Date) {
            purchaseDate = purchaseDateRaw;
          } else {
            const dateStr = purchaseDateRaw.toString().trim();
            if (dateStr) {
              purchaseDate = new Date(dateStr);
              if (isNaN(purchaseDate.getTime())) purchaseDate = null;
            }
          }
        }

        if (warrantyExpiryRaw) {
          if (warrantyExpiryRaw instanceof Date) {
            warrantyExpiry = warrantyExpiryRaw;
          } else {
            const dateStr = warrantyExpiryRaw.toString().trim();
            if (dateStr) {
              warrantyExpiry = new Date(dateStr);
              if (isNaN(warrantyExpiry.getTime())) warrantyExpiry = null;
            }
          }
        }

        // Check existing
        const existing = await this.prisma.equipment.findUnique({
          where: { serialNumber },
        });

        if (existing) {
          // Equipment exists
          if (mode === 'create_only') {
            results.skipped++;
            continue;
          }

          // Check if belongs to same store
          if (existing.storeId !== store.id) {
            throw new Error(`Serial "${serialNumber}" exists in different store`);
          }

          // Update
          await this.prisma.$transaction(async (tx) => {
            const oldData = {
              name: existing.name,
              category: existing.category,
              brand: existing.brand,
              model: existing.model,
              status: existing.status,
              purchaseDate: existing.purchaseDate,
              warrantyExpiry: existing.warrantyExpiry,
            };

            const updated = await tx.equipment.update({
              where: { id: existing.id },
              data: {
                name,
                category: category,
                brand: brand || null,
                model: model || null,
                status: (status as EquipmentStatus) || EquipmentStatus.ACTIVE,
                purchaseDate,
                warrantyExpiry,
              },
            });

            await tx.equipmentLog.create({
              data: {
                equipmentId: existing.id,
                action: EquipmentLogAction.UPDATED,
                source: EquipmentLogSource.IMPORT,
                description: `Equipment "${updated.name}" updated from Excel import`,
                changedBy: userId,
                oldValue: oldData as any,
                newValue: {
                  name: updated.name,
                  category: updated.category,
                  brand: updated.brand,
                  model: updated.model,
                  status: updated.status,
                  purchaseDate: updated.purchaseDate,
                  warrantyExpiry: updated.warrantyExpiry,
                },
              },
            });
          });

          results.updated++;
        } else {
          // Create new
          await this.prisma.$transaction(async (tx) => {
            const newEquipment = await tx.equipment.create({
              data: {
                name,
                category: category,
                brand: brand || null,
                model: model || null,
                serialNumber,
                status: (status as EquipmentStatus) || EquipmentStatus.ACTIVE,
                purchaseDate,
                warrantyExpiry,
                storeId: store.id,
              },
            });

            await tx.equipmentLog.create({
              data: {
                equipmentId: newEquipment.id,
                action: EquipmentLogAction.CREATED,
                source: EquipmentLogSource.IMPORT,
                description: `Equipment "${newEquipment.name}" imported from Excel`,
                changedBy: userId,
                newValue: {
                  name: newEquipment.name,
                  category: newEquipment.category,
                  serialNumber: newEquipment.serialNumber,
                  storeId: newEquipment.storeId,
                },
              },
            });
          });

          results.created++;
        }
      } catch (error: any) {
        results.failed++;
        results.errors.push({
          row: rowData.rowNumber,
          error: error.message || 'Unknown error',
        });
      }
    }

    return results;
  }
}

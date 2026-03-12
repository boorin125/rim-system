// src/modules/stores/stores.service.ts

import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditTrailService } from '../audit-trail/audit-trail.service';
import { AuditModule, AuditAction } from '@prisma/client';
import { ExcelService, ParsedStoreRow } from './services/excel.service';
import { ImportStoresDto } from './dto/import-stores.dto';
import { ExportStoresDto } from './dto/export-stores.dto';

@Injectable()
export class StoresService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly excelService: ExcelService,
    private readonly auditTrailService: AuditTrailService,
  ) {}

  // ==========================================
  // CRUD Methods
  // ==========================================

  async create(data: any) {
    // Check if store code already exists with ACTIVE or TEMPORARILY_CLOSED status
    const existingStore = await this.prisma.store.findFirst({
      where: {
        storeCode: data.storeCode,
        storeStatus: {
          in: ['ACTIVE', 'TEMPORARILY_CLOSED'],
        },
      },
    });

    if (existingStore) {
      const statusText = existingStore.storeStatus === 'ACTIVE' ? 'เปิดใช้งาน' : 'ปิดชั่วคราว';
      throw new BadRequestException(
        `รหัสสาขา "${data.storeCode}" มีการใช้งานอยู่ในระบบ (สถานะ: ${statusText}) กรุณาใช้รหัสสาขาอื่น หรือเปลี่ยนสถานะสาขาเดิมเป็น "ปิดถาวร" ก่อน`,
      );
    }

    // Create store
    try {
      return await this.prisma.store.create({
        data: {
          storeCode: data.storeCode,
          name: data.name,
          company: data.company,
          storeType: data.storeType || 'PERMANENT',
          storeStatus: data.storeStatus || 'ACTIVE',

          // Optional fields
          address: data.address || null,
          province: data.province || null,
          district: data.district || null,
          subDistrict: data.subDistrict || null,
          postalCode: data.postalCode || null,
          area: data.area || null,
          serviceCenter: data.serviceCenter || null,
          phone: data.phone || null,
          email: data.email || null,
          googleMapLink: data.googleMapLink || null,
          latitude: data.latitude ? parseFloat(data.latitude) : null,
          longitude: data.longitude ? parseFloat(data.longitude) : null,

          // Network
          circuitId: data.circuitId || null,
          routerIp: data.routerIp || null,
          switchIp: data.switchIp || null,
          accessPointIp: data.accessPointIp || null,
          pcServerIp: data.pcServerIp || null,
          pcPrinterIp: data.pcPrinterIp || null,
          pmcComputerIp: data.pmcComputerIp || null,
          sbsComputerIp: data.sbsComputerIp || null,
          vatComputerIp: data.vatComputerIp || null,
          posIp: data.posIp || null,
          edcIp: data.edcIp || null,
          scoIp: data.scoIp || null,
          peopleCounterIp: data.peopleCounterIp || null,
          digitalTvIp: data.digitalTvIp || null,
          timeAttendanceIp: data.timeAttendanceIp || null,
          cctvIp: data.cctvIp || null,

          // Working hours
          mondayOpen: data.mondayOpen || null,
          mondayClose: data.mondayClose || null,
          tuesdayOpen: data.tuesdayOpen || null,
          tuesdayClose: data.tuesdayClose || null,
          wednesdayOpen: data.wednesdayOpen || null,
          wednesdayClose: data.wednesdayClose || null,
          thursdayOpen: data.thursdayOpen || null,
          thursdayClose: data.thursdayClose || null,
          fridayOpen: data.fridayOpen || null,
          fridayClose: data.fridayClose || null,
          saturdayOpen: data.saturdayOpen || null,
          saturdayClose: data.saturdayClose || null,
          sundayOpen: data.sundayOpen || null,
          sundayClose: data.sundayClose || null,
          holidayOpen: data.holidayOpen || null,
          holidayClose: data.holidayClose || null,

          // Dates
          openDate: data.openDate ? new Date(data.openDate) : null,
          closeDate: data.closeDate ? new Date(data.closeDate) : null,

          notes: data.notes || null,
        },
      });
    } catch (error) {
      // Re-throw BadRequestException as-is (preserve custom error messages)
      if (error instanceof BadRequestException) {
        throw error;
      }
      // For other errors (like Prisma errors), wrap with generic message
      throw new BadRequestException(
        `ไม่สามารถสร้างสาขาได้: ${error.message}`,
      );
    }
  }

  /**
   * Get all distinct province names from stores (sorted)
   */
  async getProvinces(): Promise<string[]> {
    const result = await this.prisma.store.findMany({
      where: { province: { not: null } },
      select: { province: true },
      distinct: ['province'],
      orderBy: { province: 'asc' },
    });
    return result.map((r) => r.province as string);
  }

  async findAll(query: any) {
    const {
      page = 1,
      limit = 10,
      status,
      province,
      company,
      storeType,
      search,
    } = query;

    // Build where clause
    const where: any = {};

    // Filter by status
    if (status) {
      where.storeStatus = status;
    }

    // Filter by province
    if (province) {
      where.province = province;
    }

    // Filter by company
    if (company) {
      where.company = company;
    }

    // Filter by storeType
    if (storeType) {
      where.storeType = storeType;
    }

    // Search by name, code, or company
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { storeCode: { contains: search, mode: 'insensitive' } },
        { company: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    // Fetch stores with pagination
    const [stores, total] = await Promise.all([
      this.prisma.store.findMany({
        where,
        skip,
        take,
        orderBy: { storeCode: 'asc' },
      }),
      this.prisma.store.count({ where }),
    ]);

    // Return paginated response
    return {
      data: stores,
      meta: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    };
  }

  async findOne(id: number) {
    const store = await this.prisma.store.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            incidents: true,
            equipment: true,
          },
        },
      },
    });

    if (!store) {
      throw new NotFoundException(`ไม่พบสาขา ID ${id} ในระบบ`);
    }

    return store;
  }

  async update(id: number, data: any) {
    // Check if store exists
    await this.findOne(id);

    return this.prisma.store.update({
      where: { id },
      data,
    });
  }

  async remove(id: number) {
    // Check if store exists
    await this.findOne(id);

    return this.prisma.store.delete({
      where: { id },
    });
  }

  async updateLayoutImage(id: number, layoutImagePath: string) {
    return this.prisma.store.update({
      where: { id },
      data: { layoutImagePath },
    });
  }

  async updateIpRangeImage(id: number, ipRangeImagePath: string) {
    return this.prisma.store.update({
      where: { id },
      data: { ipRangeImagePath },
    });
  }

  // ==========================================
  // Delete Request Methods
  // ==========================================

  async requestDelete(storeId: number, requestedBy: number, reason: string) {
    // Check if store exists
    const store = await this.findOne(storeId);

    // Check if there's already a pending request
    const existingRequest = await this.prisma.storeDeleteRequest.findFirst({
      where: {
        storeId,
        status: 'PENDING',
      },
    });

    if (existingRequest) {
      throw new BadRequestException(
        'สาขานี้มีคำขอลบที่รอดำเนินการอยู่แล้ว',
      );
    }

    // Get requester info
    const requester = await this.prisma.user.findUnique({
      where: { id: requestedBy },
      select: { firstName: true, lastName: true, username: true },
    });

    // Create delete request
    const deleteRequest = await this.prisma.storeDeleteRequest.create({
      data: {
        storeId,
        requestedBy,
        reason,
        status: 'PENDING',
      },
      include: {
        store: true,
        requester: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Send notification to all IT Managers
    const itManagers = await this.prisma.user.findMany({
      where: {
        roles: {
          some: {
            role: 'IT_MANAGER',
          },
        },
        status: 'ACTIVE',
      },
      select: { id: true },
    });

    const requesterName = requester?.firstName && requester?.lastName
      ? `${requester.firstName} ${requester.lastName}`
      : requester?.username || 'ไม่ทราบชื่อ';

    // Create notifications for all IT Managers
    if (itManagers.length > 0) {
      await this.prisma.notification.createMany({
        data: itManagers.map((manager) => ({
          userId: manager.id,
          type: 'SYSTEM_ALERT' as const,
          title: 'มีคำขอลบสาขารออนุมัติ',
          message: `${requesterName} ส่งคำขอลบสาขา "${store.name}" (${store.storeCode}) เหตุผล: ${reason}`,
        })),
      });
    }

    // Audit trail
    await this.auditTrailService.logDirect({
      module: AuditModule.STORE,
      action: AuditAction.DELETE,
      entityType: 'Store',
      entityId: storeId,
      userId: requestedBy,
      description: `Requested permanent deletion of store ${store.storeCode} - ${store.name}. Reason: ${reason}`,
    });

    return deleteRequest;
  }

  async getPendingDeleteRequests() {
    return this.prisma.storeDeleteRequest.findMany({
      where: {
        status: 'PENDING',
      },
      include: {
        store: true,
        requester: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Soft delete: Change store status to PERMANENTLY_CLOSED
   * HELP_DESK can do this directly without approval
   */
  async softDeleteStore(storeId: number, userId: number, reason?: string) {
    const store = await this.findOne(storeId);

    if (store.storeStatus === 'PERMANENTLY_CLOSED') {
      throw new BadRequestException('สาขานี้ถูกปิดถาวรไปแล้ว');
    }

    // Update store status
    const updatedStore = await this.prisma.store.update({
      where: { id: storeId },
      data: {
        storeStatus: 'PERMANENTLY_CLOSED',
        closeDate: new Date(),
      },
    });

    // Log the action
    console.log(`[SOFT DELETE] Store ${store.storeCode} - ${store.name} closed by user ${userId}. Reason: ${reason || 'N/A'}`);

    // Audit trail
    await this.auditTrailService.logDirect({
      module: AuditModule.STORE,
      action: AuditAction.DELETE,
      entityType: 'Store',
      entityId: storeId,
      userId,
      description: `ปิดสาขาถาวร ${store.storeCode} - ${store.name} สถานะเดิม: ${store.storeStatus}${reason ? ` เหตุผล: ${reason}` : ''}`,
    });

    return {
      message: `สาขา "${store.name}" (${store.storeCode}) ถูกเปลี่ยนสถานะเป็นปิดถาวรสำเร็จ`,
      store: updatedStore,
    };
  }

  /**
   * Approve delete request and PERMANENTLY DELETE the store
   * IT_MANAGER approves → Hard delete from database
   */
  async approveDeleteRequest(requestId: number, approvedBy: number, note?: string) {
    // Get the request
    const request = await this.prisma.storeDeleteRequest.findUnique({
      where: { id: requestId },
      include: { store: true },
    });

    if (!request) {
      throw new NotFoundException('ไม่พบคำขอลบสาขา');
    }

    if (request.status !== 'PENDING') {
      throw new BadRequestException('คำขอนี้ได้รับการดำเนินการแล้ว');
    }

    // Store info for notification before deletion
    const storeInfo = {
      name: request.store.name,
      storeCode: request.store.storeCode,
    };

    // Update request status
    await this.prisma.storeDeleteRequest.update({
      where: { id: requestId },
      data: {
        status: 'APPROVED',
        approvedBy,
        approvalNote: note,
      },
    });

    // PERMANENT DELETE: Actually delete the store from database
    await this.prisma.store.delete({
      where: { id: request.storeId },
    });

    // Create notification for the requester (Helpdesk)
    await this.prisma.notification.create({
      data: {
        userId: request.requestedBy,
        type: 'SYSTEM_ALERT',
        title: 'คำขอลบสาขาถาวรได้รับการอนุมัติ',
        message: `คำขอลบสาขา "${storeInfo.name}" (${storeInfo.storeCode}) ได้รับการอนุมัติแล้ว ข้อมูลสาขาถูกลบออกจากระบบถาวร${note ? ` หมายเหตุ: ${note}` : ''}`,
      },
    });

    // Audit log
    await this.auditTrailService.logDirect({
      module: AuditModule.STORE,
      action: AuditAction.DELETE,
      entityType: 'Store',
      entityId: request.storeId,
      userId: approvedBy,
      description: `อนุมัติลบสาขาถาวร ${storeInfo.storeCode} - ${storeInfo.name}${note ? ` หมายเหตุ: ${note}` : ''}`,
    });

    return {
      message: `ลบสาขา "${storeInfo.name}" (${storeInfo.storeCode}) ออกจากระบบสำเร็จ`,
    };
  }

  async rejectDeleteRequest(requestId: number, approvedBy: number, note?: string) {
    const request = await this.prisma.storeDeleteRequest.findUnique({
      where: { id: requestId },
      include: { store: true },
    });

    if (!request) {
      throw new NotFoundException('ไม่พบคำขอลบสาขา');
    }

    if (request.status !== 'PENDING') {
      throw new BadRequestException('คำขอนี้ได้รับการดำเนินการแล้ว');
    }

    const updatedRequest = await this.prisma.storeDeleteRequest.update({
      where: { id: requestId },
      data: {
        status: 'REJECTED',
        approvedBy,
        approvalNote: note,
      },
      include: {
        store: true,
        requester: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
          },
        },
        approver: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Create notification for the requester (Helpdesk)
    await this.prisma.notification.create({
      data: {
        userId: request.requestedBy,
        type: 'SYSTEM_ALERT',
        title: 'คำขอลบสาขาถูกปฏิเสธ',
        message: `คำขอลบสาขา "${request.store.name}" (${request.store.storeCode}) ถูกปฏิเสธ${note ? ` เหตุผล: ${note}` : ''}`,
      },
    });

    // Audit log
    await this.auditTrailService.logDirect({
      module: AuditModule.STORE,
      action: AuditAction.DELETE,
      entityType: 'StoreDeleteRequest',
      entityId: requestId,
      userId: approvedBy,
      description: `ปฏิเสธคำขอลบสาขา ${request.store.storeCode} - ${request.store.name}${note ? ` เหตุผล: ${note}` : ''}`,
    });

    return updatedRequest;
  }

  // ==========================================
  // Statistics
  // ==========================================

  /**
   * Get store statistics
   */
  async getStoreStatistics(id: number) {
    // Check if store exists
    const store = await this.prisma.store.findUnique({
      where: { id },
    });

    if (!store) {
      throw new NotFoundException(`ไม่พบสาขา ID ${id} ในระบบ`);
    }

    // Count incidents by status
    const incidentsByStatus = await this.prisma.incident.groupBy({
      by: ['status'],
      where: { storeId: id },
      _count: true,
    });

    // Count incidents by priority
    const incidentsByPriority = await this.prisma.incident.groupBy({
      by: ['priority'],
      where: { storeId: id },
      _count: true,
    });

    // Count total incidents
    const totalIncidents = await this.prisma.incident.count({
      where: { storeId: id },
    });

    // Count open incidents
    const openIncidents = await this.prisma.incident.count({
      where: {
        storeId: id,
        status: { in: ['OPEN', 'IN_PROGRESS'] },
      },
    });

    // Count equipment (simple count)
    const totalEquipment = await this.prisma.equipment.count({
      where: { storeId: id },
    });

    // Get all equipment for this store (for manual grouping if needed)
    const equipment = await this.prisma.equipment.findMany({
      where: { storeId: id },
      select: {
        id: true,
        name: true,
        status: true,
      },
    });

    // Get recent incidents (last 10)
    const recentIncidents = await this.prisma.incident.findMany({
      where: { storeId: id },
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        ticketNumber: true,
        title: true,
        status: true,
        priority: true,
        createdAt: true,
      },
    });

    return {
      storeId: id,
      storeName: store.name,
      storeCode: store.storeCode,
      statistics: {
        incidents: {
          total: totalIncidents,
          open: openIncidents,
          byStatus: incidentsByStatus.reduce((acc, curr) => {
            acc[curr.status] = curr._count;
            return acc;
          }, {}),
          byPriority: incidentsByPriority.reduce((acc, curr) => {
            acc[curr.priority] = curr._count;
            return acc;
          }, {}),
        },
        equipment: {
          total: totalEquipment,
          items: equipment,
        },
      },
      recentIncidents,
    };
  }

  // ==========================================
  // Store Incidents & Analytics APIs
  // ==========================================

  /**
   * Get all incidents for a store with pagination and filters
   * GET /stores/:id/incidents
   */
  async getStoreIncidents(
    id: number,
    query: {
      page?: number;
      limit?: number;
      status?: string;
      priority?: string;
      period?: number; // days
    },
  ) {
    const { page = 1, limit = 10, status, priority, period = 30 } = query;

    // Check if store exists
    const store = await this.prisma.store.findUnique({
      where: { id },
      select: { id: true, name: true, storeCode: true },
    });

    if (!store) {
      throw new NotFoundException(`ไม่พบสาขา ID ${id} ในระบบ`);
    }

    // Build where clause
    const where: any = { storeId: id };

    // Filter by period (last N days)
    if (period > 0) {
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - period);
      where.createdAt = { gte: fromDate };
    }

    if (status) {
      where.status = status;
    }

    if (priority) {
      where.priority = priority;
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Get incidents with pagination
    const [incidents, total] = await Promise.all([
      this.prisma.incident.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          assignee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              username: true,
            },
          },
          equipment: {
            select: {
              id: true,
              name: true,
              serialNumber: true,
            },
          },
          slaDefenses: {
            select: {
              status: true,
            },
          },
        },
      }),
      this.prisma.incident.count({ where }),
    ]);

    return {
      storeId: id,
      storeCode: store.storeCode,
      storeName: store.name,
      period: `Last ${period} days`,
      data: incidents,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get distinct statuses and priorities for a store's incidents within a period
   * GET /stores/:id/incidents/filter-options
   */
  async getStoreIncidentFilterOptions(id: number, period: number = 30) {
    const where: any = { storeId: id };
    if (period > 0) {
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - period);
      where.createdAt = { gte: fromDate };
    }

    const [statusGroups, priorityGroups] = await Promise.all([
      this.prisma.incident.groupBy({ by: ['status'], where }),
      this.prisma.incident.groupBy({ by: ['priority'], where }),
    ]);

    return {
      statuses: statusGroups.map((g) => g.status),
      priorities: priorityGroups.map((g) => g.priority),
    };
  }

  /**
   * Get incidents count grouped by equipment for a store
   * GET /stores/:id/incidents/equipment-stats
   */
  async getStoreEquipmentIncidentStats(id: number, period: number = 30) {
    const where: any = { storeId: id, equipmentId: { not: null } };
    if (period > 0) {
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - period);
      where.createdAt = { gte: fromDate };
    }

    const groups = await this.prisma.incident.groupBy({
      by: ['equipmentId'],
      where,
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    });

    if (groups.length === 0) return [];

    const equipmentIds = groups.map((g) => g.equipmentId as number);
    const equipmentList = await this.prisma.equipment.findMany({
      where: { id: { in: equipmentIds } },
      select: { id: true, name: true },
    });
    const nameMap = Object.fromEntries(equipmentList.map((e) => [e.id, e.name]));

    return groups.map((g) => ({
      name: nameMap[g.equipmentId as number] || `Equipment #${g.equipmentId}`,
      count: g._count.id,
    }));
  }

  /**
   * Get monthly incidents count for a store (last 12 months)
   * GET /stores/:id/incidents/monthly-stats
   */
  async getStoreMonthlyIncidentStats(id: number) {
    const now = new Date();
    const fromDate = new Date(now.getFullYear(), now.getMonth() - 11, 1);

    const incidents = await this.prisma.incident.findMany({
      where: { storeId: id, createdAt: { gte: fromDate } },
      select: { createdAt: true },
    });

    // Build month buckets
    const buckets: Record<string, number> = {};
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      buckets[key] = 0;
    }

    for (const inc of incidents) {
      const d = inc.createdAt;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (key in buckets) buckets[key]++;
    }

    return Object.entries(buckets).map(([month, count]) => ({
      month,
      label: new Date(month + '-01').toLocaleDateString('th-TH', { month: 'short', year: '2-digit' }),
      count,
    }));
  }

  /**
   * Get incidents summary for a store
   * GET /stores/:id/incidents/summary
   */
  async getStoreIncidentsSummary(id: number, period: number = 30) {
    // Check if store exists
    const store = await this.prisma.store.findUnique({
      where: { id },
      select: { id: true, name: true, storeCode: true },
    });

    if (!store) {
      throw new NotFoundException(`ไม่พบสาขา ID ${id} ในระบบ`);
    }

    // Calculate date range
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - period);

    const where = {
      storeId: id,
      createdAt: { gte: fromDate },
    };

    // Get counts by status
    const [total, open, assigned, inProgress, resolved, closed] = await Promise.all([
      this.prisma.incident.count({ where }),
      this.prisma.incident.count({ where: { ...where, status: 'OPEN' } }),
      this.prisma.incident.count({ where: { ...where, status: 'ASSIGNED' } }),
      this.prisma.incident.count({ where: { ...where, status: 'IN_PROGRESS' } }),
      this.prisma.incident.count({ where: { ...where, status: 'RESOLVED' } }),
      this.prisma.incident.count({ where: { ...where, status: 'CLOSED' } }),
    ]);

    // Calculate average resolution time for closed incidents
    const closedIncidents = await this.prisma.incident.findMany({
      where: {
        ...where,
        status: 'CLOSED',
        resolvedAt: { not: null },
      },
      select: {
        createdAt: true,
        resolvedAt: true,
      },
    });

    let avgResolutionHours: number | null = null;
    if (closedIncidents.length > 0) {
      const totalMinutes = closedIncidents.reduce((sum, inc) => {
        if (inc.resolvedAt) {
          const diff = inc.resolvedAt.getTime() - inc.createdAt.getTime();
          return sum + Math.floor(diff / 60000);
        }
        return sum;
      }, 0);
      const avgMinutes = totalMinutes / closedIncidents.length;
      avgResolutionHours = Math.round((avgMinutes / 60) * 10) / 10; // Round to 1 decimal
    }

    // Calculate SLA compliance (simplified: closed within SLA)
    const slaCompliance = total > 0 ? Math.round((closed / total) * 100 * 10) / 10 : 100;

    return {
      storeId: id,
      storeCode: store.storeCode,
      storeName: store.name,
      period: `Last ${period} days`,
      total,
      open,
      assigned,
      inProgress,
      resolved,
      closed,
      avgResolutionTime: avgResolutionHours,
      slaCompliance,
    };
  }

  /**
   * Get all equipment for a store
   * GET /stores/:id/equipment
   */
  async getStoreEquipment(id: number) {
    // Check if store exists
    const store = await this.prisma.store.findUnique({
      where: { id },
      select: { id: true, name: true, storeCode: true },
    });

    if (!store) {
      throw new NotFoundException(`ไม่พบสาขา ID ${id} ในระบบ`);
    }

    const equipment = await this.prisma.equipment.findMany({
      where: { storeId: id },
      orderBy: { name: 'asc' },
    });

    // Group by status
    const byStatus = equipment.reduce((acc, eq) => {
      const status = eq.status || 'UNKNOWN';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      storeId: id,
      storeCode: store.storeCode,
      storeName: store.name,
      total: equipment.length,
      byStatus,
      data: equipment,
    };
  }

  /**
   * Get top issues (most common incident categories) for a store
   * GET /stores/:id/top-issues
   */
  async getStoreTopIssues(id: number, period: number = 30, limit: number = 5) {
    // Check if store exists
    const store = await this.prisma.store.findUnique({
      where: { id },
      select: { id: true, name: true, storeCode: true },
    });

    if (!store) {
      throw new NotFoundException(`ไม่พบสาขา ID ${id} ในระบบ`);
    }

    // Calculate date range
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - period);

    // Group incidents by category
    const incidentsByCategory = await this.prisma.incident.groupBy({
      by: ['category'],
      where: {
        storeId: id,
        createdAt: { gte: fromDate },
      },
      _count: true,
      orderBy: {
        _count: {
          category: 'desc',
        },
      },
      take: limit,
    });

    // Get total for percentage calculation
    const totalIncidents = await this.prisma.incident.count({
      where: {
        storeId: id,
        createdAt: { gte: fromDate },
      },
    });

    const topIssues = incidentsByCategory.map((item) => ({
      category: item.category || 'ไม่ระบุหมวดหมู่',
      count: item._count,
      percentage: totalIncidents > 0
        ? Math.round((item._count / totalIncidents) * 100 * 10) / 10
        : 0,
    }));

    return {
      storeId: id,
      storeCode: store.storeCode,
      storeName: store.name,
      period: `Last ${period} days`,
      totalIncidents,
      topIssues,
    };
  }

  // ==========================================
  // Helper Methods for Enum Normalization
  // ==========================================

  /**
   * Normalize store type from Excel to Prisma enum
   * permanent → PERMANENT
   * pop_up → POP_UP
   * seasonal → SEASONAL
   */
  private normalizeStoreType(value: string): string {
    return value.toUpperCase().replace('-', '_');
  }

  /**
   * Normalize store status from Excel to Prisma enum
   * active → ACTIVE
   * inactive → INACTIVE
   */
  private normalizeStoreStatus(value: string): string {
    return value.toUpperCase();
  }

  /**
   * Normalize SLA Region value
   * @param value - Input value (BANGKOK_METRO, PROVINCIAL, BKK, etc.)
   * @returns Normalized SLA Region enum value
   */
  private normalizeSlaRegion(value?: string): string {
    if (!value) return 'BANGKOK_METRO'; // Default value

    const normalized = value.toUpperCase().trim();

    // Map common aliases
    if (
      normalized === 'BKK' ||
      normalized === 'BANGKOK' ||
      normalized === 'METRO' ||
      normalized === 'BANGKOK_METRO'
    ) {
      return 'BANGKOK_METRO';
    }

    if (
      normalized === 'UPC' ||
      normalized === 'UPCOUNTRY' ||
      normalized === 'PROVINCIAL' ||
      normalized === 'PROVINCE'
    ) {
      return 'PROVINCIAL';
    }

    // Default to BANGKOK_METRO if unrecognized
    return 'BANGKOK_METRO';
  }

  /**
   * Parse date from Excel (handles serial numbers and date strings)
   * @param value - Date value from Excel (could be string, number, or empty)
   * @returns Date object or null
   */
  private parseExcelDate(value?: string): Date | null {
    if (!value || value.trim() === '') return null;

    const trimmed = value.trim();

    // Try date string first (YYYY-MM-DD, DD/MM/YYYY, etc.) — must check before serial number
    // because parseFloat("2024-01-15") returns 2024 which would be misinterpreted as serial
    if (/\D/.test(trimmed)) {
      // Contains non-digit characters, so it's a date string not a pure number
      // Handle DD/MM/YYYY format common in Thai/EU locales
      const ddmmyyyy = trimmed.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
      if (ddmmyyyy) {
        const [, d, m, y] = ddmmyyyy;
        const date = new Date(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T00:00:00`);
        if (!isNaN(date.getTime())) {
          const year = date.getFullYear();
          if (year >= 1900 && year <= 2100) return date;
        }
      }

      const date = new Date(trimmed);
      if (!isNaN(date.getTime())) {
        const year = date.getFullYear();
        if (year >= 1900 && year <= 2100) return date;
      }
      return null;
    }

    // Pure number — Excel serial date (days since 1900-01-01)
    const numValue = parseFloat(trimmed);
    if (!isNaN(numValue) && numValue > 0 && numValue < 100000) {
      // Standard conversion: (serial - 25569) * 86400 * 1000
      // 25569 = days between 1900-01-01 and 1970-01-01 (Unix epoch)
      const date = new Date((numValue - 25569) * 86400 * 1000);

      const year = date.getFullYear();
      if (year >= 1900 && year <= 2100) {
        return date;
      }
      return null;
    }

    // Fallback
    const date = new Date(trimmed);
    if (!isNaN(date.getTime())) {
      // Validate the date is reasonable (between 1900 and 2100)
      const year = date.getFullYear();
      if (year >= 1900 && year <= 2100) {
        return date;
      }
    }

    return null;
  }

  /**
   * Translate common error messages to Thai
   */
  private translateErrorMessage(message: string): string {
    // DateTime errors
    if (message.includes('Could not convert argument value') && message.includes('DateTime')) {
      return 'รูปแบบวันที่ไม่ถูกต้อง กรุณาใช้รูปแบบ YYYY-MM-DD (เช่น 2024-01-15)';
    }

    // Unique constraint errors
    if (message.includes('Unique constraint failed')) {
      return 'ข้อมูลซ้ำกับที่มีอยู่ในระบบ';
    }

    // Required field errors
    if (message.includes('must not be null') || message.includes('is required')) {
      return 'ข้อมูลที่จำเป็นไม่ครบถ้วน';
    }

    // Invalid data type errors
    if (message.includes('Invalid value') || message.includes('Expected')) {
      return 'รูปแบบข้อมูลไม่ถูกต้อง';
    }

    // Connection errors
    if (message.includes('Connection') || message.includes('connect')) {
      return 'เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล';
    }

    // Return original message if no translation found
    return message;
  }

  // ==========================================
  // Import from Excel
  // ==========================================

  /**
   * Import stores from Excel file
   */
  async importFromExcel(file: Express.Multer.File, dto?: ImportStoresDto) {
    // 1. Parse Excel file
    const rows = await this.excelService.parseExcelFile(file);
    const updateExisting = dto?.updateExisting === true;

    if (rows.length === 0) {
      throw new BadRequestException('ไฟล์ Excel ไม่มีข้อมูล');
    }

    if (rows.length > 1000) {
      throw new BadRequestException('สามารถนำเข้าได้สูงสุด 1,000 สาขาต่อครั้ง');
    }

    // 2. Validate all rows
    const validRows: ParsedStoreRow[] = [];
    const errors: Array<{ row: number; code?: string; name?: string; error: string }> = [];
    const skipped: Array<{ row: number; code: string; reason: string }> = [];

    for (const row of rows) {
      try {
        // Validate required fields
        if (!row.code || !row.name || !row.company) {
          errors.push({
            row: row.rowNumber,
            error: 'ข้อมูลไม่ครบ: รหัสสาขา, ชื่อสาขา หรือบริษัท',
          });
          continue;
        }

        // Validate IP addresses
        const ipFields: Array<keyof ParsedStoreRow> = [
          'routerIp',
          'switchIp',
          'accessPointIp',
          'pcServerIp',
          'pcPrinterIp',
          'pmcComputerIp',
          'sbsComputerIp',
          'vatComputerIp',
          'posIp',
          'edcIp',
          'scoIp',
          'peopleCounterIp',
          'digitalTvIp',
          'timeAttendanceIp',
          'cctvIp',
        ];

        let hasIpError = false;
        for (const field of ipFields) {
          const value = row[field];
          if (value && typeof value === 'string' && !this.isValidIp(value)) {
            errors.push({
              row: row.rowNumber,
              error: `IP Address ไม่ถูกต้อง: ${field} = '${value}'`,
            });
            hasIpError = true;
            break;
          }
        }

        if (hasIpError) continue;

        // Check for duplicates if skipDuplicates is enabled
        if (dto?.skipDuplicates) {
          const existing = await this.prisma.store.findFirst({
            where: {
              storeCode: row.code,
              storeStatus: 'ACTIVE',
            },
          });

          if (existing) {
            skipped.push({
              row: row.rowNumber,
              code: row.code,
              reason: updateExisting
                ? 'อัปเดตสาขาที่มีอยู่แล้ว'
                : 'รหัสสาขาซ้ำกับที่มีอยู่ในระบบ',
            });

            // Update if requested
            if (updateExisting) {
              await this.prisma.store.update({
                where: { id: existing.id },
                data: this.mapRowToStoreData(row),
              });
            }

            continue;
          }
        }

        validRows.push(row);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ';
        errors.push({
          row: row.rowNumber,
          error: errorMessage,
        });
      }
    }

    // 3. Import valid rows
    const imported: Array<{ row: number; code: string; name: string }> = [];

    for (const row of validRows) {
      try {
        // Check if store already exists
        const existing = await this.prisma.store.findFirst({
          where: {
            storeCode: row.code,
            storeStatus: 'ACTIVE',
          },
        });

        let store;
        if (existing && updateExisting) {
          // Update existing store
          store = await this.prisma.store.update({
            where: { id: existing.id },
            data: this.mapRowToStoreData(row),
          });
        } else if (!existing) {
          // Create new store
          store = await this.prisma.store.create({
            data: this.mapRowToStoreData(row),
          });
        } else {
          // Store exists but update not allowed
          errors.push({
            row: row.rowNumber,
            code: row.code,
            name: row.name,
            error: `สาขา ${row.code} มีอยู่ในระบบแล้ว กรุณาเปิดตัวเลือก "อัปเดตสาขาที่มีอยู่" เพื่ออัปเดตข้อมูล`,
          });
          continue;
        }

        imported.push({
          row: row.rowNumber,
          code: store.storeCode,
          name: store.name,
        });
      } catch (error) {
        let errorMessage =
          error instanceof Error ? error.message : 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ';

        // Translate common Prisma/database errors to Thai
        errorMessage = this.translateErrorMessage(errorMessage);

        errors.push({
          row: row.rowNumber,
          code: row.code,
          name: row.name,
          error: errorMessage,
        });
      }
    }

    // 4. Return results
    return {
      success: true,
      summary: {
        totalRows: rows.length,
        imported: imported.length,
        skipped: skipped.length,
        failed: errors.length,
      },
      imported,
      skipped,
      errors,
    };
  }

  /**
   * Map Excel row to Prisma create data
   */
  private mapRowToStoreData(row: ParsedStoreRow): any {
    return {
      storeCode: row.code,
      name: row.name,
      company: row.company,
      storeType: this.normalizeStoreType(row.storeType || 'permanent'),

      // Address Information
      address: row.address || null,
      province: row.province || null,
      slaRegion: this.normalizeSlaRegion(row.slaRegion),
      postalCode: row.postalCode || null,
      area: row.area || null,
      serviceCenter: row.serviceCenter || null,

      // Contact
      phone: row.phone || null,
      email: row.email || null,
      googleMapLink: row.googleMapLink || null,

      // Network Information
      circuitId: row.circuitId || null,

      // IP addresses
      routerIp: row.routerIp || null,
      switchIp: row.switchIp || null,
      accessPointIp: row.accessPointIp || null,
      pcServerIp: row.pcServerIp || null,
      pcPrinterIp: row.pcPrinterIp || null,
      pmcComputerIp: row.pmcComputerIp || null,
      sbsComputerIp: row.sbsComputerIp || null,
      vatComputerIp: row.vatComputerIp || null,
      posIp: row.posIp || null,
      edcIp: row.edcIp || null,
      scoIp: row.scoIp || null,
      peopleCounterIp: row.peopleCounterIp || null,
      digitalTvIp: row.digitalTvIp || null,
      timeAttendanceIp: row.timeAttendanceIp || null,
      cctvIp: row.cctvIp || null,

      // Working Hours (Monday - Sunday + Holiday)
      mondayOpen: row.mondayOpen || null,
      mondayClose: row.mondayClose || null,
      tuesdayOpen: row.tuesdayOpen || null,
      tuesdayClose: row.tuesdayClose || null,
      wednesdayOpen: row.wednesdayOpen || null,
      wednesdayClose: row.wednesdayClose || null,
      thursdayOpen: row.thursdayOpen || null,
      thursdayClose: row.thursdayClose || null,
      fridayOpen: row.fridayOpen || null,
      fridayClose: row.fridayClose || null,
      saturdayOpen: row.saturdayOpen || null,
      saturdayClose: row.saturdayClose || null,
      sundayOpen: row.sundayOpen || null,
      sundayClose: row.sundayClose || null,
      holidayOpen: row.holidayOpen || null,
      holidayClose: row.holidayClose || null,

      // Dates
      openDate: this.parseExcelDate(row.openDate),
      closeDate: this.parseExcelDate(row.closeDate),

      // Status
      storeStatus: this.normalizeStoreStatus(row.storeStatus || 'active'),

      notes: row.notes || null,
    };
  }

  /**
   * Validate IP address format
   */
  private isValidIp(ip: string): boolean {
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipRegex.test(ip)) return false;

    const parts = ip.split('.');
    return parts.every((part) => {
      const num = parseInt(part, 10);
      return num >= 0 && num <= 255;
    });
  }

  // ==========================================
  // Preview Import (Store Import with Preview + Update)
  // ==========================================

  /**
   * Preview import - analyze file and show what will be created/updated
   * Uses Store Code as the unique identifier
   */
  async previewStoreImport(file: Express.Multer.File): Promise<{
    newItems: Array<{
      row: number;
      storeCode: string;
      name: string;
      company: string;
      province?: string;
    }>;
    updateItems: Array<{
      row: number;
      storeCode: string;
      storeName: string;
      storeId: number;
      currentData: Record<string, any>;
      newData: Record<string, any>;
      changes: Array<{ field: string; oldValue: any; newValue: any }>;
    }>;
    unchangedItems: Array<{
      row: number;
      storeCode: string;
      name: string;
    }>;
    errors: Array<{ row: number; error: string }>;
  }> {
    // 1. Parse Excel file
    const rows = await this.excelService.parseExcelFile(file);

    const newItems: Array<{
      row: number;
      storeCode: string;
      name: string;
      company: string;
      province?: string;
    }> = [];

    const updateItems: Array<{
      row: number;
      storeCode: string;
      storeName: string;
      storeId: number;
      currentData: Record<string, any>;
      newData: Record<string, any>;
      changes: Array<{ field: string; oldValue: any; newValue: any }>;
    }> = [];

    const unchangedItems: Array<{
      row: number;
      storeCode: string;
      name: string;
    }> = [];

    const errors: Array<{ row: number; error: string }> = [];

    // Fields to compare for changes (exclude system fields)
    const fieldsToCompare = [
      { excelKey: 'name', dbKey: 'name', label: 'ชื่อสาขา' },
      { excelKey: 'company', dbKey: 'company', label: 'บริษัท' },
      { excelKey: 'storeType', dbKey: 'storeType', label: 'ประเภท' },
      { excelKey: 'address', dbKey: 'address', label: 'ที่อยู่' },
      { excelKey: 'province', dbKey: 'province', label: 'จังหวัด' },
      { excelKey: 'slaRegion', dbKey: 'slaRegion', label: 'SLA Region' },
      { excelKey: 'postalCode', dbKey: 'postalCode', label: 'รหัสไปรษณีย์' },
      { excelKey: 'area', dbKey: 'area', label: 'พื้นที่' },
      { excelKey: 'serviceCenter', dbKey: 'serviceCenter', label: 'Service Center' },
      { excelKey: 'phone', dbKey: 'phone', label: 'โทรศัพท์' },
      { excelKey: 'email', dbKey: 'email', label: 'อีเมล' },
      { excelKey: 'googleMapLink', dbKey: 'googleMapLink', label: 'Google Map' },
      { excelKey: 'circuitId', dbKey: 'circuitId', label: 'Circuit ID' },
      { excelKey: 'routerIp', dbKey: 'routerIp', label: 'Router IP' },
      { excelKey: 'switchIp', dbKey: 'switchIp', label: 'Switch IP' },
      { excelKey: 'accessPointIp', dbKey: 'accessPointIp', label: 'Access Point IP' },
      { excelKey: 'pcServerIp', dbKey: 'pcServerIp', label: 'PC Server IP' },
      { excelKey: 'pcPrinterIp', dbKey: 'pcPrinterIp', label: 'PC Printer IP' },
      { excelKey: 'pmcComputerIp', dbKey: 'pmcComputerIp', label: 'PMC Computer IP' },
      { excelKey: 'sbsComputerIp', dbKey: 'sbsComputerIp', label: 'SBS Computer IP' },
      { excelKey: 'vatComputerIp', dbKey: 'vatComputerIp', label: 'VAT Computer IP' },
      { excelKey: 'posIp', dbKey: 'posIp', label: 'POS IP' },
      { excelKey: 'edcIp', dbKey: 'edcIp', label: 'EDC IP' },
      { excelKey: 'scoIp', dbKey: 'scoIp', label: 'SCO IP' },
      { excelKey: 'peopleCounterIp', dbKey: 'peopleCounterIp', label: 'People Counter IP' },
      { excelKey: 'digitalTvIp', dbKey: 'digitalTvIp', label: 'Digital TV IP' },
      { excelKey: 'timeAttendanceIp', dbKey: 'timeAttendanceIp', label: 'Time Attendance IP' },
      { excelKey: 'cctvIp', dbKey: 'cctvIp', label: 'CCTV IP' },
      { excelKey: 'storeStatus', dbKey: 'storeStatus', label: 'สถานะ' },
      { excelKey: 'notes', dbKey: 'notes', label: 'หมายเหตุ' },
    ];

    // 2. Process each row
    for (const row of rows) {
      // Validate required fields
      if (!row.code || !row.name || !row.company) {
        errors.push({
          row: row.rowNumber,
          error: 'ข้อมูลไม่ครบ: รหัสสาขา, ชื่อสาขา หรือบริษัท',
        });
        continue;
      }

      try {
        // Check if store exists by Store Code
        const existingStore = await this.prisma.store.findFirst({
          where: { storeCode: row.code },
        });

        if (!existingStore) {
          // New store
          newItems.push({
            row: row.rowNumber,
            storeCode: row.code,
            name: row.name,
            company: row.company,
            province: row.province,
          });
        } else {
          // Existing store - compare for changes
          const newData = this.mapRowToStoreData(row);
          const changes: Array<{ field: string; oldValue: any; newValue: any }> = [];

          for (const field of fieldsToCompare) {
            const oldVal = existingStore[field.dbKey] ?? '';
            const newVal = newData[field.dbKey] ?? '';

            // Normalize values for comparison
            const normalizedOldVal = String(oldVal || '').trim();
            const normalizedNewVal = String(newVal || '').trim();

            if (normalizedOldVal !== normalizedNewVal) {
              changes.push({
                field: field.label,
                oldValue: normalizedOldVal || '(ว่าง)',
                newValue: normalizedNewVal || '(ว่าง)',
              });
            }
          }

          if (changes.length > 0) {
            updateItems.push({
              row: row.rowNumber,
              storeCode: row.code,
              storeName: existingStore.name,
              storeId: existingStore.id,
              currentData: existingStore,
              newData,
              changes,
            });
          } else {
            unchangedItems.push({
              row: row.rowNumber,
              storeCode: row.code,
              name: row.name,
            });
          }
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ';
        errors.push({
          row: row.rowNumber,
          error: errorMessage,
        });
      }
    }

    return {
      newItems,
      updateItems,
      unchangedItems,
      errors,
    };
  }

  /**
   * Import stores with update support
   * Mode: 'create_only' = only create new stores
   *       'update_or_create' = update existing and create new
   */
  async importWithUpdate(
    file: Express.Multer.File,
    mode: 'create_only' | 'update_or_create' = 'create_only',
  ): Promise<{
    created: number;
    updated: number;
    skipped: number;
    failed: number;
    errors: Array<{ row: number; code?: string; error: string }>;
  }> {
    // 1. Parse Excel file
    const rows = await this.excelService.parseExcelFile(file);

    let created = 0;
    let updated = 0;
    let skipped = 0;
    let failed = 0;
    const errors: Array<{ row: number; code?: string; error: string }> = [];

    // 2. Process each row
    for (const row of rows) {
      // Validate required fields
      if (!row.code || !row.name || !row.company) {
        errors.push({
          row: row.rowNumber,
          code: row.code,
          error: 'ข้อมูลไม่ครบ: รหัสสาขา, ชื่อสาขา หรือบริษัท',
        });
        failed++;
        continue;
      }

      try {
        // Check if store exists by Store Code
        const existingStore = await this.prisma.store.findFirst({
          where: { storeCode: row.code },
        });

        const storeData = this.mapRowToStoreData(row);

        if (!existingStore) {
          // Create new store
          await this.prisma.store.create({ data: storeData });
          created++;
        } else if (mode === 'update_or_create') {
          // Update existing store
          await this.prisma.store.update({
            where: { id: existingStore.id },
            data: storeData,
          });
          updated++;
        } else {
          // Skip existing store in create_only mode
          skipped++;
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ';
        errors.push({
          row: row.rowNumber,
          code: row.code,
          error: this.translateErrorMessage(errorMessage),
        });
        failed++;
      }
    }

    return {
      created,
      updated,
      skipped,
      failed,
      errors,
    };
  }

  // ==========================================
  // Export to Excel
  // ==========================================

  /**
   * Export stores to Excel
   */
  async exportToExcel(filters: ExportStoresDto): Promise<Buffer> {
    // Build where clause
    const where: any = {};

    if (filters.status) {
      where.storeStatus = filters.status;
    }

    if (filters.province) {
      where.province = filters.province;
    }

    if (filters.company) {
      where.company = filters.company;
    }

    if (filters.storeType) {
      where.storeType = filters.storeType;
    }

    // Fetch stores
    const stores = await this.prisma.store.findMany({
      where,
      orderBy: {
        storeCode: 'asc',
      },
    });

    // Generate Excel file
    return this.excelService.generateExcel(stores);
  }
}
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EquipmentStatus, EquipmentLogAction } from '@prisma/client';

export interface DashboardStats {
  total: number;
  active: number;
  maintenance: number;
  retired: number;
  warrantyExpiringSoon: number;
  warrantyExpired: number;
  topCategories: Array<{ category: string; count: number }>;
  topBrands: Array<{ brand: string; count: number }>;
  recentActivity: any[];
}

@Injectable()
export class EquipmentTrackingService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get warranty alerts (expired or expiring soon)
   */
  async getWarrantyAlerts() {
    const now = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(now.getDate() + 30);

    // Get expired warranties
    const expired = await this.prisma.equipment.findMany({
      where: {
        warrantyExpiry: { lt: now },
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
      orderBy: { warrantyExpiry: 'desc' },
    });

    // Get expiring soon warranties
    const expiringSoon = await this.prisma.equipment.findMany({
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
      orderBy: { warrantyExpiry: 'asc' },
    });

    return {
      expired: expired.map((eq) => ({
        ...eq,
        daysExpired: Math.abs(
          Math.ceil((eq.warrantyExpiry!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
        ),
      })),
      expiringSoon: expiringSoon.map((eq) => ({
        ...eq,
        daysUntilExpiry: Math.ceil(
          (eq.warrantyExpiry!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
        ),
      })),
      summary: {
        expiredCount: expired.length,
        expiringSoonCount: expiringSoon.length,
        totalAlerts: expired.length + expiringSoon.length,
      },
    };
  }

  /**
   * Schedule maintenance for equipment
   */
  async scheduleMaintenance(
    equipmentId: number,
    scheduledDate: Date,
    type: string,
    description: string,
    notes: string | undefined,
    userId: number,
  ) {
    // Check if equipment exists
    const equipment = await this.prisma.equipment.findUnique({
      where: { id: equipmentId },
    });

    if (!equipment) {
      throw new NotFoundException(`Equipment with ID ${equipmentId} not found`);
    }

    // Update equipment status and create log
    const result = await this.prisma.$transaction(async (tx) => {
      // Update equipment status to MAINTENANCE
      const updated = await tx.equipment.update({
        where: { id: equipmentId },
        data: { status: EquipmentStatus.MAINTENANCE },
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
          equipmentId,
          action: EquipmentLogAction.MAINTENANCE_SCHEDULED,
          description: `${type} maintenance scheduled for ${scheduledDate.toISOString().split('T')[0]}: ${description}`,
          changedBy: userId,
          oldValue: JSON.stringify({ status: equipment.status }),
          newValue: JSON.stringify({
            status: EquipmentStatus.MAINTENANCE,
            scheduledDate: scheduledDate.toISOString(),
            type,
            description,
            notes,
          }),
        },
      });

      return updated;
    });

    return result;
  }

  /**
   * Complete maintenance
   */
  async completeMaintenance(
    equipmentId: number,
    completionNotes: string,
    completedDate: Date,
    userId: number,
  ) {
    // Check if equipment exists
    const equipment = await this.prisma.equipment.findUnique({
      where: { id: equipmentId },
    });

    if (!equipment) {
      throw new NotFoundException(`Equipment with ID ${equipmentId} not found`);
    }

    // Update equipment status and create log
    const result = await this.prisma.$transaction(async (tx) => {
      // Update equipment status back to ACTIVE
      const updated = await tx.equipment.update({
        where: { id: equipmentId },
        data: { status: EquipmentStatus.ACTIVE },
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
          equipmentId,
          action: EquipmentLogAction.MAINTENANCE_COMPLETED,
          description: `Maintenance completed on ${completedDate.toISOString().split('T')[0]}`,
          changedBy: userId,
          oldValue: JSON.stringify({ status: equipment.status }),
          newValue: JSON.stringify({
            status: EquipmentStatus.ACTIVE,
            completedDate: completedDate.toISOString(),
            notes: completionNotes,
          }),
        },
      });

      return updated;
    });

    return result;
  }

  /**
   * Get equipment requiring maintenance (based on logs and age)
   */
  async getMaintenanceRequired() {
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    // Get equipment in maintenance status
    const inMaintenance = await this.prisma.equipment.findMany({
      where: {
        status: EquipmentStatus.MAINTENANCE,
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
        logs: {
          where: {
            action: EquipmentLogAction.MAINTENANCE_SCHEDULED,
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    // Get equipment that haven't had maintenance in 3 months
    const needsMaintenance = await this.prisma.equipment.findMany({
      where: {
        status: EquipmentStatus.ACTIVE,
        logs: {
          none: {
            action: EquipmentLogAction.MAINTENANCE_COMPLETED,
            createdAt: { gte: threeMonthsAgo },
          },
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
        logs: {
          where: {
            action: EquipmentLogAction.MAINTENANCE_COMPLETED,
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      take: 50, // Limit to 50 results
    });

    return {
      inMaintenance: inMaintenance.map((eq) => ({
        ...eq,
        lastScheduled: eq.logs[0]?.createdAt || null,
      })),
      needsMaintenance: needsMaintenance.map((eq) => ({
        ...eq,
        lastMaintenance: eq.logs[0]?.createdAt || null,
      })),
      summary: {
        inMaintenanceCount: inMaintenance.length,
        needsMaintenanceCount: needsMaintenance.length,
      },
    };
  }

  /**
   * Get equipment dashboard statistics
   */
  async getDashboardStats(): Promise<DashboardStats> {
    const now = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(now.getDate() + 30);

    // Total counts by status
    const statusCounts = await this.prisma.equipment.groupBy({
      by: ['status'],
      _count: true,
    });

    const total = statusCounts.reduce((sum, item) => sum + item._count, 0);
    const active = statusCounts.find((s) => s.status === EquipmentStatus.ACTIVE)?._count || 0;
    const maintenance = statusCounts.find((s) => s.status === EquipmentStatus.MAINTENANCE)?._count || 0;
    const retired = statusCounts.find((s) => s.status === EquipmentStatus.RETIRED)?._count || 0;

    // Warranty counts
    const warrantyExpiringSoon = await this.prisma.equipment.count({
      where: {
        warrantyExpiry: { gte: now, lte: thirtyDaysFromNow },
        status: { in: [EquipmentStatus.ACTIVE, EquipmentStatus.MAINTENANCE] },
      },
    });

    const warrantyExpired = await this.prisma.equipment.count({
      where: {
        warrantyExpiry: { lt: now },
        status: { in: [EquipmentStatus.ACTIVE, EquipmentStatus.MAINTENANCE] },
      },
    });

    // Top categories
    const categoryGroups = await this.prisma.equipment.groupBy({
      by: ['category'],
      _count: true,
      where: {
        status: { not: EquipmentStatus.RETIRED },
      },
      orderBy: {
        _count: {
          category: 'desc',
        },
      },
      take: 5,
    });

    const topCategories = categoryGroups.map((g) => ({
      category: g.category,
      count: g._count,
    }));

    // Top brands
    const brandGroups = await this.prisma.equipment.groupBy({
      by: ['brand'],
      _count: true,
      where: {
        status: { not: EquipmentStatus.RETIRED },
        brand: { not: null },
      },
      orderBy: {
        _count: {
          brand: 'desc',
        },
      },
      take: 5,
    });

    const topBrands = brandGroups.map((g) => ({
      brand: g.brand || 'Unknown',
      count: g._count,
    }));

    // Recent activity (last 10 logs)
    const recentActivity = await this.prisma.equipmentLog.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        equipment: {
          select: {
            id: true,
            serialNumber: true,
            name: true,
          },
        },
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return {
      total,
      active,
      maintenance,
      retired,
      warrantyExpiringSoon,
      warrantyExpired,
      topCategories,
      topBrands,
      recentActivity,
    };
  }

  /**
   * Get equipment health report
   */
  async getHealthReport() {
    const now = new Date();

    // Critical issues (expired warranty + active status)
    const critical = await this.prisma.equipment.count({
      where: {
        warrantyExpiry: { lt: now },
        status: EquipmentStatus.ACTIVE,
      },
    });

    // Warning issues (expiring soon)
    const warning = await this.prisma.equipment.count({
      where: {
        warrantyExpiry: {
          gte: now,
          lte: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
        },
        status: { in: [EquipmentStatus.ACTIVE, EquipmentStatus.MAINTENANCE] },
      },
    });

    // Maintenance required
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(now.getMonth() - 3);

    const maintenanceRequired = await this.prisma.equipment.count({
      where: {
        status: EquipmentStatus.ACTIVE,
        logs: {
          none: {
            action: EquipmentLogAction.MAINTENANCE_COMPLETED,
            createdAt: { gte: threeMonthsAgo },
          },
        },
      },
    });

    const total = await this.prisma.equipment.count({
      where: {
        status: { not: EquipmentStatus.RETIRED },
      },
    });

    const healthy = total - critical - warning - maintenanceRequired;
    const healthScore = total > 0 ? Math.round((healthy / total) * 100) : 100;

    return {
      total,
      healthy,
      critical,
      warning,
      maintenanceRequired,
      healthScore,
      recommendation:
        healthScore >= 90
          ? 'Excellent'
          : healthScore >= 70
          ? 'Good'
          : healthScore >= 50
          ? 'Fair'
          : 'Needs Attention',
    };
  }
}

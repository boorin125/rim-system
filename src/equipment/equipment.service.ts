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
import { EquipmentStatus, EquipmentLogAction } from '@prisma/client';

@Injectable()
export class EquipmentService {
  constructor(private prisma: PrismaService) {}

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

    // Create equipment and log in transaction
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

      // Create log entry
      await tx.equipmentLog.create({
        data: {
          equipmentId: newEquipment.id,
          action: EquipmentLogAction.CREATED,
          description: `Equipment "${newEquipment.name}" (SN: ${newEquipment.serialNumber}) created`,
          changedBy: userId,
          newValue: JSON.stringify({
            name: newEquipment.name,
            category: newEquipment.category,
            status: newEquipment.status,
            storeId: newEquipment.storeId,
          }),
        },
      });

      return newEquipment;
    });

    return equipment;
  }

  /**
   * Find all equipment with filters and pagination
   */
  async findAll(filterDto: FilterEquipmentDto) {
    const { page = 1, limit = 10, search, warrantyExpired, ...filters } = filterDto;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};

    // Apply filters
    if (filters.status) {
      where.status = filters.status;
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
      orderBy: { createdAt: 'desc' },
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
            incidentCode: true,
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

      // Create log entry
      await tx.equipmentLog.create({
        data: {
          equipmentId: id,
          action: logAction,
          description: logDescription,
          changedBy: userId,
          oldValue: JSON.stringify(equipment),
          newValue: JSON.stringify(updateData),
        },
      });

      return updated;
    });

    return updatedEquipment;
  }

  /**
   * Delete equipment (soft delete by setting status to RETIRED)
   */
  async remove(id: number, userId: number) {
    const equipment = await this.prisma.equipment.findUnique({
      where: { id },
    });

    if (!equipment) {
      throw new NotFoundException(`Equipment with ID ${id} not found`);
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
          description: `Equipment retired`,
          changedBy: userId,
          oldValue: JSON.stringify({ status: equipment.status }),
          newValue: JSON.stringify({ status: EquipmentStatus.RETIRED }),
        },
      });

      return updated;
    });

    return retired;
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
            role: true,
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
}

// src/incidents/incidents.service.ts
import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateIncidentDto, UpdateIncidentDto, QueryIncidentDto } from './dto';
import { IncidentStatus, Priority } from '@prisma/client';

@Injectable()
export class IncidentsService {
  constructor(private prisma: PrismaService) {}

  // Create new incident
  async create(createIncidentDto: CreateIncidentDto, userId: number) {
    // Verify store exists
    const store = await this.prisma.store.findUnique({
      where: { id: createIncidentDto.storeId },
    });

    if (!store) {
      throw new NotFoundException('Store not found');
    }

    // Verify equipment exists if provided
    if (createIncidentDto.equipmentId) {
      const equipment = await this.prisma.equipment.findUnique({
        where: { id: createIncidentDto.equipmentId },
      });

      if (!equipment) {
        throw new NotFoundException('Equipment not found');
      }

      // Verify equipment belongs to the store
      if (equipment.storeId !== createIncidentDto.storeId) {
        throw new BadRequestException('Equipment does not belong to this store');
      }
    }

    // Calculate SLA deadline based on priority
    const slaDeadline = this.calculateSLADeadline(createIncidentDto.priority);

    // Create incident
    const incident = await this.prisma.incident.create({
      data: {
        title: createIncidentDto.title,
        description: createIncidentDto.description,
        priority: createIncidentDto.priority,
        storeId: createIncidentDto.storeId,
        equipmentId: createIncidentDto.equipmentId,
        createdById: userId,
        slaDeadline,
        status: IncidentStatus.OPEN,
      },
      include: {
        store: true,
        equipment: true,
        createdBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
    });

    return incident;
  }

  // Get all incidents with filters and pagination
  async findAll(query: QueryIncidentDto) {
    const { page = 1, limit = 10, priority, status, storeId, assigneeId, createdById } = query;

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};

    if (priority) where.priority = priority;
    if (status) where.status = status;
    if (storeId) where.storeId = storeId;
    if (assigneeId) where.assigneeId = assigneeId;
    if (createdById) where.createdById = createdById;

    // Get total count for pagination
    const total = await this.prisma.incident.count({ where });

    // Get incidents
    const incidents = await this.prisma.incident.findMany({
      where,
      skip,
      take: limit,
      orderBy: {
        createdAt: 'desc',
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
        equipment: {
          select: {
            id: true,
            serialNumber: true,
            name: true,
            category: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
        assignee: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
    });

    return {
      data: incidents,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // Get single incident by ID
  async findOne(id: string) {
    const incident = await this.prisma.incident.findUnique({
      where: { id },
      include: {
        store: true,
        equipment: true,
        createdBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            role: true,
          },
        },
        assignee: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            role: true,
          },
        },
      },
    });

    if (!incident) {
      throw new NotFoundException('Incident not found');
    }

    return incident;
  }

  // Update incident
  async update(id: string, updateIncidentDto: UpdateIncidentDto, userId: number) {
    const incident = await this.findOne(id);

    // If updating store, verify it exists
    if (updateIncidentDto.storeId && updateIncidentDto.storeId !== incident.storeId) {
      const store = await this.prisma.store.findUnique({
        where: { id: updateIncidentDto.storeId },
      });

      if (!store) {
        throw new NotFoundException('Store not found');
      }
    }

    // If updating equipment, verify it exists and belongs to store
    if (updateIncidentDto.equipmentId) {
      const equipment = await this.prisma.equipment.findUnique({
        where: { id: updateIncidentDto.equipmentId },
      });

      if (!equipment) {
        throw new NotFoundException('Equipment not found');
      }

      const targetStoreId = updateIncidentDto.storeId || incident.storeId;
      if (equipment.storeId !== targetStoreId) {
        throw new BadRequestException('Equipment does not belong to the selected store');
      }
    }

    // If updating assignee, verify user exists and is a technician
    if (updateIncidentDto.assigneeId) {
      const assignee = await this.prisma.user.findUnique({
        where: { id: updateIncidentDto.assigneeId },
      });

      if (!assignee) {
        throw new NotFoundException('Assignee not found');
      }

      if (assignee.role !== 'TECHNICIAN') {
        throw new BadRequestException('Assignee must be a technician');
      }
    }

    // If marking as resolved, set resolvedAt
    const updateData: any = { ...updateIncidentDto };

    if (updateIncidentDto.status === IncidentStatus.RESOLVED && incident.status !== IncidentStatus.RESOLVED) {
      updateData.resolvedAt = new Date();
    }

    // Update incident
    const updated = await this.prisma.incident.update({
      where: { id },
      data: updateData,
      include: {
        store: true,
        equipment: true,
        createdBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
        assignee: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
    });

    return updated;
  }

  // Assign technician to incident
  async assign(id: string, technicianId: number) {
    const incident = await this.findOne(id);

    // Verify technician exists
    const technician = await this.prisma.user.findUnique({
      where: { id: technicianId },
    });

    if (!technician) {
      throw new NotFoundException('Technician not found');
    }

    if (technician.role !== 'TECHNICIAN') {
      throw new BadRequestException('User is not a technician');
    }

    if (technician.status !== 'ACTIVE') {
      throw new BadRequestException('Technician is not active');
    }

    // Update incident status to IN_PROGRESS if currently OPEN
    const updateData: any = {
      assigneeId: technicianId,
    };

    if (incident.status === IncidentStatus.OPEN) {
      updateData.status = IncidentStatus.IN_PROGRESS;
    }

    const updated = await this.prisma.incident.update({
      where: { id },
      data: updateData,
      include: {
        assignee: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            role: true,
          },
        },
      },
    });

    return updated;
  }

  // Cancel/Delete incident
  async remove(id: string, userId: number) {
    const incident = await this.findOne(id);

    // Only allow creator to cancel incident
    if (incident.createdById !== userId) {
      throw new ForbiddenException('You can only cancel your own incidents');
    }

    // Can't cancel resolved or closed incidents
    if (incident.status === IncidentStatus.RESOLVED || incident.status === IncidentStatus.CLOSED) {
      throw new BadRequestException('Cannot cancel resolved or closed incidents');
    }

    // Update status to CANCELLED instead of deleting
    const cancelled = await this.prisma.incident.update({
      where: { id },
      data: {
        status: IncidentStatus.CANCELLED,
      },
    });

    return cancelled;
  }

  // Helper: Calculate SLA deadline based on priority
  private calculateSLADeadline(priority: Priority): Date {
    const now = new Date();
    const deadline = new Date(now);

    switch (priority) {
      case Priority.CRITICAL:
        deadline.setHours(deadline.getHours() + 2); // 2 hours
        break;
      case Priority.HIGH:
        deadline.setHours(deadline.getHours() + 4); // 4 hours
        break;
      case Priority.MEDIUM:
        deadline.setHours(deadline.getHours() + 8); // 8 hours
        break;
      case Priority.LOW:
        deadline.setHours(deadline.getHours() + 24); // 24 hours
        break;
    }

    return deadline;
  }
}
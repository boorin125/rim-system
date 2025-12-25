// src/incidents/incidents.service.ts
// CRITICAL FIX: TECHNICIAN can only see their own assigned incidents

import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { UpdateIncidentDto } from './dto/update-incident.dto';
import { IncidentStatus, UserRole } from '@prisma/client';

@Injectable()
export class IncidentsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Find all incidents with filtering
   * 
   * ⚠️ CRITICAL: TECHNICIAN can ONLY see their assigned incidents
   * Other roles can see all incidents
   */
  async findAll(filterDto: any, user: any) {
    const { status, priority, storeId, assigneeId, page = 1, limit = 10 } = filterDto;
    
    const where: any = {};

    // ⚠️ CRITICAL: TECHNICIAN can only see incidents assigned to them
    if (user.role === UserRole.TECHNICIAN) {
      where.assigneeId = user.id;  // ← Force filter by assigneeId
    } else {
      // Other roles can filter by assigneeId if provided
      if (assigneeId) {
        where.assigneeId = parseInt(assigneeId);
      }
    }

    // Additional filters
    if (status) {
      where.status = status;
    }

    if (priority) {
      where.priority = priority;
    }

    if (storeId) {
      where.storeId = parseInt(storeId);
    }

    const skip = (page - 1) * limit;
    const take = parseInt(limit);

    const [incidents, total] = await Promise.all([
      this.prisma.incident.findMany({
        where,
        skip,
        take,
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
          equipment: {
            select: {
              id: true,
              serialNumber: true,
              name: true,
              category: true,
              status: true,
            },
          },
          assignee: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              email: true,
              role: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              role: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.incident.count({ where }),
    ]);

    return {
      data: incidents,
      meta: {
        total,
        page: parseInt(page),
        limit: take,
        totalPages: Math.ceil(total / take),
      },
    };
  }

  /**
   * Find one incident
   * 
   * ⚠️ CRITICAL: TECHNICIAN can only view their assigned incidents
   */
  async findOne(id: string, user: any) {
    const incident = await this.prisma.incident.findFirst({
      where: {
        id,
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
            phone: true,
            role: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
    });

    if (!incident) {
      throw new NotFoundException(`Incident with ID ${id} not found`);
    }

    // ⚠️ CRITICAL: TECHNICIAN can only view their own incidents
    if (user.role === UserRole.TECHNICIAN && incident.assigneeId !== user.id) {
      throw new ForbiddenException('You can only view incidents assigned to you');
    }

    return incident;
  }

  /**
   * Get incident statistics
   * 
   * ⚠️ CRITICAL: TECHNICIAN sees only their own stats
   */
  async getStatistics(user: any) {
    const where: any = {};

    // ⚠️ TECHNICIAN sees only their incidents
    if (user.role === UserRole.TECHNICIAN) {
      where.assigneeId = user.id;
    }

    const [
      total,
      byStatus,
      byPriority,
    ] = await Promise.all([
      this.prisma.incident.count({ where }),
      this.prisma.incident.groupBy({
        by: ['status'],
        where,
        _count: true,
      }),
      this.prisma.incident.groupBy({
        by: ['priority'],
        where,
        _count: true,
      }),
    ]);

    return {
      total,
      byStatus: byStatus.reduce((acc, item) => {
        acc[item.status] = item._count;
        return acc;
      }, {}),
      byPriority: byPriority.reduce((acc, item) => {
        acc[item.priority] = item._count;
        return acc;
      }, {}),
    };
  }

  /**
   * Create incident
   * Access: HELP_DESK, END_USER
   */
  async create(dto: CreateIncidentDto, userId: number) {
    // Generate incident code
    const count = await this.prisma.incident.count();
    const incidentCode = `INC-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

    return this.prisma.incident.create({
      data: {
        id: incidentCode,
        incidentCode,
        title: dto.title,
        description: dto.description,
        category: dto.category,
        priority: dto.priority,
        status: IncidentStatus.OPEN,
        storeId: dto.storeId,
        equipmentId: dto.equipmentId,
        reportedBy: userId,
        createdById: userId,
        slaDeadline: this.calculateSLA(dto.priority),
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
            role: true,
          },
        },
      },
    });
  }

  /**
   * Update incident
   * Access: HELP_DESK only
   */
  async update(id: string, dto: UpdateIncidentDto, userId: number) {
    const incident = await this.findOne(id, { role: UserRole.HELP_DESK, id: userId });

    return this.prisma.incident.update({
      where: { id },
      data: {
        ...dto,
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
            role: true,
          },
        },
      },
    });
  }

  /**
   * Assign incident to technician
   * Access: SUPERVISOR, IT_MANAGER, HELP_DESK
   */
  async assign(id: string, technicianId: number, userId: number) {
    const incident = await this.prisma.incident.findFirst({
      where: { id },
    });

    if (!incident) {
      throw new NotFoundException(`Incident ${id} not found`);
    }

    if (incident.status !== IncidentStatus.OPEN) {
      throw new BadRequestException(`Incident must be OPEN to assign. Current status: ${incident.status}`);
    }

    // Verify technician exists and has TECHNICIAN role
    const technician = await this.prisma.user.findFirst({
      where: {
        id: technicianId,
        role: UserRole.TECHNICIAN,
      },
    });

    if (!technician) {
      throw new NotFoundException(`Technician with ID ${technicianId} not found`);
    }

    return this.prisma.incident.update({
      where: { id },
      data: {
        status: IncidentStatus.ASSIGNED,
        assigneeId: technicianId,
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
            role: true,
          },
        },
      },
    });
  }

  /**
   * Reassign incident to another technician
   * Access: SUPERVISOR, IT_MANAGER, HELP_DESK
   */
  async reassign(id: string, technicianId: number, userId: number) {
    const incident = await this.prisma.incident.findFirst({
      where: { id },
    });

    if (!incident) {
      throw new NotFoundException(`Incident ${id} not found`);
    }

    const validStatuses = [IncidentStatus.ASSIGNED, IncidentStatus.IN_PROGRESS];
    if (!validStatuses.includes(incident.status as any)) {
      throw new BadRequestException(
        `Incident must be ASSIGNED or IN_PROGRESS to reassign. Current status: ${incident.status}`
      );
    }

    // Verify technician exists
    const technician = await this.prisma.user.findFirst({
      where: {
        id: technicianId,
        role: UserRole.TECHNICIAN,
      },
    });

    if (!technician) {
      throw new NotFoundException(`Technician with ID ${technicianId} not found`);
    }

    return this.prisma.incident.update({
      where: { id },
      data: {
        status: IncidentStatus.ASSIGNED,
        assigneeId: technicianId,
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
            role: true,
          },
        },
      },
    });
  }

  /**
   * Accept incident
   * Access: TECHNICIAN only
   */
  async accept(id: string, userId: number) {
    const incident = await this.prisma.incident.findFirst({
      where: { id },
    });

    if (!incident) {
      throw new NotFoundException(`Incident ${id} not found`);
    }

    // ⚠️ TECHNICIAN can only accept their own assignments
    if (incident.assigneeId !== userId) {
      throw new ForbiddenException('You can only accept incidents assigned to you');
    }

    if (incident.status !== IncidentStatus.ASSIGNED) {
      throw new BadRequestException(
        `Incident must be ASSIGNED to accept. Current status: ${incident.status}`
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
        equipment: true,
        assignee: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
    });
  }

  /**
   * Resolve incident
   * Access: TECHNICIAN only
   */
  async resolve(id: string, resolutionNote: string, userId: number) {
    const incident = await this.prisma.incident.findFirst({
      where: { id },
    });

    if (!incident) {
      throw new NotFoundException(`Incident ${id} not found`);
    }

    // ⚠️ TECHNICIAN can only resolve their own incidents
    if (incident.assigneeId !== userId) {
      throw new ForbiddenException('You can only resolve incidents assigned to you');
    }

    if (incident.status !== IncidentStatus.IN_PROGRESS) {
      throw new BadRequestException(
        `Incident must be IN_PROGRESS to resolve. Current status: ${incident.status}`
      );
    }

    if (!resolutionNote || resolutionNote.trim().length === 0) {
      throw new BadRequestException('Resolution note is required');
    }

    return this.prisma.incident.update({
      where: { id },
      data: {
        status: IncidentStatus.RESOLVED,
        resolvedAt: new Date(),
        resolutionNote,
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
            role: true,
          },
        },
      },
    });
  }

  /**
   * Close incident
   * Access: HELP_DESK only
   */
  async close(id: string, resolutionNote: string, photoEvidence: string, userId: number) {
    const incident = await this.prisma.incident.findFirst({
      where: { id },
    });

    if (!incident) {
      throw new NotFoundException(`Incident ${id} not found`);
    }

    if (incident.status !== IncidentStatus.RESOLVED) {
      throw new BadRequestException(
        `Incident must be RESOLVED to close. Current status: ${incident.status}`
      );
    }

    if (!photoEvidence || photoEvidence.trim().length === 0) {
      throw new BadRequestException('Photo evidence is required to close incident');
    }

    return this.prisma.incident.update({
      where: { id },
      data: {
        status: IncidentStatus.CLOSED,
        resolutionNote: resolutionNote || incident.resolutionNote,
        notes: `Photo: ${photoEvidence}`, // Store photo reference in notes
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
            role: true,
          },
        },
      },
    });
  }

  /**
   * Cancel incident
   * Access: HELP_DESK only
   */
  async cancel(id: string, cancellationReason: string, userId: number) {
    const incident = await this.prisma.incident.findFirst({
      where: { id },
    });

    if (!incident) {
      throw new NotFoundException(`Incident ${id} not found`);
    }

    if (incident.status === IncidentStatus.CLOSED) {
      throw new BadRequestException('Cannot cancel a closed incident');
    }

    if (!cancellationReason || cancellationReason.trim().length === 0) {
      throw new BadRequestException('Cancellation reason is required');
    }

    return this.prisma.incident.update({
      where: { id },
      data: {
        status: IncidentStatus.CANCELLED,
        notes: `Cancelled: ${cancellationReason}`, // Store reason in notes
        updatedAt: new Date(),
      },
      include: {
        store: true,
        equipment: true,
      },
    });
  }

  /**
   * Reopen incident
   * Access: HELP_DESK only
   * 
   * Use cases:
   * - Issue recurs after closing (within warranty)
   * - Incomplete repair discovered
   * - Same problem reported again
   */
  async reopen(id: string, reopenReason: string, userId: number) {
    const incident = await this.prisma.incident.findFirst({
      where: { id },
    });

    if (!incident) {
      throw new NotFoundException(`Incident ${id} not found`);
    }

    if (incident.status !== IncidentStatus.CLOSED) {
      throw new BadRequestException(
        `Incident must be CLOSED to reopen. Current status: ${incident.status}`
      );
    }

    if (!reopenReason || reopenReason.trim().length === 0) {
      throw new BadRequestException('Reopen reason is required');
    }

    return this.prisma.incident.update({
      where: { id },
      data: {
        status: IncidentStatus.OPEN,
        assigneeId: null, // Clear assignment
        resolvedAt: null, // Clear resolution
        notes: `Reopened: ${reopenReason}`, // Store reopen reason
        updatedAt: new Date(),
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
            role: true,
          },
        },
      },
    });
  }

  /**
   * Delete incident (hard delete)
   * Access: HELP_DESK only
   */
  async remove(id: string, userId: number) {
    const incident = await this.findOne(id, { role: UserRole.HELP_DESK, id: userId });

    return this.prisma.incident.delete({
      where: { id },
    });
  }

  /**
   * Calculate SLA deadline based on priority
   */
  private calculateSLA(priority: string): Date {
    const now = new Date();
    const hours = {
      CRITICAL: 2,
      HIGH: 4,
      MEDIUM: 8,
      LOW: 24,
    };

    return new Date(now.getTime() + (hours[priority] || 24) * 60 * 60 * 1000);
  }
}
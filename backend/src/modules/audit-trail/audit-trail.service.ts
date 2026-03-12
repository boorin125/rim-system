import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditModule, AuditAction, Prisma } from '@prisma/client';

export interface AuditLogData {
  module: AuditModule;
  action: AuditAction;
  entityType: string;
  entityId: string | number;
  userId: number;
  description: string;
  oldValue?: any;
  newValue?: any;
  ipAddress?: string;
}

@Injectable()
export class AuditTrailService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Log an audit entry.
   * Can accept either PrismaService or a transaction client (tx).
   */
  async log(
    txOrPrisma: Prisma.TransactionClient | PrismaService,
    data: AuditLogData,
  ) {
    return (txOrPrisma as any).auditLog.create({
      data: {
        module: data.module,
        action: data.action,
        entityType: data.entityType,
        entityId: String(data.entityId),
        userId: data.userId,
        description: data.description,
        oldValue: data.oldValue ? JSON.stringify(data.oldValue) : null,
        newValue: data.newValue ? JSON.stringify(data.newValue) : null,
        ipAddress: data.ipAddress || null,
      },
    });
  }

  /**
   * Convenience method: log without a transaction (uses PrismaService directly)
   */
  async logDirect(data: AuditLogData) {
    return this.log(this.prisma, data);
  }

  /**
   * Get audit logs with filtering and pagination
   */
  async findAll(filters: {
    module?: string;
    action?: string;
    userId?: number;
    entityType?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }) {
    const where: Prisma.AuditLogWhereInput = {};

    if (filters.module) {
      where.module = filters.module as AuditModule;
    }

    if (filters.action) {
      where.action = filters.action as AuditAction;
    }

    if (filters.userId) {
      where.userId = filters.userId;
    }

    if (filters.entityType) {
      where.entityType = filters.entityType;
    }

    if (filters.search) {
      where.description = { contains: filters.search, mode: 'insensitive' };
    }

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        (where.createdAt as any).gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        (where.createdAt as any).lte = new Date(filters.endDate);
      }
    }

    const page = filters.page || 1;
    const limit = filters.limit || 20;

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get a single audit log entry
   */
  async findOne(id: number) {
    return this.prisma.auditLog.findUnique({
      where: { id },
      include: {
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
  }
}

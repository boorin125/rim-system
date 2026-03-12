// backend/src/incidents/incident-history.service.ts

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IncidentAction, IncidentStatus } from '@prisma/client';

@Injectable()
export class IncidentHistoryService {
  constructor(private prisma: PrismaService) {}

  /**
   * Create a history entry for an incident action
   */
  async createHistory(
    incidentId: string,
    action: IncidentAction,
    userId?: number,
    oldStatus?: IncidentStatus,
    newStatus?: IncidentStatus,
    details?: string,
  ) {
    return this.prisma.incidentHistory.create({
      data: {
        incidentId,
        userId,
        action,
        oldStatus,
        newStatus,
        details,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            roles: { select: { role: true } },
          },
        },
      },
    });
  }

  /**
   * Get all history entries for an incident
   */
  async getHistory(incidentId: string) {
    return this.prisma.incidentHistory.findMany({
      where: { incidentId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            roles: { select: { role: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}

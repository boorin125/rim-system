// backend/src/incidents/incidents-analytics.service.ts

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole, IncidentStatus, SlaDefenseStatus } from '@prisma/client';

@Injectable()
export class IncidentsAnalyticsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Helper to check if user ONLY has a specific role (no other roles)
   */
  private hasOnlyRole(user: any, role: UserRole): boolean {
    if (Array.isArray(user.roles)) {
      return user.roles.length === 1 && user.roles.includes(role);
    }
    return user.role === role;
  }

  /**
   * Build where clause based on user role and date range
   */
  private buildWhereClause(user: any, from?: string, to?: string) {
    const where: any = {};

    // Role-based filtering - only restrict if user ONLY has TECHNICIAN role
    if (this.hasOnlyRole(user, UserRole.TECHNICIAN)) {
      where.assignees = { some: { userId: user.id } };
    }

    // Date range filtering
    if (from || to) {
      where.createdAt = {};
      if (from) {
        where.createdAt.gte = new Date(from);
      }
      if (to) {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        where.createdAt.lte = toDate;
      }
    }

    return where;
  }

  /**
   * Get dashboard statistics
   */
  async getDashboardStats(user: any, from?: string, to?: string) {
    const where = this.buildWhereClause(user, from, to);

    const [
      total,
      open,
      assigned,
      inProgress,
      pending,
      resolved,
      closed,
      cancelled,
      critical,
      high,
      overdueSla,
    ] = await Promise.all([
      this.prisma.incident.count({ where }),
      this.prisma.incident.count({ where: { ...where, status: IncidentStatus.OPEN } }),
      this.prisma.incident.count({ where: { ...where, status: IncidentStatus.ASSIGNED } }),
      this.prisma.incident.count({ where: { ...where, status: IncidentStatus.IN_PROGRESS } }),
      this.prisma.incident.count({ where: { ...where, status: IncidentStatus.PENDING } }),
      this.prisma.incident.count({ where: { ...where, status: IncidentStatus.RESOLVED } }),
      this.prisma.incident.count({ where: { ...where, status: IncidentStatus.CLOSED } }),
      this.prisma.incident.count({ where: { ...where, status: IncidentStatus.CANCELLED } }),
      this.prisma.incident.count({ where: { ...where, priority: 'CRITICAL' } }),
      this.prisma.incident.count({ where: { ...where, priority: 'HIGH' } }),
      this.prisma.incident.count({
        where: {
          ...where,
          slaDeadline: { lt: new Date() },
          status: {
            in: [IncidentStatus.OPEN, IncidentStatus.ASSIGNED, IncidentStatus.IN_PROGRESS, IncidentStatus.PENDING],
          },
        },
      }),
    ]);

    return {
      total,
      byStatus: {
        open,
        assigned,
        inProgress,
        pending,
        resolved,
        closed,
        cancelled,
      },
      byPriority: {
        critical,
        high,
      },
      sla: {
        overdue: overdueSla,
      },
    };
  }

  /**
   * Get incidents grouped by status
   */
  async getIncidentsByStatus(user: any, from?: string, to?: string) {
    const where = this.buildWhereClause(user, from, to);

    const results = await this.prisma.incident.groupBy({
      by: ['status'],
      where,
      _count: true,
    });

    return results.map((result) => ({
      name: result.status,
      value: result._count,
    }));
  }

  /**
   * Get incidents grouped by priority
   */
  async getIncidentsByPriority(user: any, from?: string, to?: string) {
    const where = this.buildWhereClause(user, from, to);

    const results = await this.prisma.incident.groupBy({
      by: ['priority'],
      where,
      _count: true,
    });

    return results.map((result) => ({
      name: result.priority,
      value: result._count,
    }));
  }

  /**
   * Get incidents grouped by category
   */
  async getIncidentsByCategory(user: any, from?: string, to?: string) {
    const where = this.buildWhereClause(user, from, to);

    const results = await this.prisma.incident.groupBy({
      by: ['category'],
      where: {
        ...where,
        category: { not: null },
      },
      _count: true,
    });

    return results.map((result) => ({
      name: result.category || 'Unknown',
      value: result._count,
    }));
  }

  /**
   * Get incidents trend over time
   */
  async getIncidentsTrend(
    user: any,
    from?: string,
    to?: string,
    period: 'day' | 'week' | 'month' = 'day',
  ) {
    const where = this.buildWhereClause(user, from, to);

    // Get all incidents in date range
    const incidents = await this.prisma.incident.findMany({
      where,
      select: {
        createdAt: true,
        status: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Group by period
    const trendData: { [key: string]: { created: number; resolved: number } } = {};

    incidents.forEach((incident) => {
      const date = new Date(incident.createdAt);
      let key: string;

      if (period === 'day') {
        key = date.toISOString().split('T')[0]; // YYYY-MM-DD
      } else if (period === 'week') {
        const weekNum = this.getWeekNumber(date);
        key = `${date.getFullYear()}-W${weekNum}`;
      } else {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`; // YYYY-MM
      }

      if (!trendData[key]) {
        trendData[key] = { created: 0, resolved: 0 };
      }

      trendData[key].created++;

      if (incident.status === IncidentStatus.RESOLVED || incident.status === IncidentStatus.CLOSED) {
        trendData[key].resolved++;
      }
    });

    return Object.entries(trendData)
      .map(([date, data]) => ({
        date,
        created: data.created,
        resolved: data.resolved,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Get SLA performance metrics
   */
  async getSlaPerformance(user: any, from?: string, to?: string) {
    const where = this.buildWhereClause(user, from, to);

    const [total, metSla, breachedSla, averageResolutionTime] = await Promise.all([
      this.prisma.incident.count({ where }),
      this.prisma.incident.count({
        where: {
          ...where,
          resolvedAt: { not: null },
          OR: [
            { slaDeadline: null },
            {
              AND: [
                { slaDeadline: { not: null } },
                { resolvedAt: { lte: this.prisma.incident.fields.slaDeadline } },
              ],
            },
          ],
        },
      }),
      this.prisma.incident.count({
        where: {
          ...where,
          slaDeadline: { not: null },
          resolvedAt: { not: null, gt: this.prisma.incident.fields.slaDeadline },
        },
      }),
      this.calculateAverageResolutionTime(where),
    ]);

    return {
      total,
      metSla,
      breachedSla,
      slaComplianceRate: total > 0 ? ((metSla / total) * 100).toFixed(2) : '0',
      averageResolutionTimeHours: averageResolutionTime,
    };
  }

  /**
   * Get technician performance
   */
  async getTechnicianPerformance(from?: string, to?: string) {
    const where: any = {
      assigneeId: { not: null },
    };

    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        where.createdAt.lte = toDate;
      }
    }

    const incidents = await this.prisma.incident.findMany({
      where,
      select: {
        assigneeId: true,
        assignee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        status: true,
        jobType: true,
        resolvedAt: true,
        createdAt: true,
        slaDeadline: true,
        checkInAt: true,
        slaDefenses: { select: { status: true } },
      },
    });

    // Collect technician IDs for rating lookup
    const techIds = new Set<number>();
    incidents.forEach((i) => { if (i.assigneeId) techIds.add(i.assigneeId); });

    // Fetch average ratings per technician
    const ratingMap: Record<number, number> = {};
    if (techIds.size > 0) {
      const ratings = await this.prisma.incidentRating.groupBy({
        by: ['incidentId'],
        _avg: { rating: true },
      });

      // Map incidentId -> rating, then aggregate per technician
      const incidentRatingMap: Record<string, number> = {};
      ratings.forEach((r) => {
        if (r._avg.rating != null) incidentRatingMap[r.incidentId] = r._avg.rating;
      });

      // Get incident -> assignee mapping
      const ratedIncidents = await this.prisma.incident.findMany({
        where: {
          id: { in: Object.keys(incidentRatingMap) },
          assigneeId: { in: Array.from(techIds) },
        },
        select: { id: true, assigneeId: true },
      });

      const techRatingSums: Record<number, { sum: number; count: number }> = {};
      ratedIncidents.forEach((inc) => {
        if (!inc.assigneeId || !incidentRatingMap[inc.id]) return;
        if (!techRatingSums[inc.assigneeId]) techRatingSums[inc.assigneeId] = { sum: 0, count: 0 };
        techRatingSums[inc.assigneeId].sum += incidentRatingMap[inc.id];
        techRatingSums[inc.assigneeId].count++;
      });

      Object.entries(techRatingSums).forEach(([id, data]) => {
        ratingMap[Number(id)] = data.count > 0 ? data.sum / data.count : 0;
      });
    }

    // Group by technician
    const technicianStats: {
      [key: number]: {
        name: string;
        total: number;
        resolved: number;
        averageResolutionTime: number;
        slaAchieve: number;
        slaTotal: number;
        checkInDays: Set<string>;
      };
    } = {};

    incidents.forEach((incident) => {
      if (!incident.assigneeId || !incident.assignee) return;

      if (!technicianStats[incident.assigneeId]) {
        technicianStats[incident.assigneeId] = {
          name: `${incident.assignee.firstName} ${incident.assignee.lastName}`,
          total: 0,
          resolved: 0,
          averageResolutionTime: 0,
          slaAchieve: 0,
          slaTotal: 0,
          checkInDays: new Set<string>(),
        };
      }

      const stat = technicianStats[incident.assigneeId];
      stat.total++;

      // Check-in days
      if (incident.checkInAt) {
        const dayKey = new Date(incident.checkInAt).toISOString().split('T')[0];
        stat.checkInDays.add(dayKey);
      }

      if (incident.status === IncidentStatus.RESOLVED || incident.status === IncidentStatus.CLOSED) {
        stat.resolved++;

        if (incident.resolvedAt) {
          const resolutionTime =
            (new Date(incident.resolvedAt).getTime() - new Date(incident.createdAt).getTime()) /
            (1000 * 60 * 60); // hours
          stat.averageResolutionTime += resolutionTime;
        }

        // SLA tracking — Project excluded; Adhoc always passes; approved defense counts as passed
        if ((incident as any).jobType !== 'Project' && incident.slaDeadline) {
          stat.slaTotal++;
          const adhocPass = (incident as any).jobType === 'Adhoc';
          const resolvedOnTime = incident.resolvedAt && new Date(incident.resolvedAt) <= new Date(incident.slaDeadline);
          const hasApprovedDefense = (incident as any).slaDefenses?.some((d: any) => d.status === SlaDefenseStatus.APPROVED);
          if (adhocPass || resolvedOnTime || hasApprovedDefense) {
            stat.slaAchieve++;
          }
        }
      }
    });

    // Calculate averages
    return Object.entries(technicianStats).map(([techId, tech]) => {
      const checkInDayCount = tech.checkInDays.size;
      return {
        name: tech.name,
        total: tech.total,
        resolved: tech.resolved,
        resolvedRate: tech.total > 0 ? ((tech.resolved / tech.total) * 100).toFixed(2) : '0',
        averageResolutionTime:
          tech.resolved > 0 ? (tech.averageResolutionTime / tech.resolved).toFixed(2) : '0',
        slaAchieve: tech.slaAchieve,
        slaPercent: tech.slaTotal > 0 ? ((tech.slaAchieve / tech.slaTotal) * 100).toFixed(1) : 'N/A',
        checkInDays: checkInDayCount,
        avgTicket: checkInDayCount > 0 ? (tech.total / checkInDayCount).toFixed(1) : '0',
        starRating: ratingMap[Number(techId)]?.toFixed(1) || 'N/A',
      };
    });
  }

  /**
   * Get check-in data for map display
   */
  async getMapCheckins(user: any, from?: string, to?: string, status?: string) {
    const where: any = {
      checkInLatitude: { not: null },
      checkInLongitude: { not: null },
    };

    // Role-based filtering
    if (this.hasOnlyRole(user, UserRole.TECHNICIAN)) {
      where.assignees = { some: { userId: user.id } };
    }

    // Date range on checkInAt
    if (from || to) {
      where.checkInAt = {};
      if (from) where.checkInAt.gte = new Date(from);
      if (to) {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        where.checkInAt.lte = toDate;
      }
    }

    // Status filter
    if (status) {
      where.status = status;
    }

    const incidents = await this.prisma.incident.findMany({
      where,
      select: {
        id: true,
        ticketNumber: true,
        title: true,
        status: true,
        checkInAt: true,
        checkInLatitude: true,
        checkInLongitude: true,
        confirmedAt: true,
        resolvedAt: true,
        store: {
          select: { name: true, storeCode: true },
        },
        assignee: {
          select: { id: true, firstName: true, lastName: true, avatarPath: true },
        },
      },
      orderBy: { checkInAt: 'desc' },
    });

    return incidents.map((inc) => ({
      id: inc.id,
      ticketNumber: inc.ticketNumber,
      title: inc.title,
      status: inc.status,
      latitude: inc.checkInLatitude,
      longitude: inc.checkInLongitude,
      checkInAt: inc.checkInAt,
      confirmedAt: inc.confirmedAt,
      resolvedAt: inc.resolvedAt,
      storeName: inc.store?.name || 'Unknown',
      storeCode: inc.store?.storeCode || '',
      technicianName: inc.assignee
        ? `${inc.assignee.firstName} ${inc.assignee.lastName}`
        : 'Unassigned',
      technicianInitials: inc.assignee
        ? `${(inc.assignee.firstName || '')[0] || ''}${(inc.assignee.lastName || '')[0] || ''}`.toUpperCase()
        : '??',
      technicianAvatar: inc.assignee?.avatarPath
        ? `/uploads/${inc.assignee.avatarPath}`
        : null,
    }));
  }

  /**
   * Get Technician Detail Report (per-day activity + performance summary)
   * Params: technicianId, from (YYYY-MM-DD), to (YYYY-MM-DD), period (YYYY-MM for performance)
   */
  async getTechnicianDetailReport(technicianId: number, from?: string, to?: string, period?: string) {
    // ── Validate technician ────────────────────────────────────────────────────
    const technician = await this.prisma.user.findUnique({
      where: { id: technicianId },
      select: { id: true, firstName: true, lastName: true, email: true, technicianType: true },
    });
    if (!technician) throw new Error(`Technician ID ${technicianId} not found`);

    const fromDate = from ? new Date(from) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const toDate = to ? new Date(to) : new Date();
    toDate.setHours(23, 59, 59, 999);

    // ── Performance summary (monthly) ─────────────────────────────────────────
    const targetPeriod = period || `${fromDate.getFullYear()}-${String(fromDate.getMonth() + 1).padStart(2, '0')}`;
    const perfScore = await this.prisma.technicianPerformanceScore.findUnique({
      where: { technicianId_period: { technicianId, period: targetPeriod } },
    });

    let performance: any = null;
    if (perfScore) {
      performance = {
        period: targetPeriod,
        overallScore: Number(perfScore.totalScore),
        grade: perfScore.grade,
        gradeDescription: perfScore.gradeDescription,
        ranking: perfScore.teamRanking,
        totalTechnicians: perfScore.totalTechnicians,
        slaCompliance: Number(perfScore.slaCompliance),
        workVolume: perfScore.workVolume,
        avgResolutionTimeHrs: Number(perfScore.avgResolutionTime),
        avgResponseTimeMins: Number(perfScore.avgResponseTime),
        firstTimeFixRate: Number(perfScore.firstTimeFixRate),
        reopenRate: Number(perfScore.reopenRate),
        avgCustomerRating: perfScore.avgCustomerRating ? Number(perfScore.avgCustomerRating) : null,
        bonusPoints: Number(perfScore.totalBonusPoints),
      };
    }

    // ── Activity logs (login/logout) ───────────────────────────────────────────
    const activityLogs = await this.prisma.userActivityLog.findMany({
      where: {
        userId: technicianId,
        date: { gte: fromDate, lte: toDate },
      },
      orderBy: { date: 'asc' },
    });
    const activityMap = new Map(activityLogs.map((a) => [a.date.toISOString().split('T')[0], a]));

    // ── Incidents in range ─────────────────────────────────────────────────────
    const incidents = await this.prisma.incident.findMany({
      where: {
        assignees: { some: { userId: technicianId } },
        createdAt: { gte: fromDate, lte: toDate },
      },
      select: {
        id: true,
        ticketNumber: true,
        title: true,
        status: true,
        priority: true,
        jobType: true,
        createdAt: true,
        resolvedAt: true,
        checkInAt: true,
        store: { select: { name: true, storeCode: true } },
        slaDeadline: true,
        slaDefenses: { select: { status: true } },
      },
      orderBy: { checkInAt: 'asc' },
    });

    // Group incidents by date (YYYY-MM-DD)
    const incidentsByDay = new Map<string, typeof incidents>();
    for (const inc of incidents) {
      const key = inc.createdAt.toISOString().split('T')[0];
      if (!incidentsByDay.has(key)) incidentsByDay.set(key, []);
      incidentsByDay.get(key)!.push(inc);
    }

    // ── Build daily rows (union of activity + incident days) ──────────────────
    const allDays = new Set<string>([...activityMap.keys(), ...incidentsByDay.keys()]);
    const dailyRows: any[] = [];

    for (const day of Array.from(allDays).sort()) {
      const activity = activityMap.get(day);
      const dayIncidents = incidentsByDay.get(day) || [];

      // First check-in of the day
      const checkedIn = dayIncidents.filter((i) => i.checkInAt);
      checkedIn.sort((a, b) => a.checkInAt!.getTime() - b.checkInAt!.getTime());
      const firstCheckIn = checkedIn[0]?.checkInAt ?? null;

      const resolved = dayIncidents.filter((i) =>
        i.status === 'RESOLVED' || i.status === 'CLOSED'
      ).length;

      const slaRelevant = dayIncidents.filter((i) => i.jobType !== 'Project');
      const slaPass = slaRelevant.filter((i) => {
        if (i.jobType === 'Adhoc') return true;
        if (!i.slaDeadline || !i.resolvedAt) return true;
        if (i.resolvedAt <= i.slaDeadline) return true;
        return i.slaDefenses?.some((d: any) => d.status === 'APPROVED');
      }).length;

      dailyRows.push({
        date: day,
        loginAt: activity?.loginAt ?? null,
        logoutAt: activity?.logoutAt ?? null,
        firstCheckIn,
        totalJobs: dayIncidents.length,
        resolved,
        slaPass,
        slaTotal: slaRelevant.length,
      });
    }

    // Sort by first check-in time (nulls last), then by date
    dailyRows.sort((a, b) => {
      if (a.firstCheckIn && b.firstCheckIn) return new Date(a.firstCheckIn).getTime() - new Date(b.firstCheckIn).getTime();
      if (a.firstCheckIn) return -1;
      if (b.firstCheckIn) return 1;
      return a.date.localeCompare(b.date);
    });

    return {
      technician: {
        id: technician.id,
        name: `${technician.firstName} ${technician.lastName}`,
        email: technician.email,
        technicianType: technician.technicianType,
      },
      dateRange: { from: fromDate.toISOString().split('T')[0], to: toDate.toISOString().split('T')[0] },
      performance,
      dailyRows,
    };
  }

  /**
   * Helper: Get week number
   */
  private getWeekNumber(date: Date): number {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  }

  /**
   * Helper: Calculate average resolution time
   */
  private async calculateAverageResolutionTime(where: any): Promise<string> {
    const resolvedIncidents = await this.prisma.incident.findMany({
      where: {
        ...where,
        resolvedAt: { not: null },
      },
      select: {
        createdAt: true,
        resolvedAt: true,
      },
    });

    if (resolvedIncidents.length === 0) return '0';

    const totalTime = resolvedIncidents.reduce((sum, incident) => {
      const resolutionTime =
        (new Date(incident.resolvedAt!).getTime() - new Date(incident.createdAt).getTime()) /
        (1000 * 60 * 60); // hours
      return sum + resolutionTime;
    }, 0);

    return (totalTime / resolvedIncidents.length).toFixed(2);
  }
}

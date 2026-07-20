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

    // 3 queries instead of 11 — groupBy for status, groupBy for priority, count for overdue SLA
    const [statusGroups, priorityGroups, overdueSla] = await Promise.all([
      this.prisma.incident.groupBy({ by: ['status'], where, _count: { _all: true } }),
      this.prisma.incident.groupBy({ by: ['priority'], where, _count: { _all: true } }),
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

    const byStatus = Object.fromEntries(statusGroups.map(g => [g.status, g._count._all]))
    const byPriority = Object.fromEntries(priorityGroups.map(g => [g.priority, g._count._all]))
    const total = statusGroups.reduce((sum, g) => sum + g._count._all, 0)

    return {
      total,
      byStatus: {
        open: byStatus[IncidentStatus.OPEN] ?? 0,
        assigned: byStatus[IncidentStatus.ASSIGNED] ?? 0,
        inProgress: byStatus[IncidentStatus.IN_PROGRESS] ?? 0,
        pending: byStatus[IncidentStatus.PENDING] ?? 0,
        resolved: byStatus[IncidentStatus.RESOLVED] ?? 0,
        closed: byStatus[IncidentStatus.CLOSED] ?? 0,
        cancelled: byStatus[IncidentStatus.CANCELLED] ?? 0,
      },
      byPriority: {
        critical: byPriority['CRITICAL'] ?? 0,
        high: byPriority['HIGH'] ?? 0,
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

    const [allIncidents, averageResolutionTime] = await Promise.all([
      this.prisma.incident.findMany({
        where: { ...where, resolvedAt: { not: null } },
        select: {
          jobType: true,
          slaDeadline: true,
          resolvedAt: true,
          slaDefenses: { select: { status: true } },
        },
      }),
      this.calculateAverageResolutionTime(where),
    ]);

    const total = await this.prisma.incident.count({ where });

    // SLA pass: no deadline, Adhoc, resolved on time, OR approved defense
    const metSla = allIncidents.filter((i) => {
      if (!i.slaDeadline) return true;
      if (i.jobType === 'Adhoc') return true;
      if (i.resolvedAt && i.resolvedAt <= i.slaDeadline) return true;
      return (i as any).slaDefenses?.some((d: any) => d.status === SlaDefenseStatus.APPROVED);
    }).length;

    // SLA breach: had deadline, resolved late, and no approved defense
    const breachedSla = allIncidents.filter((i) => {
      if (!i.slaDeadline || !i.resolvedAt) return false;
      if (i.resolvedAt <= i.slaDeadline) return false;
      return !(i as any).slaDefenses?.some((d: any) => d.status === SlaDefenseStatus.APPROVED);
    }).length;

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
    // ── 1. WorkRound-based query (new incidents with WorkRound records) ───────
    const wrWhere: any = {
      checkInLatitude: { not: null },
      checkInLongitude: { not: null },
    };

    if (this.hasOnlyRole(user, UserRole.TECHNICIAN)) {
      wrWhere.technicianId = user.id;
    }

    if (from || to) {
      wrWhere.checkInAt = {};
      if (from) wrWhere.checkInAt.gte = new Date(from);
      if (to) {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        wrWhere.checkInAt.lte = toDate;
      }
    }

    if (status) {
      wrWhere.incident = { status };
    }

    const rounds = await this.prisma.incidentWorkRound.findMany({
      where: wrWhere,
      select: {
        id: true,
        roundNumber: true,
        checkInAt: true,
        checkInLatitude: true,
        checkInLongitude: true,
        resolvedAt: true,
        technician: {
          select: { id: true, firstName: true, lastName: true, avatarPath: true },
        },
        incident: {
          select: {
            id: true,
            ticketNumber: true,
            title: true,
            status: true,
            reopenCount: true,
            confirmedAt: true,
            resolvedAt: true,
            store: { select: { name: true, storeCode: true } },
          },
        },
      },
      orderBy: { checkInAt: 'desc' },
    });

    // ── 2. Legacy Incident query (old incidents without WorkRound records) ────
    const legacyWhere: any = {
      checkInLatitude: { not: null },
      checkInLongitude: { not: null },
      workRounds: { none: {} },
    };

    if (this.hasOnlyRole(user, UserRole.TECHNICIAN)) {
      legacyWhere.assignees = { some: { userId: user.id } };
    }

    if (from || to) {
      legacyWhere.checkInAt = {};
      if (from) legacyWhere.checkInAt.gte = new Date(from);
      if (to) {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        legacyWhere.checkInAt.lte = toDate;
      }
    }

    if (status) {
      legacyWhere.status = status;
    }

    const legacyIncidents = await this.prisma.incident.findMany({
      where: legacyWhere,
      select: {
        id: true,
        ticketNumber: true,
        title: true,
        status: true,
        reopenCount: true,
        confirmedAt: true,
        resolvedAt: true,
        checkInAt: true,
        checkInLatitude: true,
        checkInLongitude: true,
        assignee: { select: { id: true, firstName: true, lastName: true, avatarPath: true } },
        resolvedBy: { select: { id: true, firstName: true, lastName: true, avatarPath: true } },
        assignees: {
          select: { user: { select: { id: true, firstName: true, lastName: true, avatarPath: true } } },
          orderBy: { assignedAt: 'desc' as const },
          take: 1,
        },
        store: { select: { name: true, storeCode: true } },
      },
      orderBy: { checkInAt: 'desc' },
    });

    // ── 3. Map WorkRound pins ─────────────────────────────────────────────────
    const makeTechInitials = (t: { firstName: string; lastName: string } | null) =>
      t ? `${(t.firstName || '')[0] || ''}${(t.lastName || '')[0] || ''}`.toUpperCase() : '??';

    const roundPins = rounds.map((round) => {
      const inc = round.incident;
      const tech = round.technician;
      const isSuperseded =
        round.resolvedAt !== null &&
        inc.status !== 'RESOLVED' &&
        inc.status !== 'CLOSED' &&
        inc.status !== 'CANCELLED';
      const effectiveStatus = isSuperseded ? 'REOPENED' : inc.status;

      return {
        id: `round-${round.id}`,
        incidentId: inc.id,
        ticketNumber: inc.ticketNumber,
        title: inc.title,
        status: effectiveStatus,
        roundNumber: round.roundNumber,
        reopenCount: inc.reopenCount ?? 0,
        latitude: round.checkInLatitude,
        longitude: round.checkInLongitude,
        checkInAt: round.checkInAt,
        confirmedAt: inc.confirmedAt,
        resolvedAt: round.resolvedAt,
        storeName: inc.store?.name || 'Unknown',
        storeCode: inc.store?.storeCode || '',
        technicianName: tech ? `${tech.firstName} ${tech.lastName}` : 'Unassigned',
        technicianInitials: makeTechInitials(tech),
        technicianAvatar: tech?.avatarPath ? `/uploads/${tech.avatarPath}` : null,
      };
    });

    // ── 4. Map legacy Incident pins ───────────────────────────────────────────
    const legacyPins = legacyIncidents.map((inc) => {
      const tech = inc.assignees[0]?.user ?? inc.assignee ?? inc.resolvedBy ?? null;

      return {
        id: `legacy-${inc.id}`,
        incidentId: inc.id,
        ticketNumber: inc.ticketNumber,
        title: inc.title,
        status: inc.status,
        roundNumber: 1,
        reopenCount: inc.reopenCount ?? 0,
        latitude: inc.checkInLatitude,
        longitude: inc.checkInLongitude,
        checkInAt: inc.checkInAt,
        confirmedAt: inc.confirmedAt,
        resolvedAt: inc.resolvedAt,
        storeName: inc.store?.name || 'Unknown',
        storeCode: inc.store?.storeCode || '',
        technicianName: tech ? `${tech.firstName} ${tech.lastName}` : 'Unassigned',
        technicianInitials: makeTechInitials(tech),
        technicianAvatar: tech?.avatarPath ? `/uploads/${tech.avatarPath}` : null,
      };
    });

    return [...roundPins, ...legacyPins];
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

    // Parse dates as LOCAL time (Bangkok TZ) to match how auth.service stores activity logs
    const parseLocal = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
    const fromDate = from ? parseLocal(from) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const toDate = to ? parseLocal(to) : new Date();
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
    // Use local (Bangkok) date string for all day keys
    const localDateKey = (d: Date) => d.toLocaleDateString('en-CA'); // 'YYYY-MM-DD' in local TZ
    const activityMap = new Map(activityLogs.map((a) => [localDateKey(a.date), a]));

    // ── All incidents for this tech (no date filter) for accurate carryover ─────
    const allIncidents = await this.prisma.incident.findMany({
      where: {
        assignees: { some: { userId: technicianId } },
        status: { not: 'CANCELLED' },
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
    });

    // ── Current pending ────────────────────────────────────────────────────────
    const pendingIncidents = allIncidents
      .filter((i) => !['CLOSED', 'RESOLVED'].includes(i.status))
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    const pendingCount = pendingIncidents.length;
    const now = new Date();
    const oldestPendingAgingDays = pendingCount > 0
      ? Math.floor((now.getTime() - pendingIncidents[0].createdAt.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    // ── Generate all days in date range ───────────────────────────────────────
    const allDaysInRange: string[] = [];
    const cursor = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
    while (cursor <= toDate) {
      allDaysInRange.push(localDateKey(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }

    // ── Build daily rows for every day in range ───────────────────────────────
    const dailyRows: any[] = [];

    for (const day of allDaysInRange) {
      const dayStart = parseLocal(day);
      const activity = activityMap.get(day);

      // Assigned today: incidents created on this day
      const assignedToday = allIncidents.filter((i) => localDateKey(i.createdAt) === day);

      // Closed today: incidents whose resolvedAt falls on this day
      const closedToday = allIncidents.filter(
        (i) => i.resolvedAt && ['CLOSED', 'RESOLVED'].includes(i.status) && localDateKey(i.resolvedAt) === day,
      );

      // Pending carryover: incidents created BEFORE this day that were still open at start of day
      const pendingCarryover = allIncidents.filter((i) => {
        if (i.createdAt >= dayStart) return false;
        if (['CLOSED', 'RESOLVED'].includes(i.status) && i.resolvedAt && i.resolvedAt < dayStart) return false;
        return true;
      }).length;

      const assigned = assignedToday.length;
      const totalJobs = pendingCarryover + assigned;
      const resolved = closedToday.length;

      // Check-in data: any incident with checkInAt on this day
      const dayCheckins = allIncidents.filter((i) => i.checkInAt && localDateKey(i.checkInAt) === day);
      dayCheckins.sort((a, b) => a.checkInAt!.getTime() - b.checkInAt!.getTime());
      const firstCheckIn = dayCheckins[0]?.checkInAt ?? null;
      const lastCheckIn = dayCheckins[dayCheckins.length - 1]?.checkInAt ?? null;

      // Last resolve time of the day
      const sortedClosed = [...closedToday].sort((a, b) => a.resolvedAt!.getTime() - b.resolvedAt!.getTime());
      const lastResolve = sortedClosed[sortedClosed.length - 1]?.resolvedAt ?? null;

      // SLA for incidents assigned today
      const slaRelevant = assignedToday.filter((i) => i.jobType !== 'Project');
      const slaPass = slaRelevant.filter((i) => {
        if (!i.resolvedAt) return false;
        if (i.jobType === 'Adhoc') return true;
        if (!i.slaDeadline) return true;
        if (i.resolvedAt <= i.slaDeadline) return true;
        return i.slaDefenses?.some((d: any) => d.status === 'APPROVED');
      }).length;

      const slaTotal = slaRelevant.length;
      const slaPercent = slaTotal > 0 ? Math.round((slaPass / slaTotal) * 1000) / 10 : null;

      const effectiveLogout = activity?.logoutAt
        ?? (activity?.loginAt ? new Date(`${day}T22:00:00+07:00`) : null);

      const resolutionTimeMins = closedToday
        .filter((i) => i.checkInAt && i.resolvedAt)
        .reduce((sum, i) => sum + (i.resolvedAt!.getTime() - i.checkInAt!.getTime()) / 60000, 0);

      dailyRows.push({
        date: day,
        loginAt: activity?.loginAt ?? null,
        logoutAt: effectiveLogout,
        firstCheckIn,
        lastCheckIn,
        lastResolve,
        assigned,
        pendingCarryover,
        totalJobs,
        resolved,
        slaPass,
        slaTotal,
        slaPercent,
        resolutionTimeMins: resolutionTimeMins > 0 ? Math.round(resolutionTimeMins) : null,
      });
    }

    // Sort by date ascending
    dailyRows.sort((a, b) => a.date.localeCompare(b.date));

    const responseCount = allIncidents.filter(
      (i) => i.checkInAt !== null && allDaysInRange.includes(localDateKey(i.createdAt)),
    ).length;

    return {
      technician: {
        id: technician.id,
        name: `${technician.firstName} ${technician.lastName}`,
        email: technician.email,
        technicianType: technician.technicianType,
      },
      dateRange: { from: localDateKey(fromDate), to: localDateKey(toDate) },
      performance,
      responseCount,
      pendingCount,
      oldestPendingAgingDays,
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

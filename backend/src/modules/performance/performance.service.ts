// src/modules/performance/performance.service.ts

import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UserRole, IncidentStatus, SlaDefenseStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

// Grade definitions
const GRADES = [
  { min: 95, max: 100, grade: 'A+', description: 'OUTSTANDING' },
  { min: 90, max: 94.99, grade: 'A', description: 'EXCELLENT' },
  { min: 85, max: 89.99, grade: 'B+', description: 'VERY GOOD' },
  { min: 80, max: 84.99, grade: 'B', description: 'GOOD' },
  { min: 75, max: 79.99, grade: 'C+', description: 'ABOVE AVERAGE' },
  { min: 70, max: 74.99, grade: 'C', description: 'AVERAGE' },
  { min: 60, max: 69.99, grade: 'D', description: 'BELOW AVERAGE' },
  { min: 0, max: 59.99, grade: 'F', description: 'NEEDS IMPROVEMENT' },
];

// Metric weights (total 100%)
const WEIGHTS = {
  slaCompliance: 20,
  workVolume: 15,
  resolutionTime: 15,
  responseTime: 10,
  firstTimeFix: 15,
  reopenRate: 10,
  customerSatisfaction: 15,
};

// Targets
const TARGETS = {
  slaCompliance: 95, // 95%
  workVolume: 50, // 50 jobs per month
  resolutionTime: 4, // 4 hours
  responseTime: 30, // 30 minutes
  firstTimeFix: 85, // 85%
  reopenRate: 5, // ≤5%
};

@Injectable()
export class PerformanceService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get grade from score
   */
  private getGrade(score: number): { grade: string; description: string } {
    for (const g of GRADES) {
      if (score >= g.min && score <= g.max) {
        return { grade: g.grade, description: g.description };
      }
    }
    return { grade: 'F', description: 'NEEDS IMPROVEMENT' };
  }

  /**
   * Calculate score based on percentage (0-100)
   */
  private calculatePercentageScore(
    value: number,
    target: number,
    inverse = false,
  ): number {
    if (inverse) {
      // For metrics where lower is better (like reopen rate)
      if (value <= target) return 100;
      if (value >= target * 2) return 0;
      return 100 - ((value - target) / target) * 100;
    }

    // For metrics where higher is better
    if (value >= target) return 100;
    return (value / target) * 100;
  }

  /**
   * Calculate score based on time (where faster is better)
   */
  private calculateTimeScore(
    value: number,
    standard: number,
  ): number {
    if (value <= standard) return 100;
    if (value >= standard * 2) return 0;
    return 100 - ((value - standard) / standard) * 100;
  }

  /**
   * Get Performance for a Technician (Current Month or Specific Period)
   */
  async getTechnicianPerformance(
    technicianId: number,
    period?: string, // 'YYYY-MM' format
  ) {
    // Default to current month
    const targetPeriod = period || this.getCurrentPeriod();

    // Check if already calculated
    let performanceScore = await this.prisma.technicianPerformanceScore.findUnique({
      where: {
        technicianId_period: {
          technicianId,
          period: targetPeriod,
        },
      },
      include: {
        technician: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    // If not calculated, calculate now
    if (!performanceScore || !performanceScore.isCalculated) {
      performanceScore = await this.calculatePerformance(technicianId, targetPeriod);
    }

    return this.formatPerformanceResponse(performanceScore);
  }

  /**
   * Calculate Performance for a Technician
   */
  async calculatePerformance(
    technicianId: number,
    period: string,
    calculatedById?: number,
  ) {
    // Verify technician exists
    const technician = await this.prisma.user.findUnique({
      where: { id: technicianId },
      include: { roles: true },
    });

    if (!technician) {
      throw new NotFoundException(`ไม่พบ Technician ID: ${technicianId}`);
    }

    const techRoles = technician.roles.map((r) => r.role);
    if (!techRoles.includes(UserRole.TECHNICIAN)) {
      throw new BadRequestException('ผู้ใช้นี้ไม่ใช่ Technician');
    }

    // Parse period
    const [year, month] = period.split('-').map(Number);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    // Get incidents for this technician in this period
    const incidents = await this.prisma.incident.findMany({
      where: {
        assigneeId: technicianId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        rating: true,
        slaDefenses: { select: { status: true } },
      },
    });

    // Calculate metrics
    const totalIncidents = incidents.length;
    const closedIncidents = incidents.filter(
      (i) => i.status === IncidentStatus.CLOSED || i.status === IncidentStatus.RESOLVED,
    );

    // 1. SLA Compliance (Project excluded; Adhoc always passes; approved defense counts as passed)
    const slaRelevant = closedIncidents.filter(i => (i as any).jobType !== 'Project');
    const slaCompliants = slaRelevant.filter((i) => {
      if ((i as any).jobType === 'Adhoc') return true;
      if (!i.slaDeadline || !i.resolvedAt) return true;
      if (i.resolvedAt <= i.slaDeadline) return true;
      return (i as any).slaDefenses?.some((d: any) => d.status === SlaDefenseStatus.APPROVED);
    });
    const slaCompliance = slaRelevant.length > 0
      ? (slaCompliants.length / slaRelevant.length) * 100
      : 100;
    const slaScore = this.calculatePercentageScore(slaCompliance, TARGETS.slaCompliance);

    // 2. Work Volume (50 jobs = 90 points, proportional, cap at 100)
    const workVolume = totalIncidents;
    const workVolumeScore = Math.min((workVolume / TARGETS.workVolume) * 90, 100);

    // 3. Average Resolution Time (in hours)
    const resolvedWithTime = closedIncidents.filter((i) => i.resolvedAt && i.checkInAt);
    const avgResolutionTime = resolvedWithTime.length > 0
      ? resolvedWithTime.reduce((sum, i) => {
          const diff = (i.resolvedAt!.getTime() - i.checkInAt!.getTime()) / (1000 * 60 * 60);
          return sum + diff;
        }, 0) / resolvedWithTime.length
      : 0;
    const resolutionTimeScore = avgResolutionTime > 0
      ? this.calculateTimeScore(avgResolutionTime, TARGETS.resolutionTime)
      : 100;

    // 4. Average Response Time (in minutes) - time from assignment to technician response
    const withResponse = incidents.filter((i) => i.respondedAt);
    const avgResponseTime = withResponse.length > 0
      ? withResponse.reduce((sum, i) => {
          const diff = (i.respondedAt!.getTime() - i.createdAt.getTime()) / (1000 * 60);
          return sum + diff;
        }, 0) / withResponse.length
      : 0;
    const responseTimeScore = avgResponseTime > 0
      ? this.calculateTimeScore(avgResponseTime, TARGETS.responseTime)
      : 100;

    // 5. First Time Fix Rate
    const firstTimeFixes = closedIncidents.filter((i) => i.reopenCount === 0);
    const firstTimeFixRate = closedIncidents.length > 0
      ? (firstTimeFixes.length / closedIncidents.length) * 100
      : 100;
    const firstTimeFixScore = this.calculatePercentageScore(firstTimeFixRate, TARGETS.firstTimeFix);

    // 6. Reopen Rate — denominator is incidents that received a response (respondedAt or checkInAt)
    const respondedIncidents = incidents.filter((i) => i.respondedAt || i.checkInAt);
    const reopenedIncidents = incidents.filter((i) => i.reopenCount > 0);
    const reopenRate = respondedIncidents.length > 0
      ? (reopenedIncidents.length / respondedIncidents.length) * 100
      : 0;
    const reopenScore = this.calculatePercentageScore(reopenRate, TARGETS.reopenRate, true);

    // 7. Customer Satisfaction (using cumulative running average from User)
    const avgCustomerRating = technician.cumulativeRating ?? 5.0;
    const customerSatisfactionScore = (avgCustomerRating / 5) * 100;

    // Calculate weighted total
    let totalScore = 0;
    totalScore += (slaScore * WEIGHTS.slaCompliance) / 100;
    totalScore += (workVolumeScore * WEIGHTS.workVolume) / 100;
    totalScore += (resolutionTimeScore * WEIGHTS.resolutionTime) / 100;
    totalScore += (responseTimeScore * WEIGHTS.responseTime) / 100;
    totalScore += (firstTimeFixScore * WEIGHTS.firstTimeFix) / 100;
    totalScore += (reopenScore * WEIGHTS.reopenRate) / 100;

    // Add customer satisfaction (always available via cumulative rating)
    totalScore += (customerSatisfactionScore * WEIGHTS.customerSatisfaction) / 100;

    // Calculate bonus points
    // Response Bonus: 5% bonus for technicians who respond before check-in
    const respondedBeforeCheckin = incidents.filter(
      (i) => i.respondedAt && i.checkInAt && i.respondedAt < i.checkInAt
    );
    const responseRate = totalIncidents > 0
      ? (respondedBeforeCheckin.length / totalIncidents) * 100
      : 0;
    // Give proportional bonus (up to 5% if 100% response rate)
    const responseBonus = (responseRate / 100) * 5;

    const totalBonusPoints = responseBonus;

    // Final score
    const finalScore = Math.min(totalScore + totalBonusPoints, 115);

    // Get grade
    const { grade, description } = this.getGrade(finalScore);

    // Upsert performance record
    const performanceScore = await this.prisma.technicianPerformanceScore.upsert({
      where: {
        technicianId_period: {
          technicianId,
          period,
        },
      },
      update: {
        slaCompliance,
        slaScore,
        workVolume,
        workVolumeTarget: TARGETS.workVolume,
        workVolumeScore,
        avgResolutionTime,
        resolutionTimeStandard: TARGETS.resolutionTime,
        resolutionTimeScore,
        avgResponseTime,
        responseTimeStandard: TARGETS.responseTime,
        responseTimeScore,
        firstTimeFixRate,
        firstTimeFixScore,
        reopenRate,
        reopenScore,
        avgCustomerRating: avgCustomerRating ?? null,
        totalRatings: incidents.filter((i) => i.rating).length,
        customerSatisfactionScore: customerSatisfactionScore ?? null,
        totalBonusPoints,
        totalScore: finalScore,
        grade,
        gradeDescription: description,
        isCalculated: true,
        calculatedAt: new Date(),
        calculatedById,
      },
      create: {
        technicianId,
        period,
        startDate,
        endDate,
        slaCompliance,
        slaScore,
        workVolume,
        workVolumeTarget: TARGETS.workVolume,
        workVolumeScore,
        avgResolutionTime,
        resolutionTimeStandard: TARGETS.resolutionTime,
        resolutionTimeScore,
        avgResponseTime,
        responseTimeStandard: TARGETS.responseTime,
        responseTimeScore,
        firstTimeFixRate,
        firstTimeFixScore,
        reopenRate,
        reopenScore,
        avgCustomerRating: avgCustomerRating ?? null,
        totalRatings: incidents.filter((i) => i.rating).length,
        customerSatisfactionScore: customerSatisfactionScore ?? null,
        totalBonusPoints,
        totalScore: finalScore,
        grade,
        gradeDescription: description,
        isCalculated: true,
        calculatedAt: new Date(),
        calculatedById,
      },
      include: {
        technician: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    // Update ranking
    await this.updateRankings(period);

    // Fetch updated record with ranking
    return this.prisma.technicianPerformanceScore.findUnique({
      where: {
        technicianId_period: {
          technicianId,
          period,
        },
      },
      include: {
        technician: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });
  }

  /**
   * Update Rankings for a Period
   */
  async updateRankings(period: string) {
    // Get all scores for this period, sorted by totalScore
    const scores = await this.prisma.technicianPerformanceScore.findMany({
      where: { period, isCalculated: true },
      orderBy: { totalScore: 'desc' },
    });

    const totalTechnicians = scores.length;
    const teamAvgScore = scores.length > 0
      ? scores.reduce((sum, s) => sum + (Number(s.totalScore) || 0), 0) / scores.length
      : 0;
    const topPerformerScore = scores.length > 0 ? Number(scores[0].totalScore) || 0 : 0;

    // Update each score with ranking
    await Promise.all(
      scores.map((score, index) =>
        this.prisma.technicianPerformanceScore.update({
          where: { id: score.id },
          data: {
            teamRanking: index + 1,
            totalTechnicians,
            teamAvgScore,
            topPerformerScore,
          },
        }),
      ),
    );
  }

  /**
   * Get Leaderboard
   */
  async getLeaderboard(period?: string, limit = 10) {
    const targetPeriod = period || this.getCurrentPeriod();

    const scores = await this.prisma.technicianPerformanceScore.findMany({
      where: { period: targetPeriod, isCalculated: true },
      include: {
        technician: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            technicianType: true,
          },
        },
      },
      orderBy: { totalScore: 'desc' },
      take: limit,
    });

    return scores.map((s, index) => ({
      rank: index + 1,
      technicianId: s.technicianId,
      technicianName: `${s.technician.firstName} ${s.technician.lastName}`,
      technicianType: s.technician.technicianType,
      score: Number(s.totalScore),
      grade: s.grade,
      gradeDescription: s.gradeDescription,
    }));
  }

  /**
   * Get Team Statistics
   */
  async getTeamStats(period?: string) {
    const targetPeriod = period || this.getCurrentPeriod();

    const scores = await this.prisma.technicianPerformanceScore.findMany({
      where: { period: targetPeriod, isCalculated: true },
    });

    if (scores.length === 0) {
      return {
        period: targetPeriod,
        totalTechnicians: 0,
        avgScore: 0,
        gradeDistribution: {},
        topScore: 0,
        lowestScore: 0,
      };
    }

    // Grade distribution
    const gradeDistribution: Record<string, number> = {};
    scores.forEach((s) => {
      const g = s.grade || 'N/A';
      gradeDistribution[g] = (gradeDistribution[g] || 0) + 1;
    });

    const scoreValues = scores.map((s) => Number(s.totalScore) || 0);

    return {
      period: targetPeriod,
      totalTechnicians: scores.length,
      avgScore: Math.round((scoreValues.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100,
      gradeDistribution,
      topScore: Math.max(...scoreValues),
      lowestScore: Math.min(...scoreValues),
    };
  }

  /**
   * Get Performance History for a Technician
   */
  async getPerformanceHistory(technicianId: number, months = 12) {
    const scores = await this.prisma.technicianPerformanceScore.findMany({
      where: {
        technicianId,
        isCalculated: true,
        workVolume: { gt: 0 },
      },
      orderBy: { period: 'desc' },
      take: months,
    });

    return scores.map((s) => ({
      period: s.period,
      score: Number(s.totalScore),
      grade: s.grade,
      ranking: s.teamRanking,
      totalTechnicians: s.totalTechnicians,
      slaCompliance: Number(s.slaCompliance) || 0,
      workVolume: Number(s.workVolume) || 0,
    }));
  }

  /**
   * Calculate All Technicians Performance for a Period
   */
  async calculateAllPerformance(period: string, calculatedById: number) {
    // Get all active technicians
    const technicians = await this.prisma.user.findMany({
      where: {
        roles: {
          some: {
            role: UserRole.TECHNICIAN,
          },
        },
        status: 'ACTIVE',
      },
      select: { id: true },
    });

    const results = await Promise.all(
      technicians.map((t) => this.calculatePerformance(t.id, period, calculatedById)),
    );

    return {
      message: `Calculated performance for ${results.length} technicians`,
      period,
      count: results.length,
    };
  }

  /**
   * Get Incident Statistics (total, closed, pending, cancelled, SLA pass/fail)
   */
  async getIncidentStats(period?: string, jobTypes?: string[]) {
    const targetPeriod = period || this.getCurrentPeriod();
    const [year, month] = targetPeriod.split('-').map(Number);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const incidents = await this.prisma.incident.findMany({
      where: {
        createdAt: { gte: startDate, lte: endDate },
        ...(jobTypes && jobTypes.length > 0 ? { jobType: { in: jobTypes } } : {}),
      },
      select: {
        id: true,
        status: true,
        jobType: true,
        slaDeadline: true,
        resolvedAt: true,
        reopenCount: true,
        slaDefenses: { select: { status: true } },
      },
    });

    const total = incidents.length;
    const cancelled = incidents.filter(i => i.status === IncidentStatus.CANCELLED).length;
    // Closed = CLOSED + RESOLVED
    const closed = incidents.filter(i =>
      i.status === IncidentStatus.CLOSED || i.status === IncidentStatus.RESOLVED
    ).length;
    // Pending = everything except CLOSED, RESOLVED, CANCELLED
    const pending = incidents.filter(i =>
      i.status !== IncidentStatus.CLOSED &&
      i.status !== IncidentStatus.RESOLVED &&
      i.status !== IncidentStatus.CANCELLED
    ).length;
    const open = incidents.filter(i =>
      i.status === IncidentStatus.OPEN ||
      i.status === IncidentStatus.ASSIGNED ||
      i.status === IncidentStatus.IN_PROGRESS
    ).length;

    // SLA calculation — Project excluded; Adhoc always passes; approved defense counts as passed
    const completedIncidents = incidents.filter(i =>
      i.status === IncidentStatus.CLOSED || i.status === IncidentStatus.RESOLVED
    );
    const slaRelevantCompleted = completedIncidents.filter(i => i.jobType !== 'Project');
    const slaPass = slaRelevantCompleted.filter(i => {
      if (i.jobType === 'Adhoc') return true;
      if (!i.slaDeadline || !i.resolvedAt) return true;
      if (i.resolvedAt <= i.slaDeadline) return true;
      return (i as any).slaDefenses?.some((d: any) => d.status === SlaDefenseStatus.APPROVED);
    }).length;
    const slaFail = slaRelevantCompleted.length - slaPass;
    const slaPercent = slaRelevantCompleted.length > 0
      ? Math.round((slaPass / slaRelevantCompleted.length) * 10000) / 100
      : 0;

    // Count by job type
    const byJobType: Record<string, number> = {};
    for (const inc of incidents) {
      const jt = inc.jobType || 'Other';
      byJobType[jt] = (byJobType[jt] || 0) + 1;
    }

    const reopen = incidents.filter(i => (i.reopenCount ?? 0) > 0).length;

    return {
      period: targetPeriod,
      total,
      closed: closed,
      pending,
      cancelled,
      open,
      reopen,
      slaPass,
      slaFail,
      slaPercent,
      byJobType,
    };
  }

  /**
   * Get SLA Monthly Trend for Line Graph (last N months)
   */
  async getSlaTrend(months = 12, jobTypes?: string[]) {
    const now = new Date();
    const result: { period: string; slaPercent: number; total: number; slaPass: number; slaFail: number }[] = [];

    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const period = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const startDate = new Date(d.getFullYear(), d.getMonth(), 1);
      const endDate = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);

      const incidents = await this.prisma.incident.findMany({
        where: {
          createdAt: { gte: startDate, lte: endDate },
          status: { in: [IncidentStatus.CLOSED, IncidentStatus.RESOLVED] },
          ...(jobTypes && jobTypes.length > 0 ? { jobType: { in: jobTypes } } : {}),
        },
        select: { jobType: true, slaDeadline: true, resolvedAt: true, slaDefenses: { select: { status: true } } },
      });

      const relevant = incidents.filter(inc => inc.jobType !== 'Project');
      const total = relevant.length;
      const slaPass = relevant.filter(inc => {
        if (inc.jobType === 'Adhoc') return true;
        if (!inc.slaDeadline || !inc.resolvedAt) return true;
        if (inc.resolvedAt <= inc.slaDeadline) return true;
        return (inc as any).slaDefenses?.some((d: any) => d.status === SlaDefenseStatus.APPROVED);
      }).length;
      const slaFail = total - slaPass;
      const slaPercent = total > 0 ? Math.round((slaPass / total) * 10000) / 100 : 0;

      result.push({ period, slaPercent, total, slaPass, slaFail });
    }

    return result;
  }

  /**
   * Get Enhanced Leaderboard with workVolume and SLA%
   */
  async getEnhancedLeaderboard(period?: string, limit = 50, sortBy = 'score', jobTypes?: string[]) {
    const targetPeriod = period || this.getCurrentPeriod();
    const [year, month] = targetPeriod.split('-').map(Number);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const scores = await this.prisma.technicianPerformanceScore.findMany({
      where: { period: targetPeriod, isCalculated: true },
      include: {
        technician: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            technicianType: true,
          },
        },
      },
    });

    // For each technician, get actual incident stats
    const entries = await Promise.all(
      scores.map(async (s) => {
        const incidents = await this.prisma.incident.findMany({
          where: {
            assigneeId: s.technicianId,
            createdAt: { gte: startDate, lte: endDate },
            ...(jobTypes && jobTypes.length > 0 ? { jobType: { in: jobTypes } } : {}),
          },
          select: { status: true, jobType: true, slaDeadline: true, resolvedAt: true, createdAt: true, slaDefenses: { select: { status: true } } },
        });

        const totalJobs = incidents.length;
        const completed = incidents.filter(i =>
          i.status === IncidentStatus.CLOSED || i.status === IncidentStatus.RESOLVED
        );
        const slaRelevant = completed.filter(i => i.jobType !== 'Project');
        const slaPass = slaRelevant.filter(i => {
          if (i.jobType === 'Adhoc') return true;
          if (!i.slaDeadline || !i.resolvedAt) return true;
          if (i.resolvedAt <= i.slaDeadline) return true;
          return (i as any).slaDefenses?.some((d: any) => d.status === SlaDefenseStatus.APPROVED);
        }).length;
        const slaPercent = slaRelevant.length > 0
          ? Math.round((slaPass / slaRelevant.length) * 10000) / 100
          : 0;

        // Avg resolution time (hours) — only for completed incidents with both timestamps
        const completedWithTimes = completed.filter(i => i.resolvedAt);
        const avgResolutionTimeHours = completedWithTimes.length > 0
          ? Math.round(
              (completedWithTimes.reduce((sum, i) =>
                sum + (i.resolvedAt!.getTime() - i.createdAt.getTime()) / 3600000, 0
              ) / completedWithTimes.length) * 100
            ) / 100
          : null;

        return {
          technicianId: s.technicianId,
          technicianName: `${s.technician.firstName} ${s.technician.lastName}`,
          technicianType: s.technician.technicianType,
          score: Number(s.totalScore),
          grade: s.grade,
          gradeDescription: s.gradeDescription,
          workVolume: totalJobs,
          slaPercent,
          avgResolutionTimeHours,
        };
      })
    );

    // Sort
    if (sortBy === 'workVolume') {
      entries.sort((a, b) => b.workVolume - a.workVolume);
    } else if (sortBy === 'sla') {
      entries.sort((a, b) => b.slaPercent - a.slaPercent);
    } else {
      entries.sort((a, b) => b.score - a.score);
    }

    // Add rank
    return entries.slice(0, limit).map((e, i) => ({ ...e, rank: i + 1 }));
  }

  /**
   * Get YTD (Year to Date) Performance Summary
   * Average score from Jan to current month of the current year
   */
  async getYTDPerformance(technicianId?: number) {
    const now = new Date();
    const year = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    // Build period list: 2026-01, 2026-02, ...
    const periods: string[] = [];
    for (let m = 1; m <= currentMonth; m++) {
      periods.push(`${year}-${String(m).padStart(2, '0')}`);
    }

    const where: any = {
      period: { in: periods },
      isCalculated: true,
      workVolume: { gt: 0 },
    };
    if (technicianId) where.technicianId = technicianId;

    const scores = await this.prisma.technicianPerformanceScore.findMany({
      where,
      include: {
        technician: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    if (scores.length === 0) return { year, periods: periods.length, data: [] };

    // Group by technician
    const grouped = this.groupByTechnician(scores);

    return {
      year,
      type: 'YTD',
      label: `YTD ${year} (Jan - ${this.monthName(currentMonth)})`,
      periods: periods.length,
      data: grouped,
    };
  }

  /**
   * Get YTM (Current Month) - Compare with the most recent previous month that had actual work
   */
  async getYTMPerformance(technicianId?: number, month?: number) {
    const now = new Date();
    const year = now.getFullYear();
    const targetMonth = month || now.getMonth() + 1;
    const currentPeriod = `${year}-${String(targetMonth).padStart(2, '0')}`;

    const baseWhere: any = { isCalculated: true, workVolume: { gt: 0 } };
    if (technicianId) baseWhere.technicianId = technicianId;

    // Current month scores
    const currentScores = await this.prisma.technicianPerformanceScore.findMany({
      where: { ...baseWhere, period: currentPeriod },
    });

    // Find the most recent previous period that had actual work
    const prevRecord = await this.prisma.technicianPerformanceScore.findFirst({
      where: { ...baseWhere, period: { lt: currentPeriod } },
      orderBy: { period: 'desc' },
      select: { period: true },
    });

    const prevPeriod = prevRecord?.period ?? null;

    // Fetch all scores for that previous active period
    const prevScores = prevPeriod
      ? await this.prisma.technicianPerformanceScore.findMany({
          where: { ...baseWhere, period: prevPeriod },
        })
      : [];

    const currentAvg = this.avgScore(currentScores);
    const prevAvg = this.avgScore(prevScores);

    const fmtPeriodLabel = (p: string) => {
      const [y, m] = p.split('-');
      return `${this.monthName(parseInt(m))} ${y}`;
    };

    return {
      type: 'YTM',
      label: prevPeriod
        ? `${fmtPeriodLabel(currentPeriod)} vs ${fmtPeriodLabel(prevPeriod)}`
        : fmtPeriodLabel(currentPeriod),
      current: {
        period: currentPeriod,
        avgScore: currentAvg,
        slaPercent: this.avgSla(currentScores),
        jobCount: this.sumJobs(currentScores),
        count: currentScores.length,
      },
      lastYear: {
        period: prevPeriod ?? '-',
        avgScore: prevAvg,
        slaPercent: this.avgSla(prevScores),
        jobCount: this.sumJobs(prevScores),
        count: prevScores.length,
      },
      change: currentAvg - prevAvg,
      changePercent: prevAvg > 0 ? ((currentAvg - prevAvg) / prevAvg) * 100 : 0,
    };
  }

  /**
   * Get YTY (Year to Year) - Compare full year avg this year vs last year
   */
  async getYTYPerformance(technicianId?: number) {
    const now = new Date();
    const year = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    // Current year periods (up to current month)
    const currentPeriods: string[] = [];
    for (let m = 1; m <= currentMonth; m++) {
      currentPeriods.push(`${year}-${String(m).padStart(2, '0')}`);
    }

    // Last year same periods
    const lastYearPeriods: string[] = [];
    for (let m = 1; m <= currentMonth; m++) {
      lastYearPeriods.push(`${year - 1}-${String(m).padStart(2, '0')}`);
    }

    const where: any = {
      period: { in: [...currentPeriods, ...lastYearPeriods] },
      isCalculated: true,
      workVolume: { gt: 0 },
    };
    if (technicianId) where.technicianId = technicianId;

    const scores = await this.prisma.technicianPerformanceScore.findMany({
      where,
      include: {
        technician: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    const currentScores = scores.filter(s => currentPeriods.includes(s.period));
    const lastYearScores = scores.filter(s => lastYearPeriods.includes(s.period));

    const currentAvg = this.avgScore(currentScores);
    const lastYearAvg = this.avgScore(lastYearScores);

    return {
      type: 'YTY',
      label: `${year} vs ${year - 1} (Jan - ${this.monthName(currentMonth)})`,
      current: { year, avgScore: currentAvg, count: currentScores.length },
      lastYear: { year: year - 1, avgScore: lastYearAvg, count: lastYearScores.length },
      change: currentAvg - lastYearAvg,
      changePercent: lastYearAvg > 0 ? ((currentAvg - lastYearAvg) / lastYearAvg) * 100 : 0,
    };
  }

  /**
   * Get Avg Resolution Time broken down by SLA (priority) for current and previous period
   */
  async getResolutionTimeStats(period?: string, jobTypes?: string[]) {
    const targetPeriod = period || this.getCurrentPeriod();

    // Load SLA configs once
    const slaConfigs = await this.prisma.slaConfig.findMany({
      where: { isActive: true },
      orderBy: { id: 'asc' },
      select: { name: true, priority: true, color: true, resolutionTimeMinutes: true },
    });

    const calcByPriority = async (p: string) => {
      const [y, m] = p.split('-').map(Number);
      const start = new Date(y, m - 1, 1);
      const end = new Date(y, m, 0, 23, 59, 59);
      const incidents = await this.prisma.incident.findMany({
        where: {
          createdAt: { gte: start, lte: end },
          status: { in: [IncidentStatus.CLOSED, IncidentStatus.RESOLVED] },
          resolvedAt: { not: null },
          ...(jobTypes && jobTypes.length > 0 ? { jobType: { in: jobTypes } } : {}),
        },
        select: {
          createdAt: true,
          resolvedAt: true,
          priority: true,
          jobType: true,
          slaDeadline: true,
          slaDefenses: { select: { status: true } },
        },
      });

      // Group resolution hours by priority
      const grouped: Record<string, number[]> = {};
      for (const inc of incidents) {
        const hours = (inc.resolvedAt!.getTime() - inc.createdAt.getTime()) / 3600000;
        if (!grouped[inc.priority]) grouped[inc.priority] = [];
        grouped[inc.priority].push(hours);
      }

      // Overall avg
      const allHours = incidents.map(i =>
        (i.resolvedAt!.getTime() - i.createdAt.getTime()) / 3600000
      );
      const overallAvg = allHours.length > 0
        ? Math.round((allHours.reduce((a, b) => a + b, 0) / allHours.length) * 100) / 100
        : null;

      // Per priority: avg resolution time
      const byPriority: Record<string, { avgHours: number | null; count: number }> = {};
      for (const cfg of slaConfigs) {
        const arr = grouped[cfg.priority] || [];
        byPriority[cfg.priority] = {
          avgHours: arr.length > 0
            ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 100) / 100
            : null,
          count: arr.length,
        };
      }

      // Per priority: SLA pass/fail
      const slaRelevant = incidents.filter(i => i.jobType !== 'Project');
      const slaPassFail: Record<string, { pass: number; fail: number }> = {};
      for (const cfg of slaConfigs) {
        const group = slaRelevant.filter(i => i.priority === cfg.priority);
        const pass = group.filter(i => {
          if (i.jobType === 'Adhoc') return true;
          if (!i.slaDeadline || !i.resolvedAt) return true;
          if (i.resolvedAt <= i.slaDeadline) return true;
          return (i as any).slaDefenses?.some((d: any) => d.status === SlaDefenseStatus.APPROVED);
        }).length;
        slaPassFail[cfg.priority] = { pass, fail: group.length - pass };
      }

      return { overallAvg, byPriority, slaPassFail };
    };

    // Find previous period
    const prevRecord = await this.prisma.incident.findFirst({
      where: {
        createdAt: { lt: new Date(parseInt(targetPeriod.split('-')[0]), parseInt(targetPeriod.split('-')[1]) - 1, 1) },
        status: { in: [IncidentStatus.CLOSED, IncidentStatus.RESOLVED] },
      },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    const prevPeriod = prevRecord
      ? `${prevRecord.createdAt.getFullYear()}-${String(prevRecord.createdAt.getMonth() + 1).padStart(2, '0')}`
      : null;

    const [current, prev] = await Promise.all([
      calcByPriority(targetPeriod),
      prevPeriod ? calcByPriority(prevPeriod) : Promise.resolve(null),
    ]);

    const overallChange = current.overallAvg !== null && prev?.overallAvg != null
      ? current.overallAvg - prev.overallAvg : null;

    return {
      period: targetPeriod,
      prevPeriod,
      avgHours: current.overallAvg,
      prevAvgHours: prev?.overallAvg ?? null,
      change: overallChange,
      improved: overallChange !== null ? overallChange < 0 : null,
      slaBreakdown: slaConfigs.map(cfg => ({
        slaName: cfg.name,
        priority: cfg.priority,
        color: cfg.color,
        targetMinutes: cfg.resolutionTimeMinutes,
        current: current.byPriority[cfg.priority] ?? { avgHours: null, count: 0 },
        prev: prev?.byPriority[cfg.priority] ?? { avgHours: null, count: 0 },
      })),
      slaByPriority: slaConfigs.map(cfg => {
        const pf = current.slaPassFail[cfg.priority] ?? { pass: 0, fail: 0 };
        const total = pf.pass + pf.fail;
        return {
          slaName: cfg.name,
          priority: cfg.priority,
          color: cfg.color,
          pass: pf.pass,
          fail: pf.fail,
          total,
          slaPercent: total > 0 ? Math.round((pf.pass / total) * 10000) / 100 : null,
        };
      }),
      prevSlaByPriority: prev ? slaConfigs.map(cfg => {
        const pf = prev.slaPassFail[cfg.priority] ?? { pass: 0, fail: 0 };
        const total = pf.pass + pf.fail;
        return {
          slaName: cfg.name,
          priority: cfg.priority,
          color: cfg.color,
          pass: pf.pass,
          fail: pf.fail,
          total,
          slaPercent: total > 0 ? Math.round((pf.pass / total) * 10000) / 100 : null,
        };
      }) : null,
    };
  }

  async getStoreIncidentDetail(storeId: number, period?: string, jobTypes?: string[]) {
    const targetPeriod = period || this.getCurrentPeriod();
    const [year, month] = targetPeriod.split('-').map(Number);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      select: { id: true, storeCode: true, name: true },
    });

    const incidents = await this.prisma.incident.findMany({
      where: {
        storeId,
        createdAt: { gte: startDate, lte: endDate },
        ...(jobTypes?.length ? { jobType: { in: jobTypes } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      select: {
        ticketNumber: true,
        incidentDate: true,
        createdAt: true,
        category: true,
        title: true,
        resolutionNote: true,
        resolvedAt: true,
        assignee: { select: { firstName: true, lastName: true } },
        assignees: { select: { user: { select: { firstName: true, lastName: true } } } },
      },
    });

    return {
      store,
      period: targetPeriod,
      periodStart: startDate,
      periodEnd: endDate,
      incidents: incidents.map((inc, idx) => ({
        no: idx + 1,
        incidentDate: inc.incidentDate || inc.createdAt,
        incidentNo: inc.ticketNumber,
        category: inc.category || '-',
        title: inc.title,
        resolution: inc.resolutionNote || '-',
        resolvedAt: inc.resolvedAt,
        technicianName: inc.assignee
          ? `${inc.assignee.firstName} ${inc.assignee.lastName}`
          : inc.assignees?.[0]?.user
          ? `${inc.assignees[0].user.firstName} ${inc.assignees[0].user.lastName}`
          : '-',
      })),
    };
  }

  /**
   * Get Top N Stores by Incident Count for a period
   */
  async getTopStores(period?: string, limit = 10, jobTypes?: string[]) {
    const targetPeriod = period || this.getCurrentPeriod();
    const [year, month] = targetPeriod.split('-').map(Number);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const incidents = await this.prisma.incident.findMany({
      where: {
        createdAt: { gte: startDate, lte: endDate },
        ...(jobTypes && jobTypes.length > 0 ? { jobType: { in: jobTypes } } : {}),
      },
      select: {
        storeId: true,
        storeName: true,
        storeCode: true,
      },
    });

    const countMap = new Map<number, { count: number; name: string; code: string }>();
    for (const inc of incidents) {
      if (!inc.storeId) continue;
      const entry = countMap.get(inc.storeId);
      if (entry) {
        entry.count++;
      } else {
        countMap.set(inc.storeId, {
          count: 1,
          name: inc.storeName || `Store ${inc.storeId}`,
          code: inc.storeCode || String(inc.storeId),
        });
      }
    }

    return Array.from(countMap.entries())
      .map(([id, v]) => ({ storeId: id, storeCode: v.code, storeName: v.name, count: v.count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /**
   * Get Top N Equipment by Incident Count for a period
   */
  async getTopEquipment(period?: string, limit = 10, jobTypes?: string[]) {
    const targetPeriod = period || this.getCurrentPeriod();
    const [year, month] = targetPeriod.split('-').map(Number);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const incidents = await this.prisma.incident.findMany({
      where: {
        createdAt: { gte: startDate, lte: endDate },
        ...(jobTypes && jobTypes.length > 0 ? { jobType: { in: jobTypes } } : {}),
      },
      select: { category: true },
    });

    const countMap = new Map<string, number>();
    for (const inc of incidents) {
      const label = inc.category || 'ไม่ระบุ';
      countMap.set(label, (countMap.get(label) ?? 0) + 1);
    }

    return Array.from(countMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  async getEquipmentCategories(period?: string, jobTypes?: string[]) {
    const targetPeriod = period || this.getCurrentPeriod();
    const [year, month] = targetPeriod.split('-').map(Number);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const incidents = await this.prisma.incident.findMany({
      where: {
        createdAt: { gte: startDate, lte: endDate },
        equipmentId: { not: null },
        ...(jobTypes && jobTypes.length > 0 ? { jobType: { in: jobTypes } } : {}),
      },
      select: { equipment: { select: { category: true } } },
    });

    const cats = new Set<string>();
    for (const inc of incidents) {
      if (inc.equipment?.category) cats.add(inc.equipment.category);
    }
    return Array.from(cats).sort();
  }

  // ──────────────────────────────────────────────────
  // BOX 1: Top Active Equipment with Most Incidents
  // ──────────────────────────────────────────────────
  async getTopActiveEquipment(period?: string, limit = 10, jobTypes?: string[]) {
    const dateFilter = period
      ? (() => {
          const [year, month] = period.split('-').map(Number);
          return { gte: new Date(year, month - 1, 1), lte: new Date(year, month, 0, 23, 59, 59) };
        })()
      : undefined;

    const incidents = await this.prisma.incident.findMany({
      where: {
        ...(dateFilter ? { createdAt: dateFilter } : {}),
        equipmentId: { not: null },
        equipment: { status: 'ACTIVE' },
        ...(jobTypes?.length ? { jobType: { in: jobTypes } } : {}),
      },
      select: {
        createdAt: true,
        equipmentId: true,
        equipment: {
          select: { id: true, category: true, brand: true, model: true, serialNumber: true },
        },
      },
    });

    const map = new Map<number, { equipmentId: number; category: string; brand: string; model: string; serialNumber: string; count: number; lastIncidentAt: Date }>();
    for (const inc of incidents) {
      if (!inc.equipmentId || !inc.equipment) continue;
      const cur = map.get(inc.equipmentId);
      if (cur) {
        cur.count++;
        if (inc.createdAt > cur.lastIncidentAt) cur.lastIncidentAt = inc.createdAt;
      } else {
        map.set(inc.equipmentId, {
          equipmentId: inc.equipmentId,
          category: inc.equipment.category || '',
          brand: inc.equipment.brand || '',
          model: inc.equipment.model || '',
          serialNumber: inc.equipment.serialNumber || '',
          count: 1,
          lastIncidentAt: inc.createdAt,
        });
      }
    }
    return Array.from(map.values())
      .sort((a, b) => b.count - a.count || b.lastIncidentAt.getTime() - a.lastIncidentAt.getTime())
      .slice(0, limit);
  }

  async getEquipmentIncidentDetail(equipmentId: number) {
    const equipment = await this.prisma.equipment.findUnique({
      where: { id: equipmentId },
      select: { id: true, name: true, category: true, brand: true, model: true, serialNumber: true },
    });
    const incidents = await this.prisma.incident.findMany({
      where: { equipmentId },
      orderBy: { createdAt: 'desc' },
      select: {
        ticketNumber: true, title: true, resolutionNote: true,
        incidentDate: true, createdAt: true, resolvedAt: true,
        storeCode: true, storeName: true,
        assignee: { select: { firstName: true, lastName: true } },
        resolvedBy: { select: { firstName: true, lastName: true } },
        assignees: { select: { user: { select: { firstName: true, lastName: true } } } },
      },
    });
    return {
      equipment,
      incidents: incidents.map((inc, idx) => ({
        no: idx + 1,
        incidentDate: inc.incidentDate || inc.createdAt,
        incidentNo: inc.ticketNumber,
        store: `${inc.storeCode || ''} ${inc.storeName || ''}`.trim(),
        title: inc.title,
        resolution: inc.resolutionNote || '-',
        resolvedAt: inc.resolvedAt,
        technicianName: inc.assignee
          ? `${inc.assignee.firstName} ${inc.assignee.lastName}`
          : inc.assignees?.[0]?.user
          ? `${inc.assignees[0].user.firstName} ${inc.assignees[0].user.lastName}`
          : inc.resolvedBy
          ? `${inc.resolvedBy.firstName} ${inc.resolvedBy.lastName}`
          : '-',
      })),
    };
  }

  // ──────────────────────────────────────────────────
  // BOX 2: Equipment Name in Store with >2 Incidents
  // ──────────────────────────────────────────────────
  async getEquipmentRepeatIncidents(period?: string, jobTypes?: string[]) {
    const dateFilter = period
      ? (() => {
          const [year, month] = period.split('-').map(Number);
          return { gte: new Date(year, month - 1, 1), lte: new Date(year, month, 0, 23, 59, 59) };
        })()
      : undefined;

    const incidents = await this.prisma.incident.findMany({
      where: {
        ...(dateFilter ? { createdAt: dateFilter } : {}),
        equipmentId: { not: null },
        equipment: { status: 'ACTIVE' },
        ...(jobTypes?.length ? { jobType: { in: jobTypes } } : {}),
      },
      select: {
        createdAt: true,
        storeId: true, storeCode: true, storeName: true,
        equipment: { select: { name: true } },
      },
    });

    const map = new Map<string, { equipmentName: string; storeId: number; storeCode: string; storeName: string; count: number; lastIncidentAt: Date }>();
    for (const inc of incidents) {
      if (!inc.equipment || !inc.storeId) continue;
      const key = `${inc.equipment.name}__${inc.storeId}`;
      const cur = map.get(key);
      if (cur) {
        cur.count++;
        if (inc.createdAt > cur.lastIncidentAt) cur.lastIncidentAt = inc.createdAt;
      } else {
        map.set(key, {
          equipmentName: inc.equipment.name,
          storeId: inc.storeId,
          storeCode: inc.storeCode || String(inc.storeId),
          storeName: inc.storeName || `Store ${inc.storeId}`,
          count: 1,
          lastIncidentAt: inc.createdAt,
        });
      }
    }
    return Array.from(map.values())
      .filter(v => v.count > 2)
      .sort((a, b) => b.lastIncidentAt.getTime() - a.lastIncidentAt.getTime());
  }

  async getEquipmentNameStoreDetail(equipmentName: string, storeId: number) {
    const equipments = await this.prisma.equipment.findMany({
      where: { name: equipmentName, storeId },
      select: { id: true },
    });
    const equipmentIds = equipments.map(e => e.id);
    const incidents = await this.prisma.incident.findMany({
      where: { equipmentId: { in: equipmentIds } },
      orderBy: { createdAt: 'desc' },
      select: {
        ticketNumber: true, title: true, resolutionNote: true,
        incidentDate: true, createdAt: true, resolvedAt: true,
        storeCode: true, storeName: true,
        equipment: { select: { brand: true, model: true, serialNumber: true } },
        assignee: { select: { firstName: true, lastName: true } },
        resolvedBy: { select: { firstName: true, lastName: true } },
        assignees: { select: { user: { select: { firstName: true, lastName: true } } } },
      },
    });
    return {
      equipmentName,
      storeId,
      incidents: incidents.map((inc, idx) => ({
        no: idx + 1,
        incidentDate: inc.incidentDate || inc.createdAt,
        incidentNo: inc.ticketNumber,
        brand: inc.equipment?.brand || '-',
        model: inc.equipment?.model || '-',
        serialNumber: inc.equipment?.serialNumber || '-',
        title: inc.title,
        resolution: inc.resolutionNote || '-',
        resolvedAt: inc.resolvedAt,
        technicianName: inc.assignee
          ? `${inc.assignee.firstName} ${inc.assignee.lastName}`
          : inc.assignees?.[0]?.user
          ? `${inc.assignees[0].user.firstName} ${inc.assignees[0].user.lastName}`
          : inc.resolvedBy
          ? `${inc.resolvedBy.firstName} ${inc.resolvedBy.lastName}`
          : '-',
      })),
    };
  }

  // ──────────────────────────────────────────────────
  // HELP DESK PERFORMANCE
  // ──────────────────────────────────────────────────

  private helpdeskResponseScore(avgMin: number | null): number {
    if (avgMin === null) return 0;
    if (avgMin <= 5) return 100;
    if (avgMin <= 15) return 85;
    if (avgMin <= 30) return 70;
    if (avgMin <= 60) return 50;
    if (avgMin <= 120) return 30;
    return 10;
  }

  private helpdeskConfirmScore(avgMin: number | null): number {
    if (avgMin === null) return 0;
    if (avgMin <= 15) return 100;
    if (avgMin <= 30) return 85;
    if (avgMin <= 60) return 70;
    if (avgMin <= 120) return 55;
    if (avgMin <= 240) return 35;
    return 15;
  }

  private calcHelpdeskScore(responseAvg: number | null, confirmAvg: number | null): number {
    const hasResponse = responseAvg !== null;
    const hasConfirm = confirmAvg !== null;
    if (!hasResponse && !hasConfirm) return 0;
    const rs = this.helpdeskResponseScore(responseAvg);
    const cs = this.helpdeskConfirmScore(confirmAvg);
    if (!hasResponse) return cs;
    if (!hasConfirm) return rs;
    return Math.round(rs * 0.6 + cs * 0.4);
  }

  async getHelpdeskStats(period?: string, jobTypes?: string[]) {
    const targetPeriod = period || this.getCurrentPeriod();
    const [year, month] = targetPeriod.split('-').map(Number);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const helpdeskUsers = await this.prisma.user.findMany({
      where: { roles: { some: { role: UserRole.HELP_DESK } }, status: 'ACTIVE' },
      select: { id: true },
    });
    const helpdeskIds = helpdeskUsers.map(u => u.id);

    const incidents = await this.prisma.incident.findMany({
      where: {
        createdAt: { gte: startDate, lte: endDate },
        createdById: { in: helpdeskIds },
        ...(jobTypes?.length ? { jobType: { in: jobTypes } } : {}),
      },
      select: {
        incidentDate: true,
        createdAt: true,
        resolvedAt: true,
        confirmedAt: true,
        confirmedById: true,
      },
    });

    const responseTimes = incidents
      .filter(i => i.incidentDate && i.createdAt > i.incidentDate)
      .map(i => (i.createdAt.getTime() - i.incidentDate!.getTime()) / 60000);

    const confirmTimes = incidents
      .filter(i => i.confirmedAt && i.resolvedAt && i.confirmedAt > i.resolvedAt)
      .map(i => (i.confirmedAt!.getTime() - i.resolvedAt!.getTime()) / 60000);

    const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
    const round2 = (v: number | null) => v !== null ? Math.round(v * 100) / 100 : null;

    const responseAvg = round2(avg(responseTimes));
    const confirmAvg = round2(avg(confirmTimes));

    return {
      period: targetPeriod,
      totalIncidents: incidents.length,
      responseTime: {
        avg: responseAvg,
        min: responseTimes.length ? round2(Math.min(...responseTimes)) : null,
        max: responseTimes.length ? round2(Math.max(...responseTimes)) : null,
        count: responseTimes.length,
      },
      confirmCloseTime: {
        avg: confirmAvg,
        min: confirmTimes.length ? round2(Math.min(...confirmTimes)) : null,
        max: confirmTimes.length ? round2(Math.max(...confirmTimes)) : null,
        count: confirmTimes.length,
      },
      score: this.calcHelpdeskScore(responseAvg, confirmAvg),
    };
  }

  async getHelpdeskLeaderboard(period?: string, jobTypes?: string[]) {
    const targetPeriod = period || this.getCurrentPeriod();
    const [year, month] = targetPeriod.split('-').map(Number);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const helpdeskUsers = await this.prisma.user.findMany({
      where: { roles: { some: { role: UserRole.HELP_DESK } }, status: 'ACTIVE' },
      select: { id: true, firstName: true, lastName: true },
    });
    const helpdeskIds = helpdeskUsers.map(u => u.id);

    const incidents = await this.prisma.incident.findMany({
      where: {
        createdAt: { gte: startDate, lte: endDate },
        createdById: { in: helpdeskIds },
        ...(jobTypes?.length ? { jobType: { in: jobTypes } } : {}),
      },
      select: {
        incidentDate: true,
        createdAt: true,
        resolvedAt: true,
        confirmedAt: true,
        createdById: true,
        confirmedById: true,
      },
    });

    type HdData = {
      id: number;
      name: string;
      responseTimes: number[];
      confirmTimes: number[];
      totalCreated: number;
      totalConfirmed: number;
    };

    const map = new Map<number, HdData>();
    for (const u of helpdeskUsers) {
      map.set(u.id, {
        id: u.id,
        name: `${u.firstName} ${u.lastName}`,
        responseTimes: [],
        confirmTimes: [],
        totalCreated: 0,
        totalConfirmed: 0,
      });
    }

    for (const inc of incidents) {
      const creator = map.get(inc.createdById);
      if (creator) {
        creator.totalCreated++;
        if (inc.incidentDate && inc.createdAt > inc.incidentDate) {
          creator.responseTimes.push((inc.createdAt.getTime() - inc.incidentDate.getTime()) / 60000);
        }
      }
      if (inc.confirmedById) {
        const confirmer = map.get(inc.confirmedById);
        if (confirmer && inc.confirmedAt && inc.resolvedAt && inc.confirmedAt > inc.resolvedAt) {
          confirmer.confirmTimes.push((inc.confirmedAt.getTime() - inc.resolvedAt.getTime()) / 60000);
          confirmer.totalConfirmed++;
        }
      }
    }

    const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
    const round2 = (v: number | null) => v !== null ? Math.round(v * 100) / 100 : null;

    const results = Array.from(map.values()).map(hd => {
      const responseAvg = round2(avg(hd.responseTimes));
      const confirmAvg = round2(avg(hd.confirmTimes));
      const score = this.calcHelpdeskScore(responseAvg, confirmAvg);
      const gradeInfo = this.getGrade(score);
      return {
        id: hd.id,
        name: hd.name,
        totalCreated: hd.totalCreated,
        totalConfirmed: hd.totalConfirmed,
        responseTime: {
          avg: responseAvg,
          min: hd.responseTimes.length ? round2(Math.min(...hd.responseTimes)) : null,
          max: hd.responseTimes.length ? round2(Math.max(...hd.responseTimes)) : null,
          count: hd.responseTimes.length,
        },
        confirmCloseTime: {
          avg: confirmAvg,
          min: hd.confirmTimes.length ? round2(Math.min(...hd.confirmTimes)) : null,
          max: hd.confirmTimes.length ? round2(Math.max(...hd.confirmTimes)) : null,
          count: hd.confirmTimes.length,
        },
        score,
        grade: gradeInfo.grade,
        gradeDescription: gradeInfo.description,
      };
    });

    return {
      period: targetPeriod,
      leaderboard: results.sort((a, b) => b.score - a.score).map((r, i) => ({ ...r, rank: i + 1 })),
      scoringCriteria: {
        responseTime: {
          weight: '60%',
          tiers: [
            { label: '≤ 5 min', score: 100 },
            { label: '≤ 15 min', score: 85 },
            { label: '≤ 30 min', score: 70 },
            { label: '≤ 60 min', score: 50 },
            { label: '≤ 120 min', score: 30 },
            { label: '> 120 min', score: 10 },
          ],
        },
        confirmClose: {
          weight: '40%',
          tiers: [
            { label: '≤ 15 min', score: 100 },
            { label: '≤ 30 min', score: 85 },
            { label: '≤ 60 min', score: 70 },
            { label: '≤ 120 min', score: 55 },
            { label: '≤ 240 min', score: 35 },
            { label: '> 240 min', score: 15 },
          ],
        },
      },
    };
  }

  // Helper: average score from an array of performance records
  private avgScore(scores: any[]): number {
    if (scores.length === 0) return 0;
    const sum = scores.reduce((s, r) => s + (Number(r.totalScore) || 0), 0);
    return Math.round((sum / scores.length) * 100) / 100;
  }

  // Helper: average SLA compliance from an array of performance records
  private avgSla(scores: any[]): number {
    const valid = scores.filter(s => s.slaCompliance != null);
    if (!valid.length) return 0;
    return Math.round((valid.reduce((s, r) => s + Number(r.slaCompliance), 0) / valid.length) * 100) / 100;
  }

  // Helper: total job count from an array of performance records
  private sumJobs(scores: any[]): number {
    return scores.reduce((s, r) => s + (Number(r.workVolume) || 0), 0);
  }

  // Helper: group scores by technician and compute avg
  private groupByTechnician(scores: any[]) {
    const map = new Map<number, { name: string; scores: number[]; grades: string[] }>();
    for (const s of scores) {
      const id = s.technicianId;
      if (!map.has(id)) {
        map.set(id, {
          name: s.technician ? `${s.technician.firstName} ${s.technician.lastName}` : `ID ${id}`,
          scores: [],
          grades: [],
        });
      }
      const entry = map.get(id)!;
      entry.scores.push(Number(s.totalScore) || 0);
      if (s.grade) entry.grades.push(s.grade);
    }

    return Array.from(map.entries())
      .map(([technicianId, data]) => {
        const avg = data.scores.reduce((a, b) => a + b, 0) / data.scores.length;
        return {
          technicianId,
          technicianName: data.name,
          avgScore: Math.round(avg * 100) / 100,
          grade: this.getGrade(avg).grade,
          gradeDescription: this.getGrade(avg).description,
          monthsEvaluated: data.scores.length,
        };
      })
      .sort((a, b) => b.avgScore - a.avgScore);
  }

  // Helper: month name
  private monthName(month: number): string {
    const months = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[month] || '';
  }

  /**
   * Get current period (YYYY-MM)
   */
  private getCurrentPeriod(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  /**
   * Format performance response
   */
  private formatPerformanceResponse(score: any) {
    if (!score) return null;

    return {
      technicianId: score.technicianId,
      technicianName: score.technician
        ? `${score.technician.firstName} ${score.technician.lastName}`
        : null,
      period: score.period,
      overallScore: Number(score.totalScore),
      grade: score.grade,
      gradeDescription: score.gradeDescription,
      ranking: score.teamRanking,
      totalTechnicians: score.totalTechnicians,
      metrics: {
        slaCompliance: {
          value: Number(score.slaCompliance),
          score: Number(score.slaScore),
          weight: WEIGHTS.slaCompliance,
          target: TARGETS.slaCompliance,
        },
        workVolume: {
          value: score.workVolume,
          score: Number(score.workVolumeScore),
          weight: WEIGHTS.workVolume,
          target: score.workVolumeTarget,
        },
        resolutionTime: {
          value: Number(score.avgResolutionTime),
          score: Number(score.resolutionTimeScore),
          weight: WEIGHTS.resolutionTime,
          standard: Number(score.resolutionTimeStandard),
          unit: 'hours',
        },
        responseTime: {
          value: Number(score.avgResponseTime),
          score: Number(score.responseTimeScore),
          weight: WEIGHTS.responseTime,
          standard: Number(score.responseTimeStandard),
          unit: 'minutes',
        },
        firstTimeFix: {
          value: Number(score.firstTimeFixRate),
          score: Number(score.firstTimeFixScore),
          weight: WEIGHTS.firstTimeFix,
          target: TARGETS.firstTimeFix,
        },
        reopenRate: {
          value: Number(score.reopenRate),
          score: Number(score.reopenScore),
          weight: WEIGHTS.reopenRate,
          target: TARGETS.reopenRate,
        },
        customerSatisfaction: {
          rating: score.avgCustomerRating ? Number(score.avgCustomerRating) : null,
          totalRatings: score.totalRatings,
          score: score.customerSatisfactionScore ? Number(score.customerSatisfactionScore) : null,
          weight: WEIGHTS.customerSatisfaction,
        },
      },
      bonusPoints: Number(score.totalBonusPoints),
      comparison: {
        teamAvgScore: Number(score.teamAvgScore),
        topPerformerScore: Number(score.topPerformerScore),
      },
      calculatedAt: score.calculatedAt,
    };
  }
}

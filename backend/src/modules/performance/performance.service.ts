// src/modules/performance/performance.service.ts

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { UserRole, IncidentStatus, SlaDefenseStatus, Prisma } from '@prisma/client';

// Grade definitions — score is 0-100, first grade whose min is reached wins
const GRADES = [
  { min: 95, grade: 'A+', description: 'OUTSTANDING' },
  { min: 90, grade: 'A', description: 'EXCELLENT' },
  { min: 85, grade: 'B+', description: 'VERY GOOD' },
  { min: 80, grade: 'B', description: 'GOOD' },
  { min: 75, grade: 'C+', description: 'ABOVE AVERAGE' },
  { min: 70, grade: 'C', description: 'AVERAGE' },
  { min: 60, grade: 'D', description: 'BELOW AVERAGE' },
  { min: 0, grade: 'F', description: 'NEEDS IMPROVEMENT' },
];

// Metric weights. A metric with no data in the period (e.g. no ratings, no SLA jobs)
// is left out and the remaining weights are scaled up to 100%.
const WEIGHTS = {
  slaCompliance: 30,
  workVolume: 20,
  resolutionTime: 20,
  firstTimeFix: 20,
  responseTime: 10,
  customerSatisfaction: 10,
};

// Targets
const TARGETS = {
  slaCompliance: 95, // % of SLA jobs closed within deadline
  workVolumeTeamRatio: 1.25, // jobs ≥ 1.25 × team average = full score (team average = 80)
  firstTimeFix: 95, // % of jobs closed without reopen
  responseOnTime: 90, // % of SLA jobs responded within SLA response time
};

// Job types that never count toward SLA (in addition to JobType.ignoreSla)
const SLA_EXCLUDED_JOB_TYPES = ['Project', 'Preventive Maintenance', 'Adhoc'];

const COMPLETED_STATUSES = [IncidentStatus.CLOSED, IncidentStatus.RESOLVED];
const PRIORITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const;

// How many months back the nightly job recalculates (covers YTD / YTY comparisons)
const RECALC_MONTHS = 24;

type SlaCheckable = {
  jobType: string | null;
  slaDeadline: Date | null;
  resolvedAt: Date | null;
  slaDefenses?: { status: SlaDefenseStatus }[];
};

type MetricWeights = Record<keyof typeof WEIGHTS, number>;

export interface TechnicianScore {
  technicianId: number;
  technicianName: string;
  technicianType: string | null;
  jobs: number;
  sla: { total: number; pass: number; rate: number | null; score: number | null };
  workVolume: { value: number; fullScoreTarget: number; score: number };
  resolution: { count: number; avgHours: number | null; avgTargetHours: number | null; score: number | null };
  firstTimeFix: { rate: number; score: number };
  response: { total: number; onTime: number; rate: number | null; score: number | null };
  customerSatisfaction: { count: number; avg: number | null; score: number | null };
  weights: MetricWeights; // effective weights after leaving out metrics without data
  slaBreakdown: Record<string, { avg: number | null; targetHours: number | null; count: number; label: string }>;
  totalScore: number;
  grade: string;
  gradeDescription: string;
  rank: number;
}

export interface TeamScores {
  scores: TechnicianScore[];
  teamAvgScore: number;
  topScore: number;
  teamAvgJobs: number;
}

@Injectable()
export class PerformanceService implements OnApplicationBootstrap {
  private readonly logger = new Logger(PerformanceService.name);
  private recalculating = false;

  constructor(private readonly prisma: PrismaService) {}

  /** Recalculate stored scores shortly after start-up so history reflects the current formula */
  onApplicationBootstrap() {
    setTimeout(() => this.recalculateRecentPeriods(), 30_000);
  }

  /** Nightly: refresh stored scores used by history / YTD / YTM / YTY / reports */
  @Cron('0 2 * * *')
  async recalculateRecentPeriods() {
    if (this.recalculating) return;
    this.recalculating = true;
    try {
      const now = new Date();
      for (let i = 0; i < RECALC_MONTHS; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        await this.calculateAllPerformance(this.toPeriod(d));
      }
      this.logger.log(`Recalculated technician performance for last ${RECALC_MONTHS} months`);
    } catch (err) {
      this.logger.error(`Performance recalculation failed: ${(err as Error).message}`);
    } finally {
      this.recalculating = false;
    }
  }

  /**
   * Get grade from score
   */
  private getGrade(score: number): { grade: string; description: string } {
    const g = GRADES.find((x) => score >= x.min) ?? GRADES[GRADES.length - 1];
    return { grade: g.grade, description: g.description };
  }

  /**
   * Calculate score based on percentage (0-100), higher is better
   */
  private calculatePercentageScore(value: number, target: number): number {
    if (value >= target) return 100;
    return (value / target) * 100;
  }

  /**
   * Calculate score based on time (where faster is better)
   */
  private calculateTimeScore(value: number, standard: number): number {
    if (value <= standard) return 100;
    if (value >= standard * 2) return 0;
    return 100 - ((value - standard) / standard) * 100;
  }

  // ──────────────────────────────────────────────────
  // SLA RULES (shared by every SLA figure on the dashboard)
  // ──────────────────────────────────────────────────

  /** Job types excluded from SLA: fixed list + job types flagged ignoreSla */
  private async getSlaExcludedJobTypes(): Promise<Set<string>> {
    const ignored = await this.prisma.jobType.findMany({
      where: { ignoreSla: true },
      select: { name: true },
    });
    return new Set([...SLA_EXCLUDED_JOB_TYPES, ...ignored.map((j) => j.name)]);
  }

  /** Counts toward SLA only when the job type has SLA and the job actually has a deadline */
  private isSlaRelevant(inc: SlaCheckable, excluded: Set<string>): boolean {
    if (inc.jobType && excluded.has(inc.jobType)) return false;
    return !!inc.slaDeadline && !!inc.resolvedAt;
  }

  private hasApprovedDefense(inc: SlaCheckable): boolean {
    return !!inc.slaDefenses?.some((d) => d.status === SlaDefenseStatus.APPROVED);
  }

  /** Call only for SLA-relevant incidents — approved defense counts as passed */
  private isSlaPass(inc: SlaCheckable): boolean {
    if (inc.resolvedAt! <= inc.slaDeadline!) return true;
    return this.hasApprovedDefense(inc);
  }

  // ──────────────────────────────────────────────────
  // TECHNICIAN SCORING
  // ──────────────────────────────────────────────────

  /**
   * Score every technician on jobs completed (resolvedAt) within the range.
   * A job counts for the main assignee and every co-assignee.
   */
  async computeScores(startDate: Date, endDate: Date, jobTypes?: string[]): Promise<TeamScores & {
    slaConfigs: { priority: string; name: string; responseTimeMinutes: number; resolutionTimeMinutes: number }[];
    technicians: { id: number; firstName: string; lastName: string; technicianType: string | null; status: string }[];
  }> {
    const [technicians, incidents, excluded, slaConfigs] = await Promise.all([
      this.prisma.user.findMany({
        where: { roles: { some: { role: UserRole.TECHNICIAN } } },
        select: { id: true, firstName: true, lastName: true, technicianType: true, status: true },
      }),
      this.prisma.incident.findMany({
        where: {
          status: { in: COMPLETED_STATUSES },
          resolvedAt: { gte: startDate, lte: endDate },
          ...(jobTypes?.length ? { jobType: { in: jobTypes } } : {}),
        },
        select: {
          jobType: true,
          priority: true,
          createdAt: true,
          slaDeadline: true,
          resolvedAt: true,
          respondedAt: true,
          checkInAt: true,
          reopenCount: true,
          assigneeId: true,
          assignees: { select: { userId: true, assignedAt: true, checkedInAt: true } },
          slaDefenses: { select: { status: true } },
          rating: { select: { rating: true } },
        },
      }),
      this.getSlaExcludedJobTypes(),
      this.prisma.slaConfig.findMany({
        where: { isActive: true },
        select: { priority: true, name: true, responseTimeMinutes: true, resolutionTimeMinutes: true },
      }),
    ]);

    const techMap = new Map(technicians.map((t) => [t.id, t]));
    const cfgMap = new Map(slaConfigs.map((c) => [c.priority as string, c]));

    type Acc = {
      jobs: number;
      firstFix: number;
      slaTotal: number;
      slaPass: number;
      resScores: number[];
      resHours: number[];
      resTargets: number[];
      respTotal: number;
      respOnTime: number;
      ratings: number[];
      onsiteHours: Record<string, number[]>;
    };
    const accs = new Map<number, Acc>();
    const getAcc = (id: number): Acc => {
      let a = accs.get(id);
      if (!a) {
        a = { jobs: 0, firstFix: 0, slaTotal: 0, slaPass: 0, resScores: [], resHours: [], resTargets: [], respTotal: 0, respOnTime: 0, ratings: [], onsiteHours: {} };
        accs.set(id, a);
      }
      return a;
    };

    for (const inc of incidents) {
      const techIds = new Set<number>(inc.assignees.map((a) => a.userId));
      if (inc.assigneeId) techIds.add(inc.assigneeId);

      const slaRelevant = this.isSlaRelevant(inc, excluded);
      const slaPass = slaRelevant && this.isSlaPass(inc);
      const defended = this.hasApprovedDefense(inc);
      const resolvedMs = inc.resolvedAt!.getTime();

      for (const techId of techIds) {
        if (!techMap.has(techId)) continue;
        const a = getAcc(techId);
        const member = inc.assignees.find((m) => m.userId === techId);
        const checkIn = member?.checkedInAt ?? inc.checkInAt;

        a.jobs++;
        if (inc.reopenCount === 0) a.firstFix++;
        if (inc.rating) a.ratings.push(inc.rating.rating);

        if (checkIn && resolvedMs >= checkIn.getTime()) {
          (a.onsiteHours[inc.priority] ||= []).push((resolvedMs - checkIn.getTime()) / 3600000);
        }

        if (!slaRelevant) continue;

        a.slaTotal++;
        if (slaPass) a.slaPass++;

        // Resolution time vs the job's own SLA window (createdAt → slaDeadline)
        const targetMs = inc.slaDeadline!.getTime() - inc.createdAt.getTime();
        const actualMs = resolvedMs - inc.createdAt.getTime();
        if (targetMs > 0) {
          a.resScores.push(defended ? 100 : this.calculateTimeScore(actualMs, targetMs));
          a.resHours.push(actualMs / 3600000);
          a.resTargets.push(targetMs / 3600000);
        }

        // Response on time: first response (accept or check-in) within SLA response time from assignment
        const cfg = cfgMap.get(inc.priority);
        const firstResponse = [inc.respondedAt, checkIn]
          .filter((d): d is Date => !!d)
          .reduce<Date | null>((min, d) => (!min || d < min ? d : min), null);
        if (cfg && firstResponse) {
          const start = member?.assignedAt ?? inc.createdAt;
          a.respTotal++;
          if (firstResponse.getTime() - start.getTime() <= cfg.responseTimeMinutes * 60000) a.respOnTime++;
        }
      }
    }

    const avg = (arr: number[]) => (arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : null);
    const round2 = (v: number) => Math.round(v * 100) / 100;
    const round2n = (v: number | null) => (v === null ? null : round2(v));

    const withJobs = Array.from(accs.entries()).filter(([, a]) => a.jobs > 0);
    const teamAvgJobs = withJobs.length ? withJobs.reduce((s, [, a]) => s + a.jobs, 0) / withJobs.length : 0;
    const fullScoreJobs = teamAvgJobs * TARGETS.workVolumeTeamRatio;

    const scores: TechnicianScore[] = withJobs.map(([techId, a]) => {
      const t = techMap.get(techId)!;

      const slaRate = a.slaTotal ? (a.slaPass / a.slaTotal) * 100 : null;
      const slaScore = slaRate !== null ? this.calculatePercentageScore(slaRate, TARGETS.slaCompliance) : null;
      const volScore = fullScoreJobs > 0 ? Math.min(100, (a.jobs / fullScoreJobs) * 100) : 0;
      const resScore = avg(a.resScores);
      const ftfRate = (a.firstFix / a.jobs) * 100;
      const ftfScore = this.calculatePercentageScore(ftfRate, TARGETS.firstTimeFix);
      const respRate = a.respTotal ? (a.respOnTime / a.respTotal) * 100 : null;
      const respScore = respRate !== null ? this.calculatePercentageScore(respRate, TARGETS.responseOnTime) : null;
      const csatAvg = avg(a.ratings);
      const csatScore = csatAvg !== null ? (csatAvg / 5) * 100 : null;

      const parts: [keyof typeof WEIGHTS, number | null][] = [
        ['slaCompliance', slaScore],
        ['workVolume', volScore],
        ['resolutionTime', resScore],
        ['firstTimeFix', ftfScore],
        ['responseTime', respScore],
        ['customerSatisfaction', csatScore],
      ];
      const weightSum = parts.reduce((s, [k, v]) => (v === null ? s : s + WEIGHTS[k]), 0);
      const weights = {} as MetricWeights;
      let total = 0;
      for (const [k, v] of parts) {
        weights[k] = v === null || weightSum === 0 ? 0 : round2((WEIGHTS[k] / weightSum) * 100);
        if (v !== null && weightSum > 0) total += (v * WEIGHTS[k]) / weightSum;
      }
      const totalScore = round2(Math.max(0, Math.min(100, total)));
      const { grade, description } = this.getGrade(totalScore);

      const slaBreakdown: TechnicianScore['slaBreakdown'] = {};
      for (const p of PRIORITIES) {
        const hours = a.onsiteHours[p] || [];
        const cfg = cfgMap.get(p);
        slaBreakdown[p] = {
          avg: round2n(avg(hours)),
          targetHours: cfg ? cfg.resolutionTimeMinutes / 60 : null,
          count: hours.length,
          label: cfg?.name || p,
        };
      }

      return {
        technicianId: techId,
        technicianName: `${t.firstName} ${t.lastName}`,
        technicianType: t.technicianType,
        jobs: a.jobs,
        sla: { total: a.slaTotal, pass: a.slaPass, rate: round2n(slaRate), score: round2n(slaScore) },
        workVolume: { value: a.jobs, fullScoreTarget: Math.ceil(fullScoreJobs), score: round2(volScore) },
        resolution: {
          count: a.resScores.length,
          avgHours: round2n(avg(a.resHours)),
          avgTargetHours: round2n(avg(a.resTargets)),
          score: round2n(resScore),
        },
        firstTimeFix: { rate: round2(ftfRate), score: round2(ftfScore) },
        response: { total: a.respTotal, onTime: a.respOnTime, rate: round2n(respRate), score: round2n(respScore) },
        customerSatisfaction: { count: a.ratings.length, avg: round2n(csatAvg), score: round2n(csatScore) },
        weights,
        slaBreakdown,
        totalScore,
        grade,
        gradeDescription: description,
        rank: 0,
      };
    });

    scores.sort((x, y) => y.totalScore - x.totalScore || y.jobs - x.jobs);
    scores.forEach((s, i) => (s.rank = i + 1));

    const teamAvgScore = scores.length ? round2(scores.reduce((s, x) => s + x.totalScore, 0) / scores.length) : 0;
    const topScore = scores.length ? scores[0].totalScore : 0;

    return { scores, teamAvgScore, topScore, teamAvgJobs: round2(teamAvgJobs), slaConfigs, technicians };
  }

  /**
   * Get Performance for a Technician — computed live for the month or custom range
   */
  async getTechnicianPerformance(technicianId: number, period?: string, from?: string, to?: string) {
    const technician = await this.prisma.user.findUnique({
      where: { id: technicianId },
      select: { id: true, firstName: true, lastName: true },
    });
    if (!technician) {
      throw new NotFoundException(`ไม่พบ Technician ID: ${technicianId}`);
    }

    const { startDate, endDate, targetPeriod } = this.getDateRange(period, from, to);
    const team = await this.computeScores(startDate, endDate);
    const s = team.scores.find((x) => x.technicianId === technicianId) ?? null;

    return this.formatPerformanceResponse(
      s,
      `${technician.firstName} ${technician.lastName}`,
      technicianId,
      from && to ? `${from} – ${to}` : targetPeriod,
      team,
    );
  }

  /**
   * Recalculate one technician's period. Scores depend on the team average,
   * so the whole team for that period is recalculated.
   */
  async calculatePerformance(technicianId: number, period: string, calculatedById?: number) {
    const technician = await this.prisma.user.findUnique({
      where: { id: technicianId },
      include: { roles: true },
    });
    if (!technician) {
      throw new NotFoundException(`ไม่พบ Technician ID: ${technicianId}`);
    }
    if (!technician.roles.some((r) => r.role === UserRole.TECHNICIAN)) {
      throw new BadRequestException('ผู้ใช้นี้ไม่ใช่ Technician');
    }

    await this.calculateAllPerformance(period, calculatedById);
    return this.getTechnicianPerformance(technicianId, period);
  }

  /**
   * Calculate & store all technicians' scores for a period (YYYY-MM)
   */
  async calculateAllPerformance(period: string, calculatedById?: number) {
    const { startDate, endDate } = this.getDateRange(period);
    const team = await this.computeScores(startDate, endDate);
    const now = new Date();

    await this.prisma.$transaction([
      // Technicians with no completed job in this period have no score
      this.prisma.technicianPerformanceScore.deleteMany({
        where: { period, technicianId: { notIn: team.scores.map((s) => s.technicianId) } },
      }),
      ...team.scores.map((s) => {
        const data = {
          startDate,
          endDate,
          slaCompliance: s.sla.rate,
          slaScore: s.sla.score,
          workVolume: s.jobs,
          workVolumeTarget: s.workVolume.fullScoreTarget,
          workVolumeScore: s.workVolume.score,
          avgResolutionTime: s.resolution.avgHours,
          resolutionTimeStandard: s.resolution.avgTargetHours,
          resolutionTimeScore: s.resolution.score,
          avgResponseTime: s.response.rate,
          responseTimeStandard: TARGETS.responseOnTime,
          responseTimeScore: s.response.score,
          firstTimeFixRate: s.firstTimeFix.rate,
          firstTimeFixScore: s.firstTimeFix.score,
          reopenRate: Math.round((100 - s.firstTimeFix.rate) * 100) / 100,
          reopenScore: s.firstTimeFix.score,
          avgCustomerRating: s.customerSatisfaction.avg,
          totalRatings: s.customerSatisfaction.count,
          customerSatisfactionScore: s.customerSatisfaction.score,
          totalBonusPoints: 0,
          totalScore: s.totalScore,
          grade: s.grade,
          gradeDescription: s.gradeDescription,
          teamRanking: s.rank,
          totalTechnicians: team.scores.length,
          teamAvgScore: team.teamAvgScore,
          topPerformerScore: team.topScore,
          isCalculated: true,
          calculatedAt: now,
          calculatedById: calculatedById ?? null,
        };
        return this.prisma.technicianPerformanceScore.upsert({
          where: { technicianId_period: { technicianId: s.technicianId, period } },
          update: data,
          create: { technicianId: s.technicianId, period, ...data },
        });
      }),
    ]);

    return {
      message: `Calculated performance for ${team.scores.length} technicians`,
      period,
      count: team.scores.length,
    };
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
   * Get Incident Statistics (total, closed, pending, cancelled, SLA pass/fail)
   */
  async getIncidentStats(period?: string, jobTypes?: string[], from?: string, to?: string) {
    const { startDate, endDate, targetPeriod } = this.getDateRange(period, from, to);

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

    // SLA calculation — see isSlaRelevant / isSlaPass
    const excluded = await this.getSlaExcludedJobTypes();
    const slaRelevantCompleted = incidents.filter(i =>
      (i.status === IncidentStatus.CLOSED || i.status === IncidentStatus.RESOLVED) &&
      this.isSlaRelevant(i, excluded)
    );
    const slaPass = slaRelevantCompleted.filter(i => this.isSlaPass(i)).length;
    const slaFail = slaRelevantCompleted.length - slaPass;
    const slaPercent = slaRelevantCompleted.length > 0
      ? Math.round((slaPass / slaRelevantCompleted.length) * 10000) / 100
      : 0;
    // jobs that failed SLA but were saved by an approved defense
    const slaDefenseApproved = slaRelevantCompleted.filter(i =>
      i.resolvedAt! > i.slaDeadline! && this.hasApprovedDefense(i)
    ).length;

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
      slaDefenseApproved,
      byJobType,
    };
  }

  /**
   * Get SLA Monthly Trend for Line Graph (last N months)
   */
  async getSlaTrend(months = 12, jobTypes?: string[]) {
    const now = new Date();
    const result: { period: string; slaPercent: number; total: number; slaPass: number; slaFail: number; slaDefenseApproved: number }[] = [];
    const excluded = await this.getSlaExcludedJobTypes();

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

      const relevant = incidents.filter(inc => this.isSlaRelevant(inc, excluded));
      const total = relevant.length;
      const slaPass = relevant.filter(inc => this.isSlaPass(inc)).length;
      const slaFail = total - slaPass;
      const slaPercent = total > 0 ? Math.round((slaPass / total) * 10000) / 100 : 0;
      const slaDefenseApproved = relevant.filter(inc =>
        inc.resolvedAt! > inc.slaDeadline! && this.hasApprovedDefense(inc)
      ).length;

      result.push({ period, slaPercent, total, slaPass, slaFail, slaDefenseApproved });
    }

    return result;
  }

  /**
   * Leaderboard — computed live from the same scoring as the detail view,
   * so score / grade / columns always match the selected range and job types.
   */
  async getEnhancedLeaderboard(period?: string, limit = 50, sortBy = 'score', jobTypes?: string[], from?: string, to?: string) {
    const { startDate, endDate } = this.getDateRange(period, from, to);
    const team = await this.computeScores(startDate, endDate, jobTypes);

    const entries = team.scores.map((s) => ({
      technicianId: s.technicianId,
      technicianName: s.technicianName,
      technicianType: s.technicianType,
      score: s.totalScore,
      grade: s.grade,
      gradeDescription: s.gradeDescription,
      workVolume: s.jobs,
      slaPercent: s.sla.rate ?? 0,
      avgResolutionTimeHours: s.resolution.avgHours,
      slaResolution: Object.fromEntries(PRIORITIES.map((p) => [p, s.slaBreakdown[p]?.avg ?? null])),
    }));

    // Active technicians without completed jobs are listed at the bottom
    const scoredIds = new Set(team.scores.map((s) => s.technicianId));
    const idle = team.technicians
      .filter((t) => t.status === 'ACTIVE' && !scoredIds.has(t.id))
      .map((t) => ({
        technicianId: t.id,
        technicianName: `${t.firstName} ${t.lastName}`,
        technicianType: t.technicianType,
        score: 0,
        grade: '-',
        gradeDescription: 'ไม่มีงานที่ปิดในช่วงนี้',
        workVolume: 0,
        slaPercent: 0,
        avgResolutionTimeHours: null,
        slaResolution: { CRITICAL: null, HIGH: null, MEDIUM: null, LOW: null },
      }));

    if (sortBy === 'workVolume') {
      entries.sort((a, b) => b.workVolume - a.workVolume);
    } else if (sortBy === 'sla') {
      entries.sort((a, b) => b.slaPercent - a.slaPercent);
    }

    return [...entries, ...idle].slice(0, limit).map((e, i) => ({ ...e, rank: i + 1 }));
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
  async getResolutionTimeStats(period?: string, jobTypes?: string[], from?: string, to?: string) {
    const { startDate, endDate, targetPeriod } = this.getDateRange(period, from, to);
    const excluded = await this.getSlaExcludedJobTypes();

    // Load SLA configs once
    const slaConfigs = await this.prisma.slaConfig.findMany({
      where: { isActive: true },
      orderBy: { id: 'asc' },
      select: { name: true, priority: true, color: true, resolutionTimeMinutes: true },
    });

    const calcByPriority = async (start: Date, end: Date) => {
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
      const slaRelevant = incidents.filter(i => this.isSlaRelevant(i, excluded));
      const slaPassFail: Record<string, { pass: number; fail: number }> = {};
      for (const cfg of slaConfigs) {
        const group = slaRelevant.filter(i => i.priority === cfg.priority);
        const pass = group.filter(i => this.isSlaPass(i)).length;
        slaPassFail[cfg.priority] = { pass, fail: group.length - pass };
      }

      return { overallAvg, byPriority, slaPassFail };
    };

    // Previous period logic — skip when from/to custom range
    let prevPeriod: string | null = null;
    let prevStart: Date | null = null;
    let prevEnd: Date | null = null;

    if (!from || !to) {
      const prevRecord = await this.prisma.incident.findFirst({
        where: {
          createdAt: { lt: new Date(parseInt(targetPeriod.split('-')[0]), parseInt(targetPeriod.split('-')[1]) - 1, 1) },
          status: { in: [IncidentStatus.CLOSED, IncidentStatus.RESOLVED] },
        },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      });
      prevPeriod = prevRecord
        ? `${prevRecord.createdAt.getFullYear()}-${String(prevRecord.createdAt.getMonth() + 1).padStart(2, '0')}`
        : null;
      if (prevPeriod) {
        const [py, pm] = prevPeriod.split('-').map(Number);
        prevStart = new Date(py, pm - 1, 1);
        prevEnd = new Date(py, pm, 0, 23, 59, 59);
      }
    }

    const [current, prev] = await Promise.all([
      calcByPriority(startDate, endDate),
      prevStart && prevEnd ? calcByPriority(prevStart, prevEnd) : Promise.resolve(null),
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

  async getStoreIncidentDetail(storeId: number, period?: string, jobTypes?: string[], from?: string, to?: string) {
    const { startDate, endDate, targetPeriod } = this.getDateRange(period, from, to);

    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      select: { id: true, storeCode: true, name: true },
    });

    const incidents = await this.prisma.incident.findMany({
      where: {
        storeId,
        createdAt: { gte: startDate, lte: endDate },
        status: { not: 'CANCELLED' },
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
  async getTopStores(period?: string, limit = 10, jobTypes?: string[], from?: string, to?: string) {
    const { startDate, endDate } = this.getDateRange(period, from, to);

    const incidents = await this.prisma.incident.findMany({
      where: {
        createdAt: { gte: startDate, lte: endDate },
        status: { not: 'CANCELLED' },
        ...(jobTypes && jobTypes.length > 0 ? { jobType: { in: jobTypes } } : {}),
      },
      select: {
        storeId: true,
        storeName: true,
        storeCode: true,
        status: true,
      },
    });

    const countMap = new Map<number, { count: number; resolved: number; name: string; code: string }>();
    for (const inc of incidents) {
      if (!inc.storeId) continue;
      const isResolved = inc.status === 'RESOLVED' || inc.status === 'CLOSED';
      const entry = countMap.get(inc.storeId);
      if (entry) {
        entry.count++;
        if (isResolved) entry.resolved++;
      } else {
        countMap.set(inc.storeId, {
          count: 1,
          resolved: isResolved ? 1 : 0,
          name: inc.storeName || `Store ${inc.storeId}`,
          code: inc.storeCode || String(inc.storeId),
        });
      }
    }

    return Array.from(countMap.entries())
      .map(([id, v]) => ({ storeId: id, storeCode: v.code, storeName: v.name, count: v.count, resolved: v.resolved }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /**
   * Top N incident categories with the most repair requests in the range
   * (same filter as the equipment boxes: PM and cancelled jobs are not repair requests)
   */
  async getTopEquipment(period?: string, limit = 10, jobTypes?: string[], from?: string, to?: string) {
    const { startDate, endDate } = this.getDateRange(period, from, to);

    const groups = await this.prisma.incident.groupBy({
      by: ['category'],
      where: {
        AND: [this.repeatIncidentWhere(jobTypes), { createdAt: { gte: startDate, lte: endDate } }],
      },
      _count: { _all: true },
    });

    return groups
      .map((g) => ({ name: g.category || 'ไม่ระบุ', count: g._count._all }))
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
  // EQUIPMENT REPEAT ANALYSIS (Box 1 + Box 2)
  // A physical device is identified by its serial number. An equipment record can
  // have its serial overwritten when the device is swapped (see equipment logs),
  // so each incident is attributed to the serial the record had when it was reported.
  // ──────────────────────────────────────────────────

  /** Incidents that count as a repair request for equipment — PM jobs and cancelled are excluded */
  private repeatIncidentWhere(jobTypes?: string[]): Prisma.IncidentWhereInput {
    return {
      status: { notIn: [IncidentStatus.CANCELLED] },
      jobType: jobTypes?.length
        ? { in: jobTypes.filter((jt) => jt !== 'Preventive Maintenance') }
        : { not: 'Preventive Maintenance' },
    };
  }

  private normalizeSerial(sn?: string | null): string {
    const v = (sn || '').trim().toUpperCase();
    return ['', '-', 'N/A', 'NA', 'NONE', 'NULL', '0', 'ไม่มี', 'ไม่ระบุ'].includes(v) ? '' : v;
  }

  /**
   * Group repair incidents by physical device.
   * Only devices currently in service (ACTIVE / MAINTENANCE) are returned.
   * count = incidents + reopens.
   */
  private async buildDeviceGroups(opts: {
    jobTypes?: string[];
    startDate?: Date;
    endDate?: Date;
    equipmentIds?: number[];
  }) {
    const equipmentFilter: Prisma.IncidentWhereInput = opts.equipmentIds
      ? { OR: [{ equipmentId: { in: opts.equipmentIds } }, { equipmentIds: { hasSome: opts.equipmentIds } }] }
      : { OR: [{ equipmentId: { not: null } }, { equipmentIds: { isEmpty: false } }] };

    const incidents = await this.prisma.incident.findMany({
      where: {
        AND: [
          this.repeatIncidentWhere(opts.jobTypes),
          equipmentFilter,
          opts.startDate && opts.endDate ? { createdAt: { gte: opts.startDate, lte: opts.endDate } } : {},
        ],
      },
      select: { id: true, createdAt: true, reopenCount: true, equipmentId: true, equipmentIds: true },
    });

    const incEquip = incidents.map((inc) => {
      const ids = new Set<number>(inc.equipmentIds ?? []);
      if (inc.equipmentId) ids.add(inc.equipmentId);
      return { ...inc, ids };
    });
    const allIds = Array.from(new Set(incEquip.flatMap((i) => Array.from(i.ids))));

    const equipSelect = {
      id: true, name: true, category: true, brand: true, model: true, serialNumber: true, status: true,
      store: { select: { storeCode: true, name: true } },
    } as const;

    const [records, logs] = await Promise.all([
      this.prisma.equipment.findMany({ where: { id: { in: allIds } }, select: equipSelect }),
      this.prisma.equipmentLog.findMany({
        where: { equipmentId: { in: allIds }, action: 'UPDATED' },
        orderBy: { createdAt: 'asc' },
        select: { equipmentId: true, createdAt: true, oldValue: true, newValue: true },
      }),
    ]);
    const recordMap = new Map(records.map((r) => [r.id, r]));

    // Serial-change timeline per equipment record
    const serialChanges = new Map<number, { at: Date; oldSerial: string }[]>();
    for (const log of logs) {
      const oldSerial = (log.oldValue as any)?.serialNumber;
      const newSerial = (log.newValue as any)?.serialNumber;
      if (!oldSerial || !newSerial || this.normalizeSerial(oldSerial) === this.normalizeSerial(newSerial)) continue;
      const list = serialChanges.get(log.equipmentId) ?? [];
      list.push({ at: log.createdAt, oldSerial });
      serialChanges.set(log.equipmentId, list);
    }
    const serialAt = (equipmentId: number, at: Date): string => {
      const change = serialChanges.get(equipmentId)?.find((c) => c.at > at);
      return change ? change.oldSerial : recordMap.get(equipmentId)?.serialNumber ?? '';
    };

    type Group = {
      key: string;
      serial: string;
      equipmentIds: Set<number>;
      incidentIds: Set<string>;
      count: number;
      lastIncidentAt: Date;
    };
    const groups = new Map<string, Group>();
    for (const inc of incEquip) {
      const seenKeys = new Set<string>();
      for (const eid of inc.ids) {
        if (!recordMap.has(eid)) continue;
        const serial = serialAt(eid, inc.createdAt);
        const sn = this.normalizeSerial(serial);
        const key = sn ? `sn:${sn}` : `id:${eid}`;
        let g = groups.get(key);
        if (!g) {
          g = { key, serial, equipmentIds: new Set(), incidentIds: new Set(), count: 0, lastIncidentAt: inc.createdAt };
          groups.set(key, g);
        }
        g.equipmentIds.add(eid);
        if (seenKeys.has(key)) continue; // same device linked twice in one incident
        seenKeys.add(key);
        g.incidentIds.add(inc.id);
        g.count += 1 + (inc.reopenCount ?? 0);
        if (inc.createdAt > g.lastIncidentAt) g.lastIncidentAt = inc.createdAt;
      }
    }

    // Current record of each device (serial may have moved to another record after repair)
    const ownerBySerial = new Map<string, (typeof records)[number]>();
    for (const r of records) {
      const sn = this.normalizeSerial(r.serialNumber);
      if (sn) ownerBySerial.set(sn, r);
    }
    const missingSerials = Array.from(groups.values())
      .filter((g) => g.key.startsWith('sn:') && !ownerBySerial.has(g.key.slice(3)))
      .map((g) => g.serial);
    if (missingSerials.length) {
      const extra = await this.prisma.equipment.findMany({
        where: { serialNumber: { in: missingSerials } },
        select: equipSelect,
      });
      for (const r of extra) ownerBySerial.set(this.normalizeSerial(r.serialNumber), r);
    }

    const inService: string[] = ['ACTIVE', 'MAINTENANCE'];
    return Array.from(groups.values()).flatMap((g) => {
      const owner = g.key.startsWith('sn:')
        ? ownerBySerial.get(g.key.slice(3))
        : recordMap.get(Number(g.key.slice(3)));
      if (!owner || !inService.includes(owner.status)) return [];
      return [{
        key: g.key,
        equipmentId: owner.id,
        equipmentIds: Array.from(g.equipmentIds),
        equipmentName: owner.name,
        category: owner.category || '',
        brand: owner.brand || '-',
        model: owner.model || '-',
        serialNumber: owner.serialNumber || '-',
        status: owner.status,
        storeCode: owner.store?.storeCode || '',
        storeName: owner.store?.name || '',
        count: g.count,
        incidentIds: Array.from(g.incidentIds),
        lastIncidentAt: g.lastIncidentAt,
      }];
    });
  }

  /** Box 1: devices with ≥ 2 repair requests within the selected range */
  async getTopActiveEquipment(period?: string, limit = 10, jobTypes?: string[], from?: string, to?: string) {
    const { startDate, endDate } = this.getDateRange(period, from, to);
    const groups = await this.buildDeviceGroups({ jobTypes, startDate, endDate });
    return groups
      .filter((g) => g.count >= 2)
      .sort((a, b) => b.count - a.count || b.lastIncidentAt.getTime() - a.lastIncidentAt.getTime())
      .slice(0, limit)
      .map(({ incidentIds, ...g }) => g);
  }

  /** Box 2: devices with > 2 repair requests (all time, or within range) */
  async getEquipmentRepeatIncidents(period?: string, jobTypes?: string[], from?: string, to?: string, allTime?: boolean) {
    const range = allTime ? {} : this.getDateRange(period, from, to);
    const groups = await this.buildDeviceGroups({ jobTypes, ...range });
    return groups
      .filter((g) => g.count > 2)
      .sort((a, b) => b.count - a.count || b.lastIncidentAt.getTime() - a.lastIncidentAt.getTime())
      .map(({ incidentIds, ...g }) => g);
  }

  /** Incidents attributed to one device (same grouping as Box 1 / Box 2) */
  async getEquipmentRepeatDetail(equipmentIds: number[], jobTypes?: string[], key?: string, from?: string, to?: string) {
    const range = from && to ? this.getDateRange(undefined, from, to) : {};
    const groups = await this.buildDeviceGroups({ jobTypes, equipmentIds, ...range });
    const selected = key ? groups.filter((g) => g.key === key) : groups;
    const incidentIds = Array.from(new Set(selected.flatMap((g) => g.incidentIds)));
    const head = selected[0];

    const incidents = await this.prisma.incident.findMany({
      where: { id: { in: incidentIds } },
      orderBy: { createdAt: 'desc' },
      select: {
        ticketNumber: true, title: true, resolutionNote: true, status: true, reopenCount: true,
        incidentDate: true, createdAt: true, resolvedAt: true,
        storeCode: true, storeName: true,
        assignee: { select: { firstName: true, lastName: true } },
        resolvedBy: { select: { firstName: true, lastName: true } },
        assignees: { select: { user: { select: { firstName: true, lastName: true } } } },
      },
    });

    return {
      equipmentName: head?.equipmentName || '',
      brand: head && head.brand !== '-' ? head.brand : '',
      model: head && head.model !== '-' ? head.model : '',
      serialNumber: head && head.serialNumber !== '-' ? head.serialNumber : '',
      count: head?.count ?? 0,
      incidents: incidents.map((inc, idx) => ({
        no: idx + 1,
        incidentDate: inc.incidentDate || inc.createdAt,
        incidentNo: inc.ticketNumber,
        store: `${inc.storeCode || ''} ${inc.storeName || ''}`.trim() || '-',
        title: inc.title,
        status: inc.status,
        reopenCount: inc.reopenCount,
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

  async getHelpdeskStats(period?: string, jobTypes?: string[], from?: string, to?: string) {
    const { startDate, endDate, targetPeriod } = this.getDateRange(period, from, to);

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

  async getHelpdeskLeaderboard(period?: string, jobTypes?: string[], from?: string, to?: string) {
    const { startDate, endDate, targetPeriod } = this.getDateRange(period, from, to);

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

    const results = Array.from(map.values()).filter(hd => hd.totalCreated > 0 || hd.totalConfirmed > 0).map(hd => {
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
   * Resolve date range from either explicit from/to dates or a period string
   */
  private getDateRange(period?: string, from?: string, to?: string): { startDate: Date; endDate: Date; targetPeriod: string } {
    if (from && to) {
      const startDate = new Date(from + 'T00:00:00');
      const endDate = new Date(to + 'T23:59:59');
      return { startDate, endDate, targetPeriod: from.substring(0, 7) };
    }
    const targetPeriod = period || this.getCurrentPeriod();
    const [year, month] = targetPeriod.split('-').map(Number);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);
    return { startDate, endDate, targetPeriod };
  }

  private toPeriod(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  /**
   * Format performance response (technician detail view)
   */
  private formatPerformanceResponse(
    s: TechnicianScore | null,
    technicianName: string,
    technicianId: number,
    period: string,
    team: Awaited<ReturnType<PerformanceService['computeScores']>>,
  ) {
    const slaBreakdown =
      s?.slaBreakdown ??
      Object.fromEntries(
        PRIORITIES.map((p) => {
          const cfg = team.slaConfigs.find((c) => c.priority === p);
          return [p, { avg: null, targetHours: cfg ? cfg.resolutionTimeMinutes / 60 : null, count: 0, label: cfg?.name || p }];
        }),
      );

    return {
      technicianId,
      technicianName,
      period,
      overallScore: s?.totalScore ?? 0,
      grade: s?.grade ?? '-',
      gradeDescription: s?.gradeDescription ?? 'ไม่มีงานที่ปิดในช่วงนี้',
      ranking: s?.rank ?? null,
      totalTechnicians: team.scores.length,
      metrics: {
        slaCompliance: {
          value: s?.sla.rate ?? null,
          score: s?.sla.score ?? 0,
          weight: s?.weights.slaCompliance ?? WEIGHTS.slaCompliance,
          target: TARGETS.slaCompliance,
          total: s?.sla.total ?? 0,
          pass: s?.sla.pass ?? 0,
        },
        workVolume: {
          value: s?.jobs ?? 0,
          score: s?.workVolume.score ?? 0,
          weight: s?.weights.workVolume ?? WEIGHTS.workVolume,
          target: s?.workVolume.fullScoreTarget ?? Math.ceil(team.teamAvgJobs * TARGETS.workVolumeTeamRatio),
          teamAvg: team.teamAvgJobs,
        },
        resolutionTime: {
          value: s?.resolution.avgHours ?? null,
          score: s?.resolution.score ?? 0,
          weight: s?.weights.resolutionTime ?? WEIGHTS.resolutionTime,
          standard: s?.resolution.avgTargetHours ?? null,
          count: s?.resolution.count ?? 0,
          unit: 'hours',
        },
        responseTime: {
          value: s?.response.rate ?? null,
          score: s?.response.score ?? 0,
          weight: s?.weights.responseTime ?? WEIGHTS.responseTime,
          standard: TARGETS.responseOnTime,
          total: s?.response.total ?? 0,
          onTime: s?.response.onTime ?? 0,
          unit: 'percent',
        },
        firstTimeFix: {
          value: s?.firstTimeFix.rate ?? null,
          score: s?.firstTimeFix.score ?? 0,
          weight: s?.weights.firstTimeFix ?? WEIGHTS.firstTimeFix,
          target: TARGETS.firstTimeFix,
        },
        customerSatisfaction: {
          rating: s?.customerSatisfaction.avg ?? null,
          totalRatings: s?.customerSatisfaction.count ?? 0,
          score: s?.customerSatisfaction.score ?? null,
          weight: s?.weights.customerSatisfaction ?? 0,
        },
      },
      bonusPoints: 0,
      comparison: {
        teamAvgScore: team.teamAvgScore,
        topPerformerScore: team.topScore,
      },
      calculatedAt: new Date(),
      slaBreakdown,
    };
  }
}

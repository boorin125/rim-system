// src/modules/ratings/ratings.service.ts

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { SubmitRatingDto } from './dto';
import { v4 as uuidv4 } from 'uuid';
import { NotificationsService } from '../../notifications/notifications.service';

// Rating Token หมดอายุใน 30 วัน
const RATING_TOKEN_EXPIRY_DAYS = 30;

// Auto-rate 5 stars after 3 days without response
const AUTO_RATE_DAYS = 3;

@Injectable()
export class RatingsService {
  private readonly logger = new Logger(RatingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Generate Rating Token for an Incident (when closed)
   * Called internally when incident is confirmed/closed
   */
  async generateRatingToken(incidentId: string): Promise<string> {
    const incident = await this.prisma.incident.findUnique({
      where: { id: incidentId },
    });

    if (!incident) {
      throw new NotFoundException(`ไม่พบ Incident ID: ${incidentId}`);
    }

    // Check if already has rating
    const existingRating = await this.prisma.incidentRating.findUnique({
      where: { incidentId },
    });

    if (existingRating) {
      throw new BadRequestException('Incident นี้ได้รับการประเมินแล้ว');
    }

    // Generate new UUID token
    const token = uuidv4();
    const now = new Date();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + RATING_TOKEN_EXPIRY_DAYS);

    // Update incident with token
    await this.prisma.incident.update({
      where: { id: incidentId },
      data: {
        ratingToken: token,
        ratingTokenCreatedAt: now,
        ratingTokenExpiresAt: expiresAt,
      },
    });

    return token;
  }

  /**
   * Get Incident Info by Rating Token (Public)
   * Returns basic info for rating page
   */
  async getIncidentByToken(token: string) {
    const incident = await this.prisma.incident.findUnique({
      where: { ratingToken: token },
      include: {
        store: {
          select: {
            id: true,
            storeCode: true,
            name: true,
          },
        },
        assignee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        rating: true,
      },
    });

    if (!incident) {
      throw new NotFoundException('ลิงก์ประเมินไม่ถูกต้องหรือหมดอายุแล้ว');
    }

    // Check if token expired
    if (incident.ratingTokenExpiresAt && new Date() > incident.ratingTokenExpiresAt) {
      throw new BadRequestException('ลิงก์ประเมินหมดอายุแล้ว');
    }

    // Check if already rated
    if (incident.rating) {
      return {
        alreadyRated: true,
        incident: {
          ticketNumber: incident.ticketNumber,
          title: incident.title,
        },
        rating: {
          rating: incident.rating.rating,
          comment: incident.rating.comment,
          createdAt: incident.rating.createdAt,
        },
      };
    }

    // Check if 3-day submission window has passed
    let submissionExpired = false;
    if (incident.ratingTokenCreatedAt) {
      const threeDaysAfter = new Date(incident.ratingTokenCreatedAt);
      threeDaysAfter.setDate(threeDaysAfter.getDate() + AUTO_RATE_DAYS);
      submissionExpired = new Date() > threeDaysAfter;
    }

    return {
      alreadyRated: false,
      submissionExpired,
      incident: {
        ticketNumber: incident.ticketNumber,
        title: incident.title,
        description: incident.description,
        category: incident.category,
        closedAt: incident.confirmedAt,
        store: incident.store,
        technician: incident.assignee
          ? {
              firstName: incident.assignee.firstName,
              lastName: incident.assignee.lastName,
            }
          : null,
      },
    };
  }

  /**
   * Submit Rating via Public Link (No Auth Required)
   */
  async submitRating(
    token: string,
    dto: SubmitRatingDto,
    raterIp?: string,
    userAgent?: string,
  ) {
    const incident = await this.prisma.incident.findUnique({
      where: { ratingToken: token },
      include: {
        assignee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        rating: true,
      },
    });

    if (!incident) {
      throw new NotFoundException('ลิงก์ประเมินไม่ถูกต้องหรือหมดอายุแล้ว');
    }

    // Check if token expired
    if (incident.ratingTokenExpiresAt && new Date() > incident.ratingTokenExpiresAt) {
      throw new BadRequestException('ลิงก์ประเมินหมดอายุแล้ว');
    }

    // Check if already rated
    if (incident.rating) {
      throw new BadRequestException('Incident นี้ได้รับการประเมินแล้ว');
    }

    // Check if 3-day submission window has passed
    if (incident.ratingTokenCreatedAt) {
      const threeDaysAfter = new Date(incident.ratingTokenCreatedAt);
      threeDaysAfter.setDate(threeDaysAfter.getDate() + AUTO_RATE_DAYS);
      if (new Date() > threeDaysAfter) {
        throw new BadRequestException('ระยะเวลาการประเมินหมดอายุแล้ว (เกิน 3 วัน)');
      }
    }

    // Create rating
    let rating: any;
    try {
      rating = await this.prisma.incidentRating.create({
        data: {
          incidentId: incident.id,
          rating: dto.rating,
          comment: dto.comment,
          qualityRating: dto.qualityRating,
          professionalismRating: dto.professionalismRating,
          politenessRating: dto.politenessRating,
          raterName: dto.raterName,
          raterEmail: dto.raterEmail,
          raterIp,
          userAgent,
        },
      });
    } catch (err: any) {
      this.logger.error('Failed to create incidentRating:', err?.message || err);
      // P2002 = unique constraint violation (already rated)
      if (err?.code === 'P2002') {
        throw new BadRequestException('Incident นี้ได้รับการประเมินแล้ว');
      }
      throw new BadRequestException(`ไม่สามารถบันทึกการประเมินได้: ${err?.message || 'DB error'}`);
    }

    // Update technician's cumulative rating: new = (current + newRating) / 2
    if (incident.assigneeId) {
      try {
        const technician = await this.prisma.user.findUnique({
          where: { id: incident.assigneeId },
          select: { cumulativeRating: true },
        });
        const currentRating = technician?.cumulativeRating ?? 5.0;
        const newCumulative = (currentRating + dto.rating) / 2;
        await this.prisma.user.update({
          where: { id: incident.assigneeId },
          data: { cumulativeRating: Math.round(newCumulative * 100) / 100 },
        });
      } catch (err) {
        this.logger.error('Failed to update cumulativeRating:', err);
        // Non-fatal: rating was already saved
      }
    }

    // Send notification to technician (non-fatal)
    if (incident.assigneeId) {
      this.notificationsService
        .createNotification(
          incident.assigneeId,
          'INCIDENT_CONFIRMED',
          'คุณได้รับคะแนนประเมิน!',
          `Incident ${incident.ticketNumber} ได้รับการประเมิน ${dto.rating} ดาว${dto.comment ? `: "${dto.comment}"` : ''}`,
          incident.id,
        )
        .catch((err) => this.logger.error('Failed to send rating notification:', err));
    }

    return {
      message: 'ขอบคุณสำหรับการประเมิน!',
      rating: {
        rating: rating.rating,
        comment: rating.comment,
      },
    };
  }

  /**
   * Check Rating Status by Token (Public)
   */
  async checkRatingStatus(token: string) {
    const incident = await this.prisma.incident.findUnique({
      where: { ratingToken: token },
      include: {
        rating: true,
      },
    });

    if (!incident) {
      throw new NotFoundException('ลิงก์ไม่ถูกต้อง');
    }

    const isExpired = incident.ratingTokenExpiresAt && new Date() > incident.ratingTokenExpiresAt;

    return {
      ticketNumber: incident.ticketNumber,
      isRated: !!incident.rating,
      isExpired,
      expiresAt: incident.ratingTokenExpiresAt,
    };
  }

  /**
   * Get Rating for an Incident (Protected)
   */
  async getRatingByIncident(incidentId: string) {
    const rating = await this.prisma.incidentRating.findUnique({
      where: { incidentId },
      include: {
        incident: {
          select: {
            ticketNumber: true,
            title: true,
          },
        },
        ratedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!rating) {
      return null;
    }

    return rating;
  }

  /**
   * Get All Ratings (Admin)
   */
  async findAll(query?: {
    page?: number;
    limit?: number;
    startDate?: string;
    endDate?: string;
    minRating?: number;
    maxRating?: number;
    technicianId?: number;
  }) {
    const page = query?.page || 1;
    const limit = query?.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};

    // Date filter
    if (query?.startDate || query?.endDate) {
      where.createdAt = {};
      if (query.startDate) {
        where.createdAt.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        where.createdAt.lte = new Date(query.endDate);
      }
    }

    // Rating filter
    if (query?.minRating) {
      where.rating = { ...where.rating, gte: query.minRating };
    }
    if (query?.maxRating) {
      where.rating = { ...where.rating, lte: query.maxRating };
    }

    // Technician filter
    if (query?.technicianId) {
      where.incident = {
        assigneeId: query.technicianId,
      };
    }

    const [ratings, total] = await Promise.all([
      this.prisma.incidentRating.findMany({
        where,
        include: {
          incident: {
            select: {
              id: true,
              ticketNumber: true,
              title: true,
              assignee: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                },
              },
              store: {
                select: {
                  id: true,
                  storeCode: true,
                  name: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.incidentRating.count({ where }),
    ]);

    return {
      data: ratings,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get Rating Statistics
   */
  async getStats(query?: {
    startDate?: string;
    endDate?: string;
    technicianId?: number;
  }) {
    const where: any = {};

    // Date filter
    if (query?.startDate || query?.endDate) {
      where.createdAt = {};
      if (query.startDate) {
        where.createdAt.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        where.createdAt.lte = new Date(query.endDate);
      }
    }

    // Technician filter
    if (query?.technicianId) {
      where.incident = {
        assigneeId: query.technicianId,
      };
    }

    // Get aggregate stats
    const aggregate = await this.prisma.incidentRating.aggregate({
      where,
      _avg: {
        rating: true,
        qualityRating: true,
        professionalismRating: true,
        politenessRating: true,
      },
      _count: {
        id: true,
      },
    });

    // Get distribution
    const distribution = await this.prisma.incidentRating.groupBy({
      by: ['rating'],
      where,
      _count: {
        id: true,
      },
      orderBy: {
        rating: 'desc',
      },
    });

    // Format distribution
    const distributionMap = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    distribution.forEach((item) => {
      distributionMap[item.rating as keyof typeof distributionMap] = item._count.id;
    });

    // Calculate percentages
    const total = aggregate._count.id;
    const distributionPercent = {
      5: total > 0 ? Math.round((distributionMap[5] / total) * 100) : 0,
      4: total > 0 ? Math.round((distributionMap[4] / total) * 100) : 0,
      3: total > 0 ? Math.round((distributionMap[3] / total) * 100) : 0,
      2: total > 0 ? Math.round((distributionMap[2] / total) * 100) : 0,
      1: total > 0 ? Math.round((distributionMap[1] / total) * 100) : 0,
    };

    return {
      totalRatings: total,
      averageRating: aggregate._avg.rating
        ? Math.round(aggregate._avg.rating * 100) / 100
        : 0,
      averages: {
        overall: aggregate._avg.rating
          ? Math.round(aggregate._avg.rating * 100) / 100
          : 0,
        quality: aggregate._avg.qualityRating
          ? Math.round(aggregate._avg.qualityRating * 100) / 100
          : null,
        professionalism: aggregate._avg.professionalismRating
          ? Math.round(aggregate._avg.professionalismRating * 100) / 100
          : null,
        politeness: aggregate._avg.politenessRating
          ? Math.round(aggregate._avg.politenessRating * 100) / 100
          : null,
      },
      distribution: distributionMap,
      distributionPercent,
    };
  }

  /**
   * Get Technician's Ratings
   */
  async getTechnicianRatings(technicianId: number, limit = 10) {
    const ratings = await this.prisma.incidentRating.findMany({
      where: {
        incident: {
          assigneeId: technicianId,
        },
      },
      include: {
        incident: {
          select: {
            id: true,
            ticketNumber: true,
            title: true,
            store: {
              select: {
                name: true,
                storeCode: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    // Get stats
    const stats = await this.getStats({ technicianId });

    return {
      ratings,
      stats,
    };
  }

  /**
   * Resend Rating Email (Admin)
   */
  async resendRatingEmail(incidentId: string) {
    const incident = await this.prisma.incident.findUnique({
      where: { id: incidentId },
      include: {
        rating: true,
        createdBy: {
          select: {
            email: true,
          },
        },
      },
    });

    if (!incident) {
      throw new NotFoundException(`ไม่พบ Incident ID: ${incidentId}`);
    }

    if (incident.rating) {
      throw new BadRequestException('Incident นี้ได้รับการประเมินแล้ว');
    }

    // Generate new token if expired or doesn't exist
    let token = incident.ratingToken;
    if (!token || (incident.ratingTokenExpiresAt && new Date() > incident.ratingTokenExpiresAt)) {
      token = await this.generateRatingToken(incidentId);
    }

    // Update email sent timestamp
    await this.prisma.incident.update({
      where: { id: incidentId },
      data: {
        ratingEmailSentAt: new Date(),
      },
    });

    // TODO: Send email via EmailService
    // For now, just return the token for manual testing

    return {
      message: 'Rating link generated successfully',
      token,
      ratingUrl: `/rate/${token}`,
    };
  }

  /**
   * Cron Job: Auto-rate 5 stars for incidents not rated within 3 days
   * Runs every day at 03:00 AM
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async autoRateExpiredIncidents() {
    this.logger.log('Running auto-rate cron job...');

    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - AUTO_RATE_DAYS);

    // Find closed incidents with rating token created > 3 days ago, that haven't been rated
    const unratedIncidents = await this.prisma.incident.findMany({
      where: {
        ratingToken: { not: null },
        ratingTokenCreatedAt: { lte: threeDaysAgo },
        ratingEmailSentAt: { not: null },
        status: 'CLOSED',
        rating: null, // Not rated yet
      },
      include: {
        assignee: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    if (unratedIncidents.length === 0) {
      this.logger.log('No expired unrated incidents found.');
      return;
    }

    this.logger.log(`Found ${unratedIncidents.length} incidents to auto-rate.`);

    let autoRatedCount = 0;

    for (const incident of unratedIncidents) {
      try {
        await this.prisma.incidentRating.create({
          data: {
            incidentId: incident.id,
            rating: 5,
            comment: 'Auto-rated: No response within 3 days',
            qualityRating: 5,
            professionalismRating: 5,
            politenessRating: 5,
            ratedById: null,
            raterName: 'System (Auto)',
            raterEmail: null,
            raterIp: '0.0.0.0',
            userAgent: 'RIM-AutoRate-CronJob',
          },
        });

        // Update technician's cumulative rating: (current + 5) / 2
        if (incident.assigneeId) {
          const tech = await this.prisma.user.findUnique({
            where: { id: incident.assigneeId },
            select: { cumulativeRating: true },
          });
          const current = tech?.cumulativeRating ?? 5.0;
          const newCumulative = (current + 5) / 2;
          await this.prisma.user.update({
            where: { id: incident.assigneeId },
            data: { cumulativeRating: Math.round(newCumulative * 100) / 100 },
          });
        }

        autoRatedCount++;
        this.logger.log(`Auto-rated incident ${incident.ticketNumber} with 5 stars`);
      } catch (err) {
        this.logger.error(`Failed to auto-rate incident ${incident.id}:`, err);
      }
    }

    this.logger.log(`Auto-rating complete. Rated ${autoRatedCount}/${unratedIncidents.length} incidents.`);
  }
}

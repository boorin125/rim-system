// src/modules/outsource/outsource.service.ts

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';
import {
  CreateOutsourceJobDto,
  UpdateOutsourceJobDto,
  SubmitBidDto,
  AwardJobDto,
  CompleteJobDto,
  VerifyJobDto,
  ProcessPaymentDto,
  RateJobDto,
  ApproveJobDto,
  SubmitDocumentsDto,
} from './dto';
import { OutsourceJobStatus, BidStatus, TechnicianType, UserRole, NotificationType } from '@prisma/client';

@Injectable()
export class OutsourceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Generate unique job code
   */
  private async generateJobCode(): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');

    const lastJob = await this.prisma.outsourceJob.findFirst({
      where: {
        jobCode: {
          startsWith: `OUT-${dateStr}`,
        },
      },
      orderBy: { jobCode: 'desc' },
    });

    let sequence = 1;
    if (lastJob) {
      const lastSequence = parseInt(lastJob.jobCode.slice(-4), 10);
      sequence = lastSequence + 1;
    }

    return `OUT-${dateStr}-${String(sequence).padStart(4, '0')}`;
  }

  /**
   * Create new outsource job (IT_MANAGER, HELP_DESK)
   */
  async createJob(userId: number, dto: CreateOutsourceJobDto) {
    // Verify incident exists
    const incident = await this.prisma.incident.findUnique({
      where: { id: dto.incidentId },
      include: { store: true },
    });

    if (!incident) {
      throw new NotFoundException(`ไม่พบ Incident ID: ${dto.incidentId}`);
    }

    // Prevent duplicate: check if active outsource job already exists for this incident
    const existingJob = await this.prisma.outsourceJob.findFirst({
      where: {
        incidentId: dto.incidentId,
        status: { notIn: ['CANCELLED'] },
      },
    });

    if (existingJob) {
      throw new BadRequestException(
        `Incident นี้มีงาน Outsource อยู่แล้ว (${existingJob.jobCode}) ไม่สามารถสร้างซ้ำได้`,
      );
    }

    const jobType = dto.jobType || 'MARKETPLACE';

    // Validate DIRECT_ASSIGN requires assignToId
    if (jobType === 'DIRECT_ASSIGN' && !dto.assignToId) {
      throw new BadRequestException('กรุณาเลือกช่าง Outsource สำหรับการมอบหมายงานเจาะจง');
    }

    // If DIRECT_ASSIGN, verify technician is OUTSOURCE type
    if (jobType === 'DIRECT_ASSIGN' && dto.assignToId) {
      const targetTech = await this.prisma.user.findUnique({
        where: { id: dto.assignToId },
        select: { technicianType: true, status: true },
      });
      if (!targetTech || targetTech.technicianType !== 'OUTSOURCE') {
        throw new BadRequestException('ผู้ที่เลือกไม่ใช่ช่าง Outsource');
      }
      if (targetTech.status !== 'ACTIVE') {
        throw new BadRequestException('ช่าง Outsource นี้ไม่อยู่ในสถานะ Active');
      }
    }

    const jobCode = await this.generateJobCode();

    const job = await this.prisma.outsourceJob.create({
      data: {
        incidentId: dto.incidentId,
        jobCode,
        title: dto.title,
        description: dto.description,
        requirements: dto.requirements,
        location: dto.location || `${incident.store.name} - ${incident.store.address || ''}`,
        estimatedHours: dto.estimatedHours,
        budgetMin: dto.budgetMin,
        budgetMax: dto.budgetMax,
        agreedPrice: dto.agreedPrice,
        deadline: dto.deadline ? new Date(dto.deadline) : null,
        urgencyLevel: dto.urgencyLevel || 'NORMAL',
        jobType,
        status: 'PENDING_APPROVAL',
        approvalStatus: 'PENDING',
        // For DIRECT_ASSIGN, pre-fill awardedToId (will be confirmed on approval)
        awardedToId: jobType === 'DIRECT_ASSIGN' ? dto.assignToId : null,
        postedById: userId,
      },
      include: {
        incident: {
          include: { store: true },
        },
        postedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
        awardedTo: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    // Notify IT_MANAGER(s) for approval
    const itManagers = await this.prisma.user.findMany({
      where: {
        roles: { some: { role: UserRole.IT_MANAGER } },
        status: 'ACTIVE',
      },
      select: { id: true },
    });

    for (const mgr of itManagers) {
      await this.notificationsService.createNotification(
        mgr.id,
        'SYSTEM_ALERT',
        'งาน Outsource รออนุมัติ',
        `งาน ${jobCode}: ${job.title} (${jobType === 'DIRECT_ASSIGN' ? 'มอบหมายเจาะจง' : 'Marketplace'}) รอการอนุมัติ`,
        dto.incidentId,
        `/dashboard/outsource/${job.id}`,
      );
    }

    return job;
  }

  /**
   * Approve or reject outsource job (IT_MANAGER only)
   */
  async approveJob(jobId: number, userId: number, dto: ApproveJobDto) {
    const job = await this.prisma.outsourceJob.findUnique({
      where: { id: jobId },
      include: {
        awardedTo: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    if (!job) {
      throw new NotFoundException(`ไม่พบงาน Outsource ID: ${jobId}`);
    }

    if (job.status !== 'PENDING_APPROVAL') {
      throw new BadRequestException('งานนี้ไม่อยู่ในสถานะรออนุมัติ');
    }

    if (dto.action === 'APPROVED') {
      if (job.jobType === 'MARKETPLACE') {
        // Marketplace: OPEN for bidding/accepting
        const updatedJob = await this.prisma.outsourceJob.update({
          where: { id: jobId },
          data: {
            status: 'OPEN',
            approvalStatus: 'APPROVED',
            approvedById: userId,
            approvedAt: new Date(),
          },
          include: {
            incident: { include: { store: true } },
            postedBy: { select: { id: true, firstName: true, lastName: true } },
          },
        });

        // Update incident status to OUTSOURCED
        await this.prisma.incident.update({
          where: { id: job.incidentId },
          data: { status: 'OUTSOURCED' },
        });

        // Notify all OUTSOURCE technicians
        const outsourceTechnicians = await this.prisma.user.findMany({
          where: {
            technicianType: TechnicianType.OUTSOURCE,
            status: 'ACTIVE',
          },
          select: { id: true },
        });

        for (const tech of outsourceTechnicians) {
          await this.notificationsService.createNotification(
            tech.id,
            'SYSTEM_ALERT',
            'งาน Outsource ใหม่!',
            `มีงาน Outsource ใหม่: ${job.title} (${job.jobCode})`,
            job.incidentId,
          );
        }

        // Notify poster
        await this.notificationsService.createNotification(
          job.postedById,
          'SYSTEM_ALERT',
          'งาน Outsource ได้รับอนุมัติ',
          `งาน ${job.jobCode} ได้รับอนุมัติแล้ว เปิดรับช่างใน Marketplace`,
          job.incidentId,
        );

        return updatedJob;
      } else {
        // DIRECT_ASSIGN: Award directly to selected technician
        if (!job.awardedToId) {
          throw new BadRequestException('ไม่พบช่างที่มอบหมาย');
        }

        const assignedTech = await this.prisma.user.findUnique({
          where: { id: job.awardedToId },
          select: { technicianType: true },
        });

        const updatedJob = await this.prisma.outsourceJob.update({
          where: { id: jobId },
          data: {
            status: 'AWARDED',
            approvalStatus: 'APPROVED',
            approvedById: userId,
            approvedAt: new Date(),
            awardedAt: new Date(),
            awardedById: userId,
            technicianTypeAtAward: assignedTech?.technicianType,
          },
          include: {
            incident: { include: { store: true } },
            postedBy: { select: { id: true, firstName: true, lastName: true } },
            awardedTo: { select: { id: true, firstName: true, lastName: true } },
          },
        });

        // Update incident
        await this.prisma.incident.update({
          where: { id: job.incidentId },
          data: {
            status: 'ASSIGNED',
            assigneeId: job.awardedToId,
          },
        });

        // Create IncidentAssignee record so the job appears in technician's "My Incidents"
        await this.prisma.incidentAssignee.upsert({
          where: { incidentId_userId: { incidentId: job.incidentId, userId: job.awardedToId } },
          create: { incidentId: job.incidentId, userId: job.awardedToId },
          update: {},
        });

        // Notify assigned technician
        await this.notificationsService.createNotification(
          job.awardedToId,
          'INCIDENT_ASSIGNED',
          'คุณได้รับมอบหมายงาน Outsource!',
          `งาน ${job.jobCode}: ${job.title} ถูกมอบหมายให้คุณ`,
          job.incidentId,
        );

        // Notify poster
        await this.notificationsService.createNotification(
          job.postedById,
          'SYSTEM_ALERT',
          'งาน Outsource ได้รับอนุมัติ',
          `งาน ${job.jobCode} อนุมัติแล้ว มอบหมายให้ ${job.awardedTo?.firstName} ${job.awardedTo?.lastName}`,
          job.incidentId,
        );

        return updatedJob;
      }
    } else {
      // REJECTED
      const updatedJob = await this.prisma.outsourceJob.update({
        where: { id: jobId },
        data: {
          status: 'CANCELLED',
          approvalStatus: 'REJECTED',
          approvedById: userId,
          approvedAt: new Date(),
          rejectionReason: dto.rejectionReason,
          // Clear pre-assigned technician for DIRECT_ASSIGN
          awardedToId: null,
        },
        include: {
          incident: { include: { store: true } },
          postedBy: { select: { id: true, firstName: true, lastName: true } },
        },
      });

      // Notify poster
      await this.notificationsService.createNotification(
        job.postedById,
        'SYSTEM_ALERT',
        'งาน Outsource ถูกปฏิเสธ',
        `งาน ${job.jobCode} ถูกปฏิเสธ${dto.rejectionReason ? ': ' + dto.rejectionReason : ''}`,
        job.incidentId,
      );

      return updatedJob;
    }
  }

  /**
   * Update outsource job
   */
  async updateJob(jobId: number, userId: number, dto: UpdateOutsourceJobDto) {
    const job = await this.prisma.outsourceJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new NotFoundException(`ไม่พบงาน Outsource ID: ${jobId}`);
    }

    if (!['DRAFT', 'OPEN'].includes(job.status)) {
      throw new BadRequestException('ไม่สามารถแก้ไขงานที่ดำเนินการแล้ว');
    }

    return this.prisma.outsourceJob.update({
      where: { id: jobId },
      data: {
        title: dto.title,
        description: dto.description,
        requirements: dto.requirements,
        location: dto.location,
        estimatedHours: dto.estimatedHours,
        budgetMin: dto.budgetMin,
        budgetMax: dto.budgetMax,
        deadline: dto.deadline ? new Date(dto.deadline) : undefined,
        urgencyLevel: dto.urgencyLevel,
      },
      include: {
        incident: { include: { store: true } },
        bids: {
          include: {
            technician: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        },
      },
    });
  }

  /**
   * Get all open jobs (for OUTSOURCE technicians)
   * Filtered by responsibleProvinces if the technician has set preferred provinces.
   */
  async getOpenJobs(userId: number, query?: {
    page?: number;
    limit?: number;
    urgency?: string;
    minBudget?: number;
    maxBudget?: number;
  }) {
    const page = query?.page || 1;
    const limit = query?.limit || 20;
    const skip = (page - 1) * limit;

    // Fetch the technician's responsible provinces
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { responsibleProvinces: true },
    });

    const where: any = {
      status: 'OPEN',
    };

    // Filter by province if the technician has responsible provinces set
    if (user?.responsibleProvinces?.length) {
      where.incident = {
        store: {
          province: { in: user.responsibleProvinces },
        },
      };
    }

    if (query?.urgency) {
      where.urgencyLevel = query.urgency;
    }

    if (query?.minBudget) {
      where.budgetMax = { gte: query.minBudget };
    }

    if (query?.maxBudget) {
      where.budgetMin = { lte: query.maxBudget };
    }

    const [jobs, total] = await Promise.all([
      this.prisma.outsourceJob.findMany({
        where,
        include: {
          incident: {
            select: {
              id: true,
              ticketNumber: true,
              title: true,
              status: true,
              store: {
                select: { id: true, name: true, storeCode: true, company: true, address: true, province: true, googleMapLink: true },
              },
            },
          },
          postedBy: {
            select: { id: true, firstName: true, lastName: true },
          },
          _count: {
            select: { bids: true },
          },
        },
        orderBy: [
          { urgencyLevel: 'desc' },
          { postedAt: 'desc' },
        ],
        skip,
        take: limit,
      }),
      this.prisma.outsourceJob.count({ where }),
    ]);

    return {
      data: jobs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get all jobs (for Admin)
   */
  async findAll(query?: {
    page?: number;
    limit?: number;
    status?: string;
    postedById?: number;
    awardedToId?: number;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
    isFinance?: boolean;
  }) {
    const page = query?.page || 1;
    const limit = query?.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query?.status === 'PAYMENT_DUE') {
      // Special computed status: VERIFIED + verifiedAt >= 30 days ago
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      where.status = 'VERIFIED';
      where.verifiedAt = { lte: thirtyDaysAgo };
    } else if (query?.status) {
      where.status = query.status;
    } else if (query?.isFinance) {
      // Finance sees all statuses (focus on financial pipeline)
      where.status = { not: 'CANCELLED' };
    } else {
      // Non-Finance: hide jobs that have been accepted/awarded (they go to Incidents)
      where.status = { in: ['PENDING_APPROVAL', 'OPEN', 'PENDING_CANCEL'] };
    }

    if (query?.postedById) {
      where.postedById = query.postedById;
    }

    if (query?.awardedToId) {
      where.awardedToId = query.awardedToId;
    }

    // Search by technician name
    if (query?.search) {
      where.awardedTo = {
        OR: [
          { firstName: { contains: query.search, mode: 'insensitive' } },
          { lastName: { contains: query.search, mode: 'insensitive' } },
        ],
      };
    }

    // Filter by date range (postedAt)
    if (query?.dateFrom || query?.dateTo) {
      where.postedAt = {};
      if (query?.dateFrom) {
        where.postedAt.gte = new Date(query.dateFrom);
      }
      if (query?.dateTo) {
        // Include the entire end date
        const endDate = new Date(query.dateTo);
        endDate.setHours(23, 59, 59, 999);
        where.postedAt.lte = endDate;
      }
    }

    const [jobs, total] = await Promise.all([
      this.prisma.outsourceJob.findMany({
        where,
        include: {
          incident: {
            select: {
              id: true,
              ticketNumber: true,
              title: true,
              status: true,
              store: {
                select: { id: true, name: true, storeCode: true, company: true, address: true, province: true, googleMapLink: true },
              },
            },
          },
          postedBy: {
            select: { id: true, firstName: true, lastName: true },
          },
          awardedTo: {
            select: { id: true, firstName: true, lastName: true },
          },
          _count: {
            select: { bids: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.outsourceJob.count({ where }),
    ]);

    return {
      data: jobs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get job details
   */
  async getJob(jobId: number, userId: number, userRoles: string[]) {
    const job = await this.prisma.outsourceJob.findUnique({
      where: { id: jobId },
      include: {
        incident: {
          include: {
            store: true,
            equipment: true,
          },
        },
        postedBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        approvedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
        awardedTo: {
          select: { id: true, firstName: true, lastName: true, email: true, phone: true },
        },
        awardedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
        verifiedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
        paidBy: {
          select: { id: true, firstName: true, lastName: true },
        },
        sparePartsConfirmedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
        documentsReceivedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
        bids: {
          include: {
            technician: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
              },
            },
          },
          orderBy: { proposedPrice: 'asc' },
        },
      },
    });

    if (!job) {
      throw new NotFoundException(`ไม่พบงาน Outsource ID: ${jobId}`);
    }

    // Auto-sync: if incident is CLOSED/RESOLVED but outsource job still active, update it
    if (
      job.incident &&
      ['CLOSED', 'RESOLVED'].includes(job.incident.status) &&
      ['OPEN', 'AWARDED', 'IN_PROGRESS', 'COMPLETED'].includes(job.status)
    ) {
      const updated = await this.prisma.outsourceJob.update({
        where: { id: jobId },
        data: {
          status: 'VERIFIED',
          verificationStatus: 'APPROVED',
          verifiedAt: new Date(),
          completedAt: job.completedAt || new Date(),
          paymentStatus: 'PENDING_APPROVAL',
        },
      });
      // Merge updated fields into job object
      job.status = updated.status;
      job.verificationStatus = updated.verificationStatus;
      job.verifiedAt = updated.verifiedAt;
      job.completedAt = updated.completedAt;
      job.paymentStatus = updated.paymentStatus;
    }

    // If technician, only show their own bid
    const isAdmin = userRoles.some(r =>
      ['SUPER_ADMIN', 'IT_MANAGER', 'HELP_DESK', 'SUPERVISOR', 'FINANCE_ADMIN'].includes(r)
    );

    if (!isAdmin) {
      // Filter bids to only show own bid
      job.bids = job.bids.filter(b => b.technicianId === userId);
    }

    return job;
  }

  /**
   * Submit bid for a job (OUTSOURCE technicians only)
   */
  async submitBid(jobId: number, technicianId: number, dto: SubmitBidDto) {
    const job = await this.prisma.outsourceJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new NotFoundException(`ไม่พบงาน Outsource ID: ${jobId}`);
    }

    if (job.status !== 'OPEN') {
      throw new BadRequestException('งานนี้ไม่เปิดรับเสนอราคาแล้ว');
    }

    // Check if technician is OUTSOURCE type
    const technician = await this.prisma.user.findUnique({
      where: { id: technicianId },
      select: { technicianType: true },
    });

    if (technician?.technicianType !== 'OUTSOURCE') {
      throw new ForbiddenException('เฉพาะช่าง Outsource เท่านั้นที่สามารถเสนอราคาได้');
    }

    // Check existing bid
    const existingBid = await this.prisma.outsourceBid.findUnique({
      where: {
        jobId_technicianId: {
          jobId,
          technicianId,
        },
      },
    });

    if (existingBid) {
      // Update existing bid
      return this.prisma.outsourceBid.update({
        where: { id: existingBid.id },
        data: {
          proposedPrice: dto.proposedPrice,
          estimatedHours: dto.estimatedHours,
          proposedStartDate: dto.proposedStartDate ? new Date(dto.proposedStartDate) : null,
          message: dto.message,
          attachments: dto.attachments || [],
          status: 'PENDING',
        },
        include: {
          job: true,
          technician: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      });
    }

    // Create new bid
    const bid = await this.prisma.outsourceBid.create({
      data: {
        jobId,
        technicianId,
        proposedPrice: dto.proposedPrice,
        estimatedHours: dto.estimatedHours,
        proposedStartDate: dto.proposedStartDate ? new Date(dto.proposedStartDate) : null,
        message: dto.message,
        attachments: dto.attachments || [],
      },
      include: {
        job: true,
        technician: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    // Notify job poster
    await this.notificationsService.createNotification(
      job.postedById,
      'SYSTEM_ALERT',
      'มีผู้เสนอราคางาน Outsource',
      `${bid.technician.firstName} ${bid.technician.lastName} เสนอราคา ${dto.proposedPrice.toLocaleString()} บาท สำหรับงาน ${job.jobCode}`,
      job.incidentId,
    );

    return bid;
  }

  /**
   * Get my bids (for OUTSOURCE technicians)
   */
  async getMyBids(technicianId: number, query?: { page?: number; limit?: number; status?: string }) {
    const page = query?.page || 1;
    const limit = query?.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {
      technicianId,
    };

    if (query?.status) {
      where.status = query.status;
    }

    const [bids, total] = await Promise.all([
      this.prisma.outsourceBid.findMany({
        where,
        include: {
          job: {
            include: {
              incident: {
                include: {
                  store: {
                    select: { id: true, name: true, storeCode: true },
                  },
                },
              },
            },
          },
        },
        orderBy: { submittedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.outsourceBid.count({ where }),
    ]);

    return {
      data: bids,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get my awarded jobs (for OUTSOURCE technicians)
   */
  async getMyJobs(technicianId: number, query?: { page?: number; limit?: number; status?: string }) {
    const page = query?.page || 1;
    const limit = query?.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {
      awardedToId: technicianId,
    };

    if (query?.status) {
      where.status = query.status;
    }

    const [jobs, total] = await Promise.all([
      this.prisma.outsourceJob.findMany({
        where,
        include: {
          incident: {
            include: {
              store: {
                select: { id: true, name: true, storeCode: true, address: true },
              },
            },
          },
        },
        orderBy: { awardedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.outsourceJob.count({ where }),
    ]);

    return {
      data: jobs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Accept job (OUTSOURCE technician directly accepts)
   * Sets the technician as awarded + assigns them to the incident
   */
  async acceptJob(jobId: number, technicianId: number) {
    const job = await this.prisma.outsourceJob.findUnique({
      where: { id: jobId },
      include: { incident: true },
    });

    if (!job) {
      throw new NotFoundException(`ไม่พบงาน Outsource ID: ${jobId}`);
    }

    if (job.status !== 'OPEN') {
      throw new BadRequestException('งานนี้ไม่เปิดรับแล้ว');
    }

    // Check if technician is OUTSOURCE type
    const technician = await this.prisma.user.findUnique({
      where: { id: technicianId },
      select: { technicianType: true, firstName: true, lastName: true },
    });

    if (technician?.technicianType !== 'OUTSOURCE') {
      throw new ForbiddenException('เฉพาะช่าง Outsource เท่านั้นที่สามารถรับงานได้');
    }

    // Update outsource job: AWARDED + assigned
    const updatedJob = await this.prisma.outsourceJob.update({
      where: { id: jobId },
      data: {
        status: 'AWARDED',
        awardedToId: technicianId,
        awardedAt: new Date(),
        technicianTypeAtAward: technician.technicianType,
      },
      include: {
        incident: { include: { store: true } },
        awardedTo: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    // Assign technician to the incident (same as insource)
    await this.prisma.incident.update({
      where: { id: job.incidentId },
      data: {
        status: 'ASSIGNED',
        assigneeId: technicianId,
      },
    });

    // Create IncidentAssignee record so the job appears in technician's "My Incidents"
    await this.prisma.incidentAssignee.upsert({
      where: { incidentId_userId: { incidentId: job.incidentId, userId: technicianId } },
      create: { incidentId: job.incidentId, userId: technicianId },
      update: {},
    });

    // Notify the job poster
    await this.notificationsService.createNotification(
      job.postedById,
      'INCIDENT_ASSIGNED',
      'ช่าง Outsource รับงานแล้ว!',
      `${technician.firstName} ${technician.lastName} รับงาน ${job.jobCode}: ${job.title}`,
      job.incidentId,
    );

    return updatedJob;
  }

  /**
   * Award job to a technician (Admin)
   */
  async awardJob(jobId: number, userId: number, dto: AwardJobDto) {
    const job = await this.prisma.outsourceJob.findUnique({
      where: { id: jobId },
      include: {
        bids: {
          where: { id: dto.bidId },
          include: {
            technician: {
              select: { id: true, firstName: true, lastName: true, technicianType: true },
            },
          },
        },
      },
    });

    if (!job) {
      throw new NotFoundException(`ไม่พบงาน Outsource ID: ${jobId}`);
    }

    if (!['OPEN', 'BIDDING_CLOSED'].includes(job.status)) {
      throw new BadRequestException('ไม่สามารถมอบหมายงานนี้ได้');
    }

    const bid = job.bids[0];
    if (!bid) {
      throw new NotFoundException(`ไม่พบ Bid ID: ${dto.bidId}`);
    }

    // Update job
    const updatedJob = await this.prisma.outsourceJob.update({
      where: { id: jobId },
      data: {
        status: 'AWARDED',
        awardedToId: bid.technicianId,
        awardedAt: new Date(),
        awardedById: userId,
        awardNotes: dto.awardNotes,
        agreedPrice: bid.proposedPrice,
        technicianTypeAtAward: bid.technician.technicianType,
      },
      include: {
        incident: true,
        awardedTo: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    // Update winning bid
    await this.prisma.outsourceBid.update({
      where: { id: dto.bidId },
      data: {
        status: 'ACCEPTED',
        respondedAt: new Date(),
      },
    });

    // Reject other bids
    await this.prisma.outsourceBid.updateMany({
      where: {
        jobId,
        id: { not: dto.bidId },
        status: 'PENDING',
      },
      data: {
        status: 'REJECTED',
        respondedAt: new Date(),
      },
    });

    // Notify awarded technician
    await this.notificationsService.createNotification(
      bid.technicianId,
      'INCIDENT_ASSIGNED',
      'คุณได้รับงาน Outsource!',
      `คุณได้รับมอบหมายงาน ${job.jobCode}: ${job.title}`,
      job.incidentId,
    );

    return updatedJob;
  }

  /**
   * Start job (OUTSOURCE technician)
   */
  async startJob(jobId: number, technicianId: number) {
    const job = await this.prisma.outsourceJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new NotFoundException(`ไม่พบงาน Outsource ID: ${jobId}`);
    }

    if (job.awardedToId !== technicianId) {
      throw new ForbiddenException('คุณไม่ใช่ผู้รับงานนี้');
    }

    if (job.status !== 'AWARDED') {
      throw new BadRequestException('ไม่สามารถเริ่มงานได้');
    }

    return this.prisma.outsourceJob.update({
      where: { id: jobId },
      data: {
        status: 'IN_PROGRESS',
      },
    });
  }

  /**
   * Complete job (OUTSOURCE technician)
   */
  async completeJob(jobId: number, technicianId: number, dto: CompleteJobDto) {
    const job = await this.prisma.outsourceJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new NotFoundException(`ไม่พบงาน Outsource ID: ${jobId}`);
    }

    if (job.awardedToId !== technicianId) {
      throw new ForbiddenException('คุณไม่ใช่ผู้รับงานนี้');
    }

    if (!['AWARDED', 'IN_PROGRESS', 'REJECTED'].includes(job.status)) {
      throw new BadRequestException('ไม่สามารถส่งงานได้');
    }

    const updatedJob = await this.prisma.outsourceJob.update({
      where: { id: jobId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        completionNotes: dto.completionNotes,
        completionPhotos: dto.completionPhotos || [],
        verificationStatus: 'PENDING',
      },
      include: {
        postedBy: true,
      },
    });

    // Notify admin for verification
    await this.notificationsService.createNotification(
      job.postedById,
      'INCIDENT_RESOLVED',
      'งาน Outsource รอตรวจสอบ',
      `งาน ${job.jobCode} ส่งงานแล้ว รอการตรวจสอบ`,
      job.incidentId,
    );

    return updatedJob;
  }

  /**
   * Verify completed job (Admin)
   */
  async verifyJob(jobId: number, userId: number, dto: VerifyJobDto) {
    const job = await this.prisma.outsourceJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new NotFoundException(`ไม่พบงาน Outsource ID: ${jobId}`);
    }

    if (job.status !== 'COMPLETED') {
      throw new BadRequestException('งานนี้ยังไม่ได้ส่งมา');
    }

    const newStatus =
      dto.status === 'APPROVED'
        ? 'VERIFIED'
        : dto.status === 'REJECTED'
        ? 'REJECTED'
        : 'REJECTED';

    const updatedJob = await this.prisma.outsourceJob.update({
      where: { id: jobId },
      data: {
        status: newStatus,
        verifiedAt: new Date(),
        verifiedById: userId,
        verificationNotes: dto.verificationNotes,
        verificationStatus: dto.status,
        paymentStatus: dto.status === 'APPROVED' ? 'PENDING_APPROVAL' : 'UNPAID',
      },
    });

    // Notify technician
    if (job.awardedToId) {
      await this.notificationsService.createNotification(
        job.awardedToId,
        dto.status === 'APPROVED' ? 'INCIDENT_CONFIRMED' : 'INCIDENT_REOPENED',
        dto.status === 'APPROVED' ? 'งานผ่านการตรวจสอบ!' : 'งานต้องแก้ไข',
        dto.status === 'APPROVED'
          ? `งาน ${job.jobCode} ผ่านการตรวจสอบแล้ว รอการชำระเงิน`
          : `งาน ${job.jobCode} ต้องแก้ไข: ${dto.verificationNotes || ''}`,
        job.incidentId,
      );
    }

    return updatedJob;
  }

  /**
   * Process payment (FINANCE_ADMIN)
   */
  async processPayment(jobId: number, userId: number, dto: ProcessPaymentDto) {
    const job = await this.prisma.outsourceJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new NotFoundException(`ไม่พบงาน Outsource ID: ${jobId}`);
    }

    if (job.status !== 'VERIFIED') {
      throw new BadRequestException('งานยังไม่ผ่านการตรวจสอบ');
    }

    // Calculate payment including shipping cost
    const shippingCost = job.shippingCost ? Number(job.shippingCost) : 0;
    const totalBeforeTax = dto.paymentAmount + shippingCost;
    const withholdingTax = dto.withholdingTax ?? (totalBeforeTax * 0.03);
    const netPayment = dto.netPaymentAmount ?? (totalBeforeTax - withholdingTax);

    const updatedJob = await this.prisma.outsourceJob.update({
      where: { id: jobId },
      data: {
        status: 'PAID',
        paymentStatus: 'PAID',
        paymentAmount: totalBeforeTax,
        withholdingTax,
        netPaymentAmount: netPayment,
        paymentSlipPath: dto.paymentSlipPath ?? null,
        paymentNote: dto.paymentNote,
        paidAt: new Date(),
        paidById: userId,
      },
    });

    // Notify technician
    if (job.awardedToId) {
      await this.notificationsService.createNotification(
        job.awardedToId,
        'INCIDENT_CONFIRMED',
        'ได้รับเงินค่าจ้างแล้ว!',
        `งาน ${job.jobCode} ได้รับเงิน ${netPayment.toLocaleString()} บาท`,
        job.incidentId,
      );
    }

    return updatedJob;
  }

  /**
   * Submit documents (Outsource technician - after completion)
   */
  async submitDocuments(jobId: number, technicianId: number, dto: SubmitDocumentsDto) {
    const job = await this.prisma.outsourceJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new NotFoundException(`ไม่พบงาน Outsource ID: ${jobId}`);
    }

    if (job.awardedToId !== technicianId) {
      throw new ForbiddenException('คุณไม่ใช่ผู้รับงานนี้');
    }

    if (!['COMPLETED', 'DOCUMENT_SUBMITTED'].includes(job.status)) {
      throw new BadRequestException('งานยังไม่อยู่ในสถานะที่สามารถส่งเอกสารได้');
    }

    const isResubmission = job.status === 'DOCUMENT_SUBMITTED';

    // Build update data
    const updateData: any = {
      documentSubmittedAt: new Date(),
    };

    if (!isResubmission) {
      // First submission: set status + replace all fields
      updateData.status = 'DOCUMENT_SUBMITTED';
      updateData.documentSlipPath = dto.documentSlipPath;
      updateData.documentWorkOrderPath = dto.documentWorkOrderPath;
      updateData.documentPhotos = dto.documentPhotos || [];
      updateData.shippingCost = dto.shippingCost;
    } else {
      // Resubmission: only update provided fields, append photos
      if (dto.documentSlipPath) updateData.documentSlipPath = dto.documentSlipPath;
      if (dto.documentWorkOrderPath) updateData.documentWorkOrderPath = dto.documentWorkOrderPath;
      if (dto.shippingCost !== undefined) updateData.shippingCost = dto.shippingCost;
      if (dto.documentPhotos && dto.documentPhotos.length > 0) {
        const existingPhotos = (job.documentPhotos as string[]) || [];
        updateData.documentPhotos = [...existingPhotos, ...dto.documentPhotos];
      }
    }

    const updatedJob = await this.prisma.outsourceJob.update({
      where: { id: jobId },
      data: updateData,
    });

    // Notify Finance / Admin
    const financeUsers = await this.prisma.user.findMany({
      where: {
        roles: { some: { role: { in: [UserRole.FINANCE_ADMIN, UserRole.IT_MANAGER] } } },
        status: 'ACTIVE',
      },
      select: { id: true },
    });

    const notifTitle = isResubmission ? 'Outsource เพิ่มเอกสารแล้ว' : 'Outsource ส่งเอกสารแล้ว';
    const notifBody = isResubmission
      ? `งาน ${job.jobCode} มีเอกสารเพิ่มเติม กรุณาตรวจสอบ`
      : `งาน ${job.jobCode} ส่งเอกสารแล้ว รอตรวจรับ`;

    for (const user of financeUsers) {
      await this.notificationsService.createNotification(
        user.id,
        'SYSTEM_ALERT',
        notifTitle,
        notifBody,
        job.incidentId,
      );
    }

    return updatedJob;
  }

  /**
   * Confirm spare parts returned (Finance)
   */
  async confirmSpareParts(jobId: number, userId: number) {
    const job = await this.prisma.outsourceJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new NotFoundException(`ไม่พบงาน Outsource ID: ${jobId}`);
    }

    if (job.status !== 'DOCUMENT_SUBMITTED') {
      throw new BadRequestException('งานยังไม่ได้ส่งเอกสาร');
    }

    return this.prisma.outsourceJob.update({
      where: { id: jobId },
      data: {
        sparePartsReturned: true,
        sparePartsConfirmedAt: new Date(),
        sparePartsConfirmedById: userId,
      },
    });
  }

  /**
   * Confirm documents received (Finance) → moves to VERIFIED
   */
  async confirmDocuments(jobId: number, userId: number) {
    const job = await this.prisma.outsourceJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new NotFoundException(`ไม่พบงาน Outsource ID: ${jobId}`);
    }

    if (job.status !== 'DOCUMENT_SUBMITTED') {
      throw new BadRequestException('งานยังไม่ได้ส่งเอกสาร');
    }

    const updatedJob = await this.prisma.outsourceJob.update({
      where: { id: jobId },
      data: {
        status: 'VERIFIED',
        verificationStatus: 'APPROVED',
        verifiedAt: new Date(),
        verifiedById: userId,
        documentsReceivedAt: new Date(),
        documentsReceivedById: userId,
        paymentStatus: 'PENDING_APPROVAL',
      },
    });

    // Notify technician
    if (job.awardedToId) {
      await this.notificationsService.createNotification(
        job.awardedToId,
        'INCIDENT_CONFIRMED',
        'เอกสารผ่านการตรวจรับ',
        `งาน ${job.jobCode} ผ่านการตรวจรับเอกสารแล้ว รอการชำระเงิน`,
        job.incidentId,
      );
    }

    return updatedJob;
  }

  /**
   * Request more documents (Finance) — add review comment + notify outsource
   */
  async requestMoreDocuments(jobId: number, userId: number, note: string) {
    const job = await this.prisma.outsourceJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new NotFoundException(`ไม่พบงาน Outsource ID: ${jobId}`);
    }

    if (job.status !== 'DOCUMENT_SUBMITTED') {
      throw new BadRequestException('งานยังไม่ได้ส่งเอกสาร');
    }

    // Get finance user name
    const financeUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true },
    });

    const existingNotes = (job.documentReviewNotes as any[]) || [];
    const newNote = {
      by: financeUser ? `${financeUser.firstName} ${financeUser.lastName}` : 'Finance',
      userId,
      note,
      at: new Date().toISOString(),
    };

    const updatedJob = await this.prisma.outsourceJob.update({
      where: { id: jobId },
      data: {
        documentReviewNotes: [...existingNotes, newNote],
      },
    });

    // Notify outsource technician
    if (job.awardedToId) {
      await this.notificationsService.createNotification(
        job.awardedToId,
        'SYSTEM_ALERT',
        'Finance ขอเอกสารเพิ่มเติม',
        `งาน ${job.jobCode}: ${note}`,
        job.incidentId,
      );
    }

    return updatedJob;
  }

  /**
   * Rate job (by poster or technician)
   */
  async rateJob(jobId: number, userId: number, isCustomerRating: boolean, dto: RateJobDto) {
    const job = await this.prisma.outsourceJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new NotFoundException(`ไม่พบงาน Outsource ID: ${jobId}`);
    }

    if (!['VERIFIED', 'PAID'].includes(job.status)) {
      throw new BadRequestException('ยังไม่สามารถให้คะแนนได้');
    }

    const updateData: any = {};

    if (isCustomerRating) {
      // Customer (poster) rating technician
      updateData.technicianRating = dto.rating;
      updateData.technicianComment = dto.comment;
    } else {
      // Technician rating the job/customer
      updateData.customerRating = dto.rating;
      updateData.customerComment = dto.comment;
    }

    return this.prisma.outsourceJob.update({
      where: { id: jobId },
      data: updateData,
    });
  }

  /**
   * Request cancel job (Admin/Supervisor)
   * If job has no awarded technician (OPEN/DRAFT) → cancel immediately
   * If job has awarded technician → set PENDING_CANCEL, wait for outsource confirmation
   */
  async cancelJob(jobId: number, userId: number, reason: string) {
    const job = await this.prisma.outsourceJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new NotFoundException(`ไม่พบงาน Outsource ID: ${jobId}`);
    }

    if (['PAID', 'CANCELLED'].includes(job.status)) {
      throw new BadRequestException('ไม่สามารถยกเลิกงานนี้ได้');
    }

    // If no technician awarded yet → cancel immediately
    if (!job.awardedToId || ['OPEN', 'DRAFT', 'BIDDING_CLOSED'].includes(job.status)) {
      const updatedJob = await this.prisma.outsourceJob.update({
        where: { id: jobId },
        data: {
          status: 'CANCELLED',
          cancellationReason: reason,
          cancellationRequestedById: userId,
          cancellationRequestedAt: new Date(),
          cancellationConfirmedAt: new Date(),
          cancellationConfirmedById: userId,
        },
      });

      // Revert incident status back to OPEN
      await this.prisma.incident.update({
        where: { id: job.incidentId },
        data: { status: 'OPEN' },
      });

      return updatedJob;
    }

    // Technician is awarded → request cancel (PENDING_CANCEL)
    const updatedJob = await this.prisma.outsourceJob.update({
      where: { id: jobId },
      data: {
        status: 'PENDING_CANCEL',
        cancellationReason: reason,
        cancellationRequestedById: userId,
        cancellationRequestedAt: new Date(),
      },
    });

    // Notify the awarded technician
    await this.notificationsService.createNotification(
      job.awardedToId,
      'INCIDENT_CANCELLED',
      'Supervisor ขอยกเลิกงาน Outsource',
      `Supervisor ขอยกเลิกงาน ${job.jobCode}: ${reason} — กรุณายืนยัน หรือ IT Manager สามารถอนุมัติแทนได้`,
      job.incidentId,
    );

    // Notify all IT Managers so they can approve if needed
    await this.notificationsService.notifyAllItManagers(
      NotificationType.INCIDENT_CANCELLED,
      'Supervisor ขอยกเลิกงาน Outsource — รออนุมัติ',
      `Supervisor ขอยกเลิกงาน ${job.jobCode}: ${reason} — สามารถอนุมัติการยกเลิกได้`,
      job.incidentId,
      `/dashboard/outsource/${job.id}`,
    );

    return updatedJob;
  }

  /**
   * Confirm cancel (Outsource technician who owns the job, or IT Manager)
   */
  async confirmCancel(jobId: number, userId: number, userRoles: string[] = []) {
    const job = await this.prisma.outsourceJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new NotFoundException(`ไม่พบงาน Outsource ID: ${jobId}`);
    }

    if (job.status !== 'PENDING_CANCEL') {
      throw new BadRequestException('งานนี้ไม่ได้อยู่ในสถานะรอยืนยันยกเลิก');
    }

    const isITManager = userRoles.includes('IT_MANAGER');
    if (!isITManager && job.awardedToId !== userId) {
      throw new BadRequestException('เฉพาะช่างที่ได้รับมอบหมายหรือ IT Manager เท่านั้นที่สามารถอนุมัติการยกเลิกได้');
    }

    const updatedJob = await this.prisma.outsourceJob.update({
      where: { id: jobId },
      data: {
        status: 'CANCELLED',
        cancellationConfirmedAt: new Date(),
        cancellationConfirmedById: userId,
      },
    });

    // Revert incident status back to OPEN
    await this.prisma.incident.update({
      where: { id: job.incidentId },
      data: { status: 'OPEN' },
    });

    // Notify the requester (Supervisor who requested the cancellation)
    if (job.cancellationRequestedById) {
      const confirmerLabel = isITManager ? 'IT Manager' : 'Outsource';
      await this.notificationsService.createNotification(
        job.cancellationRequestedById,
        'SYSTEM_ALERT',
        'อนุมัติการยกเลิกงาน Outsource แล้ว',
        `${confirmerLabel} อนุมัติยกเลิกงาน ${job.jobCode} แล้ว — Incident กลับสู่สถานะ OPEN`,
        job.incidentId,
      );
    }

    return updatedJob;
  }

  /**
   * Get marketplace statistics
   */
  async getStats() {
    // Calculate 30 days ago for payment due
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      totalJobs,
      openJobs,
      inProgressJobs,
      completedJobs,
      totalBids,
      avgBidsPerJob,
      totalPayments,
      // Finance-specific stats
      documentSubmittedJobs,
      verifiedJobs,
      paymentDueJobs,
      paidJobs,
    ] = await Promise.all([
      this.prisma.outsourceJob.count(),
      this.prisma.outsourceJob.count({ where: { status: 'OPEN' } }),
      this.prisma.outsourceJob.count({ where: { status: 'IN_PROGRESS' } }),
      this.prisma.outsourceJob.count({ where: { status: { in: ['VERIFIED', 'PAID'] } } }),
      this.prisma.outsourceBid.count(),
      this.prisma.outsourceBid.groupBy({
        by: ['jobId'],
        _count: { id: true },
      }),
      this.prisma.outsourceJob.aggregate({
        where: { paymentStatus: 'PAID' },
        _sum: { paymentAmount: true },
      }),
      this.prisma.outsourceJob.count({ where: { status: 'DOCUMENT_SUBMITTED' } }),
      this.prisma.outsourceJob.count({ where: { status: 'VERIFIED' } }),
      this.prisma.outsourceJob.count({ where: { status: 'VERIFIED', verifiedAt: { lte: thirtyDaysAgo } } }),
      this.prisma.outsourceJob.count({ where: { status: 'PAID' } }),
    ]);

    const avgBids = avgBidsPerJob.length > 0
      ? avgBidsPerJob.reduce((sum, item) => sum + item._count.id, 0) / avgBidsPerJob.length
      : 0;

    return {
      totalJobs,
      openJobs,
      inProgressJobs,
      completedJobs,
      totalBids,
      avgBidsPerJob: Math.round(avgBids * 10) / 10,
      totalPayments: totalPayments._sum.paymentAmount || 0,
      documentSubmittedJobs,
      verifiedJobs,
      paymentDueJobs,
      paidJobs,
    };
  }

  /**
   * Withdraw bid (OUTSOURCE technician)
   */
  async withdrawBid(bidId: number, technicianId: number) {
    const bid = await this.prisma.outsourceBid.findUnique({
      where: { id: bidId },
      include: { job: true },
    });

    if (!bid) {
      throw new NotFoundException(`ไม่พบ Bid ID: ${bidId}`);
    }

    if (bid.technicianId !== technicianId) {
      throw new ForbiddenException('คุณไม่ใช่เจ้าของ Bid นี้');
    }

    if (bid.status !== 'PENDING') {
      throw new BadRequestException('ไม่สามารถถอน Bid นี้ได้');
    }

    return this.prisma.outsourceBid.update({
      where: { id: bidId },
      data: {
        status: 'WITHDRAWN',
      },
    });
  }
}

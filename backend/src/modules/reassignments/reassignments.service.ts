// src/modules/reassignments/reassignments.service.ts

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateReassignmentDto, RespondReassignmentDto } from './dto';
import { IncidentStatus, ReassignmentStatus, UserRole } from '@prisma/client';
import { NotificationsService } from '../../notifications/notifications.service';

// สถานะที่สามารถ Reassign ได้
const REASSIGNABLE_STATUSES: IncidentStatus[] = [
  IncidentStatus.ASSIGNED,
  IncidentStatus.IN_PROGRESS,
];

@Injectable()
export class ReassignmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * สร้างคำขอโอนย้ายงาน (Reassign Incident)
   *
   * Access: IT_MANAGER, HELP_DESK, SUPERVISOR
   * ⚠️ SUPER_ADMIN: NO ACCESS
   */
  async create(
    incidentId: string,
    dto: CreateReassignmentDto,
    reassignedById: number,
    userRoles: UserRole[],
  ) {
    // ตรวจสอบสิทธิ์ - SUPER_ADMIN ไม่สามารถ Reassign ได้
    if (userRoles.includes(UserRole.SUPER_ADMIN)) {
      throw new ForbiddenException('SUPER_ADMIN ไม่มีสิทธิ์โอนย้ายงาน');
    }

    // ค้นหา Incident
    const incident = await this.prisma.incident.findUnique({
      where: { id: incidentId },
      include: {
        assignee: {
          include: {
            roles: true,
          },
        },
        store: true,
      },
    });

    if (!incident) {
      throw new NotFoundException(`ไม่พบ Incident ID: ${incidentId}`);
    }

    // ตรวจสอบสถานะ - ต้องอยู่ใน REASSIGNABLE_STATUSES
    if (!REASSIGNABLE_STATUSES.includes(incident.status)) {
      throw new BadRequestException(
        `ไม่สามารถโอนย้ายงานได้ สถานะปัจจุบัน: ${incident.status} (อนุญาตเฉพาะ: ${REASSIGNABLE_STATUSES.join(', ')})`,
      );
    }

    // ต้องมีผู้รับผิดชอบคนปัจจุบัน
    if (!incident.assigneeId) {
      throw new BadRequestException('งานนี้ยังไม่มีผู้รับผิดชอบ ให้ใช้การ Assign แทน');
    }

    // ตรวจสอบว่าไม่ได้โอนให้คนเดิม
    if (incident.assigneeId === dto.toTechnicianId) {
      throw new BadRequestException('ไม่สามารถโอนงานให้ช่างคนเดิมได้');
    }

    // ตรวจสอบว่าช่างใหม่มีอยู่จริงและเป็น TECHNICIAN
    const newTechnician = await this.prisma.user.findUnique({
      where: { id: dto.toTechnicianId },
      include: {
        roles: true,
      },
    });

    if (!newTechnician) {
      throw new NotFoundException(`ไม่พบช่างเทคนิค ID: ${dto.toTechnicianId}`);
    }

    const technicianRoles = newTechnician.roles.map((r) => r.role);
    if (!technicianRoles.includes(UserRole.TECHNICIAN)) {
      throw new BadRequestException('ผู้รับงานใหม่ต้องมีสิทธิ์ TECHNICIAN');
    }

    // ตรวจสอบว่าไม่มี Pending Reassignment อยู่แล้ว
    const existingPending = await this.prisma.incidentReassignment.findFirst({
      where: {
        incidentId,
        status: ReassignmentStatus.PENDING,
      },
    });

    if (existingPending) {
      throw new BadRequestException(
        'มีคำขอโอนย้ายที่รอการตอบรับอยู่แล้ว กรุณารอการตอบรับก่อน',
      );
    }

    // สร้าง Reassignment record
    const reassignment = await this.prisma.incidentReassignment.create({
      data: {
        incidentId,
        fromTechnicianId: incident.assigneeId,
        toTechnicianId: dto.toTechnicianId,
        reassignedById,
        reason: dto.reason,
        status: ReassignmentStatus.PENDING,
      },
      include: {
        incident: {
          select: {
            ticketNumber: true,
            title: true,
          },
        },
        fromTechnician: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        toTechnician: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        reassignedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // บันทึก History
    await this.prisma.incidentHistory.create({
      data: {
        incidentId,
        userId: reassignedById,
        action: 'REASSIGNED',
        details: JSON.stringify({
          reassignmentId: reassignment.id,
          fromTechnicianId: incident.assigneeId,
          toTechnicianId: dto.toTechnicianId,
          reason: dto.reason,
          status: 'PENDING',
        }),
      },
    });

    // ส่ง Notification ให้ช่างใหม่
    await this.notificationsService.createNotification(
      dto.toTechnicianId,
      'INCIDENT_REASSIGNED',
      'มีคำขอโอนย้ายงานใหม่',
      `${reassignment.reassignedBy.firstName} ${reassignment.reassignedBy.lastName} ขอโอนย้ายงาน ${reassignment.incident.ticketNumber}: ${reassignment.incident.title} ให้คุณ`,
      incidentId,
    );

    return {
      message: 'สร้างคำขอโอนย้ายงานสำเร็จ',
      reassignment,
    };
  }

  /**
   * ตอบรับ/ปฏิเสธการโอนย้ายงาน
   *
   * Access: เฉพาะ Technician ที่ได้รับคำขอ (toTechnician)
   */
  async respond(
    reassignmentId: number,
    dto: RespondReassignmentDto,
    userId: number,
  ) {
    const reassignment = await this.prisma.incidentReassignment.findUnique({
      where: { id: reassignmentId },
      include: {
        incident: true,
        fromTechnician: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        toTechnician: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        reassignedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!reassignment) {
      throw new NotFoundException(`ไม่พบคำขอโอนย้าย ID: ${reassignmentId}`);
    }

    // ตรวจสอบว่าเป็นช่างที่ได้รับคำขอหรือไม่
    if (reassignment.toTechnicianId !== userId) {
      throw new ForbiddenException('คุณไม่มีสิทธิ์ตอบรับ/ปฏิเสธคำขอนี้');
    }

    // ตรวจสอบว่ายังเป็น PENDING อยู่
    if (reassignment.status !== ReassignmentStatus.PENDING) {
      throw new BadRequestException(
        `คำขอนี้ได้รับการตอบรับแล้ว (สถานะ: ${reassignment.status})`,
      );
    }

    const newStatus =
      dto.status === 'ACCEPTED'
        ? ReassignmentStatus.ACCEPTED
        : ReassignmentStatus.REJECTED;

    // อัพเดท Reassignment
    const updatedReassignment = await this.prisma.incidentReassignment.update({
      where: { id: reassignmentId },
      data: {
        status: newStatus,
        responseNote: dto.responseNote,
        respondedAt: new Date(),
      },
      include: {
        incident: {
          select: {
            id: true,
            ticketNumber: true,
            title: true,
          },
        },
        fromTechnician: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        toTechnician: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // ถ้าตอบรับ -> อัพเดท Incident assignee
    if (newStatus === ReassignmentStatus.ACCEPTED) {
      await this.prisma.incident.update({
        where: { id: reassignment.incidentId },
        data: {
          assigneeId: reassignment.toTechnicianId,
        },
      });

      // บันทึก History
      await this.prisma.incidentHistory.create({
        data: {
          incidentId: reassignment.incidentId,
          userId,
          action: 'ASSIGNED',
          details: JSON.stringify({
            reassignmentId: reassignment.id,
            previousAssigneeId: reassignment.fromTechnicianId,
            newAssigneeId: reassignment.toTechnicianId,
            type: 'reassignment_accepted',
          }),
        },
      });

      // ส่ง Notification ให้ผู้ขอโอน
      await this.notificationsService.createNotification(
        reassignment.reassignedById,
        'INCIDENT_REASSIGNED',
        'คำขอโอนย้ายงานได้รับการตอบรับ',
        `${updatedReassignment.toTechnician.firstName} ${updatedReassignment.toTechnician.lastName} ตอบรับการโอนย้ายงาน ${updatedReassignment.incident.ticketNumber}`,
        reassignment.incidentId,
      );

      // ส่ง Notification ให้ช่างเดิม
      await this.notificationsService.createNotification(
        reassignment.fromTechnicianId,
        'INCIDENT_REASSIGNED',
        'งานของคุณถูกโอนย้าย',
        `งาน ${updatedReassignment.incident.ticketNumber}: ${updatedReassignment.incident.title} ถูกโอนย้ายให้ ${updatedReassignment.toTechnician.firstName} ${updatedReassignment.toTechnician.lastName}`,
        reassignment.incidentId,
      );
    } else {
      // ถ้าปฏิเสธ -> ส่ง Notification ให้ผู้ขอโอน
      await this.notificationsService.createNotification(
        reassignment.reassignedById,
        'INCIDENT_REASSIGNED',
        'คำขอโอนย้ายงานถูกปฏิเสธ',
        `${updatedReassignment.toTechnician.firstName} ${updatedReassignment.toTechnician.lastName} ปฏิเสธการโอนย้ายงาน ${updatedReassignment.incident.ticketNumber} เหตุผล: ${dto.responseNote || '-'}`,
        reassignment.incidentId,
      );

      // บันทึก History
      await this.prisma.incidentHistory.create({
        data: {
          incidentId: reassignment.incidentId,
          userId,
          action: 'REASSIGNED',
          details: JSON.stringify({
            reassignmentId: reassignment.id,
            type: 'reassignment_rejected',
            responseNote: dto.responseNote,
          }),
        },
      });
    }

    return {
      message:
        newStatus === ReassignmentStatus.ACCEPTED
          ? 'ตอบรับการโอนย้ายงานสำเร็จ'
          : 'ปฏิเสธการโอนย้ายงานสำเร็จ',
      reassignment: updatedReassignment,
    };
  }

  /**
   * ดึงประวัติการโอนย้ายของ Incident
   */
  async getByIncident(incidentId: string) {
    const reassignments = await this.prisma.incidentReassignment.findMany({
      where: { incidentId },
      include: {
        fromTechnician: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        toTechnician: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        reassignedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: {
        reassignedAt: 'desc',
      },
    });

    return reassignments;
  }

  /**
   * ดึงงานที่รอตอบรับสำหรับ Technician
   */
  async getMyPendingReassignments(userId: number) {
    const reassignments = await this.prisma.incidentReassignment.findMany({
      where: {
        toTechnicianId: userId,
        status: ReassignmentStatus.PENDING,
      },
      include: {
        incident: {
          include: {
            store: {
              select: {
                id: true,
                storeCode: true,
                name: true,
              },
            },
          },
        },
        fromTechnician: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        reassignedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: {
        reassignedAt: 'desc',
      },
    });

    return reassignments;
  }

  /**
   * ดึงสถิติการโอนย้ายงาน
   *
   * Access: IT_MANAGER, HELP_DESK, SUPERVISOR
   */
  async getStats(query?: { startDate?: string; endDate?: string }) {
    const where: any = {};

    if (query?.startDate || query?.endDate) {
      where.reassignedAt = {};
      if (query.startDate) {
        where.reassignedAt.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        where.reassignedAt.lte = new Date(query.endDate);
      }
    }

    // นับตามสถานะ
    const statusCounts = await this.prisma.incidentReassignment.groupBy({
      by: ['status'],
      where,
      _count: {
        id: true,
      },
    });

    // นับทั้งหมด
    const total = await this.prisma.incidentReassignment.count({ where });

    // Top Technicians ที่ได้รับการโอนย้ายมากที่สุด
    const topReceivers = await this.prisma.incidentReassignment.groupBy({
      by: ['toTechnicianId'],
      where: {
        ...where,
        status: ReassignmentStatus.ACCEPTED,
      },
      _count: {
        id: true,
      },
      orderBy: {
        _count: {
          id: 'desc',
        },
      },
      take: 5,
    });

    // ดึงข้อมูล User สำหรับ Top Receivers
    const topReceiverDetails = await Promise.all(
      topReceivers.map(async (item) => {
        const user = await this.prisma.user.findUnique({
          where: { id: item.toTechnicianId },
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        });
        return {
          technician: user,
          acceptedCount: item._count.id,
        };
      }),
    );

    // Top Technicians ที่มีการโอนออกมากที่สุด
    const topSenders = await this.prisma.incidentReassignment.groupBy({
      by: ['fromTechnicianId'],
      where,
      _count: {
        id: true,
      },
      orderBy: {
        _count: {
          id: 'desc',
        },
      },
      take: 5,
    });

    const topSenderDetails = await Promise.all(
      topSenders.map(async (item) => {
        const user = await this.prisma.user.findUnique({
          where: { id: item.fromTechnicianId },
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        });
        return {
          technician: user,
          reassignedCount: item._count.id,
        };
      }),
    );

    // คำนวณ Acceptance Rate
    const accepted = statusCounts.find(
      (s) => s.status === ReassignmentStatus.ACCEPTED,
    );
    const rejected = statusCounts.find(
      (s) => s.status === ReassignmentStatus.REJECTED,
    );
    const pending = statusCounts.find(
      (s) => s.status === ReassignmentStatus.PENDING,
    );

    const completedTotal =
      (accepted?._count?.id || 0) + (rejected?._count?.id || 0);
    const acceptanceRate =
      completedTotal > 0
        ? Math.round(((accepted?._count?.id || 0) / completedTotal) * 100)
        : 0;

    return {
      total,
      byStatus: {
        pending: pending?._count?.id || 0,
        accepted: accepted?._count?.id || 0,
        rejected: rejected?._count?.id || 0,
      },
      acceptanceRate,
      topReceivers: topReceiverDetails,
      topSenders: topSenderDetails,
    };
  }

  /**
   * ยกเลิกคำขอโอนย้ายที่ยังเป็น PENDING
   *
   * Access: ผู้สร้างคำขอ (reassignedBy) หรือ IT_MANAGER
   */
  async cancel(reassignmentId: number, userId: number, userRoles: UserRole[]) {
    const reassignment = await this.prisma.incidentReassignment.findUnique({
      where: { id: reassignmentId },
      include: {
        incident: {
          select: {
            ticketNumber: true,
            title: true,
          },
        },
        toTechnician: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!reassignment) {
      throw new NotFoundException(`ไม่พบคำขอโอนย้าย ID: ${reassignmentId}`);
    }

    // ตรวจสอบว่าเป็นผู้สร้างหรือ IT_MANAGER
    const isCreator = reassignment.reassignedById === userId;
    const isItManager = userRoles.includes(UserRole.IT_MANAGER);

    if (!isCreator && !isItManager) {
      throw new ForbiddenException('คุณไม่มีสิทธิ์ยกเลิกคำขอนี้');
    }

    // ต้องเป็น PENDING เท่านั้น
    if (reassignment.status !== ReassignmentStatus.PENDING) {
      throw new BadRequestException(
        'ไม่สามารถยกเลิกคำขอที่ได้รับการตอบรับแล้ว',
      );
    }

    // ลบคำขอ
    await this.prisma.incidentReassignment.delete({
      where: { id: reassignmentId },
    });

    // ส่ง Notification ให้ช่างที่รอตอบรับ
    await this.notificationsService.createNotification(
      reassignment.toTechnicianId,
      'INCIDENT_REASSIGNED',
      'คำขอโอนย้ายงานถูกยกเลิก',
      `คำขอโอนย้ายงาน ${reassignment.incident.ticketNumber}: ${reassignment.incident.title} ถูกยกเลิกแล้ว`,
      reassignment.incidentId,
    );

    return {
      message: 'ยกเลิกคำขอโอนย้ายสำเร็จ',
    };
  }
}

// backend/src/incidents/sla-monitor.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { IncidentStatus, NotificationType } from '@prisma/client';

@Injectable()
export class SlaMonitorService {
  private readonly logger = new Logger(SlaMonitorService.name);

  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  /**
   * Check for SLA violations every 15 minutes
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async checkSlaStatus() {
    this.logger.log('Running SLA monitoring check...');

    try {
      await this.checkSlaWarnings();
      await this.checkSlaBreaches();
    } catch (error) {
      this.logger.error('Error during SLA monitoring:', error);
    }
  }

  /**
   * Check for incidents approaching SLA deadline (within 1 hour)
   */
  private async checkSlaWarnings() {
    const now = new Date();
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);

    const incidents = await this.prisma.incident.findMany({
      where: {
        status: {
          in: [
            IncidentStatus.OPEN,
            IncidentStatus.ASSIGNED,
            IncidentStatus.IN_PROGRESS,
            IncidentStatus.PENDING,
          ],
        },
        slaDeadline: {
          lte: oneHourLater,
          gt: now, // Not yet breached
        },
      },
      include: {
        assignee: true,
        assignees: { select: { userId: true } },
        createdBy: true,
      },
    });

    this.logger.log(`Found ${incidents.length} incidents approaching SLA deadline`);

    for (const incident of incidents) {
      // Check if we already sent a warning for this incident recently
      const recentWarning = await this.prisma.notification.findFirst({
        where: {
          incidentId: incident.id,
          type: NotificationType.SLA_WARNING,
          createdAt: {
            gte: new Date(now.getTime() - 60 * 60 * 1000), // Within last hour
          },
        },
      });

      if (recentWarning) {
        continue; // Already notified recently
      }

      const timeRemaining = this.getTimeRemaining(incident.slaDeadline!);

      // Notify supervisors only (NOT Help Desk)
      await this.notificationsService.notifyAllSupervisors(
        NotificationType.SLA_WARNING,
        '⚠️ SLA Warning',
        `Incident ${incident.ticketNumber} is approaching SLA deadline in ${timeRemaining}: ${incident.title}`,
        incident.id,
      );

      // Notify all assigned technicians
      const assignedUserIds = (incident as any).assignees?.map((a: any) => a.userId) || [];
      if (assignedUserIds.length === 0 && incident.assigneeId) {
        assignedUserIds.push(incident.assigneeId);
      }
      for (const techId of assignedUserIds) {
        await this.notificationsService.createNotification(
          techId,
          NotificationType.SLA_WARNING,
          '⚠️ SLA Warning',
          `Your incident ${incident.ticketNumber} is approaching SLA deadline in ${timeRemaining}: ${incident.title}`,
          incident.id,
        );
      }

      this.logger.log(`Sent SLA warning for incident ${incident.ticketNumber}`);
    }
  }

  /**
   * Check for incidents that have breached SLA
   */
  private async checkSlaBreaches() {
    const now = new Date();

    const incidents = await this.prisma.incident.findMany({
      where: {
        status: {
          in: [
            IncidentStatus.OPEN,
            IncidentStatus.ASSIGNED,
            IncidentStatus.IN_PROGRESS,
            IncidentStatus.PENDING,
          ],
        },
        slaDeadline: {
          lt: now, // Past deadline
        },
      },
      include: {
        assignee: true,
        assignees: { select: { userId: true } },
        createdBy: true,
      },
    });

    this.logger.log(`Found ${incidents.length} incidents with SLA breach`);

    for (const incident of incidents) {
      // Check if we already sent a breach notification for this incident recently
      const recentBreach = await this.prisma.notification.findFirst({
        where: {
          incidentId: incident.id,
          type: NotificationType.SLA_BREACH,
          createdAt: {
            gte: new Date(now.getTime() - 60 * 60 * 1000), // Within last hour
          },
        },
      });

      if (recentBreach) {
        continue; // Already notified recently
      }

      const overdueDuration = this.getOverdueDuration(incident.slaDeadline!);

      // Notify supervisors
      await this.notificationsService.notifyAllSupervisors(
        NotificationType.SLA_BREACH,
        '🚨 SLA BREACH',
        `Incident ${incident.ticketNumber} has breached SLA by ${overdueDuration}: ${incident.title}`,
        incident.id,
      );

      // Notify all assigned technicians
      const breachAssignedIds = (incident as any).assignees?.map((a: any) => a.userId) || [];
      if (breachAssignedIds.length === 0 && incident.assigneeId) {
        breachAssignedIds.push(incident.assigneeId);
      }
      for (const techId of breachAssignedIds) {
        await this.notificationsService.createNotification(
          techId,
          NotificationType.SLA_BREACH,
          '🚨 SLA BREACH',
          `Your incident ${incident.ticketNumber} has breached SLA by ${overdueDuration}: ${incident.title}`,
          incident.id,
        );
      }

      // Notify incident creator
      if (incident.createdById) {
        await this.notificationsService.createNotification(
          incident.createdById,
          NotificationType.SLA_BREACH,
          '🚨 SLA BREACH',
          `Incident ${incident.ticketNumber} has breached SLA by ${overdueDuration}: ${incident.title}`,
          incident.id,
        );
      }

      this.logger.log(`Sent SLA breach notification for incident ${incident.ticketNumber}`);
    }
  }

  /**
   * Check for scheduled assignments approaching in 30 minutes and send reminders
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async checkScheduledAssignmentReminders() {
    const now = new Date();
    const windowStart = new Date(now.getTime() + 20 * 60 * 1000); // +20 min
    const windowEnd   = new Date(now.getTime() + 30 * 60 * 1000); // +30 min

    try {
      const incidents = await this.prisma.incident.findMany({
        where: {
          scheduledAt: { gt: windowStart, lte: windowEnd },
          status: IncidentStatus.ASSIGNED,
        },
        select: {
          id: true,
          ticketNumber: true,
          title: true,
          scheduledAt: true,
          assigneeId: true,
          assignees: { select: { userId: true } },
        },
      });

      for (const incident of incidents) {
        const assigneeIds = incident.assignees.map((a: any) => a.userId);
        if (assigneeIds.length === 0 && incident.assigneeId) {
          assigneeIds.push(incident.assigneeId);
        }

        for (const userId of assigneeIds) {
          // Dedup: skip if reminder already sent in last 2 hours
          const alreadySent = await this.prisma.notification.findFirst({
            where: {
              userId,
              incidentId: incident.id,
              type: NotificationType.SYSTEM_ALERT,
              message: { contains: 'กำหนดเข้าดำเนินการใน 30 นาที' },
              createdAt: { gte: new Date(now.getTime() - 2 * 60 * 60 * 1000) },
            },
          });
          if (alreadySent) continue;

          await this.notificationsService.createNotification(
            userId,
            NotificationType.SYSTEM_ALERT,
            'แจ้งเตือน: ใกล้ถึงเวลานัดหมาย',
            `Incident ${incident.ticketNumber} กำหนดเข้าดำเนินการใน 30 นาที: ${incident.title}`,
            incident.id,
          );
        }
      }
    } catch (error) {
      this.logger.error('Error checking scheduled assignment reminders:', error);
    }
  }

  /**
   * Calculate time remaining until SLA deadline
   */
  private getTimeRemaining(deadline: Date): string {
    const now = new Date();
    const diff = deadline.getTime() - now.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    return `${minutes}m`;
  }

  /**
   * Calculate how long the incident is overdue
   */
  private getOverdueDuration(deadline: Date): string {
    const now = new Date();
    const diff = now.getTime() - deadline.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h`;
    }
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    return `${minutes}m`;
  }
}

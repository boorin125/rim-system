// backend/src/incidents/sla-monitor.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailService } from '../email/email.service';
import { SettingsService } from '../settings/settings.service';
import { IncidentStatus, NotificationType } from '@prisma/client';

@Injectable()
export class SlaMonitorService {
  private readonly logger = new Logger(SlaMonitorService.name);

  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
    private emailService: EmailService,
    private settingsService: SettingsService,
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

      // Collect direct recipients (technicians + creator) to exclude from supervisor broadcast
      const directUserIds = new Set<number>();

      // Notify all assigned technicians
      const assignedUserIds = (incident as any).assignees?.map((a: any) => a.userId) || [];
      if (assignedUserIds.length === 0 && incident.assigneeId) {
        assignedUserIds.push(incident.assigneeId);
      }
      for (const techId of assignedUserIds) {
        directUserIds.add(techId);
        await this.notificationsService.createNotification(
          techId,
          NotificationType.SLA_WARNING,
          '⚠️ SLA Warning',
          `Your incident ${incident.ticketNumber} is approaching SLA deadline in ${timeRemaining}: ${incident.title}`,
          incident.id,
        );
      }

      // Notify supervisors, excluding technicians already notified above
      await this.notificationsService.notifyAllSupervisors(
        NotificationType.SLA_WARNING,
        '⚠️ SLA Warning',
        `Incident ${incident.ticketNumber} is approaching SLA deadline in ${timeRemaining}: ${incident.title}`,
        incident.id,
        [...directUserIds],
      );

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

      // Collect direct recipients to exclude from supervisor broadcast
      const directUserIds = new Set<number>();

      // Notify all assigned technicians
      const breachAssignedIds = (incident as any).assignees?.map((a: any) => a.userId) || [];
      if (breachAssignedIds.length === 0 && incident.assigneeId) {
        breachAssignedIds.push(incident.assigneeId);
      }
      for (const techId of breachAssignedIds) {
        directUserIds.add(techId);
        await this.notificationsService.createNotification(
          techId,
          NotificationType.SLA_BREACH,
          '🚨 SLA BREACH',
          `Your incident ${incident.ticketNumber} has breached SLA by ${overdueDuration}: ${incident.title}`,
          incident.id,
        );
      }

      // Notify incident creator (if not already notified as technician)
      if (incident.createdById && !directUserIds.has(incident.createdById)) {
        directUserIds.add(incident.createdById);
        await this.notificationsService.createNotification(
          incident.createdById,
          NotificationType.SLA_BREACH,
          '🚨 SLA BREACH',
          `Incident ${incident.ticketNumber} has breached SLA by ${overdueDuration}: ${incident.title}`,
          incident.id,
        );
      }

      // Notify supervisors, excluding all directly-notified users above
      await this.notificationsService.notifyAllSupervisors(
        NotificationType.SLA_BREACH,
        '🚨 SLA BREACH',
        `Incident ${incident.ticketNumber} has breached SLA by ${overdueDuration}: ${incident.title}`,
        incident.id,
        [...directUserIds],
      );

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
    const totalMinutes = Math.floor(diff / (1000 * 60));
    const days = Math.floor(totalMinutes / (60 * 24));
    const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
    const minutes = totalMinutes % 60;

    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    }
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }

  // ============================================
  // DISK SPACE ALERT (every hour)
  // ============================================

  @Cron(CronExpression.EVERY_HOUR)
  async checkDiskSpaceAlert() {
    try {
      const alertEmail = await this.settingsService.getDiskAlertEmail();
      if (!alertEmail) return; // no recipient configured

      const disk = await this.settingsService.getDiskUsage();
      if (!disk) return;

      // Read threshold
      let threshold = 85;
      try {
        const cfg = await this.prisma.systemConfig.findUnique({ where: { key: 'disk_alert_threshold' } });
        if (cfg) threshold = parseInt(cfg.value) || 85;
      } catch { /* ignore */ }

      if (disk.usedPercent < threshold) return;

      // Dedup: don't send more than once every 6 hours
      const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
      try {
        const lastSent = await this.prisma.systemConfig.findUnique({ where: { key: 'disk_alert_last_sent' } });
        if (lastSent && new Date(lastSent.value) > sixHoursAgo) return;
      } catch { /* ignore */ }

      const formatBytes = (b: number) => b >= 1_073_741_824
        ? `${(b / 1_073_741_824).toFixed(1)} GB`
        : `${(b / 1_048_576).toFixed(0)} MB`;

      // 3-color bar: green (0-60%), orange (60-85%), red (85-100%), gray = free
      const greenW  = Math.min(disk.usedPercent, 60);
      const orangeW = Math.max(0, Math.min(disk.usedPercent, 85) - 60);
      const redW    = Math.max(0, disk.usedPercent - 85);
      const freeW   = 100 - disk.usedPercent;

      const html = `
        <div style="font-family:Tahoma,'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
          <div style="background:#ef4444;color:#fff;padding:16px 24px">
            <h2 style="margin:0;font-size:17px">⚠️ แจ้งเตือน: พื้นที่ Disk ใกล้เต็ม</h2>
          </div>
          <div style="padding:24px;color:#1e293b">
            <p style="margin:0 0 16px 0;font-size:14px">พื้นที่จัดเก็บข้อมูลบนเซิร์ฟเวอร์ถูกใช้งานแล้ว <strong style="color:#dc2626">${disk.usedPercent}%</strong> ซึ่งเกินขีดจำกัดที่ตั้งไว้ที่ <strong>${threshold}%</strong></p>

            <!-- 3-color disk bar -->
            <table style="width:100%;border-collapse:collapse;border-radius:6px;overflow:hidden;margin:0 0 6px 0">
              <tr style="height:28px">
                ${greenW  > 0 ? `<td style="width:${greenW}%;background:#22c55e;"></td>` : ''}
                ${orangeW > 0 ? `<td style="width:${orangeW}%;background:#f97316;"></td>` : ''}
                ${redW    > 0 ? `<td style="width:${redW}%;background:#ef4444;"></td>` : ''}
                ${freeW   > 0 ? `<td style="width:${freeW}%;background:#e2e8f0;"></td>` : ''}
              </tr>
            </table>
            <!-- Legend -->
            <table style="width:100%;border-collapse:collapse;margin:0 0 20px 0;font-size:12px">
              <tr>
                <td style="padding:4px 6px"><span style="display:inline-block;width:10px;height:10px;background:#22c55e;border-radius:2px;margin-right:4px;vertical-align:middle"></span>ปกติ (0–60%)</td>
                <td style="padding:4px 6px"><span style="display:inline-block;width:10px;height:10px;background:#f97316;border-radius:2px;margin-right:4px;vertical-align:middle"></span>เฝ้าระวัง (60–85%)</td>
                <td style="padding:4px 6px"><span style="display:inline-block;width:10px;height:10px;background:#ef4444;border-radius:2px;margin-right:4px;vertical-align:middle"></span>วิกฤต (85%+)</td>
              </tr>
            </table>

            <!-- Stats table -->
            <table style="width:100%;border-collapse:collapse;margin:0 0 16px 0;font-size:14px">
              <tr style="background:#f8fafc">
                <td style="padding:10px 16px;border:1px solid #e2e8f0;color:#475569">พื้นที่ทั้งหมด</td>
                <td style="padding:10px 16px;border:1px solid #e2e8f0;text-align:right;font-weight:600;color:#1e293b">${formatBytes(disk.total)}</td>
              </tr>
              <tr>
                <td style="padding:10px 16px;border:1px solid #e2e8f0;color:#475569">ใช้งานแล้ว</td>
                <td style="padding:10px 16px;border:1px solid #e2e8f0;text-align:right;font-weight:600;color:#dc2626">${formatBytes(disk.used)} (${disk.usedPercent}%)</td>
              </tr>
              <tr style="background:#f8fafc">
                <td style="padding:10px 16px;border:1px solid #e2e8f0;color:#475569">พื้นที่ว่าง</td>
                <td style="padding:10px 16px;border:1px solid #e2e8f0;text-align:right;font-weight:600;color:#059669">${formatBytes(disk.free)}</td>
              </tr>
            </table>
            <p style="color:#64748b;font-size:13px;margin:0 0 24px 0">กรุณาลบไฟล์ที่ไม่จำเป็นหรือเพิ่มพื้นที่จัดเก็บข้อมูลเพื่อป้องกันระบบทำงานผิดพลาด</p>
            <p style="color:#94a3b8;font-size:12px;margin:0;border-top:1px solid #e2e8f0;padding-top:16px">แจ้งเตือนโดยระบบ X-treme Service System — ${new Date().toLocaleString('th-TH')}</p>
          </div>
        </div>`;

      await this.emailService.sendEmail({
        to: alertEmail,
        subject: `[X-treme Service System] ⚠️ พื้นที่ Disk ใกล้เต็ม (${disk.usedPercent}%)`,
        html,
      });

      // Record last sent time
      await this.prisma.systemConfig.upsert({
        where: { key: 'disk_alert_last_sent' },
        update: { value: new Date().toISOString() },
        create: { key: 'disk_alert_last_sent', value: new Date().toISOString(), category: 'system', description: 'Last disk alert email sent at' },
      });

      this.logger.log(`Disk space alert email sent to ${alertEmail} (${disk.usedPercent}% used)`);
    } catch (error) {
      this.logger.error('Error during disk space alert check:', error);
    }
  }
}

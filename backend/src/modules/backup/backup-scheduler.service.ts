// src/modules/backup/backup-scheduler.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { BackupService } from './backup.service';
import { AuditTrailService } from '../audit-trail/audit-trail.service';
import { AuditModule, AuditAction } from '@prisma/client';

@Injectable()
export class BackupSchedulerService {
  private readonly logger = new Logger(BackupSchedulerService.name);
  private isRunning = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly backupService: BackupService,
    private readonly auditTrailService: AuditTrailService,
  ) {}

  /**
   * Check for scheduled backups every minute
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async handleScheduledBackups() {
    // Prevent concurrent execution
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;

    try {
      const now = new Date();

      // Find schedules that are active and due to run
      const dueSchedules = await this.prisma.backupSchedule.findMany({
        where: {
          isActive: true,
          nextRunAt: {
            lte: now,
          },
        },
      });

      // Check for due Differential sub-schedules
      const dueDiffSchedules = await this.prisma.backupSchedule.findMany({
        where: {
          isActive: true,
          diffIntervalMinutes: { not: null },
          nextDiffRunAt: { lte: now },
        },
      });

      for (const schedule of dueDiffSchedules) {
        try {
          this.logger.log(`Executing scheduled Diff backup: ${schedule.name} (ID: ${schedule.id})`);
          const backupJob = await this.backupService.executeScheduledDiffBackup(schedule);
          await this.auditTrailService.logDirect({
            module: AuditModule.SYSTEM,
            action: AuditAction.CREATE,
            entityType: 'BackupJob',
            entityId: backupJob.id,
            userId: schedule.createdById,
            description: `Auto Diff Backup สำเร็จ - Schedule: ${schedule.name}, Job: ${backupJob.jobCode}`,
          });
        } catch (error) {
          this.logger.error(`Failed Diff backup ${schedule.name}: ${error.message}`, error.stack);
        }
      }

      if (dueSchedules.length === 0) {
        return;
      }

      this.logger.log(`Found ${dueSchedules.length} scheduled backup(s) to run`);

      for (const schedule of dueSchedules) {
        try {
          this.logger.log(`Executing scheduled backup: ${schedule.name} (ID: ${schedule.id})`);

          // Execute the backup
          const backupJob = await this.backupService.executeScheduledBackup(schedule);

          this.logger.log(`Scheduled backup completed: ${schedule.name}`);

          // Audit trail: Auto Backup Success
          await this.auditTrailService.logDirect({
            module: AuditModule.SYSTEM,
            action: AuditAction.CREATE,
            entityType: 'BackupJob',
            entityId: backupJob.id,
            userId: schedule.createdById,
            description: `Auto Backup สำเร็จ - Schedule: ${schedule.name}, Job: ${backupJob.jobCode}`,
          });
        } catch (error) {
          this.logger.error(
            `Failed to execute scheduled backup ${schedule.name}: ${error.message}`,
            error.stack,
          );
        }
      }
    } catch (error) {
      this.logger.error('Error in scheduled backup handler:', error.stack);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Clean up expired backups daily at 3 AM
   */
  @Cron('0 3 * * *')
  async cleanupExpiredBackups() {
    try {
      this.logger.log('Starting expired backup cleanup');

      const now = new Date();

      // Find expired backups
      const expiredBackups = await this.prisma.backupJob.findMany({
        where: {
          expiresAt: {
            lt: now,
          },
          status: 'COMPLETED',
        },
      });

      this.logger.log(`Found ${expiredBackups.length} expired backup(s) to clean up`);

      for (const backup of expiredBackups) {
        try {
          await this.backupService.deleteBackup(backup.id);
          this.logger.log(`Deleted expired backup: ${backup.jobCode}`);

          // Audit trail: Expired backup deleted
          await this.auditTrailService.logDirect({
            module: AuditModule.SYSTEM,
            action: AuditAction.DELETE,
            entityType: 'BackupJob',
            entityId: backup.id,
            userId: backup.createdById,
            description: `Auto Delete - ลบ Backup หมดอายุ: ${backup.jobCode}`,
          });
        } catch (error) {
          this.logger.error(
            `Failed to delete expired backup ${backup.jobCode}: ${error.message}`,
          );
        }
      }

      this.logger.log('Expired backup cleanup completed');
    } catch (error) {
      this.logger.error('Error in expired backup cleanup:', error.stack);
    }
  }

  /**
   * Enforce maxBackups limit for each schedule
   */
  @Cron('0 4 * * *')
  async enforceBackupLimits() {
    try {
      this.logger.log('Starting backup limit enforcement');

      // Find schedules with maxBackups set
      const schedules = await this.prisma.backupSchedule.findMany({
        where: {
          maxBackups: {
            not: null,
          },
        },
      });

      for (const schedule of schedules) {
        if (!schedule.maxBackups) continue;

        // Only count FULL backups against maxBackups (Diff backups are auto-managed)
        const backups = await this.prisma.backupJob.findMany({
          where: {
            scheduleId: schedule.id,
            status: 'COMPLETED',
            backupType: 'FULL',
          },
          orderBy: { createdAt: 'desc' },
        });

        // Delete excess backups
        if (backups.length > schedule.maxBackups) {
          const toDelete = backups.slice(schedule.maxBackups);
          for (const backup of toDelete) {
            try {
              await this.backupService.deleteBackup(backup.id);
              this.logger.log(
                `Deleted excess backup ${backup.jobCode} for schedule ${schedule.name}`,
              );

              // Audit trail: Excess backup deleted
              await this.auditTrailService.logDirect({
                module: AuditModule.SYSTEM,
                action: AuditAction.DELETE,
                entityType: 'BackupJob',
                entityId: backup.id,
                userId: schedule.createdById,
                description: `Auto Delete - ลบ Backup เกินจำนวนสูงสุด (${schedule.maxBackups} ไฟล์): ${backup.jobCode}, Schedule: ${schedule.name}`,
              });
            } catch (error) {
              this.logger.error(
                `Failed to delete excess backup ${backup.jobCode}: ${error.message}`,
              );
            }
          }
        }
      }

      this.logger.log('Backup limit enforcement completed');
    } catch (error) {
      this.logger.error('Error in backup limit enforcement:', error.stack);
    }
  }
}

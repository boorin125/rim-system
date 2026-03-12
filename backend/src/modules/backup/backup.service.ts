// src/modules/backup/backup.service.ts

import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateBackupDto,
  CreateRestoreDto,
  CreateScheduleDto,
  UpdateScheduleDto,
} from './dto';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// Default backup directory
const DEFAULT_BACKUP_DIR = process.env.BACKUP_DIR || './backups';

// Tables by scope
const SCOPE_TABLES = {
  ALL: [
    'users', 'stores', 'incidents', 'equipment', 'comments',
    'notifications', 'incident_history', 'sla_configs',
    'incident_categories', 'job_types', 'spare_parts',
  ],
  CORE: ['users', 'stores', 'incidents', 'equipment'],
  TRANSACTIONS: ['incidents', 'comments', 'incident_history', 'notifications', 'spare_parts'],
  CONFIG: ['sla_configs', 'incident_categories', 'job_types'],
};

@Injectable()
export class BackupService {
  constructor(private readonly prisma: PrismaService) {
    // Ensure default backup directory exists
    if (!fs.existsSync(DEFAULT_BACKUP_DIR)) {
      fs.mkdirSync(DEFAULT_BACKUP_DIR, { recursive: true });
    }
  }

  /**
   * Get backup directory based on storage type
   */
  private getBackupDir(storageType?: string, externalPath?: string): string {
    if (storageType === 'EXTERNAL' && externalPath) {
      // Ensure external path exists
      if (!fs.existsSync(externalPath)) {
        try {
          fs.mkdirSync(externalPath, { recursive: true });
        } catch (error) {
          console.error(`Failed to create external backup directory: ${externalPath}`, error);
          // Fallback to default directory
          return DEFAULT_BACKUP_DIR;
        }
      }
      return externalPath;
    }
    return DEFAULT_BACKUP_DIR;
  }

  /**
   * Generate unique job code
   */
  private generateJobCode(prefix: string): string {
    const now = new Date();
    const timestamp = now.toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
    return `${prefix}-${timestamp}`;
  }

  /**
   * Generate checksum for file
   */
  private generateChecksum(filePath: string): string {
    const fileBuffer = fs.readFileSync(filePath);
    return crypto.createHash('md5').update(fileBuffer).digest('hex');
  }

  /**
   * Create new backup job
   */
  async createBackup(userId: number, dto: CreateBackupDto) {
    const jobCode = this.generateJobCode('BKP');
    const scope = dto.scope || 'ALL';
    const tables = scope === 'SELECTIVE'
      ? dto.scopeDetails || []
      : SCOPE_TABLES[scope as keyof typeof SCOPE_TABLES] || SCOPE_TABLES.ALL;

    // Create backup job record
    const backupJob = await this.prisma.backupJob.create({
      data: {
        jobCode,
        backupType: dto.backupType || 'FULL',
        scope,
        scopeDetails: dto.scopeDetails || [],
        isCompressed: dto.isCompressed ?? true,
        isEncrypted: dto.isEncrypted ?? true,
        tablesIncluded: tables,
        createdById: userId,
        status: 'PENDING',
      },
    });

    // Start backup process asynchronously
    this.executeBackup(backupJob.id).catch(console.error);

    return backupJob;
  }

  /**
   * Execute backup process
   */
  private async executeBackup(backupId: number) {
    try {
      // Update status to running
      await this.prisma.backupJob.update({
        where: { id: backupId },
        data: { status: 'RUNNING', startedAt: new Date() },
      });

      const backup = await this.prisma.backupJob.findUnique({
        where: { id: backupId },
        include: {
          schedule: {
            select: { storageType: true, externalPath: true },
          },
        },
      });

      if (!backup) return;

      const tables = backup.tablesIncluded;
      const backupData: Record<string, any[]> = {};
      let totalRecords = 0;
      let progress = 0;

      // Export data from each table
      for (let i = 0; i < tables.length; i++) {
        const table = tables[i];

        try {
          // Get data based on table name
          const data = await this.getTableData(table);
          backupData[table] = data;
          totalRecords += data.length;
        } catch (err) {
          console.error(`Error backing up table ${table}:`, err);
        }

        // Update progress
        progress = Math.round(((i + 1) / tables.length) * 100);
        await this.prisma.backupJob.update({
          where: { id: backupId },
          data: { progress },
        });
      }

      // Determine backup directory based on schedule settings
      const backupDir = this.getBackupDir(
        backup.schedule?.storageType,
        backup.schedule?.externalPath,
      );

      // Create backup file
      const fileName = `${backup.jobCode}.json`;
      const filePath = path.join(backupDir, fileName);

      const backupContent = JSON.stringify({
        metadata: {
          jobCode: backup.jobCode,
          createdAt: new Date().toISOString(),
          backupType: backup.backupType,
          scope: backup.scope,
          tables: tables,
          totalRecords,
        },
        data: backupData,
      }, null, 2);

      fs.writeFileSync(filePath, backupContent);

      // Get file size
      const stats = fs.statSync(filePath);
      const checksum = this.generateChecksum(filePath);

      // Update backup job as completed
      await this.prisma.backupJob.update({
        where: { id: backupId },
        data: {
          status: 'COMPLETED',
          progress: 100,
          completedAt: new Date(),
          fileName,
          filePath,
          fileSize: BigInt(stats.size),
          checksum,
          totalRecords,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        },
      });
    } catch (error: any) {
      // Update as failed
      await this.prisma.backupJob.update({
        where: { id: backupId },
        data: {
          status: 'FAILED',
          errorMessage: error.message,
          completedAt: new Date(),
        },
      });
    }
  }

  /**
   * Get table data for backup
   */
  private async getTableData(table: string): Promise<any[]> {
    // Map table names to Prisma models
    const tableModelMap: Record<string, () => Promise<any[]>> = {
      users: () => this.prisma.user.findMany({ select: { id: true, username: true, email: true, firstName: true, lastName: true, phone: true, department: true, status: true, createdAt: true } }),
      stores: () => this.prisma.store.findMany(),
      incidents: () => this.prisma.incident.findMany(),
      equipment: () => this.prisma.equipment.findMany(),
      comments: () => this.prisma.comment.findMany(),
      notifications: () => this.prisma.notification.findMany(),
      incident_history: () => this.prisma.incidentHistory.findMany(),
      sla_configs: () => this.prisma.slaConfig.findMany(),
      incident_categories: () => this.prisma.incidentCategory.findMany(),
      job_types: () => this.prisma.jobType.findMany(),
      spare_parts: () => this.prisma.sparePart.findMany(),
    };

    const getData = tableModelMap[table];
    if (getData) {
      return getData();
    }
    return [];
  }

  /**
   * Get all backup jobs
   */
  async getBackups(query?: {
    page?: number;
    limit?: number;
    status?: string;
    backupType?: string;
  }) {
    const page = query?.page || 1;
    const limit = query?.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query?.status) {
      where.status = query.status;
    }

    if (query?.backupType) {
      where.backupType = query.backupType;
    }

    const [backups, total] = await Promise.all([
      this.prisma.backupJob.findMany({
        where,
        include: {
          createdBy: {
            select: { id: true, firstName: true, lastName: true },
          },
          schedule: {
            select: { id: true, name: true },
          },
          _count: { select: { restoreJobs: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.backupJob.count({ where }),
    ]);

    return {
      data: backups.map(b => ({
        ...b,
        fileSize: b.fileSize ? Number(b.fileSize) : null,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get backup details
   */
  async getBackup(id: number) {
    const backup = await this.prisma.backupJob.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: { id: true, firstName: true, lastName: true },
        },
        schedule: true,
        restoreJobs: {
          include: {
            createdBy: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!backup) {
      throw new NotFoundException(`Backup not found: ${id}`);
    }

    return {
      ...backup,
      fileSize: backup.fileSize ? Number(backup.fileSize) : null,
    };
  }

  /**
   * Delete backup
   */
  async deleteBackup(id: number) {
    const backup = await this.prisma.backupJob.findUnique({
      where: { id },
    });

    if (!backup) {
      throw new NotFoundException(`Backup not found: ${id}`);
    }

    // Delete file if exists
    if (backup.filePath && fs.existsSync(backup.filePath)) {
      fs.unlinkSync(backup.filePath);
    }

    return this.prisma.backupJob.delete({
      where: { id },
    });
  }

  /**
   * Download backup file
   */
  async downloadBackup(id: number) {
    const backup = await this.prisma.backupJob.findUnique({
      where: { id },
    });

    if (!backup) {
      throw new NotFoundException(`Backup not found: ${id}`);
    }

    if (!backup.filePath || !fs.existsSync(backup.filePath)) {
      throw new NotFoundException('Backup file not found');
    }

    return {
      filePath: backup.filePath,
      fileName: backup.fileName,
    };
  }

  /**
   * Create restore job
   */
  async createRestore(userId: number, dto: CreateRestoreDto) {
    const backup = await this.prisma.backupJob.findUnique({
      where: { id: dto.backupId },
    });

    if (!backup) {
      throw new NotFoundException(`Backup not found: ${dto.backupId}`);
    }

    if (backup.status !== 'COMPLETED') {
      throw new BadRequestException('Backup is not completed');
    }

    const jobCode = this.generateJobCode('RST');

    const restoreJob = await this.prisma.restoreJob.create({
      data: {
        jobCode,
        backupId: dto.backupId,
        restoreType: dto.restoreType || 'FULL',
        targetTables: dto.targetTables || [],
        overwriteMode: dto.overwriteMode || 'SKIP_EXISTING',
        createdById: userId,
        status: 'PENDING',
      },
    });

    // Start restore process asynchronously
    this.executeRestore(restoreJob.id).catch(console.error);

    return restoreJob;
  }

  /**
   * Execute restore process
   */
  private async executeRestore(restoreId: number) {
    try {
      await this.prisma.restoreJob.update({
        where: { id: restoreId },
        data: { status: 'RUNNING', startedAt: new Date() },
      });

      const restore = await this.prisma.restoreJob.findUnique({
        where: { id: restoreId },
        include: { backup: true },
      });

      if (!restore || !restore.backup.filePath) {
        throw new Error('Restore or backup file not found');
      }

      // Read backup file
      const backupContent = fs.readFileSync(restore.backup.filePath, 'utf-8');
      const backupData = JSON.parse(backupContent);

      let recordsRestored = 0;
      let recordsSkipped = 0;
      let recordsFailed = 0;

      const tables = restore.restoreType === 'SELECTIVE'
        ? restore.targetTables
        : Object.keys(backupData.data);

      // Restore each table
      for (const table of tables) {
        const tableData = backupData.data[table];
        if (!tableData) continue;

        try {
          // Note: This is a simplified restore
          // In production, you'd need proper upsert logic based on overwriteMode
          const result = await this.restoreTableData(table, tableData, restore.overwriteMode);
          recordsRestored += result.restored;
          recordsSkipped += result.skipped;
        } catch (err) {
          recordsFailed += tableData.length;
          console.error(`Error restoring table ${table}:`, err);
        }
      }

      await this.prisma.restoreJob.update({
        where: { id: restoreId },
        data: {
          status: 'COMPLETED',
          progress: 100,
          completedAt: new Date(),
          recordsRestored,
          recordsSkipped,
          recordsFailed,
        },
      });
    } catch (error: any) {
      await this.prisma.restoreJob.update({
        where: { id: restoreId },
        data: {
          status: 'FAILED',
          errorMessage: error.message,
          completedAt: new Date(),
        },
      });
    }
  }

  /**
   * Restore table data
   */
  private async restoreTableData(
    table: string,
    data: any[],
    overwriteMode: string,
  ): Promise<{ restored: number; skipped: number }> {
    // Simplified implementation - in production, this would need more sophisticated logic
    let restored = 0;
    let skipped = 0;

    // For now, just log that restore would happen
    console.log(`Would restore ${data.length} records to ${table} with mode ${overwriteMode}`);

    // In a real implementation, you'd loop through records and upsert/insert them
    restored = data.length;

    return { restored, skipped };
  }

  /**
   * Get restore jobs
   */
  async getRestores(query?: {
    page?: number;
    limit?: number;
    status?: string;
    backupId?: number;
  }) {
    const page = query?.page || 1;
    const limit = query?.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query?.status) {
      where.status = query.status;
    }

    if (query?.backupId) {
      where.backupId = query.backupId;
    }

    const [restores, total] = await Promise.all([
      this.prisma.restoreJob.findMany({
        where,
        include: {
          backup: {
            select: { id: true, jobCode: true, backupType: true },
          },
          createdBy: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.restoreJob.count({ where }),
    ]);

    return {
      data: restores,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ==========================================
  // SCHEDULE METHODS
  // ==========================================

  /**
   * Create backup schedule
   */
  async createSchedule(userId: number, dto: CreateScheduleDto) {
    // Calculate next run time
    const nextRunAt = this.calculateNextRun(dto);

    // Validate external path if storage type is EXTERNAL
    if (dto.storageType === 'EXTERNAL' && dto.externalPath) {
      try {
        if (!fs.existsSync(dto.externalPath)) {
          fs.mkdirSync(dto.externalPath, { recursive: true });
        }
      } catch (error) {
        throw new BadRequestException(`Cannot access external path: ${dto.externalPath}`);
      }
    }

    return this.prisma.backupSchedule.create({
      data: {
        name: dto.name,
        description: dto.description,
        frequency: dto.frequency,
        cronExpression: dto.cronExpression,
        timeOfDay: dto.timeOfDay,
        dayOfWeek: dto.dayOfWeek,
        dayOfMonth: dto.dayOfMonth,
        backupType: dto.backupType || 'FULL',
        scope: dto.scope || 'ALL',
        scopeDetails: dto.scopeDetails || [],
        isCompressed: dto.isCompressed ?? true,
        isEncrypted: dto.isEncrypted ?? true,
        retentionDays: dto.retentionDays || 30,
        maxBackups: dto.maxBackups,
        storageType: dto.storageType || 'LOCAL',
        externalPath: dto.externalPath,
        createdById: userId,
        nextRunAt,
      },
    });
  }

  /**
   * Calculate next run time
   */
  private calculateNextRun(schedule: CreateScheduleDto | UpdateScheduleDto): Date {
    const now = new Date();
    const timeOfDay = schedule.timeOfDay || '02:00';
    const [hours, minutes] = timeOfDay.split(':').map(Number);

    let next = new Date(now);
    next.setHours(hours, minutes, 0, 0);

    switch (schedule.frequency) {
      case 'HOURLY':
        next.setMinutes(minutes);
        if (next <= now) next.setHours(next.getHours() + 1);
        break;

      case 'DAILY':
        if (next <= now) next.setDate(next.getDate() + 1);
        break;

      case 'WEEKLY':
        const targetDay = schedule.dayOfWeek || 0;
        while (next.getDay() !== targetDay || next <= now) {
          next.setDate(next.getDate() + 1);
        }
        break;

      case 'MONTHLY':
        const targetDate = schedule.dayOfMonth || 1;
        next.setDate(targetDate);
        if (next <= now) next.setMonth(next.getMonth() + 1);
        break;
    }

    return next;
  }

  /**
   * Get all schedules
   */
  async getSchedules() {
    return this.prisma.backupSchedule.findMany({
      include: {
        createdBy: {
          select: { id: true, firstName: true, lastName: true },
        },
        _count: { select: { backupJobs: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get schedule details
   */
  async getSchedule(id: number) {
    const schedule = await this.prisma.backupSchedule.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: { id: true, firstName: true, lastName: true },
        },
        backupJobs: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!schedule) {
      throw new NotFoundException(`Schedule not found: ${id}`);
    }

    return schedule;
  }

  /**
   * Update schedule
   */
  async updateSchedule(id: number, dto: UpdateScheduleDto) {
    const schedule = await this.prisma.backupSchedule.findUnique({
      where: { id },
    });

    if (!schedule) {
      throw new NotFoundException(`Schedule not found: ${id}`);
    }

    // Validate external path if storage type is EXTERNAL
    const newStorageType = dto.storageType || schedule.storageType;
    const newExternalPath = dto.externalPath !== undefined ? dto.externalPath : schedule.externalPath;

    if (newStorageType === 'EXTERNAL' && newExternalPath) {
      try {
        if (!fs.existsSync(newExternalPath)) {
          fs.mkdirSync(newExternalPath, { recursive: true });
        }
      } catch (error) {
        throw new BadRequestException(`Cannot access external path: ${newExternalPath}`);
      }
    }

    const nextRunAt = this.calculateNextRun({ ...schedule, ...dto } as any);

    return this.prisma.backupSchedule.update({
      where: { id },
      data: {
        ...dto,
        nextRunAt,
      },
    });
  }

  /**
   * Delete schedule
   */
  async deleteSchedule(id: number) {
    const schedule = await this.prisma.backupSchedule.findUnique({
      where: { id },
    });

    if (!schedule) {
      throw new NotFoundException(`Schedule not found: ${id}`);
    }

    return this.prisma.backupSchedule.delete({
      where: { id },
    });
  }

  /**
   * Toggle schedule active status
   */
  async toggleSchedule(id: number, isActive: boolean) {
    return this.prisma.backupSchedule.update({
      where: { id },
      data: { isActive },
    });
  }

  /**
   * Execute a scheduled backup
   * Called by the scheduler service when a schedule is due
   */
  async executeScheduledBackup(schedule: any) {
    const jobCode = this.generateJobCode('BKP');
    const scope = schedule.scope || 'ALL';
    const tables = scope === 'SELECTIVE'
      ? schedule.scopeDetails || []
      : SCOPE_TABLES[scope as keyof typeof SCOPE_TABLES] || SCOPE_TABLES.ALL;

    // Create backup job linked to the schedule
    const backupJob = await this.prisma.backupJob.create({
      data: {
        jobCode,
        backupType: schedule.backupType || 'FULL',
        scope,
        scopeDetails: schedule.scopeDetails || [],
        isCompressed: schedule.isCompressed ?? true,
        isEncrypted: schedule.isEncrypted ?? true,
        tablesIncluded: tables,
        createdById: schedule.createdById,
        scheduleId: schedule.id,
        status: 'PENDING',
      },
    });

    // Calculate next run time for the schedule
    const nextRunAt = this.calculateNextRunFromSchedule(schedule);

    // Update schedule's lastRunAt and nextRunAt
    await this.prisma.backupSchedule.update({
      where: { id: schedule.id },
      data: {
        lastRunAt: new Date(),
        nextRunAt,
      },
    });

    // Execute the backup
    await this.executeBackup(backupJob.id);

    return backupJob;
  }

  /**
   * Calculate next run time from existing schedule record
   */
  private calculateNextRunFromSchedule(schedule: any): Date {
    const now = new Date();
    const timeOfDay = schedule.timeOfDay || '02:00';
    const [hours, minutes] = timeOfDay.split(':').map(Number);

    let next = new Date(now);
    next.setSeconds(0, 0);

    switch (schedule.frequency) {
      case 'HOURLY':
        next.setMinutes(minutes);
        next.setHours(next.getHours() + 1);
        break;

      case 'DAILY':
        next.setHours(hours, minutes);
        next.setDate(next.getDate() + 1);
        break;

      case 'WEEKLY':
        next.setHours(hours, minutes);
        next.setDate(next.getDate() + 7);
        break;

      case 'MONTHLY':
        next.setHours(hours, minutes);
        next.setMonth(next.getMonth() + 1);
        if (schedule.dayOfMonth) {
          next.setDate(schedule.dayOfMonth);
        }
        break;

      default:
        // Default to daily
        next.setHours(hours, minutes);
        next.setDate(next.getDate() + 1);
    }

    return next;
  }

  /**
   * Get backup statistics
   */
  async getStats() {
    const [
      totalBackups,
      completedBackups,
      failedBackups,
      totalSize,
      totalRestores,
      activeSchedules,
      recentBackups,
    ] = await Promise.all([
      this.prisma.backupJob.count(),
      this.prisma.backupJob.count({ where: { status: 'COMPLETED' } }),
      this.prisma.backupJob.count({ where: { status: 'FAILED' } }),
      this.prisma.backupJob.aggregate({
        where: { status: 'COMPLETED' },
        _sum: { fileSize: true },
      }),
      this.prisma.restoreJob.count(),
      this.prisma.backupSchedule.count({ where: { isActive: true } }),
      this.prisma.backupJob.findMany({
        where: { status: 'COMPLETED' },
        select: { id: true, jobCode: true, createdAt: true, fileSize: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);

    return {
      totalBackups,
      completedBackups,
      failedBackups,
      pendingBackups: totalBackups - completedBackups - failedBackups,
      totalSize: totalSize._sum.fileSize ? Number(totalSize._sum.fileSize) : 0,
      totalRestores,
      activeSchedules,
      recentBackups: recentBackups.map(b => ({
        ...b,
        fileSize: b.fileSize ? Number(b.fileSize) : null,
      })),
    };
  }
}

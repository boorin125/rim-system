// src/modules/backup/backup.service.ts

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
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
import * as bcrypt from 'bcrypt';

// Default backup directory
const DEFAULT_BACKUP_DIR = process.env.BACKUP_DIR || './Backup';

// Backup config file path (stores externalCopyPath etc.)
const BACKUP_CONFIG_FILE = path.join(process.cwd(), 'backup-config.json');

interface BackupConfig {
  externalCopyPath?: string;
}

// Tables by scope
const SCOPE_TABLES = {
  ALL: [
    // Core config (no FK deps)
    'system_configs', 'sla_configs', 'incident_categories', 'job_types',
    // Users & roles
    'users', 'user_role_assignments',
    // Stores & equipment
    'stores', 'equipment',
    // Knowledge base (categories before articles; self-ref handled specially)
    'knowledge_categories', 'knowledge_articles',
    // Incidents & related
    'incidents', 'incident_assignees', 'incident_reassignments', 'incident_ratings',
    'sla_defenses', 'comments', 'spare_parts', 'incident_history', 'notifications',
    // Outsource
    'outsource_jobs', 'outsource_bids',
    // PM
    'pm_records', 'pm_equipment_records',
    // Equipment logs
    'equipment_logs',
  ],
  CORE: ['users', 'user_role_assignments', 'stores', 'incidents', 'equipment'],
  TRANSACTIONS: ['incidents', 'comments', 'incident_history', 'notifications', 'spare_parts'],
  CONFIG: ['system_configs', 'sla_configs', 'incident_categories', 'job_types'],
};

@Injectable()
export class BackupService {
  constructor(private readonly prisma: PrismaService) {
    // Ensure default backup directory exists
    if (!fs.existsSync(DEFAULT_BACKUP_DIR)) {
      fs.mkdirSync(DEFAULT_BACKUP_DIR, { recursive: true });
    }
  }

  /** Read global backup config from JSON file */
  getBackupConfig(): BackupConfig {
    try {
      if (fs.existsSync(BACKUP_CONFIG_FILE)) {
        return JSON.parse(fs.readFileSync(BACKUP_CONFIG_FILE, 'utf-8'));
      }
    } catch { /* ignore */ }
    return {};
  }

  /** Save global backup config to JSON file */
  saveBackupConfig(config: BackupConfig): BackupConfig {
    fs.writeFileSync(BACKUP_CONFIG_FILE, JSON.stringify(config, null, 2));
    return config;
  }

  /** Test if external path is writable */
  testExternalPath(targetPath: string): { accessible: boolean; message: string } {
    try {
      if (!fs.existsSync(targetPath)) {
        fs.mkdirSync(targetPath, { recursive: true });
      }
      const testFile = path.join(targetPath, '.rim-write-test');
      fs.writeFileSync(testFile, 'test');
      fs.unlinkSync(testFile);
      return { accessible: true, message: 'เข้าถึง Path ได้สำเร็จ' };
    } catch (error: any) {
      return { accessible: false, message: error.message };
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
   * Block Backup/Restore features for TRIAL licenses
   */
  private async checkBackupFeatureAllowed(): Promise<void> {
    // Find any active non-TRIAL license — ignore rogue trial records created by machineId changes
    const license = await this.prisma.license.findFirst({
      where: { status: 'ACTIVE', licenseType: { not: 'TRIAL' } },
    });
    if (!license) {
      throw new ForbiddenException({
        code: 'TRIAL_RESTRICTED',
        message: 'ฟีเจอร์ Backup/Restore ไม่รองรับใน Trial License กรุณา Activate License เพื่อใช้งาน',
      });
    }
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
    await this.checkBackupFeatureAllowed();

    // Enforce password when external copy path is configured
    const bkConfig = this.getBackupConfig();
    if (bkConfig.externalCopyPath && !dto.password) {
      throw new BadRequestException(
        'ต้องตั้ง Password เนื่องจากมีการ Copy Backup ไปยัง External Path',
      );
    }

    const jobCode = this.generateJobCode('BKP');
    const scope = dto.scope || 'ALL';
    const tables = scope === 'SELECTIVE'
      ? dto.scopeDetails || []
      : SCOPE_TABLES[scope as keyof typeof SCOPE_TABLES] || SCOPE_TABLES.ALL;

    // Create backup job record
    const backupJob = await this.prisma.backupJob.create({
      data: {
        jobCode,
        customName: dto.customName || null,
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
    this.executeBackup(backupJob.id, dto.password).catch(console.error);

    return backupJob;
  }

  /**
   * Execute backup process
   * password: plain-text password to hash and embed
   * preHashedPassword: already-hashed password to embed directly (used by scheduled backups)
   */
  private async executeBackup(backupId: number, password?: string, preHashedPassword?: string) {
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

      // Backup logo files as base64 (org logo + service report logo)
      const logoBackups: Record<string, string> = {};
      const logoKeys = ['organization_logo', 'sr_provider_logo'];
      for (const key of logoKeys) {
        const config = (backupData.system_configs as any[] || []).find((c: any) => c.key === key);
        if (config?.value) {
          const logoFilePath = path.join(process.cwd(), config.value.replace(/^\//, ''));
          try {
            if (fs.existsSync(logoFilePath)) {
              logoBackups[key] = fs.readFileSync(logoFilePath).toString('base64');
            }
          } catch { /* skip unreadable logo */ }
        }
      }

      // Determine backup directory based on schedule settings
      const backupDir = this.getBackupDir(
        backup.schedule?.storageType,
        backup.schedule?.externalPath,
      );

      // Create backup file — include custom name as prefix if provided
      const safeName = backup.customName
        ? backup.customName.replace(/[\s/\\:*?"<>|]/g, '_') + '_'
        : '';
      const fileName = `${safeName}${backup.jobCode}.json`;
      const filePath = path.join(backupDir, fileName);

      const passwordHash = preHashedPassword || (password ? await bcrypt.hash(password, 10) : undefined);

      const backupContent = JSON.stringify({
        metadata: {
          jobCode: backup.jobCode,
          createdAt: new Date().toISOString(),
          backupType: backup.backupType,
          scope: backup.scope,
          tables: tables,
          totalRecords,
          ...(passwordHash && { passwordHash }),
          ...(Object.keys(logoBackups).length > 0 && { logos: logoBackups }),
        },
        data: backupData,
      }, null, 2);

      fs.writeFileSync(filePath, backupContent);

      // Copy to external path if configured (always save locally first)
      const bkConfig = this.getBackupConfig();
      if (bkConfig.externalCopyPath) {
        try {
          if (!fs.existsSync(bkConfig.externalCopyPath)) {
            fs.mkdirSync(bkConfig.externalCopyPath, { recursive: true });
          }
          fs.copyFileSync(filePath, path.join(bkConfig.externalCopyPath, fileName));
        } catch (extError: any) {
          console.warn(`[Backup] External copy failed: ${extError.message}`);
          // Do not fail the backup — local copy is already saved
        }
      }

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
      // Config
      system_configs: () => this.prisma.systemConfig.findMany(),
      sla_configs: () => this.prisma.slaConfig.findMany(),
      incident_categories: () => this.prisma.incidentCategory.findMany(),
      job_types: () => this.prisma.jobType.findMany(),
      // Users (exclude sensitive 2FA secret; password set to default on restore)
      users: () => this.prisma.user.findMany({
        select: {
          id: true, username: true, email: true,
          firstName: true, lastName: true, phone: true,
          department: true, technicianType: true, serviceCenter: true,
          responsibleProvinces: true, address: true,
          cumulativeRating: true, status: true, isProtected: true,
          createdAt: true, updatedAt: true, createdBy: true,
        },
      }),
      user_role_assignments: () => this.prisma.userRoleAssignment.findMany(),
      // Stores & equipment
      stores: () => this.prisma.store.findMany(),
      equipment: () => this.prisma.equipment.findMany(),
      equipment_logs: () => this.prisma.equipmentLog.findMany(),
      // Knowledge base
      knowledge_categories: () => this.prisma.knowledgeCategory.findMany(),
      knowledge_articles: () => this.prisma.knowledgeArticle.findMany(),
      // Incidents & related
      incidents: () => this.prisma.incident.findMany(),
      incident_assignees: () => this.prisma.incidentAssignee.findMany(),
      incident_reassignments: () => this.prisma.incidentReassignment.findMany(),
      incident_ratings: () => this.prisma.incidentRating.findMany(),
      sla_defenses: () => this.prisma.slaDefense.findMany(),
      comments: () => this.prisma.comment.findMany(),
      spare_parts: () => this.prisma.sparePart.findMany(),
      incident_history: () => this.prisma.incidentHistory.findMany(),
      notifications: () => this.prisma.notification.findMany(),
      // Outsource
      outsource_jobs: () => this.prisma.outsourceJob.findMany(),
      outsource_bids: () => this.prisma.outsourceBid.findMany(),
      // PM
      pm_records: () => this.prisma.pmRecord.findMany(),
      pm_equipment_records: () => this.prisma.pmEquipmentRecord.findMany(),
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
    await this.checkBackupFeatureAllowed();
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
   * Restore from uploaded file content
   */
  async restoreFromFile(userId: number, content: string, password?: string, selectedTables?: string[]) {
    await this.checkBackupFeatureAllowed();
    let backupData: any;
    try {
      backupData = JSON.parse(content);
    } catch {
      throw new BadRequestException('Invalid backup file format');
    }

    const metadata = backupData.metadata;
    const data = backupData.data;

    if (!metadata || !data) {
      throw new BadRequestException('Invalid backup file structure');
    }

    // Verify password if backup is protected
    if (metadata.passwordHash) {
      if (!password) {
        throw new BadRequestException('PASSWORD_REQUIRED');
      }
      const valid = await bcrypt.compare(password, metadata.passwordHash);
      if (!valid) {
        throw new BadRequestException('INVALID_PASSWORD');
      }
    }

    const stats: Record<string, number> = {};
    const errors: Record<string, string> = {};
    let totalRestored = 0;

    // Restore order respects foreign key dependencies
    const restoreOrder = [
      // No-FK config first
      'system_configs', 'sla_configs', 'incident_categories', 'job_types',
      // Users & roles
      'users', 'user_role_assignments',
      // Stores & equipment
      'stores', 'equipment',
      // Knowledge base (self-ref categories: root nodes first, then children)
      'knowledge_categories', 'knowledge_articles',
      // Incidents & relations
      'incidents', 'incident_assignees', 'incident_reassignments', 'incident_ratings',
      'sla_defenses', 'comments', 'spare_parts', 'incident_history', 'notifications',
      // Outsource
      'outsource_jobs', 'outsource_bids',
      // PM
      'pm_records', 'pm_equipment_records',
      // Equipment logs (last — depends on equipment + users)
      'equipment_logs',
    ];

    for (const table of restoreOrder) {
      // Skip tables not selected by user (if selective restore)
      if (selectedTables && selectedTables.length > 0 && !selectedTables.includes(table)) continue;
      const tableData = data[table];
      if (!Array.isArray(tableData) || tableData.length === 0) continue;
      try {
        const result = await this.restoreTableFromFile(table, tableData);
        stats[table] = result.restored;
        totalRestored += result.restored;
      } catch (err: any) {
        const msg = err?.message || 'Unknown error';
        errors[table] = msg;
        stats[table] = 0;
        console.error(`Error restoring table ${table}:`, msg);
      }
    }

    // Restore logo files from base64 in metadata
    if (metadata.logos && typeof metadata.logos === 'object') {
      const uploadsLogoDir = path.join(process.cwd(), 'uploads', 'logos');
      if (!fs.existsSync(uploadsLogoDir)) {
        fs.mkdirSync(uploadsLogoDir, { recursive: true });
      }
      for (const [key, base64] of Object.entries(metadata.logos)) {
        const config = await this.prisma.systemConfig.findUnique({ where: { key } });
        if (config?.value) {
          const logoFilePath = path.join(process.cwd(), config.value.replace(/^\//, ''));
          try {
            fs.writeFileSync(logoFilePath, Buffer.from(base64 as string, 'base64'));
          } catch { /* skip */ }
        }
      }
    }

    const hasErrors = Object.keys(errors).length > 0;
    return {
      success: !hasErrors || totalRestored > 0,
      message: `Restored ${totalRestored} records${hasErrors ? ` (some tables had errors)` : ''}`,
      stats,
      errors: hasErrors ? errors : undefined,
    };
  }

  /**
   * Restore table data from file (createMany skipDuplicates)
   */
  private async restoreTableFromFile(table: string, data: any[]): Promise<{ restored: number }> {
    const dateFields = [
      'createdAt', 'updatedAt', 'resolvedAt', 'closedAt', 'slaDeadline',
      'openDate', 'purchaseDate', 'warrantyExpiry', 'expiresAt', 'lastReopenedAt',
      'respondedAt', 'scheduledAt', 'checkInAt', 'checkOutAt', 'performedAt',
      'issuedAt', 'activatedAt', 'lastActivationAt', 'lastCheckAt',
      'publishedAt', 'deadline', 'postedAt', 'awardedAt', 'completedAt',
      'verifiedAt', 'paidAt', 'documentSubmittedAt', 'submittedAt',
      'cancellationRequestedAt', 'cancellationConfirmedAt',
      'sparePartsConfirmedAt', 'documentsReceivedAt', 'lockedUntil',
      'lastLogin', 'lastPasswordChange', 'lastPmAt',
      'inventoryListTokenExpiresAt', 'storeSignedAt',
    ];

    const processed = data.map(record => {
      const r: any = { ...record };
      for (const f of dateFields) {
        if (r[f]) r[f] = new Date(r[f]);
      }
      return r;
    });

    const defaultPasswordHash = await bcrypt.hash('Password@1', 10);

    const tableMap: Record<string, (d: any[]) => Promise<{ count: number }>> = {
      // Config — update existing keys first, then insert new ones (avoids sequence/id conflict)
      system_configs: async (d) => {
        const existingKeys = new Set(
          (await this.prisma.systemConfig.findMany({ select: { key: true } })).map(r => r.key)
        );
        // Update existing
        for (const row of d) {
          if (existingKeys.has(row.key)) {
            await this.prisma.systemConfig.updateMany({
              where: { key: row.key },
              data: { value: row.value, description: row.description, isEncrypted: row.isEncrypted ?? false, category: row.category || 'general' },
            });
          }
        }
        // Insert new (no explicit id — let DB auto-assign after sequence reset)
        const newRows = d.filter(row => !existingKeys.has(row.key));
        if (newRows.length > 0) {
          // Reset sequence to avoid collision with existing ids
          await this.prisma.$executeRawUnsafe(
            `SELECT setval(pg_get_serial_sequence('system_configs', 'id'), COALESCE((SELECT MAX(id) FROM system_configs), 0) + 1, false)`
          );
          await this.prisma.systemConfig.createMany({
            data: newRows.map(row => ({ key: row.key, value: row.value, description: row.description, isEncrypted: row.isEncrypted ?? false, category: row.category || 'general' })),
            skipDuplicates: true,
          });
        }
        return { count: d.length };
      },
      sla_configs: (d) => this.prisma.slaConfig.createMany({ data: d, skipDuplicates: true }),
      incident_categories: (d) => this.prisma.incidentCategory.createMany({ data: d, skipDuplicates: true }),
      job_types: (d) => this.prisma.jobType.createMany({ data: d, skipDuplicates: true }),
      // licenses — intentionally excluded from backup/restore (must be activated via key)

      // Users (restore with default password since we don't back up hashed passwords)
      users: (d) => this.prisma.user.createMany({
        data: d.map(u => ({
          id: u.id,
          username: u.username,
          email: u.email,
          password: defaultPasswordHash,
          firstName: u.firstName || null,
          lastName: u.lastName || null,
          phone: u.phone || null,
          department: u.department || null,
          technicianType: u.technicianType || null,
          serviceCenter: u.serviceCenter || null,
          responsibleProvinces: u.responsibleProvinces || [],
          address: u.address || null,
          cumulativeRating: u.cumulativeRating ?? 5.0,
          status: u.status || 'ACTIVE',
          isProtected: false,
          createdAt: u.createdAt ? new Date(u.createdAt) : new Date(),
          updatedAt: u.updatedAt ? new Date(u.updatedAt) : new Date(),
          createdBy: u.createdBy || null,
        })),
        skipDuplicates: true,
      }),
      user_role_assignments: async (d) => {
        // Filter out assignments where userId doesn't exist (user may have been skipped due to duplicate email)
        const existingUsers = await this.prisma.user.findMany({
          where: { id: { in: d.map((r: any) => r.userId) } },
          select: { id: true },
        });
        const validIds = new Set(existingUsers.map((u) => u.id));
        const valid = d.filter((r: any) => validIds.has(r.userId));
        if (valid.length === 0) return { count: 0 };
        return this.prisma.userRoleAssignment.createMany({ data: valid, skipDuplicates: true });
      },

      // Stores & equipment
      stores: (d) => this.prisma.store.createMany({ data: d, skipDuplicates: true }),
      equipment: (d) => this.prisma.equipment.createMany({ data: d, skipDuplicates: true }),
      equipment_logs: (d) => this.prisma.equipmentLog.createMany({ data: d, skipDuplicates: true }),

      // Knowledge base (self-referential categories: restore root nodes first, then children)
      knowledge_categories: async (d) => {
        const roots = d.filter(c => !c.parentId);
        const children = d.filter(c => !!c.parentId);
        const r1 = await this.prisma.knowledgeCategory.createMany({ data: roots, skipDuplicates: true });
        const r2 = await this.prisma.knowledgeCategory.createMany({ data: children, skipDuplicates: true });
        return { count: r1.count + r2.count };
      },
      knowledge_articles: (d) => this.prisma.knowledgeArticle.createMany({ data: d, skipDuplicates: true }),

      // Incidents & related
      incidents: (d) => this.prisma.incident.createMany({ data: d, skipDuplicates: true }),
      incident_assignees: (d) => this.prisma.incidentAssignee.createMany({ data: d, skipDuplicates: true }),
      incident_reassignments: (d) => this.prisma.incidentReassignment.createMany({ data: d, skipDuplicates: true }),
      incident_ratings: (d) => this.prisma.incidentRating.createMany({ data: d, skipDuplicates: true }),
      sla_defenses: (d) => this.prisma.slaDefense.createMany({ data: d, skipDuplicates: true }),
      comments: (d) => this.prisma.comment.createMany({ data: d, skipDuplicates: true }),
      spare_parts: (d) => this.prisma.sparePart.createMany({ data: d, skipDuplicates: true }),
      incident_history: (d) => this.prisma.incidentHistory.createMany({ data: d, skipDuplicates: true }),
      notifications: (d) => this.prisma.notification.createMany({ data: d, skipDuplicates: true }),

      // Outsource
      outsource_jobs: (d) => this.prisma.outsourceJob.createMany({ data: d, skipDuplicates: true }),
      outsource_bids: (d) => this.prisma.outsourceBid.createMany({ data: d, skipDuplicates: true }),

      // PM
      pm_records: (d) => this.prisma.pmRecord.createMany({ data: d, skipDuplicates: true }),
      pm_equipment_records: (d) => this.prisma.pmEquipmentRecord.createMany({ data: d, skipDuplicates: true }),
    };

    const fn = tableMap[table];
    if (!fn) return { restored: 0 };

    const result = await fn(processed);
    return { restored: result.count };
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
    await this.checkBackupFeatureAllowed();
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

    const schedulePasswordHash = dto.schedulePassword
      ? await bcrypt.hash(dto.schedulePassword, 10)
      : undefined;

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
        schedulePassword: schedulePasswordHash,
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

    const { schedulePassword: newPassword, ...dtoWithoutPassword } = dto;
    const schedulePasswordHash = newPassword
      ? await bcrypt.hash(newPassword, 10)
      : (newPassword === '' ? null : undefined);

    return this.prisma.backupSchedule.update({
      where: { id },
      data: {
        ...dtoWithoutPassword,
        ...(schedulePasswordHash !== undefined && { schedulePassword: schedulePasswordHash }),
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

    // Execute the backup (pass stored hash directly to avoid double-hashing)
    await this.executeBackup(backupJob.id, undefined, schedule.schedulePassword || undefined);

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

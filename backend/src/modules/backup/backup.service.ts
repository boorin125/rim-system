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
import * as zlib from 'zlib';
import { exec, execSync } from 'child_process';

// Default backup directory
const DEFAULT_BACKUP_DIR = process.env.BACKUP_DIR || './Backup';

// Backup config file path (stores externalCopyPath etc.)
const BACKUP_CONFIG_FILE = path.join(process.cwd(), 'backup-config.json');

export interface SmbConfig {
  path: string;       // \\server\share or //server/share
  username: string;
  password: string;
  domain?: string;
}

export interface BackupConfig {
  externalCopyPath?: string;
  smb?: SmbConfig | null;
}

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

// Tables by scope
// NOTE: licenses + license_activation_logs are intentionally EXCLUDED from all scopes.
//       They are server-specific and must be activated via key on each server.
//       Session/token tables (push_subscriptions, refresh_tokens, password_reset_tokens)
//       and system metadata (backup_jobs, app_versions, patches) are also excluded.
const SCOPE_TABLES = {
  ALL: [
    // Core config (no FK deps)
    'system_configs', 'sla_configs', 'incident_categories', 'job_types',
    // Users & roles
    'users', 'user_role_assignments',
    // Stores & equipment
    'stores', 'equipment',
    // Store/equipment lifecycle requests
    'store_delete_requests', 'equipment_retirement_requests',
    // Knowledge base (categories before articles; self-ref handled specially)
    'knowledge_categories', 'knowledge_articles',
    'knowledge_article_feedbacks', 'knowledge_article_usages',
    // Incidents & related
    'incidents', 'incident_assignees', 'incident_reassignments', 'incident_ratings',
    'sla_defenses', 'comments', 'spare_parts', 'incident_history', 'notifications',
    // Outsource
    'outsource_jobs', 'outsource_bids',
    // PM
    'pm_records', 'pm_equipment_records',
    // Equipment logs
    'equipment_logs',
    // Performance scores
    'technician_performance_scores',
    // Audit trail
    'audit_logs',
  ],
  // Full system — same tables as ALL (uploads/ handled separately in executeBackup)
  FULL_SYSTEM: [
    'system_configs', 'sla_configs', 'incident_categories', 'job_types',
    'users', 'user_role_assignments',
    'stores', 'equipment',
    'store_delete_requests', 'equipment_retirement_requests',
    'knowledge_categories', 'knowledge_articles',
    'knowledge_article_feedbacks', 'knowledge_article_usages',
    'incidents', 'incident_assignees', 'incident_reassignments', 'incident_ratings',
    'sla_defenses', 'comments', 'spare_parts', 'incident_history', 'notifications',
    'outsource_jobs', 'outsource_bids',
    'pm_records', 'pm_equipment_records',
    'equipment_logs',
    'technician_performance_scores',
    'audit_logs',
  ],
  // Master data only — for migrating to a new/production server without test transactions
  MASTER: [
    'system_configs', 'sla_configs', 'incident_categories', 'job_types',
    'users', 'user_role_assignments',
    'stores', 'equipment',
    'knowledge_categories', 'knowledge_articles',
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

  /** Parse UNC/SMB path → smbclient URL (//server/share) + optional subpath */
  private parseSmbUrl(uncPath: string): string {
    // \\server\share\sub → //server/share  (smbclient only needs server+share)
    const normalized = uncPath.replace(/\\/g, '/').replace(/^\/\//, '');
    const parts = normalized.split('/').filter(Boolean);
    if (parts.length < 2) throw new Error('Path ต้องมีรูปแบบ \\\\server\\share');
    return `//${parts[0]}/${parts[1]}`;
  }

  /** Build smbclient -U auth string */
  private smbUserArg(smb: SmbConfig): string {
    const user = smb.domain ? `${smb.domain}\\${smb.username}` : smb.username;
    return `${user}%${smb.password}`;
  }

  /** Copy local file to SMB share */
  async copySmbFile(localFilePath: string, fileName: string, smb: SmbConfig): Promise<void> {
    const url = this.parseSmbUrl(smb.path);
    const user = this.smbUserArg(smb);
    const cmd = `smbclient "${url}" -U "${user}" -c "put \\"${localFilePath}\\" \\"${fileName}\\""`;
    await new Promise<void>((resolve, reject) => {
      exec(cmd, (err, _stdout, stderr) => {
        if (err) reject(new Error(stderr?.trim() || err.message));
        else resolve();
      });
    });
  }

  /** Test SMB connection by writing + deleting a temp file */
  async testSmbConnection(smb: SmbConfig): Promise<{ accessible: boolean; message: string }> {
    const tmpName = `.rim-smb-test-${Date.now()}`;
    const tmpLocal = path.join(DEFAULT_BACKUP_DIR, tmpName);
    try {
      fs.writeFileSync(tmpLocal, 'rim-smb-test');
      const url = this.parseSmbUrl(smb.path);
      const user = this.smbUserArg(smb);
      const cmd = `smbclient "${url}" -U "${user}" -c "put \\"${tmpLocal}\\" \\"${tmpName}\\"; del \\"${tmpName}\\""`;
      await new Promise<void>((resolve, reject) => {
        exec(cmd, (err, _stdout, stderr) => {
          if (err) reject(new Error(stderr?.trim() || err.message));
          else resolve();
        });
      });
      return { accessible: true, message: `เชื่อมต่อ SMB สำเร็จ: ${smb.path}` };
    } catch (err: any) {
      return { accessible: false, message: err.message };
    } finally {
      try { fs.unlinkSync(tmpLocal); } catch { /* ignore */ }
    }
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
    const timestamp = now.toISOString().replace(/[-:T.Z]/g, '').slice(0, 12);
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
   * Read backup file content — handles both gzip (.bkp) and plain JSON (.json)
   */
  private readBackupContent(filePath: string): string {
    const buf = fs.readFileSync(filePath);
    if (buf[0] === 0x1f && buf[1] === 0x8b) {
      return zlib.gunzipSync(buf).toString('utf-8');
    }
    return buf.toString('utf-8');
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

    const bkpPrefix = dto.backupType === 'DIFFERENTIAL' ? 'BKP-D' : 'BKP-F';
    const jobCode = this.generateJobCode(bkpPrefix);
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

      // --- Differential: find base Full backup ---
      let sinceTimestamp: Date | undefined;
      let baseBackupId: number | undefined;
      let baseJobCode: string | undefined;

      if (backup.backupType === 'DIFFERENTIAL') {
        const fullBackup = await this.prisma.backupJob.findFirst({
          where: { backupType: 'FULL', status: 'COMPLETED' },
          orderBy: { completedAt: 'desc' },
        });
        if (fullBackup?.completedAt) {
          sinceTimestamp = fullBackup.completedAt;
          baseBackupId = fullBackup.id;
          baseJobCode = fullBackup.jobCode;
          await this.prisma.backupJob.update({
            where: { id: backupId },
            data: { sinceTimestamp, baseBackupId },
          });
        } else {
          // No Full backup found — fall back to Full
          await this.prisma.backupJob.update({
            where: { id: backupId },
            data: { backupType: 'FULL' },
          });
          sinceTimestamp = undefined;
        }
      }

      // Export data from each table
      for (let i = 0; i < tables.length; i++) {
        const table = tables[i];

        try {
          const data = await this.getTableData(table, sinceTimestamp);
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

      const baseName = backup.customName
        ? backup.customName.replace(/[\s/\\:*?"<>|]/g, '_')
        : backup.jobCode;
      const fileName = baseName + '.tar';
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
          ...(sinceTimestamp && { sinceTimestamp: sinceTimestamp.toISOString() }),
          ...(baseBackupId && { baseBackupId }),
          ...(baseJobCode && { baseJobCode }),
          ...(passwordHash && { passwordHash }),
          ...(Object.keys(logoBackups).length > 0 && { logos: logoBackups }),
        },
        data: backupData,
      });

      // Every backup bundles db.bkp + uploads/ into a single .tar
      const tempDir = path.join(DEFAULT_BACKUP_DIR, `tmp-bkp-${backupId}`);
      fs.mkdirSync(tempDir, { recursive: true });
      try {
        fs.writeFileSync(path.join(tempDir, 'db.bkp'), zlib.gzipSync(Buffer.from(backupContent, 'utf-8')));

        const uploadsTarPath = path.join(tempDir, 'uploads.tar.gz');
        if (fs.existsSync(UPLOADS_DIR)) {
          execSync(`tar -czf "${uploadsTarPath}" -C "${path.dirname(UPLOADS_DIR)}" uploads`, { timeout: 600000 });
        } else {
          execSync(`tar -czf "${uploadsTarPath}" -T /dev/null`, { timeout: 10000 });
        }

        execSync(`tar -cf "${filePath}" -C "${tempDir}" db.bkp uploads.tar.gz`, { timeout: 60000 });
      } finally {
        try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch { /* ignore */ }
      }

      // Copy to external path / SMB if configured (always save locally first)
      const bkConfig = this.getBackupConfig();
      if (bkConfig.externalCopyPath) {
        try {
          if (!fs.existsSync(bkConfig.externalCopyPath)) {
            fs.mkdirSync(bkConfig.externalCopyPath, { recursive: true });
          }
          fs.copyFileSync(filePath, path.join(bkConfig.externalCopyPath, fileName));
        } catch (extError: any) {
          console.warn(`[Backup] External copy failed: ${extError.message}`);
        }
      }
      if (bkConfig.smb?.path) {
        try {
          await this.copySmbFile(filePath, fileName, bkConfig.smb);
        } catch (smbError: any) {
          console.warn(`[Backup] SMB copy failed: ${smbError.message}`);
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

      // After a Full backup completes, purge all older Differential backups —
      // the Full supersedes them and they waste disk space.
      if (backup.backupType === 'FULL') {
        const oldDiffs = await this.prisma.backupJob.findMany({
          where: { backupType: 'DIFFERENTIAL', id: { not: backupId } },
          select: { id: true, filePath: true },
        });
        for (const diff of oldDiffs) {
          if (diff.filePath) {
            try { fs.unlinkSync(diff.filePath); } catch { /* file may already be gone */ }
          }
        }
        if (oldDiffs.length > 0) {
          await this.prisma.backupJob.deleteMany({
            where: { id: { in: oldDiffs.map(d => d.id) } },
          });
          console.log(`[Backup] Purged ${oldDiffs.length} old Differential backup(s) after Full backup ${backupId}`);
        }
      }
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
  private async getTableData(table: string, since?: Date): Promise<any[]> {
    // Config tables: always export all (small, may be updated without updatedAt tracking)
    const CONFIG_TABLES = new Set(['system_configs', 'sla_configs', 'incident_categories', 'job_types']);
    const s = since && !CONFIG_TABLES.has(table) ? since : undefined;

    // Helpers always return { where } so TypeScript never sees a union type
    const w = (): { where: any } => ({
      where: s ? { OR: [{ createdAt: { gt: s } }, { updatedAt: { gt: s } }] } : undefined,
    });
    const wc = (): { where: any } => ({
      where: s ? { createdAt: { gt: s } } : undefined,
    });

    const tableModelMap: Record<string, () => Promise<any[]>> = {
      // Config — always full
      system_configs: () => this.prisma.systemConfig.findMany(),
      sla_configs: () => this.prisma.slaConfig.findMany(),
      incident_categories: () => this.prisma.incidentCategory.findMany(),
      job_types: () => this.prisma.jobType.findMany(),
      // Users (createdAt + updatedAt)
      users: () => this.prisma.user.findMany({
        ...w(),
        select: {
          id: true, username: true, email: true,
          firstName: true, lastName: true,
          firstNameEn: true, lastNameEn: true,
          phone: true, department: true,
          technicianType: true, serviceCenter: true,
          responsibleProvinces: true,
          address: true, subDistrict: true, district: true, province: true,
          cumulativeRating: true, status: true, isProtected: true,
          createdAt: true, updatedAt: true, createdBy: true,
        },
      }),
      user_role_assignments: () => this.prisma.userRoleAssignment.findMany(wc()),
      // Stores & equipment (createdAt + updatedAt)
      stores: () => this.prisma.store.findMany(w()),
      equipment: () => this.prisma.equipment.findMany(w()),
      equipment_logs: () => this.prisma.equipmentLog.findMany(wc()),
      store_delete_requests: () => this.prisma.storeDeleteRequest.findMany(w()),
      equipment_retirement_requests: () => this.prisma.equipmentRetirementRequest.findMany(w()),
      // Knowledge base (createdAt + updatedAt)
      knowledge_categories: () => this.prisma.knowledgeCategory.findMany(w()),
      knowledge_articles: () => this.prisma.knowledgeArticle.findMany(w()),
      knowledge_article_feedbacks: () => this.prisma.knowledgeArticleFeedback.findMany(wc()),
      knowledge_article_usages: () => this.prisma.knowledgeArticleUsage.findMany(wc()),
      // Incidents & related (createdAt + updatedAt)
      incidents: () => this.prisma.incident.findMany(w()),
      incident_assignees: () => this.prisma.incidentAssignee.findMany(wc()),
      incident_reassignments: () => this.prisma.incidentReassignment.findMany(wc()),
      incident_ratings: () => this.prisma.incidentRating.findMany(w()),
      sla_defenses: () => this.prisma.slaDefense.findMany(wc()),
      comments: () => this.prisma.comment.findMany(w()),
      spare_parts: () => this.prisma.sparePart.findMany(w()),
      incident_history: () => this.prisma.incidentHistory.findMany(wc()),
      notifications: () => this.prisma.notification.findMany(wc()),
      // Outsource (createdAt + updatedAt)
      outsource_jobs: () => this.prisma.outsourceJob.findMany(w()),
      outsource_bids: () => this.prisma.outsourceBid.findMany(w()),
      // PM (createdAt + updatedAt)
      pm_records: () => this.prisma.pmRecord.findMany(w()),
      pm_equipment_records: () => this.prisma.pmEquipmentRecord.findMany(w()),
      // Performance scores (createdAt + updatedAt)
      technician_performance_scores: () => this.prisma.technicianPerformanceScore.findMany(w()),
      // Audit trail (createdAt only)
      audit_logs: () => this.prisma.auditLog.findMany(wc()),
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
      return { id, deleted: true };
    }

    // Delete file if exists
    if (backup.filePath && fs.existsSync(backup.filePath)) {
      fs.unlinkSync(backup.filePath);
    }

    // Remove FK references before deleting
    await this.prisma.restoreJob.deleteMany({ where: { backupId: id } });
    await this.prisma.backupJob.updateMany({
      where: { baseBackupId: id },
      data: { baseBackupId: null },
    });

    await this.prisma.backupJob.delete({ where: { id } });
    return { id, deleted: true };
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
    this._tableColumnCache.clear();
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
      // Store/equipment lifecycle (depends on stores/equipment)
      'store_delete_requests', 'equipment_retirement_requests',
      // Knowledge base (self-ref categories: root nodes first, then children)
      'knowledge_categories', 'knowledge_articles',
      'knowledge_article_feedbacks', 'knowledge_article_usages',
      // Incidents & relations
      'incidents', 'incident_assignees', 'incident_reassignments', 'incident_ratings',
      'sla_defenses', 'comments', 'spare_parts', 'incident_history', 'notifications',
      // Outsource
      'outsource_jobs', 'outsource_bids',
      // PM
      'pm_records', 'pm_equipment_records',
      // Equipment logs (depends on equipment + users)
      'equipment_logs',
      // Performance scores (depends on users)
      'technician_performance_scores',
      // Audit trail (depends on users)
      'audit_logs',
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

    // Cleanup: delete records created AFTER this backup's timestamp
    // (records that didn't exist when Full backup was taken)
    if (metadata.backupType !== 'DIFFERENTIAL' && metadata.createdAt) {
      const backupTs = new Date(metadata.createdAt);
      const cleanupTables = selectedTables && selectedTables.length > 0 ? selectedTables : undefined;
      await this.cleanupPostRestore(backupTs, cleanupTables);
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
   * Delete records created AFTER backupTimestamp (reverse FK order)
   * Used after Full restore to remove records that didn't exist at backup time
   */
  private async cleanupPostRestore(backupTimestamp: Date, selectedTables?: string[]) {
    // Reverse FK order: children deleted before parents
    const deleteOrder = [
      'audit_logs', 'technician_performance_scores', 'equipment_logs',
      'pm_equipment_records', 'pm_records',
      'outsource_bids', 'outsource_jobs',
      'notifications', 'incident_history', 'spare_parts', 'comments',
      'sla_defenses', 'incident_ratings', 'incident_reassignments', 'incident_assignees',
      'incidents',
      'knowledge_article_usages', 'knowledge_article_feedbacks',
      'knowledge_articles', 'knowledge_categories',
      'equipment_retirement_requests', 'store_delete_requests',
      'equipment', 'stores',
      'user_role_assignments', 'users',
      // Config tables excluded — small and replaced via upsert
    ];

    const after = { gt: backupTimestamp };
    const tableMap: Record<string, () => Promise<any>> = {
      audit_logs:                    () => this.prisma.auditLog.deleteMany({ where: { createdAt: after } }),
      technician_performance_scores: () => this.prisma.technicianPerformanceScore.deleteMany({ where: { createdAt: after } }),
      equipment_logs:                () => this.prisma.equipmentLog.deleteMany({ where: { createdAt: after } }),
      pm_equipment_records:          () => this.prisma.pmEquipmentRecord.deleteMany({ where: { createdAt: after } }),
      pm_records:                    () => this.prisma.pmRecord.deleteMany({ where: { createdAt: after } }),
      outsource_bids:                () => this.prisma.outsourceBid.deleteMany({ where: { createdAt: after } }),
      outsource_jobs:                () => this.prisma.outsourceJob.deleteMany({ where: { createdAt: after } }),
      notifications:                 () => this.prisma.notification.deleteMany({ where: { createdAt: after } }),
      incident_history:              () => this.prisma.incidentHistory.deleteMany({ where: { createdAt: after } }),
      spare_parts:                   () => this.prisma.sparePart.deleteMany({ where: { createdAt: after } }),
      comments:                      () => this.prisma.comment.deleteMany({ where: { createdAt: after } }),
      sla_defenses:                  () => this.prisma.slaDefense.deleteMany({ where: { createdAt: after } }),
      incident_ratings:              () => this.prisma.incidentRating.deleteMany({ where: { createdAt: after } }),
      incident_reassignments:        () => this.prisma.incidentReassignment.deleteMany({ where: { createdAt: after } }),
      incident_assignees:            () => this.prisma.incidentAssignee.deleteMany({ where: { assignedAt: after } }),
      incidents:                     () => this.prisma.incident.deleteMany({ where: { createdAt: after } }),
      knowledge_article_usages:      () => this.prisma.knowledgeArticleUsage.deleteMany({ where: { createdAt: after } }),
      knowledge_article_feedbacks:   () => this.prisma.knowledgeArticleFeedback.deleteMany({ where: { createdAt: after } }),
      knowledge_articles:            () => this.prisma.knowledgeArticle.deleteMany({ where: { createdAt: after } }),
      knowledge_categories:          () => this.prisma.knowledgeCategory.deleteMany({ where: { createdAt: after } }),
      equipment_retirement_requests: () => this.prisma.equipmentRetirementRequest.deleteMany({ where: { createdAt: after } }),
      store_delete_requests:         () => this.prisma.storeDeleteRequest.deleteMany({ where: { createdAt: after } }),
      equipment:                     () => this.prisma.equipment.deleteMany({ where: { createdAt: after } }),
      stores:                        () => this.prisma.store.deleteMany({ where: { createdAt: after } }),
      user_role_assignments:         () => this.prisma.userRoleAssignment.deleteMany({ where: { createdAt: after } }),
      users:                         () => this.prisma.user.deleteMany({ where: { createdAt: after, isProtected: false } }),
    };

    for (const table of deleteOrder) {
      if (selectedTables && !selectedTables.includes(table)) continue;
      if (!tableMap[table]) continue;
      try {
        await tableMap[table]();
      } catch (err: any) {
        console.warn(`[Restore Cleanup] Could not delete from ${table}:`, err?.message);
      }
    }
  }

  /**
   * Step 1: Upload backup file to temp storage, return metadata for UI preview
   */
  async uploadRestoreTemp(buffer: Buffer): Promise<{ tempId: string; metadata: any; tables: string[] }> {
    await this.checkBackupFeatureAllowed();
    let backupData: any;
    try {
      backupData = JSON.parse(buffer.toString('utf-8'));
    } catch {
      throw new BadRequestException('Invalid backup file format');
    }
    const metadata = backupData.metadata;
    const data = backupData.data;
    if (!metadata || !data) throw new BadRequestException('Invalid backup file structure');

    const tempDir = path.join(DEFAULT_BACKUP_DIR, 'restore-temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    const tempId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const tempPath = path.join(tempDir, `${tempId}.json`);
    fs.writeFileSync(tempPath, buffer);

    setTimeout(() => { try { fs.unlinkSync(tempPath); } catch { /* ignore */ } }, 30 * 60 * 1000);

    const tables = Object.keys(data).filter(k => Array.isArray(data[k]) && data[k].length > 0);
    return { tempId, metadata: { ...metadata, passwordHash: undefined, isEncrypted: !!metadata.passwordHash }, tables };
  }

  /**
   * Upload restore from disk path (multer diskStorage) — reads metadata lazily without full JSON.parse
   * File is already on disk; we extract only the leading chunk to get metadata + table keys.
   */
  async uploadRestoreTempFromDisk(filePath: string): Promise<{ tempId: string; metadata: any; tables: string[]; isFullSystem?: boolean }> {
    await this.checkBackupFeatureAllowed();

    if (!fs.existsSync(filePath)) throw new BadRequestException('Uploaded file not found');

    // Detect file format by magic bytes
    const header = Buffer.alloc(512);
    const fdH = fs.openSync(filePath, 'r');
    fs.readSync(fdH, header, 0, 512, 0);
    fs.closeSync(fdH);

    const isTar = header.slice(257, 262).toString('ascii') === 'ustar';
    const isGzip = header[0] === 0x1f && header[1] === 0x8b;

    const baseName = path.basename(filePath).replace(/^upload-/, '').replace(/\.(json|bkp|tmp|tar)$/, '');
    const tempId = baseName;
    const destDir = path.join(DEFAULT_BACKUP_DIR, 'restore-temp');
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

    if (isTar) {
      // Full System backup — extract tar to a directory
      const extractDir = path.join(destDir, `${tempId}-fullsys`);
      if (fs.existsSync(extractDir)) fs.rmSync(extractDir, { recursive: true, force: true });
      fs.mkdirSync(extractDir, { recursive: true });
      try {
        execSync(`tar -xf "${filePath}" -C "${extractDir}"`, { timeout: 120000 });
      } catch {
        fs.unlinkSync(filePath);
        fs.rmSync(extractDir, { recursive: true, force: true });
        throw new BadRequestException('Invalid backup file — failed to extract tar');
      }
      fs.unlinkSync(filePath);

      // Read db.bkp from extracted contents
      const dbBkpPath = path.join(extractDir, 'db.bkp');
      if (!fs.existsSync(dbBkpPath)) {
        fs.rmSync(extractDir, { recursive: true, force: true });
        throw new BadRequestException('Invalid Full System backup — db.bkp not found inside tar');
      }

      let head: string;
      try {
        head = zlib.gunzipSync(fs.readFileSync(dbBkpPath)).toString('utf-8');
      } catch {
        fs.rmSync(extractDir, { recursive: true, force: true });
        throw new BadRequestException('Invalid backup file — failed to decompress db.bkp');
      }

      const metaMatch = head.match(/"metadata"\s*:\s*(\{[\s\S]*?\})\s*,\s*"data"/);
      if (!metaMatch) {
        fs.rmSync(extractDir, { recursive: true, force: true });
        throw new BadRequestException('Invalid backup file format — metadata not found');
      }
      let metadata: any;
      try { metadata = JSON.parse(metaMatch[1]); } catch {
        fs.rmSync(extractDir, { recursive: true, force: true });
        throw new BadRequestException('Invalid backup metadata');
      }

      const tablesFromHead: string[] = [];
      const dataIdx = head.indexOf('"data"');
      if (dataIdx !== -1) {
        const dataChunk = head.slice(dataIdx + 6).trimStart().replace(/^:/, '').trimStart();
        const keyRe = /"(\w+)"\s*:/g;
        let m: RegExpExecArray | null;
        while ((m = keyRe.exec(dataChunk)) !== null) tablesFromHead.push(m[1]);
      }

      setTimeout(() => { try { fs.rmSync(extractDir, { recursive: true, force: true }); } catch { /* ignore */ } }, 30 * 60 * 1000);

      return {
        tempId,
        metadata: { ...metadata, passwordHash: undefined, isEncrypted: !!metadata.passwordHash },
        tables: tablesFromHead.length > 0 ? tablesFromHead : [],
        isFullSystem: true,
      };
    }

    let head: string;
    if (isGzip) {
      try {
        head = zlib.gunzipSync(fs.readFileSync(filePath)).toString('utf-8');
      } catch {
        fs.unlinkSync(filePath);
        throw new BadRequestException('Invalid backup file — failed to decompress');
      }
    } else {
      const CHUNK = 64 * 1024;
      const fd = fs.openSync(filePath, 'r');
      const buf = Buffer.alloc(CHUNK);
      const bytesRead = fs.readSync(fd, buf, 0, CHUNK, 0);
      fs.closeSync(fd);
      head = buf.slice(0, bytesRead).toString('utf-8');
    }

    const metaMatch = head.match(/"metadata"\s*:\s*(\{[\s\S]*?\})\s*,\s*"data"/);
    if (!metaMatch) {
      fs.unlinkSync(filePath);
      throw new BadRequestException('Invalid backup file format — metadata not found');
    }
    let metadata: any;
    try {
      metadata = JSON.parse(metaMatch[1]);
    } catch {
      fs.unlinkSync(filePath);
      throw new BadRequestException('Invalid backup metadata');
    }

    const dataIdx = head.indexOf('"data"');
    const tablesFromHead: string[] = [];
    if (dataIdx !== -1) {
      const dataChunk = head.slice(dataIdx + 6).trimStart().replace(/^:/, '').trimStart();
      const keyRe = /"(\w+)"\s*:/g;
      let m: RegExpExecArray | null;
      while ((m = keyRe.exec(dataChunk)) !== null) tablesFromHead.push(m[1]);
    }

    const destExt = isGzip ? '.bkp' : '.json';
    const destPath = path.join(destDir, `${tempId}${destExt}`);
    fs.renameSync(filePath, destPath);

    setTimeout(() => { try { fs.unlinkSync(destPath); } catch { /* ignore */ } }, 30 * 60 * 1000);

    return {
      tempId,
      metadata: { ...metadata, passwordHash: undefined, isEncrypted: !!metadata.passwordHash },
      tables: tablesFromHead.length > 0 ? tablesFromHead : [],
    };
  }

  /**
   * Step 2: Restore from temp file using tempId
   */
  async restoreFromTempFile(userId: number, tempId: string, password?: string, selectedTables?: string[]) {
    const restoreDir = path.join(DEFAULT_BACKUP_DIR, 'restore-temp');

    // Full System restore — extracted directory exists
    const extractDir = path.join(restoreDir, `${tempId}-fullsys`);
    if (fs.existsSync(extractDir)) {
      const dbBkpPath = path.join(extractDir, 'db.bkp');
      const uploadsTarPath = path.join(extractDir, 'uploads.tar.gz');

      if (!fs.existsSync(dbBkpPath)) throw new BadRequestException('Full System backup is corrupted — db.bkp missing');

      const content = this.readBackupContent(dbBkpPath);
      const result = await this.restoreFromFile(userId, content, password, selectedTables);

      // Restore uploads/ volume
      if (fs.existsSync(uploadsTarPath)) {
        const uploadsParent = path.dirname(UPLOADS_DIR);
        try {
          execSync(`tar -xzf "${uploadsTarPath}" -C "${uploadsParent}"`, { timeout: 600000 });
          (result as any).uploadsRestored = true;
        } catch (err: any) {
          (result as any).uploadsError = `uploads restore failed: ${err.message}`;
        }
      }

      try { fs.rmSync(extractDir, { recursive: true, force: true }); } catch { /* ignore */ }
      return result;
    }

    // Normal DB-only restore — support both .bkp (gzip) and legacy .json
    const bkpPath = path.join(restoreDir, `${tempId}.bkp`);
    const jsonPath = path.join(restoreDir, `${tempId}.json`);
    const tempPath = fs.existsSync(bkpPath) ? bkpPath : jsonPath;
    if (!fs.existsSync(tempPath)) throw new BadRequestException('Temp file not found or expired. Please re-upload the backup file.');
    const content = this.readBackupContent(tempPath);
    try { fs.unlinkSync(tempPath); } catch { /* ignore */ }
    return this.restoreFromFile(userId, content, password, selectedTables);
  }

  /**
   * Restore from a Differential backup stored on server (auto-fetches Full backup)
   * backupId = the DIFFERENTIAL BackupJob id
   */
  async restoreWithDifferential(
    userId: number,
    diffBackupId: number,
    password?: string,
    selectedTables?: string[],
  ) {
    await this.checkBackupFeatureAllowed();

    const diffJob = await this.prisma.backupJob.findUnique({ where: { id: diffBackupId } });
    if (!diffJob) throw new BadRequestException('Differential backup not found');
    if (diffJob.backupType !== 'DIFFERENTIAL') throw new BadRequestException('Selected backup is not a Differential backup');
    if (!diffJob.baseBackupId) throw new BadRequestException('This differential backup has no linked Full backup');
    if (!diffJob.filePath || !fs.existsSync(diffJob.filePath)) throw new BadRequestException('Differential backup file not found on server');

    const fullJob = await this.prisma.backupJob.findUnique({ where: { id: diffJob.baseBackupId } });
    if (!fullJob) throw new BadRequestException('Linked Full backup record not found');
    if (!fullJob.filePath || !fs.existsSync(fullJob.filePath)) throw new BadRequestException('Linked Full backup file not found on server');

    // Parse both files — supports gzip (.bkp) and legacy plain JSON (.json)
    let fullData: any, diffData: any;
    try {
      fullData = JSON.parse(this.readBackupContent(fullJob.filePath));
      diffData = JSON.parse(this.readBackupContent(diffJob.filePath));
    } catch {
      throw new BadRequestException('Failed to read backup files');
    }

    // Verify password (diff file is authoritative; full may also be protected)
    if (diffData.metadata?.passwordHash) {
      if (!password) throw new BadRequestException('PASSWORD_REQUIRED');
      const valid = await bcrypt.compare(password, diffData.metadata.passwordHash);
      if (!valid) throw new BadRequestException('INVALID_PASSWORD');
    }

    const stats: Record<string, number> = {};
    const errors: Record<string, string> = {};
    let totalRestored = 0;

    const restoreOrder = [
      'system_configs', 'sla_configs', 'incident_categories', 'job_types',
      'users', 'user_role_assignments',
      'stores', 'equipment',
      'store_delete_requests', 'equipment_retirement_requests',
      'knowledge_categories', 'knowledge_articles',
      'knowledge_article_feedbacks', 'knowledge_article_usages',
      'incidents', 'incident_assignees', 'incident_reassignments', 'incident_ratings',
      'sla_defenses', 'comments', 'spare_parts', 'incident_history', 'notifications',
      'outsource_jobs', 'outsource_bids',
      'pm_records', 'pm_equipment_records',
      'equipment_logs',
      'technician_performance_scores',
      'audit_logs',
    ];

    // Step 1: Restore Full (skip duplicates)
    for (const table of restoreOrder) {
      if (selectedTables && selectedTables.length > 0 && !selectedTables.includes(table)) continue;
      const tableData = fullData.data?.[table];
      if (!Array.isArray(tableData) || tableData.length === 0) continue;
      try {
        const result = await this.restoreTableFromFile(table, tableData);
        stats[table] = result.restored;
        totalRestored += result.restored;
      } catch (err: any) {
        errors[table] = err?.message || 'Unknown error';
        stats[table] = 0;
      }
    }

    // Step 2: Apply Differential (upsert — overwrite existing records)
    for (const table of restoreOrder) {
      if (selectedTables && selectedTables.length > 0 && !selectedTables.includes(table)) continue;
      const tableData = diffData.data?.[table];
      if (!Array.isArray(tableData) || tableData.length === 0) continue;
      try {
        const result = await this.restoreTableUpsert(table, tableData);
        stats[table] = (stats[table] || 0) + result.restored;
        totalRestored += result.restored;
      } catch (err: any) {
        errors[table] = err?.message || 'Unknown error';
      }
    }

    // Restore logos from diff (preferred) then full
    const logosMeta = diffData.metadata?.logos || fullData.metadata?.logos || {};
    if (Object.keys(logosMeta).length > 0) {
      const uploadsLogoDir = path.join(process.cwd(), 'uploads', 'logos');
      if (!fs.existsSync(uploadsLogoDir)) fs.mkdirSync(uploadsLogoDir, { recursive: true });
      for (const [key, base64] of Object.entries(logosMeta)) {
        const config = await this.prisma.systemConfig.findUnique({ where: { key } });
        if (config?.value) {
          try {
            fs.writeFileSync(path.join(process.cwd(), config.value.replace(/^\//, '')), Buffer.from(base64 as string, 'base64'));
          } catch { /* skip */ }
        }
      }
    }

    const hasErrors = Object.keys(errors).length > 0;
    return {
      success: !hasErrors || totalRestored > 0,
      message: `Restored ${totalRestored} records from Full + Differential${hasErrors ? ' (some tables had errors)' : ''}`,
      fullBackup: { id: fullJob.id, jobCode: fullJob.jobCode, fileName: fullJob.fileName },
      diffBackup: { id: diffJob.id, jobCode: diffJob.jobCode, fileName: diffJob.fileName },
      stats,
      errors: hasErrors ? errors : undefined,
    };
  }

  /**
   * Upsert table records (for applying Differential on top of Full)
   * Uses updateOrCreate pattern per record to overwrite existing data
   */
  private async restoreTableUpsert(table: string, data: any[]): Promise<{ restored: number }> {
    return this.restoreTableFromFile(table, data);
  }

  // Cache of table column metadata to avoid repeated DB queries within one restore
  private _tableColumnCache: Map<string, Map<string, { udt_name: string; data_type: string }>> = new Map();

  private async getTableColumnMeta(table: string): Promise<Map<string, { udt_name: string; data_type: string }>> {
    if (this._tableColumnCache.has(table)) return this._tableColumnCache.get(table)!;
    const rows = await this.prisma.$queryRawUnsafe<{ column_name: string; udt_name: string; data_type: string }[]>(
      `SELECT column_name, udt_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`,
      table,
    );
    const meta = new Map(rows.map(r => [r.column_name, { udt_name: r.udt_name, data_type: r.data_type }]));
    this._tableColumnCache.set(table, meta);
    return meta;
  }

  // Generic UPSERT via raw SQL — filters columns to target DB schema + casts enum types
  private async upsertRaw(table: string, data: any[]): Promise<{ count: number }> {
    if (!data.length) return { count: 0 };
    const colMeta = await this.getTableColumnMeta(table);
    const columns = Object.keys(data[0]).filter(c => colMeta.has(c));
    if (!columns.length) return { count: 0 };

    // Build column SQL with enum casts where needed
    const colSql = columns.map(c => `"${c}"`).join(', ');
    const updateCols = columns.filter(c => c !== 'id');
    if (!updateCols.length) return { count: 0 };
    const updateSql = updateCols.map(c => {
      const meta = colMeta.get(c)!;
      const cast = meta.data_type === 'USER-DEFINED' ? `::"${meta.udt_name}"` : '';
      return `"${c}" = EXCLUDED."${c}"${cast ? '' : ''}`;
    }).join(', ');

    const BATCH = 50;
    for (let i = 0; i < data.length; i += BATCH) {
      const batch = data.slice(i, i + BATCH);
      const vals = batch.map((_, ri) =>
        `(${columns.map((col, ci) => {
          const meta = colMeta.get(col)!;
          const cast = meta.data_type === 'USER-DEFINED' ? `::"${meta.udt_name}"` : '';
          return `$${ri * columns.length + ci + 1}${cast}`;
        }).join(', ')})`
      ).join(', ');
      const params = batch.flatMap(row => columns.map(c => row[c] ?? null));
      try {
        await this.prisma.$executeRawUnsafe(
          `INSERT INTO "${table}" (${colSql}) VALUES ${vals} ON CONFLICT (id) DO UPDATE SET ${updateSql}`,
          ...params
        );
      } catch (batchErr: any) {
        // Batch failed — retry row by row to skip bad rows
        for (const row of batch) {
          const singleVals = `(${columns.map((col, ci) => {
            const meta = colMeta.get(col)!;
            const cast = meta.data_type === 'USER-DEFINED' ? `::"${meta.udt_name}"` : '';
            return `$${ci + 1}${cast}`;
          }).join(', ')})`;
          const singleParams = columns.map(c => row[c] ?? null);
          try {
            await this.prisma.$executeRawUnsafe(
              `INSERT INTO "${table}" (${colSql}) VALUES ${singleVals} ON CONFLICT (id) DO UPDATE SET ${updateSql}`,
              ...singleParams
            );
          } catch { /* skip individual bad row */ }
        }
      }
    }
    return { count: data.length };
  }

  // UPSERT for tables with array/Json fields — uses Prisma model methods
  private async upsertWithArrayFields<T extends { id: any }>(
    findFn: (ids: any[]) => Promise<{ id: any }[]>,
    updateFn: (id: any, data: any) => Promise<any>,
    createFn: (data: any[]) => Promise<{ count: number }>,
    data: T[],
  ): Promise<{ count: number }> {
    if (!data.length) return { count: 0 };
    const existingIds = new Set(
      (await findFn(data.map(r => r.id))).map(r => r.id)
    );
    const existing = data.filter(r => existingIds.has(r.id));
    const newRows = data.filter(r => !existingIds.has(r.id));
    const BATCH = 20;
    for (let i = 0; i < existing.length; i += BATCH) {
      await Promise.all(
        existing.slice(i, i + BATCH).map(row => updateFn(row.id, row).catch(() => {}))
      );
    }
    if (newRows.length > 0) await createFn(newRows);
    return { count: data.length };
  }

  /**
   * Restore table data from file (createMany skipDuplicates)
   */
  private async restoreTableFromFile(table: string, data: any[]): Promise<{ restored: number }> {
    const dateFields = [
      'createdAt', 'updatedAt', 'resolvedAt', 'closedAt', 'slaDeadline',
      'openDate', 'closeDate', 'purchaseDate', 'warrantyExpiry', 'expiresAt',
      'lastReopenedAt', 'respondedAt', 'scheduledAt', 'checkInAt', 'checkedInAt',
      'performedAt', 'issuedAt', 'activatedAt', 'lastActivationAt', 'lastCheckAt',
      'publishedAt', 'deadline', 'postedAt', 'awardedAt', 'completedAt',
      'verifiedAt', 'paidAt', 'documentSubmittedAt', 'submittedAt',
      'cancellationRequestedAt', 'cancellationConfirmedAt',
      'sparePartsConfirmedAt', 'documentsReceivedAt', 'lockedUntil',
      'lastLogin', 'lastPasswordChange', 'lastPmAt',
      'inventoryListTokenExpiresAt', 'storeSignedAt',
      // Incident token/tracking dates
      'ratingTokenCreatedAt', 'ratingTokenExpiresAt', 'ratingEmailSentAt',
      'serviceReportTokenCreatedAt', 'serviceReportTokenExpiresAt',
      'techConfirmedAt', 'emailSentAt',
      // Assignment/reassignment
      'assignedAt', 'reassignedAt', 'approvedAt', 'reviewedAt',
      // Notification
      'readAt',
      // Knowledge
      'usedAt',
      // Outsource
      'proposedStartDate', 'estimatedArrivalTime', 'startedAt',
      // Performance scores
      'startDate', 'endDate', 'calculatedAt',
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
      // Scalar-only tables: UPSERT via raw SQL (overwrite existing, insert new)
      sla_configs: (d) => this.upsertRaw('sla_configs', d),
      incident_categories: (d) => this.upsertRaw('incident_categories', d),
      job_types: (d) => this.upsertRaw('job_types', d),
      // licenses — always skipped (server-specific, must be activated via key)

      // Users — upsert: update all fields except password for existing users
      users: async (d) => {
        const existingIds = new Set(
          (await this.prisma.user.findMany({
            where: { id: { in: d.map((u: any) => u.id) } },
            select: { id: true },
          })).map(u => u.id)
        );
        const existing = d.filter((u: any) => existingIds.has(u.id));
        const newRows = d.filter((u: any) => !existingIds.has(u.id));
        const BATCH = 20;
        for (let i = 0; i < existing.length; i += BATCH) {
          await Promise.all(existing.slice(i, i + BATCH).map((u: any) =>
            this.prisma.user.update({
              where: { id: u.id },
              data: {
                username: u.username, email: u.email,
                firstName: u.firstName ?? null, lastName: u.lastName ?? null,
                firstNameEn: u.firstNameEn ?? null, lastNameEn: u.lastNameEn ?? null,
                phone: u.phone ?? null, department: u.department ?? null,
                technicianType: u.technicianType ?? null, serviceCenter: u.serviceCenter ?? null,
                responsibleProvinces: u.responsibleProvinces ?? [],
                address: u.address ?? null, subDistrict: u.subDistrict ?? null,
                district: u.district ?? null, province: u.province ?? null,
                cumulativeRating: u.cumulativeRating ?? 5.0,
                status: u.status ?? 'ACTIVE',
                updatedAt: u.updatedAt ? new Date(u.updatedAt) : new Date(),
              },
            }).catch(() => {})
          ));
        }
        if (newRows.length > 0) {
          await this.prisma.user.createMany({
            data: newRows.map((u: any) => ({
              id: u.id, username: u.username, email: u.email,
              password: defaultPasswordHash,
              firstName: u.firstName ?? null, lastName: u.lastName ?? null,
              firstNameEn: u.firstNameEn ?? null, lastNameEn: u.lastNameEn ?? null,
              phone: u.phone ?? null, department: u.department ?? null,
              technicianType: u.technicianType ?? null, serviceCenter: u.serviceCenter ?? null,
              responsibleProvinces: u.responsibleProvinces ?? [],
              address: u.address ?? null, subDistrict: u.subDistrict ?? null,
              district: u.district ?? null, province: u.province ?? null,
              cumulativeRating: u.cumulativeRating ?? 5.0,
              status: u.status ?? 'ACTIVE', isProtected: false,
              createdAt: u.createdAt ? new Date(u.createdAt) : new Date(),
              updatedAt: u.updatedAt ? new Date(u.updatedAt) : new Date(),
              createdBy: u.createdBy ?? null,
            })),
            skipDuplicates: true,
          });
        }
        return { count: d.length };
      },
      user_role_assignments: async (d) => {
        const existingUsers = await this.prisma.user.findMany({
          where: { id: { in: d.map((r: any) => r.userId) } },
          select: { id: true },
        });
        const validIds = new Set(existingUsers.map(u => u.id));
        const valid = d.filter((r: any) => validIds.has(r.userId));
        if (!valid.length) return { count: 0 };
        return this.upsertRaw('user_role_assignments', valid);
      },

      // Stores & equipment
      stores: (d) => this.upsertRaw('stores', d),
      equipment: (d) => this.upsertRaw('equipment', d),
      // equipment_logs has Json fields — use Prisma upsert
      equipment_logs: (d) => this.upsertWithArrayFields(
        (ids) => this.prisma.equipmentLog.findMany({ where: { id: { in: ids } }, select: { id: true } }),
        (id, data) => this.prisma.equipmentLog.update({ where: { id }, data: data as any }),
        (data) => this.prisma.equipmentLog.createMany({ data: data as any[], skipDuplicates: true }),
        d,
      ),
      store_delete_requests: (d) => this.upsertRaw('store_delete_requests', d),
      equipment_retirement_requests: (d) => this.upsertRaw('equipment_retirement_requests', d),

      // Knowledge base — self-referential categories: roots first, then children
      knowledge_categories: async (d) => {
        const roots = d.filter((c: any) => !c.parentId);
        const children = d.filter((c: any) => !!c.parentId);
        const r1 = await this.upsertRaw('knowledge_categories', roots);
        const r2 = await this.upsertRaw('knowledge_categories', children);
        return { count: r1.count + r2.count };
      },
      // knowledge_articles has array fields
      knowledge_articles: (d) => this.upsertWithArrayFields(
        (ids) => this.prisma.knowledgeArticle.findMany({ where: { id: { in: ids } }, select: { id: true } }),
        (id, data) => this.prisma.knowledgeArticle.update({ where: { id }, data: data as any }),
        (data) => this.prisma.knowledgeArticle.createMany({ data: data as any[], skipDuplicates: true }),
        d,
      ),
      knowledge_article_feedbacks: (d) => this.upsertRaw('knowledge_article_feedbacks', d),
      knowledge_article_usages: (d) => this.upsertRaw('knowledge_article_usages', d),

      // Incidents (array fields: beforePhotos, afterPhotos, signedReportPhotos)
      incidents: (d) => this.upsertWithArrayFields(
        (ids) => this.prisma.incident.findMany({ where: { id: { in: ids } }, select: { id: true } }),
        (id, data) => this.prisma.incident.update({ where: { id }, data: data as any }),
        (data) => this.prisma.incident.createMany({ data: data as any[], skipDuplicates: true }),
        d,
      ),
      incident_assignees: (d) => this.upsertRaw('incident_assignees', d),
      incident_reassignments: (d) => this.upsertRaw('incident_reassignments', d),
      incident_ratings: (d) => this.upsertRaw('incident_ratings', d),
      sla_defenses: (d) => this.upsertRaw('sla_defenses', d),
      // comments has array field: attachments
      comments: (d) => this.upsertWithArrayFields(
        (ids) => this.prisma.comment.findMany({ where: { id: { in: ids } }, select: { id: true } }),
        (id, data) => this.prisma.comment.update({ where: { id }, data: data as any }),
        (data) => this.prisma.comment.createMany({ data: data as any[], skipDuplicates: true }),
        d,
      ),
      spare_parts: (d) => this.upsertRaw('spare_parts', d),
      incident_history: (d) => this.upsertRaw('incident_history', d),
      notifications: (d) => this.upsertRaw('notifications', d),

      // Outsource — outsource_jobs has array + Json fields
      outsource_jobs: (d) => this.upsertWithArrayFields(
        (ids) => this.prisma.outsourceJob.findMany({ where: { id: { in: ids } }, select: { id: true } }),
        (id, data) => this.prisma.outsourceJob.update({ where: { id }, data: data as any }),
        (data) => this.prisma.outsourceJob.createMany({ data: data as any[], skipDuplicates: true }),
        d,
      ),
      outsource_bids: (d) => this.upsertRaw('outsource_bids', d),

      // PM — both tables have array fields
      pm_records: (d) => this.upsertWithArrayFields(
        (ids) => this.prisma.pmRecord.findMany({ where: { id: { in: ids } }, select: { id: true } }),
        (id, data) => this.prisma.pmRecord.update({ where: { id }, data: data as any }),
        (data) => this.prisma.pmRecord.createMany({ data: data as any[], skipDuplicates: true }),
        d,
      ),
      pm_equipment_records: (d) => this.upsertWithArrayFields(
        (ids) => this.prisma.pmEquipmentRecord.findMany({ where: { id: { in: ids } }, select: { id: true } }),
        (id, data) => this.prisma.pmEquipmentRecord.update({ where: { id }, data: data as any }),
        (data) => this.prisma.pmEquipmentRecord.createMany({ data: data as any[], skipDuplicates: true }),
        d,
      ),
      technician_performance_scores: (d) => this.upsertRaw('technician_performance_scores', d),
      audit_logs: (d) => this.upsertRaw('audit_logs', d),
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

    const isFull = dto.backupType === 'FULL' || !dto.backupType;
    const diffIntervalMinutes = isFull ? (dto.diffIntervalMinutes ?? null) : null;
    const diffStartTime = isFull ? (dto.diffStartTime ?? null) : null;

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
        diffIntervalMinutes,
        diffStartTime,
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

    const newBackupType = dto.backupType ?? schedule.backupType;
    const isFull = newBackupType === 'FULL';
    const newDiffInterval = isFull
      ? (dto.diffIntervalMinutes !== undefined ? dto.diffIntervalMinutes : schedule.diffIntervalMinutes)
      : null;
    const newDiffStartTime = isFull
      ? (dto.diffStartTime !== undefined ? dto.diffStartTime : schedule.diffStartTime)
      : null;

    return this.prisma.backupSchedule.update({
      where: { id },
      data: {
        ...dtoWithoutPassword,
        ...(schedulePasswordHash !== undefined && { schedulePassword: schedulePasswordHash }),
        nextRunAt,
        diffIntervalMinutes: newDiffInterval,
        diffStartTime: newDiffStartTime,
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
    const jobCode = this.generateJobCode('BKP-F');
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

    // After FULL backup: delete old Differential backups + arm next Diff run
    if ((schedule.backupType === 'FULL' || !schedule.backupType) && schedule.diffIntervalMinutes) {
      await this.cleanupDiffBackupsForSchedule(schedule.id);
      const nextDiffRunAt = this.calcFirstDiffRunAt(schedule.diffStartTime);
      await this.prisma.backupSchedule.update({
        where: { id: schedule.id },
        data: { nextDiffRunAt },
      });
    }

    return backupJob;
  }

  /**
   * Execute a scheduled Differential backup (triggered by diffIntervalMinutes)
   */
  async executeScheduledDiffBackup(schedule: any) {
    const jobCode = this.generateJobCode('BKP-D');
    const scope = schedule.scope || 'ALL';
    const tables = scope === 'SELECTIVE'
      ? schedule.scopeDetails || []
      : SCOPE_TABLES[scope as keyof typeof SCOPE_TABLES] || SCOPE_TABLES.ALL;

    const backupJob = await this.prisma.backupJob.create({
      data: {
        jobCode,
        backupType: 'DIFFERENTIAL',
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

    const nextDiffRunAt = new Date(Date.now() + schedule.diffIntervalMinutes * 60 * 1000);
    await this.prisma.backupSchedule.update({
      where: { id: schedule.id },
      data: { nextDiffRunAt },
    });

    await this.executeBackup(backupJob.id, undefined, schedule.schedulePassword || undefined);

    return backupJob;
  }

  /**
   * Calculate the first Diff run time after a Full backup.
   * If diffStartTime (HH:mm) is in the future today → use today at that time.
   * If already past → use tomorrow at that time.
   * If no diffStartTime → run immediately (now + 1 min buffer).
   */
  private calcFirstDiffRunAt(diffStartTime?: string | null): Date {
    const now = new Date();
    if (!diffStartTime) {
      return new Date(now.getTime() + 60 * 1000);
    }
    const [h, m] = diffStartTime.split(':').map(Number);
    const candidate = new Date(now);
    candidate.setHours(h, m, 0, 0);
    if (candidate <= now) candidate.setDate(candidate.getDate() + 1);
    return candidate;
  }

  /**
   * Delete all Differential backup jobs (and files) linked to a schedule
   */
  private async cleanupDiffBackupsForSchedule(scheduleId: number) {
    const diffs = await this.prisma.backupJob.findMany({
      where: { scheduleId, backupType: 'DIFFERENTIAL' },
    });
    for (const diff of diffs) {
      try {
        await this.deleteBackup(diff.id);
      } catch { /* skip if file already gone */ }
    }
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

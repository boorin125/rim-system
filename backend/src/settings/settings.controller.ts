// src/settings/settings.controller.ts

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  BadRequestException,
  Request,
  Res,
  StreamableFile,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { SettingsService } from './settings.service';
import { EmailService } from '../email/email.service';
import { BackupService } from '../modules/backup/backup.service';
import {
  BackupType,
  BackupScope,
  RestoreType,
  ScheduleFrequency,
  CreateScheduleDto,
  UpdateScheduleDto,
  RestoreFromFileDto,
} from '../modules/backup/dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { diskStorage } from 'multer';

@Controller('settings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SettingsController {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly emailService: EmailService,
    private readonly backupService: BackupService,
  ) {}

  /**
   * Get incident settings (service warranty days, etc.)
   */
  @Get('incident')
  @Roles(
    UserRole.SUPER_ADMIN, UserRole.IT_MANAGER, UserRole.HELP_DESK,
    UserRole.SUPERVISOR, UserRole.TECHNICIAN, UserRole.FINANCE_ADMIN,
  )
  async getIncidentSettings() {
    return this.settingsService.getIncidentSettings();
  }

  /**
   * Save incident settings
   */
  @Post('incident')
  @Roles(UserRole.SUPER_ADMIN, UserRole.IT_MANAGER)
  async saveIncidentSettings(@Body() data: { serviceWarrantyDays?: number; autoAssignOnsite?: boolean }) {
    if (data.serviceWarrantyDays !== undefined && data.serviceWarrantyDays < 0) {
      throw new BadRequestException('serviceWarrantyDays must be 0 or more');
    }
    return this.settingsService.saveIncidentSettings(data);
  }

  /**
   * Get email settings
   */
  @Get('email')
  @Roles(UserRole.SUPER_ADMIN, UserRole.IT_MANAGER)
  async getEmailSettings() {
    return this.settingsService.getEmailSettings();
  }

  /**
   * Save email settings
   */
  @Post('email')
  @Roles(UserRole.SUPER_ADMIN, UserRole.IT_MANAGER)
  async saveEmailSettings(
    @Body()
    data: {
      smtpHost?: string;
      smtpPort?: number;
      smtpUser?: string;
      smtpPassword?: string;
      smtpSecure?: boolean;
      fromEmail?: string;
      fromName?: string;
      closeNotificationTo?: string;
      closeNotificationCc?: string;
      ccStoreEmail?: boolean;
    }
  ) {
    return this.settingsService.saveEmailSettings(data);
  }

  /**
   * Send test email
   */
  @Post('email/test')
  @Roles(UserRole.SUPER_ADMIN, UserRole.IT_MANAGER)
  async sendTestEmail(@Body() data: { to: string; cc?: string }) {
    if (!data.to) {
      throw new BadRequestException('Email address is required');
    }

    const result = await this.emailService.sendTestEmail(data.to, data.cc);

    if (!result.success) {
      throw new BadRequestException(result.error || result.message);
    }

    return result;
  }

  /**
   * Get system info
   */
  @Get('system-info')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.IT_MANAGER,
    UserRole.SUPERVISOR,
    UserRole.HELP_DESK,
    UserRole.TECHNICIAN,
  )
  async getSystemInfo() {
    return this.settingsService.getSystemInfo();
  }

  // ==========================================
  // ORGANIZATION SETTINGS ENDPOINTS
  // ==========================================

  /**
   * Get organization settings (readable by all authenticated users for logo display)
   */
  @Get('organization')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.IT_MANAGER,
    UserRole.FINANCE_ADMIN,
    UserRole.HELP_DESK,
    UserRole.SUPERVISOR,
    UserRole.TECHNICIAN,
    UserRole.END_USER,
    UserRole.READ_ONLY,
  )
  async getOrganizationSettings() {
    return this.settingsService.getOrganizationSettings();
  }

  /**
   * Save organization settings
   */
  @Post('organization')
  @Roles(UserRole.SUPER_ADMIN, UserRole.IT_MANAGER)
  async saveOrganizationSettings(
    @Body()
    data: {
      organizationName?: string;
      incidentPrefix?: string;
    }
  ) {
    // Validate incident prefix
    if (data.incidentPrefix) {
      const prefix = data.incidentPrefix.toUpperCase();
      if (!/^[A-Z]{1,3}$/.test(prefix)) {
        throw new BadRequestException('Incident prefix must be 1-3 uppercase letters');
      }
      data.incidentPrefix = prefix;
    }
    return this.settingsService.saveOrganizationSettings(data);
  }

  /**
   * Upload organization logo
   */
  @Post('organization/logo')
  @Roles(UserRole.SUPER_ADMIN, UserRole.IT_MANAGER)
  @UseInterceptors(
    FileInterceptor('logo', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const uploadPath = path.join(process.cwd(), 'uploads', 'logos');
          // Create directory if it doesn't exist
          if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
          }
          cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
          // Use organization_logo.{ext} as filename
          const ext = path.extname(file.originalname);
          cb(null, `organization_logo${ext}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        // Only allow images
        if (!file.mimetype.match(/^image\/(png|jpeg|jpg|gif|svg\+xml)$/)) {
          return cb(new BadRequestException('Only image files are allowed'), false);
        }
        cb(null, true);
      },
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB max
      },
    })
  )
  async uploadLogo(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No logo file uploaded');
    }

    // Save the path to settings
    const logoPath = `/uploads/logos/${file.filename}`;
    await this.settingsService.saveOrganizationSettings({ logoPath });

    return {
      message: 'Logo uploaded successfully',
      logoPath,
    };
  }

  /**
   * Delete organization logo
   */
  @Delete('organization/logo')
  @Roles(UserRole.SUPER_ADMIN, UserRole.IT_MANAGER)
  async deleteLogo() {
    const settings = await this.settingsService.getOrganizationSettings();

    if (settings.logoPath) {
      const filePath = path.join(process.cwd(), settings.logoPath.replace(/^\//, ''));
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await this.settingsService.saveOrganizationSettings({ logoPath: '' });
    return { message: 'Logo deleted successfully' };
  }

  // ==========================================
  // SERVICE REPORT SETTINGS ENDPOINTS
  // ==========================================

  /**
   * Get service report settings (provider info)
   */
  @Get('service-report')
  @Roles(UserRole.SUPER_ADMIN, UserRole.IT_MANAGER, UserRole.SUPERVISOR, UserRole.TECHNICIAN, UserRole.FINANCE_ADMIN, UserRole.HELP_DESK)
  async getServiceReportSettings() {
    return this.settingsService.getServiceReportSettings();
  }

  /**
   * Save service report settings (SUPER_ADMIN only)
   */
  @Post('service-report')
  @Roles(UserRole.SUPER_ADMIN)
  async saveServiceReportSettings(
    @Body()
    data: {
      providerName?: string;
      providerAddress?: string;
      providerPhone?: string;
      providerEmail?: string;
      providerTaxId?: string;
      templateStyle?: string;
      srThemeBgStart?: string;
      srThemeBgEnd?: string;
    },
  ) {
    return this.settingsService.saveServiceReportSettings(data);
  }

  /**
   * Upload service report logo (provider logo)
   */
  @Post('service-report/logo')
  @Roles(UserRole.SUPER_ADMIN)
  @UseInterceptors(
    FileInterceptor('logo', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const uploadPath = path.join(process.cwd(), 'uploads', 'logos');
          if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
          }
          cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
          const ext = path.extname(file.originalname);
          cb(null, `service_report_logo${ext}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        if (!file.mimetype.match(/^image\/(png|jpeg|jpg|gif|svg\+xml)$/)) {
          return cb(new BadRequestException('Only image files are allowed'), false);
        }
        cb(null, true);
      },
      limits: {
        fileSize: 5 * 1024 * 1024,
      },
    }),
  )
  async uploadServiceReportLogo(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No logo file uploaded');
    }

    const logoPath = `/uploads/logos/${file.filename}`;
    await this.settingsService.saveServiceReportSettings({ providerLogo: logoPath });

    return {
      message: 'Service Report logo uploaded successfully',
      logoPath,
    };
  }

  /**
   * Delete service report logo
   */
  @Delete('service-report/logo')
  @Roles(UserRole.SUPER_ADMIN)
  async deleteServiceReportLogo() {
    const settings = await this.settingsService.getServiceReportSettings();

    if (settings.providerLogo) {
      const filePath = path.join(process.cwd(), settings.providerLogo.replace(/^\//, ''));
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await this.settingsService.saveServiceReportSettings({ providerLogo: '' });
    return { message: 'Service Report logo deleted successfully' };
  }

  // ==========================================
  // THEME ENDPOINTS
  // ==========================================

  /**
   * Get theme settings (accessible by all authenticated users)
   */
  @Get('theme')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.IT_MANAGER,
    UserRole.FINANCE_ADMIN,
    UserRole.HELP_DESK,
    UserRole.SUPERVISOR,
    UserRole.TECHNICIAN,
    UserRole.END_USER,
    UserRole.READ_ONLY,
  )
  async getThemeSettings() {
    return this.settingsService.getThemeSettings();
  }

  /**
   * Save theme settings
   */
  @Post('theme')
  @Roles(UserRole.SUPER_ADMIN)
  async saveThemeSettings(@Body() data: { bgStart: string; bgEnd: string }) {
    return this.settingsService.saveThemeSettings(data);
  }

  // ==========================================
  // BACKUP ENDPOINTS
  // ==========================================

  /**
   * Get all backups
   */
  @Get('backups')
  @Roles(UserRole.SUPER_ADMIN, UserRole.IT_MANAGER)
  async getBackups() {
    const result = await this.backupService.getBackups({
      page: 1,
      limit: 50,
    });

    // Transform to frontend expected format
    return result.data.map((backup: any) => {
      return {
        id: backup.id,
        jobCode: backup.jobCode,
        customName: backup.customName || null,
        filename: backup.fileName || (backup.customName
          ? backup.customName.replace(/[\s/\\:*?"<>|]/g, '_') + '.json'
          : `${backup.jobCode}.json`),
        size: backup.fileSize ? this.formatFileSize(backup.fileSize) : 'N/A',
        createdAt: backup.createdAt,
        type: backup.scheduleId ? 'auto' : 'manual',
        status: backup.status,
        tablesIncluded: backup.tablesIncluded || [],
        scope: backup.scope,
        backupType: backup.backupType || 'FULL',
        baseBackupId: backup.baseBackupId || null,
        sinceTimestamp: backup.sinceTimestamp || null,
      };
    });
  }

  /**
   * Create new backup
   */
  @Post('backups')
  @Roles(UserRole.SUPER_ADMIN, UserRole.IT_MANAGER)
  async createBackup(@Request() req, @Body() body: { password?: string; customName?: string; scope?: string; scopeDetails?: string[]; backupType?: string }) {
    const scope = (body?.scope as BackupScope) || BackupScope.ALL;
    const backupType = body?.backupType === 'DIFFERENTIAL' ? BackupType.DIFFERENTIAL : BackupType.FULL;
    return this.backupService.createBackup(req.user.id, {
      backupType,
      scope,
      scopeDetails: body?.scopeDetails,
      password: body?.password,
      customName: body?.customName,
    });
  }

  /**
   * Restore from uploaded file (legacy — small files only)
   */
  @Post('backups/restore-file')
  @Roles(UserRole.SUPER_ADMIN)
  async restoreFromFile(@Request() req, @Body() dto: RestoreFromFileDto) {
    return this.backupService.restoreFromFile(req.user.id, dto.content, dto.password, dto.selectedTables);
  }

  /**
   * Chunked upload — Step A: receive one chunk
   * Body: multipart with fields: uploadId, chunkIndex, totalChunks, chunk (binary)
   */
  @Post('backups/upload-chunk')
  @Roles(UserRole.SUPER_ADMIN)
  @UseInterceptors(FileInterceptor('chunk', {
    storage: diskStorage({
      destination: (req: any, _file, cb) => {
        const uploadId = req.body?.uploadId || 'unknown';
        const dir = path.join(process.cwd(), 'Backup', 'chunks', uploadId);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
      },
      filename: (req: any, _file, cb) => {
        const idx = req.body?.chunkIndex ?? 0;
        cb(null, `chunk-${String(idx).padStart(6, '0')}`);
      },
    }),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB per chunk
  }))
  async uploadChunk(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { uploadId: string; chunkIndex: string; totalChunks: string },
  ) {
    if (!file) throw new BadRequestException('No chunk data');
    return { received: true, chunkIndex: Number(body.chunkIndex) };
  }

  /**
   * Chunked upload — Step B: assemble all chunks → return tempId + metadata
   */
  @Post('backups/finalize-upload')
  @Roles(UserRole.SUPER_ADMIN)
  async finalizeUpload(@Body() body: { uploadId: string; fileName: string }) {
    const { uploadId, fileName } = body;
    if (!uploadId) throw new BadRequestException('uploadId required');

    const chunksDir = path.join(process.cwd(), 'Backup', 'chunks', uploadId);
    if (!fs.existsSync(chunksDir)) throw new BadRequestException('No chunks found for this uploadId');

    const chunkFiles = fs.readdirSync(chunksDir)
      .filter(f => f.startsWith('chunk-'))
      .sort();

    if (chunkFiles.length === 0) throw new BadRequestException('No chunks found');

    const destDir = path.join(process.cwd(), 'Backup', 'restore-temp');
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

    const ext = (fileName || '').endsWith('.tar') ? '.tar' : (fileName || '').endsWith('.bkp') ? '.bkp' : '.tmp';
    const destFile = path.join(destDir, `upload-${uploadId}${ext}`);

    const writeStream = fs.createWriteStream(destFile);
    for (const chunkFile of chunkFiles) {
      const chunkPath = path.join(chunksDir, chunkFile);
      const data = fs.readFileSync(chunkPath);
      writeStream.write(data);
    }
    await new Promise<void>((resolve, reject) => {
      writeStream.end();
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });

    // Cleanup chunks
    try { fs.rmSync(chunksDir, { recursive: true, force: true }); } catch { /* ignore */ }

    return this.backupService.uploadRestoreTempFromDisk(destFile);
  }

  /**
   * Step 1: Upload backup file as multipart → returns metadata + tempId
   * Uses disk storage to avoid loading large files into RAM
   */
  @Post('backups/upload-restore')
  @Roles(UserRole.SUPER_ADMIN)
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: (req, file, cb) => {
        const dir = path.join(process.cwd(), 'Backup', 'restore-temp');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
      },
      filename: (req, file, cb) => {
        cb(null, `upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.tmp`);
      },
    }),
    limits: { fileSize: 2 * 1024 * 1024 * 1024 }, // 2 GB max
  }))
  async uploadRestoreFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');
    return this.backupService.uploadRestoreTempFromDisk(file.path);
  }

  /**
   * Step 2: Confirm restore using tempId returned from upload-restore
   */
  @Post('backups/restore-temp/:tempId')
  @Roles(UserRole.SUPER_ADMIN)
  async restoreFromTemp(
    @Request() req,
    @Param('tempId') tempId: string,
    @Body() body: { password?: string; selectedTables?: string[] },
  ) {
    return this.backupService.restoreFromTempFile(req.user.id, tempId, body.password, body.selectedTables);
  }

  /**
   * Restore from Differential backup (auto-applies Full + Diff)
   */
  @Post('backups/:id/restore-differential')
  @Roles(UserRole.SUPER_ADMIN)
  async restoreDifferential(
    @Request() req,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { password?: string; selectedTables?: string[] },
  ) {
    return this.backupService.restoreWithDifferential(req.user.id, id, body.password, body.selectedTables);
  }

  /**
   * Download backup file
   */
  @Get('backups/:id/download')
  @Roles(UserRole.SUPER_ADMIN, UserRole.IT_MANAGER)
  async downloadBackup(
    @Param('id', ParseIntPipe) id: number,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { filePath, fileName } = await this.backupService.downloadBackup(id);

    const file = fs.createReadStream(filePath);

    res.set({
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    });

    return new StreamableFile(file);
  }

  /**
   * Restore from backup
   */
  @Post('backups/:id/restore')
  @Roles(UserRole.SUPER_ADMIN)
  async restoreBackup(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
  ) {
    return this.backupService.createRestore(req.user.id, {
      backupId: id,
      restoreType: RestoreType.FULL,
    });
  }

  /**
   * Delete backup
   */
  @Delete('backups/:id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.IT_MANAGER)
  async deleteBackup(@Param('id', ParseIntPipe) id: number) {
    return this.backupService.deleteBackup(id);
  }

  // ==========================================
  // PATCH UPDATE (Online via License Server)
  // ==========================================

  /** GET /settings/check-update — check if newer version available */
  @Get('check-update')
  @Roles(UserRole.SUPER_ADMIN, UserRole.IT_MANAGER)
  checkForUpdate() {
    return this.settingsService.checkForUpdate();
  }

  /** POST /settings/apply-update — write update flag for watchdog */
  @Post('apply-update')
  @Roles(UserRole.SUPER_ADMIN)
  async applyUpdate(@Body() body: { version: string }) {
    if (!body.version || !/^\d+\.\d+\.\d+/.test(body.version)) {
      throw new BadRequestException('Invalid version format');
    }
    return this.settingsService.applyUpdate(body.version);
  }

  // ==========================================
  // DISK ALERT THRESHOLD
  // ==========================================

  @Put('disk-alert-threshold')
  @Roles(UserRole.SUPER_ADMIN)
  async saveDiskAlertThreshold(@Body() body: { threshold: number }) {
    return this.settingsService.saveDiskAlertThreshold(body.threshold);
  }

  @Put('disk-alert-email')
  @Roles(UserRole.SUPER_ADMIN)
  async saveDiskAlertEmail(@Body() body: { email: string }) {
    return this.settingsService.saveDiskAlertEmail(body.email || '');
  }

  // ==========================================
  // BACKUP CONFIG (Global external copy path)
  // ==========================================

  @Get('backup-config')
  @Roles(UserRole.SUPER_ADMIN, UserRole.IT_MANAGER)
  getBackupConfig() {
    const cfg = this.backupService.getBackupConfig();
    return {
      ...cfg,
      smb: cfg.smb ? { ...cfg.smb, password: cfg.smb.password ? '••••••••' : '' } : null,
    };
  }

  @Put('backup-config')
  @Roles(UserRole.SUPER_ADMIN)
  saveBackupConfig(@Body() body: { externalCopyPath?: string; smb?: any }) {
    const current = this.backupService.getBackupConfig();
    // If SMB password is the masked placeholder, keep existing password
    const smb = body.smb
      ? {
          path: body.smb.path,
          username: body.smb.username,
          domain: body.smb.domain || undefined,
          password: body.smb.password === '••••••••' ? (current.smb?.password ?? '') : body.smb.password,
        }
      : (body.smb === null ? null : current.smb);
    return this.backupService.saveBackupConfig({
      externalCopyPath: body.externalCopyPath || undefined,
      smb: smb || null,
    });
  }

  @Post('backup-config/test-path')
  @Roles(UserRole.SUPER_ADMIN)
  testBackupPath(@Body() body: { path: string }) {
    if (!body.path) throw new BadRequestException('กรุณาระบุ Path');
    return this.backupService.testExternalPath(body.path);
  }

  @Post('backup-config/test-smb')
  @Roles(UserRole.SUPER_ADMIN)
  async testSmbConnection(@Body() body: { path: string; username: string; password: string; domain?: string }) {
    if (!body.path || !body.username || !body.password) {
      throw new BadRequestException('กรุณาระบุ Path, Username และ Password');
    }
    // If password is masked, use stored password
    let password = body.password;
    if (password === '••••••••') {
      const cfg = this.backupService.getBackupConfig();
      password = cfg.smb?.password ?? '';
    }
    return this.backupService.testSmbConnection({ ...body, password });
  }

  // ==========================================
  // BACKUP SCHEDULE ENDPOINTS
  // ==========================================

  /**
   * Get all backup schedules
   */
  @Get('backups/schedules')
  @Roles(UserRole.SUPER_ADMIN, UserRole.IT_MANAGER)
  async getSchedules() {
    return this.backupService.getSchedules();
  }

  /**
   * Create backup schedule
   */
  @Post('backups/schedules')
  @Roles(UserRole.SUPER_ADMIN, UserRole.IT_MANAGER)
  async createSchedule(@Request() req, @Body() dto: CreateScheduleDto) {
    return this.backupService.createSchedule(req.user.id, dto);
  }

  /**
   * Update backup schedule
   */
  @Put('backups/schedules/:id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.IT_MANAGER)
  async updateSchedule(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateScheduleDto,
  ) {
    return this.backupService.updateSchedule(id, dto);
  }

  /**
   * Toggle schedule active status
   */
  @Post('backups/schedules/:id/toggle')
  @Roles(UserRole.SUPER_ADMIN, UserRole.IT_MANAGER)
  async toggleSchedule(
    @Param('id', ParseIntPipe) id: number,
    @Body('isActive') isActive: boolean,
  ) {
    return this.backupService.toggleSchedule(id, isActive);
  }

  /**
   * Delete backup schedule
   */
  @Delete('backups/schedules/:id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.IT_MANAGER)
  async deleteSchedule(@Param('id', ParseIntPipe) id: number) {
    return this.backupService.deleteSchedule(id);
  }

  /**
   * Format file size to human readable
   */
  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

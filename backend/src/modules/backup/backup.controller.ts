// src/modules/backup/backup.controller.ts

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { Response } from 'express';
import { BackupService } from './backup.service';
import {
  CreateBackupDto,
  CreateRestoreDto,
  CreateScheduleDto,
  UpdateScheduleDto,
} from './dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import * as fs from 'fs';

/**
 * Backup & Restore Controller
 *
 * Feature 13: Backup & Restore System
 *
 * BACKUP ENDPOINTS:
 * - POST   /api/backup/jobs              - Create backup job
 * - GET    /api/backup/jobs              - List backup jobs
 * - GET    /api/backup/jobs/:id          - Get backup details
 * - DELETE /api/backup/jobs/:id          - Delete backup
 * - GET    /api/backup/jobs/:id/download - Download backup file
 *
 * RESTORE ENDPOINTS:
 * - POST   /api/backup/restore           - Create restore job
 * - GET    /api/backup/restore           - List restore jobs
 *
 * SCHEDULE ENDPOINTS:
 * - POST   /api/backup/schedules         - Create schedule
 * - GET    /api/backup/schedules         - List schedules
 * - GET    /api/backup/schedules/:id     - Get schedule details
 * - PUT    /api/backup/schedules/:id     - Update schedule
 * - DELETE /api/backup/schedules/:id     - Delete schedule
 * - POST   /api/backup/schedules/:id/toggle - Toggle schedule
 *
 * STATS:
 * - GET    /api/backup/stats             - Get backup statistics
 */

@Controller('backup')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.IT_MANAGER)
export class BackupController {
  constructor(private readonly backupService: BackupService) {}

  // ==========================================
  // BACKUP ENDPOINTS
  // ==========================================

  /**
   * Create backup job
   */
  @Post('jobs')
  async createBackup(@Request() req, @Body() dto: CreateBackupDto) {
    return this.backupService.createBackup(req.user.id, dto);
  }

  /**
   * Get all backup jobs
   */
  @Get('jobs')
  async getBackups(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('backupType') backupType?: string,
  ) {
    return this.backupService.getBackups({
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
      status,
      backupType,
    });
  }

  /**
   * Get backup details
   */
  @Get('jobs/:id')
  async getBackup(@Param('id', ParseIntPipe) id: number) {
    return this.backupService.getBackup(id);
  }

  /**
   * Delete backup
   */
  @Delete('jobs/:id')
  async deleteBackup(@Param('id', ParseIntPipe) id: number) {
    return this.backupService.deleteBackup(id);
  }

  /**
   * Download backup file
   */
  @Get('jobs/:id/download')
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

  // ==========================================
  // RESTORE ENDPOINTS
  // ==========================================

  /**
   * Create restore job
   */
  @Post('restore')
  async createRestore(@Request() req, @Body() dto: CreateRestoreDto) {
    return this.backupService.createRestore(req.user.id, dto);
  }

  /**
   * Get all restore jobs
   */
  @Get('restore')
  async getRestores(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('backupId') backupId?: string,
  ) {
    return this.backupService.getRestores({
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
      status,
      backupId: backupId ? parseInt(backupId) : undefined,
    });
  }

  // ==========================================
  // SCHEDULE ENDPOINTS
  // ==========================================

  /**
   * Create backup schedule
   */
  @Post('schedules')
  async createSchedule(@Request() req, @Body() dto: CreateScheduleDto) {
    return this.backupService.createSchedule(req.user.id, dto);
  }

  /**
   * Get all schedules
   */
  @Get('schedules')
  async getSchedules() {
    return this.backupService.getSchedules();
  }

  /**
   * Get schedule details
   */
  @Get('schedules/:id')
  async getSchedule(@Param('id', ParseIntPipe) id: number) {
    return this.backupService.getSchedule(id);
  }

  /**
   * Update schedule
   */
  @Put('schedules/:id')
  async updateSchedule(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateScheduleDto,
  ) {
    return this.backupService.updateSchedule(id, dto);
  }

  /**
   * Delete schedule
   */
  @Delete('schedules/:id')
  async deleteSchedule(@Param('id', ParseIntPipe) id: number) {
    return this.backupService.deleteSchedule(id);
  }

  /**
   * Toggle schedule active status
   */
  @Post('schedules/:id/toggle')
  @HttpCode(HttpStatus.OK)
  async toggleSchedule(
    @Param('id', ParseIntPipe) id: number,
    @Body('isActive') isActive: boolean,
  ) {
    return this.backupService.toggleSchedule(id, isActive);
  }

  // ==========================================
  // STATS
  // ==========================================

  /**
   * Get backup statistics
   */
  @Get('stats')
  async getStats() {
    return this.backupService.getStats();
  }
}

// src/modules/performance/performance.controller.ts

import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  Request,
  Query,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PerformanceService } from './performance.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

/**
 * Performance Controller
 *
 * Feature 14: Technician Performance Grading System
 */

@Controller('performance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PerformanceController {
  constructor(private readonly performanceService: PerformanceService) {}

  // ==========================================
  // TECHNICIAN ENDPOINTS (own data only)
  // ==========================================

  /**
   * Get My Performance (Current Month)
   * Access: TECHNICIAN
   */
  @Get('my')
  @Roles(UserRole.TECHNICIAN)
  async getMyPerformance(
    @Request() req,
    @Query('period') period?: string,
  ) {
    return this.performanceService.getTechnicianPerformance(req.user.id, period);
  }

  /**
   * Get My Performance History
   * Access: TECHNICIAN
   */
  @Get('my/history')
  @Roles(UserRole.TECHNICIAN)
  async getMyHistory(
    @Request() req,
    @Query('months') months?: string,
  ) {
    return this.performanceService.getPerformanceHistory(
      req.user.id,
      months ? parseInt(months) : 6,
    );
  }

  /**
   * Get My YTD Performance
   * Access: TECHNICIAN
   */
  @Get('my/ytd')
  @Roles(UserRole.TECHNICIAN)
  async getMyYTD(@Request() req) {
    return this.performanceService.getYTDPerformance(req.user.id);
  }

  /**
   * Get My YTM Performance
   * Access: TECHNICIAN
   */
  @Get('my/ytm')
  @Roles(UserRole.TECHNICIAN)
  async getMyYTM(@Request() req) {
    return this.performanceService.getYTMPerformance(req.user.id);
  }

  /**
   * Get My YTY Performance
   * Access: TECHNICIAN
   */
  @Get('my/yty')
  @Roles(UserRole.TECHNICIAN)
  async getMyYTY(@Request() req) {
    return this.performanceService.getYTYPerformance(req.user.id);
  }

  // ==========================================
  // ADMIN/SUPERVISOR ENDPOINTS (all data)
  // ==========================================

  /**
   * Get Incident Statistics (total, closed, pending, cancelled, SLA)
   * Access: IT_MANAGER, SUPERVISOR, HELP_DESK
   */
  @Get('incident-stats')
  @Roles(UserRole.IT_MANAGER, UserRole.SUPERVISOR, UserRole.HELP_DESK)
  async getIncidentStats(
    @Query('period') period?: string,
    @Query('jobTypes') jobTypes?: string,
  ) {
    const parsed = jobTypes ? jobTypes.split(',').map(s => s.trim()).filter(Boolean) : undefined;
    return this.performanceService.getIncidentStats(period, parsed);
  }

  /**
   * Get SLA Monthly Trend (line graph data)
   * Access: IT_MANAGER, SUPERVISOR, HELP_DESK
   */
  @Get('sla-trend')
  @Roles(UserRole.IT_MANAGER, UserRole.SUPERVISOR, UserRole.HELP_DESK)
  async getSlaTrend(
    @Query('months') months?: string,
    @Query('jobTypes') jobTypes?: string,
  ) {
    const parsed = jobTypes ? jobTypes.split(',').map(s => s.trim()).filter(Boolean) : undefined;
    return this.performanceService.getSlaTrend(months ? parseInt(months) : 12, parsed);
  }

  /**
   * Get Enhanced Leaderboard (with workVolume and SLA%)
   * Access: IT_MANAGER, SUPERVISOR, HELP_DESK
   */
  @Get('leaderboard')
  @Roles(UserRole.IT_MANAGER, UserRole.SUPERVISOR, UserRole.HELP_DESK)
  async getLeaderboard(
    @Query('period') period?: string,
    @Query('limit') limit?: string,
    @Query('sortBy') sortBy?: string,
    @Query('jobTypes') jobTypes?: string,
  ) {
    const parsed = jobTypes ? jobTypes.split(',').map(s => s.trim()).filter(Boolean) : undefined;
    return this.performanceService.getEnhancedLeaderboard(
      period,
      limit ? parseInt(limit) : 50,
      sortBy || 'score',
      parsed,
    );
  }

  /**
   * Get Team Statistics
   * Access: IT_MANAGER, SUPERVISOR, HELP_DESK
   */
  @Get('stats')
  @Roles(UserRole.IT_MANAGER, UserRole.SUPERVISOR, UserRole.HELP_DESK)
  async getTeamStats(@Query('period') period?: string) {
    return this.performanceService.getTeamStats(period);
  }

  /**
   * Get Team YTD Performance
   * Access: IT_MANAGER, SUPERVISOR
   */
  @Get('ytd')
  @Roles(UserRole.IT_MANAGER, UserRole.SUPERVISOR)
  async getTeamYTD() {
    return this.performanceService.getYTDPerformance();
  }

  /**
   * Get Team YTM Performance
   * Access: IT_MANAGER, SUPERVISOR
   */
  @Get('ytm')
  @Roles(UserRole.IT_MANAGER, UserRole.SUPERVISOR)
  async getTeamYTM(@Query('month') month?: string) {
    return this.performanceService.getYTMPerformance(
      undefined,
      month ? parseInt(month) : undefined,
    );
  }

  /**
   * Get Team YTY Performance
   * Access: IT_MANAGER, SUPERVISOR
   */
  @Get('yty')
  @Roles(UserRole.IT_MANAGER, UserRole.SUPERVISOR)
  async getTeamYTY() {
    return this.performanceService.getYTYPerformance();
  }

  /**
   * Get Technician's Performance
   * Access: IT_MANAGER, SUPERVISOR
   */
  @Get('technicians/:id')
  @Roles(UserRole.IT_MANAGER, UserRole.SUPERVISOR)
  async getTechnicianPerformance(
    @Param('id', ParseIntPipe) id: number,
    @Query('period') period?: string,
  ) {
    return this.performanceService.getTechnicianPerformance(id, period);
  }

  /**
   * Get Technician's Performance History
   * Access: IT_MANAGER, SUPERVISOR
   */
  @Get('technicians/:id/history')
  @Roles(UserRole.IT_MANAGER, UserRole.SUPERVISOR)
  async getTechnicianHistory(
    @Param('id', ParseIntPipe) id: number,
    @Query('months') months?: string,
  ) {
    return this.performanceService.getPerformanceHistory(
      id,
      months ? parseInt(months) : 6,
    );
  }

  // ==========================================
  // CALCULATION ENDPOINTS (ADMIN ONLY)
  // ==========================================

  /**
   * Calculate All Technicians Performance
   * Access: IT_MANAGER
   */
  @Post('calculate')
  @Roles(UserRole.IT_MANAGER)
  @HttpCode(HttpStatus.OK)
  async calculateAll(
    @Request() req,
    @Query('period') period?: string,
  ) {
    const targetPeriod = period || this.getCurrentPeriod();
    return this.performanceService.calculateAllPerformance(targetPeriod, req.user.id);
  }

  /**
   * Calculate Specific Technician Performance
   * Access: IT_MANAGER
   */
  @Post('calculate/:id')
  @Roles(UserRole.IT_MANAGER)
  @HttpCode(HttpStatus.OK)
  async calculateTechnician(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
    @Query('period') period?: string,
  ) {
    const targetPeriod = period || this.getCurrentPeriod();
    return this.performanceService.calculatePerformance(id, targetPeriod, req.user.id);
  }

  private getCurrentPeriod(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }
}

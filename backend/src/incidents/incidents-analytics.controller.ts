// backend/src/incidents/incidents-analytics.controller.ts

import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { IncidentsAnalyticsService } from './incidents-analytics.service';

@Controller('incidents/analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
export class IncidentsAnalyticsController {
  constructor(
    private readonly analyticsService: IncidentsAnalyticsService,
  ) {}

  /**
   * Get dashboard statistics
   */
  @Get('stats')
  @Roles(
    UserRole.IT_MANAGER,
    UserRole.SUPERVISOR,
    UserRole.HELP_DESK,
    UserRole.TECHNICIAN,
  )
  async getDashboardStats(
    @Request() req,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.analyticsService.getDashboardStats(req.user, from, to);
  }

  /**
   * Get incidents by status (for pie chart)
   */
  @Get('by-status')
  @Roles(
    UserRole.IT_MANAGER,
    UserRole.SUPERVISOR,
    UserRole.HELP_DESK,
    UserRole.TECHNICIAN,
  )
  async getIncidentsByStatus(
    @Request() req,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.analyticsService.getIncidentsByStatus(req.user, from, to);
  }

  /**
   * Get incidents by priority (for pie chart)
   */
  @Get('by-priority')
  @Roles(
    UserRole.IT_MANAGER,
    UserRole.SUPERVISOR,
    UserRole.HELP_DESK,
    UserRole.TECHNICIAN,
  )
  async getIncidentsByPriority(
    @Request() req,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.analyticsService.getIncidentsByPriority(req.user, from, to);
  }

  /**
   * Get incidents by category (for bar chart)
   */
  @Get('by-category')
  @Roles(
    UserRole.IT_MANAGER,
    UserRole.SUPERVISOR,
    UserRole.HELP_DESK,
    UserRole.TECHNICIAN,
  )
  async getIncidentsByCategory(
    @Request() req,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.analyticsService.getIncidentsByCategory(req.user, from, to);
  }

  /**
   * Get incidents trend over time (for line chart)
   */
  @Get('trend')
  @Roles(
    UserRole.IT_MANAGER,
    UserRole.SUPERVISOR,
    UserRole.HELP_DESK,
    UserRole.TECHNICIAN,
  )
  async getIncidentsTrend(
    @Request() req,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('period') period: 'day' | 'week' | 'month' = 'day',
  ) {
    return this.analyticsService.getIncidentsTrend(req.user, from, to, period);
  }

  /**
   * Get SLA performance metrics
   */
  @Get('sla-performance')
  @Roles(
    UserRole.IT_MANAGER,
    UserRole.SUPERVISOR,
    UserRole.HELP_DESK,
  )
  async getSlaPerformance(
    @Request() req,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.analyticsService.getSlaPerformance(req.user, from, to);
  }

  /**
   * Get technician performance
   */
  @Get('technician-performance')
  @Roles(
    UserRole.IT_MANAGER,
    UserRole.SUPERVISOR,
  )
  async getTechnicianPerformance(
    @Request() req,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.analyticsService.getTechnicianPerformance(from, to);
  }

  /**
   * Get Technician Detail Report (per-day activity + performance summary)
   */
  @Get('technician-detail')
  @Roles(UserRole.IT_MANAGER, UserRole.SUPERVISOR)
  async getTechnicianDetailReport(
    @Query('technicianId') technicianId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('period') period?: string,
  ) {
    return this.analyticsService.getTechnicianDetailReport(Number(technicianId), from, to, period);
  }

  /**
   * Get check-in locations for map display
   */
  @Get('map-checkins')
  @Roles(UserRole.IT_MANAGER, UserRole.MONITOR)
  async getMapCheckins(
    @Request() req,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('status') status?: string,
  ) {
    return this.analyticsService.getMapCheckins(req.user, from, to, status);
  }
}

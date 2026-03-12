// src/modules/ratings/ratings.controller.ts

import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  Query,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  Headers,
  Ip,
} from '@nestjs/common';
import { RatingsService } from './ratings.service';
import { SubmitRatingDto } from './dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

/**
 * Ratings Controller
 *
 * Feature 8: Rating System (Public Link)
 *
 * ⚠️ PUBLIC ENDPOINTS (No Auth):
 * - GET  /api/public/ratings/:token      - Get incident info for rating
 * - POST /api/public/ratings/:token      - Submit rating
 * - GET  /api/public/ratings/:token/status - Check rating status
 *
 * ⚠️ PROTECTED ENDPOINTS:
 * - GET /api/ratings                     - List all ratings (Admin)
 * - GET /api/ratings/stats               - Rating statistics
 * - GET /api/incidents/:id/rating        - Get rating for specific incident
 */

// ===========================================
// PUBLIC CONTROLLER (No Authentication)
// ===========================================

@Controller('public/ratings')
export class PublicRatingsController {
  constructor(private readonly ratingsService: RatingsService) {}

  /**
   * Get Incident Info by Rating Token (Public)
   * Used to display incident details on rating page
   */
  @Get(':token')
  async getIncidentByToken(@Param('token') token: string) {
    return this.ratingsService.getIncidentByToken(token);
  }

  /**
   * Submit Rating via Public Link
   */
  @Post(':token')
  @HttpCode(HttpStatus.CREATED)
  async submitRating(
    @Param('token') token: string,
    @Body() dto: SubmitRatingDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.ratingsService.submitRating(token, dto, ip, userAgent);
  }

  /**
   * Check Rating Status by Token
   */
  @Get(':token/status')
  async checkRatingStatus(@Param('token') token: string) {
    return this.ratingsService.checkRatingStatus(token);
  }
}

// ===========================================
// PROTECTED CONTROLLER (Authentication Required)
// ===========================================

@Controller('ratings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RatingsController {
  constructor(private readonly ratingsService: RatingsService) {}

  /**
   * Get All Ratings (Admin)
   * Access: IT_MANAGER, HELP_DESK, SUPERVISOR
   */
  @Get()
  @Roles(UserRole.IT_MANAGER, UserRole.HELP_DESK, UserRole.SUPERVISOR)
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('minRating') minRating?: string,
    @Query('maxRating') maxRating?: string,
    @Query('technicianId') technicianId?: string,
  ) {
    return this.ratingsService.findAll({
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
      startDate,
      endDate,
      minRating: minRating ? parseInt(minRating) : undefined,
      maxRating: maxRating ? parseInt(maxRating) : undefined,
      technicianId: technicianId ? parseInt(technicianId) : undefined,
    });
  }

  /**
   * Get Rating Statistics
   * Access: IT_MANAGER, HELP_DESK, SUPERVISOR
   */
  @Get('stats')
  @Roles(UserRole.IT_MANAGER, UserRole.HELP_DESK, UserRole.SUPERVISOR)
  async getStats(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('technicianId') technicianId?: string,
  ) {
    return this.ratingsService.getStats({
      startDate,
      endDate,
      technicianId: technicianId ? parseInt(technicianId) : undefined,
    });
  }

  /**
   * Get My Ratings (Technician)
   * Access: TECHNICIAN
   */
  @Get('my')
  @Roles(UserRole.TECHNICIAN)
  async getMyRatings(@Request() req, @Query('limit') limit?: string) {
    return this.ratingsService.getTechnicianRatings(
      req.user.id,
      limit ? parseInt(limit) : 10,
    );
  }

  /**
   * Generate Rating Link for Incident (Admin)
   * Access: IT_MANAGER, HELP_DESK
   */
  @Post('generate/:incidentId')
  @Roles(UserRole.IT_MANAGER, UserRole.HELP_DESK)
  @HttpCode(HttpStatus.OK)
  async generateRatingLink(@Param('incidentId') incidentId: string) {
    return this.ratingsService.resendRatingEmail(incidentId);
  }

  /**
   * Get Rating for Specific Incident
   * Access: All authenticated users except SUPER_ADMIN
   */
  @Get('incident/:incidentId')
  @Roles(
    UserRole.IT_MANAGER,
    UserRole.HELP_DESK,
    UserRole.SUPERVISOR,
    UserRole.TECHNICIAN,
    UserRole.END_USER,
    UserRole.READ_ONLY,
  )
  async getRatingByIncident(@Param('incidentId') incidentId: string) {
    return this.ratingsService.getRatingByIncident(incidentId);
  }
}

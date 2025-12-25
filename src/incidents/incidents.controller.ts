// src/incidents/incidents.controller.ts
// Updated to pass user object to service methods

import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { IncidentsService } from './incidents.service';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { UpdateIncidentDto } from './dto/update-incident.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('api/incidents')
@UseGuards(JwtAuthGuard, RolesGuard)
export class IncidentsController {
  constructor(private readonly incidentsService: IncidentsService) {}

  /**
   * Create incident
   * Access: HELP_DESK, END_USER
   */
  @Post()
  @Roles(UserRole.HELP_DESK, UserRole.END_USER)
  create(@Body() dto: CreateIncidentDto, @Request() req) {
    return this.incidentsService.create(dto, req.user.id);
  }

  /**
   * Get all incidents
   * Access: All except SUPER_ADMIN
   * 
   * ⚠️ CRITICAL: TECHNICIAN sees only their assigned incidents
   */
  @Get()
  @Roles(
    UserRole.IT_MANAGER,
    UserRole.SUPERVISOR,
    UserRole.HELP_DESK,
    UserRole.TECHNICIAN,
    UserRole.END_USER,
    UserRole.READ_ONLY,
  )
  findAll(@Query() filterDto: any, @Request() req) {
    return this.incidentsService.findAll(filterDto, req.user);  // ← Pass user object
  }

  /**
   * Get incident statistics
   * Access: All except SUPER_ADMIN and END_USER
   * 
   * ⚠️ CRITICAL: TECHNICIAN sees only their stats
   */
  @Get('statistics')
  @Roles(
    UserRole.IT_MANAGER,
    UserRole.SUPERVISOR,
    UserRole.HELP_DESK,
    UserRole.TECHNICIAN,
    UserRole.READ_ONLY,
  )
  getStatistics(@Request() req) {
    return this.incidentsService.getStatistics(req.user);  // ← Pass user object
  }

  /**
   * Get incident by ID
   * Access: All except SUPER_ADMIN
   * 
   * ⚠️ CRITICAL: TECHNICIAN can only view their assigned incidents
   */
  @Get(':id')
  @Roles(
    UserRole.IT_MANAGER,
    UserRole.SUPERVISOR,
    UserRole.HELP_DESK,
    UserRole.TECHNICIAN,
    UserRole.END_USER,
    UserRole.READ_ONLY,
  )
  findOne(@Param('id') id: string, @Request() req) {
    return this.incidentsService.findOne(id, req.user);  // ← Pass user object
  }

  /**
   * Update incident
   * Access: HELP_DESK only
   */
  @Patch(':id')
  @Roles(UserRole.HELP_DESK)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateIncidentDto,
    @Request() req,
  ) {
    return this.incidentsService.update(id, dto, req.user.id);
  }

  /**
   * Assign incident to technician
   * Access: SUPERVISOR, IT_MANAGER only
   * 
   * ⚠️ HELP_DESK removed - this is SUPERVISOR's responsibility
   */
  @Post(':id/assign')
  @Roles(UserRole.SUPERVISOR, UserRole.IT_MANAGER)
  assign(
    @Param('id') id: string,
    @Body('technicianId') technicianId: number,
    @Request() req,
  ) {
    return this.incidentsService.assign(id, technicianId, req.user.id);
  }

  /**
   * Reassign incident to another technician
   * Access: SUPERVISOR, IT_MANAGER only
   * 
   * ⚠️ HELP_DESK removed - this is SUPERVISOR's responsibility
   */
  @Post(':id/reassign')
  @Roles(UserRole.SUPERVISOR, UserRole.IT_MANAGER)
  reassign(
    @Param('id') id: string,
    @Body('technicianId') technicianId: number,
    @Request() req,
  ) {
    return this.incidentsService.reassign(id, technicianId, req.user.id);
  }

  /**
   * Accept incident
   * Access: TECHNICIAN only
   */
  @Post(':id/accept')
  @Roles(UserRole.TECHNICIAN)
  accept(@Param('id') id: string, @Request() req) {
    return this.incidentsService.accept(id, req.user.id);
  }

  /**
   * Resolve incident
   * Access: TECHNICIAN only
   */
  @Post(':id/resolve')
  @Roles(UserRole.TECHNICIAN)
  resolve(
    @Param('id') id: string,
    @Body('resolutionNote') resolutionNote: string,
    @Request() req,
  ) {
    return this.incidentsService.resolve(id, resolutionNote, req.user.id);
  }

  /**
   * Close incident
   * Access: HELP_DESK only
   */
  @Post(':id/close')
  @Roles(UserRole.HELP_DESK)
  close(
    @Param('id') id: string,
    @Body('resolutionNote') resolutionNote: string,
    @Body('photoEvidence') photoEvidence: string,
    @Request() req,
  ) {
    return this.incidentsService.close(id, resolutionNote, photoEvidence, req.user.id);
  }

  /**
   * Cancel incident
   * Access: HELP_DESK only
   */
  @Post(':id/cancel')
  @Roles(UserRole.HELP_DESK)
  cancel(
    @Param('id') id: string,
    @Body('cancellationReason') cancellationReason: string,
    @Request() req,
  ) {
    return this.incidentsService.cancel(id, cancellationReason, req.user.id);
  }

  /**
   * Reopen incident
   * Access: HELP_DESK only
   * 
   * Use cases:
   * - Issue recurs after closing (especially within warranty period)
   * - Incomplete repair discovered during verification
   * - Customer reports same problem again
   */
  @Post(':id/reopen')
  @Roles(UserRole.HELP_DESK)
  reopen(
    @Param('id') id: string,
    @Body('reopenReason') reopenReason: string,
    @Request() req,
  ) {
    return this.incidentsService.reopen(id, reopenReason, req.user.id);
  }

  /**
   * Delete incident (hard delete)
   * Access: HELP_DESK only
   */
  @Delete(':id')
  @Roles(UserRole.HELP_DESK)
  remove(@Param('id') id: string, @Request() req) {
    return this.incidentsService.remove(id, req.user.id);
  }
}
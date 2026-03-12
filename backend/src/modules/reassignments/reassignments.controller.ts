// src/modules/reassignments/reassignments.controller.ts

import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  Request,
  Query,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ReassignmentsService } from './reassignments.service';
import { CreateReassignmentDto, RespondReassignmentDto } from './dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

/**
 * Reassignments Controller
 *
 * Feature 15: Incident Reassignment System (SRS v3.10.1)
 *
 * ⚠️ PERMISSION RULES:
 *
 * 1. SUPER_ADMIN:
 *    - ❌ NO ACCESS to any reassignment operations
 *
 * 2. IT_MANAGER, HELP_DESK, SUPERVISOR:
 *    - ✅ Create reassignment requests
 *    - ✅ View reassignment history
 *    - ✅ View statistics
 *
 * 3. TECHNICIAN:
 *    - ✅ View my pending reassignments
 *    - ✅ Accept/Reject reassignment requests
 */

@Controller('reassignments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReassignmentsController {
  constructor(private readonly reassignmentsService: ReassignmentsService) {}

  // ==========================================
  // CREATE REASSIGNMENT REQUEST
  // ==========================================

  /**
   * Create reassignment request for an incident
   * Access: IT_MANAGER, HELP_DESK, SUPERVISOR
   *
   * ⚠️ SUPER_ADMIN: NO ACCESS
   */
  @Post('incidents/:incidentId')
  @Roles(UserRole.IT_MANAGER, UserRole.HELP_DESK, UserRole.SUPERVISOR)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param('incidentId') incidentId: string,
    @Body() dto: CreateReassignmentDto,
    @Request() req,
  ) {
    return this.reassignmentsService.create(
      incidentId,
      dto,
      req.user.id,
      req.user.roles,
    );
  }

  // ==========================================
  // GET REASSIGNMENT HISTORY
  // ==========================================

  /**
   * Get reassignment history for an incident
   * Access: All authenticated users EXCEPT SUPER_ADMIN
   */
  @Get('incidents/:incidentId')
  @Roles(
    UserRole.IT_MANAGER,
    UserRole.HELP_DESK,
    UserRole.SUPERVISOR,
    UserRole.TECHNICIAN,
    UserRole.END_USER,
    UserRole.READ_ONLY,
  )
  async getByIncident(@Param('incidentId') incidentId: string) {
    return this.reassignmentsService.getByIncident(incidentId);
  }

  // ==========================================
  // MY PENDING REASSIGNMENTS (FOR TECHNICIANS)
  // ==========================================

  /**
   * Get my pending reassignment requests
   * Access: TECHNICIAN
   */
  @Get('my-pending')
  @Roles(UserRole.TECHNICIAN)
  async getMyPendingReassignments(@Request() req) {
    return this.reassignmentsService.getMyPendingReassignments(req.user.id);
  }

  // ==========================================
  // RESPOND TO REASSIGNMENT
  // ==========================================

  /**
   * Accept or reject a reassignment request
   * Access: TECHNICIAN (only the target technician)
   */
  @Post(':id/respond')
  @Roles(UserRole.TECHNICIAN)
  @HttpCode(HttpStatus.OK)
  async respond(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RespondReassignmentDto,
    @Request() req,
  ) {
    return this.reassignmentsService.respond(id, dto, req.user.id);
  }

  // ==========================================
  // CANCEL PENDING REASSIGNMENT
  // ==========================================

  /**
   * Cancel a pending reassignment request
   * Access: Creator of the request OR IT_MANAGER
   */
  @Delete(':id')
  @Roles(UserRole.IT_MANAGER, UserRole.HELP_DESK, UserRole.SUPERVISOR)
  @HttpCode(HttpStatus.OK)
  async cancel(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.reassignmentsService.cancel(id, req.user.id, req.user.roles);
  }

  // ==========================================
  // STATISTICS
  // ==========================================

  /**
   * Get reassignment statistics
   * Access: IT_MANAGER, HELP_DESK, SUPERVISOR
   */
  @Get('stats')
  @Roles(UserRole.IT_MANAGER, UserRole.HELP_DESK, UserRole.SUPERVISOR)
  async getStats(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reassignmentsService.getStats({ startDate, endDate });
  }
}

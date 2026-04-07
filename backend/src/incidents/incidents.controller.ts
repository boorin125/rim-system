// src/incidents/incidents.controller.ts
// Updated with Technician Workflow endpoints

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
import { LicenseGuard } from '../modules/license/license.guard';
import { ResolveIncidentDto, UpdateResolveDto } from './dto/resolve-incident.dto';
import { ReopenIncidentDto } from './dto/reopen-incident.dto';
import { SubmitResponseDto } from './dto/submit-response.dto';
import { IncidentHistoryService } from './incident-history.service';

@Controller('incidents')
@UseGuards(JwtAuthGuard, RolesGuard)
export class IncidentsController {
  constructor(
    private readonly incidentsService: IncidentsService,
    private readonly historyService: IncidentHistoryService,
  ) {}

  /**
   * Create incident
   * Access: HELP_DESK, END_USER
   */
  @Post()
  @Roles(UserRole.IT_MANAGER, UserRole.HELP_DESK, UserRole.END_USER)
  @UseGuards(LicenseGuard)
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
    return this.incidentsService.findAll(filterDto, req.user);
  }

  /**
   * Check for open (non-CLOSED, non-CANCELLED) incident for same store + equipment
   * Used to prevent duplicate incidents
   */
  @Get('duplicate-check')
  @Roles(
    UserRole.IT_MANAGER, UserRole.SUPERVISOR, UserRole.HELP_DESK,
    UserRole.TECHNICIAN, UserRole.SUPER_ADMIN, UserRole.END_USER,
  )
  duplicateCheck(
    @Query('equipmentIds') equipmentIds: string,
    @Query('storeId') storeId: string,
  ) {
    const ids = equipmentIds
      ? equipmentIds.split(',').map(Number).filter(Boolean)
      : [];
    return this.incidentsService.duplicateCheck(ids, parseInt(storeId));
  }

  /**
   * Check service warranty for equipment at a store
   * Returns the latest closed incident within warranty period if any
   */
  @Get('warranty-check')
  @Roles(
    UserRole.IT_MANAGER, UserRole.SUPERVISOR, UserRole.HELP_DESK,
    UserRole.TECHNICIAN, UserRole.SUPER_ADMIN,
  )
  warrantyCheck(
    @Query('equipmentIds') equipmentIds: string,
    @Query('storeId') storeId: string,
  ) {
    const ids = equipmentIds
      ? equipmentIds.split(',').map(Number).filter(Boolean)
      : [];
    return this.incidentsService.warrantyCheck(ids, parseInt(storeId));
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
    return this.incidentsService.getStatistics(req.user);
  }

  /**
   * Get Service Report data for authenticated users (for blank-signature PDF)
   * Access: TECHNICIAN only (assigned)
   */
  @Get(':id/service-report-data')
  @Roles(UserRole.TECHNICIAN)
  getServiceReportData(@Param('id') id: string, @Request() req) {
    return this.incidentsService.getServiceReportData(id, req.user);
  }

  /**
   * Send blank-signature Service Report PDF to store email
   * Access: TECHNICIAN only (assigned)
   */
  @Post(':id/send-service-report-email')
  @Roles(UserRole.TECHNICIAN)
  sendServiceReportEmail(
    @Param('id') id: string,
    @Body('pdfBase64') pdfBase64: string,
    @Body('toEmail') toEmail: string,
    @Request() req,
  ) {
    return this.incidentsService.sendServiceReportEmail(id, pdfBase64, toEmail, req.user);
  }

  /**
   * Upload signed service report photos
   * Access: TECHNICIAN only (assigned)
   */
  @Post(':id/upload-signed-report')
  @Roles(UserRole.TECHNICIAN)
  uploadSignedReport(
    @Param('id') id: string,
    @Body('signedReportPhotos') signedReportPhotos: string[],
    @Request() req,
  ) {
    return this.incidentsService.uploadSignedReportPhotos(id, signedReportPhotos, req.user);
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
    return this.incidentsService.findOne(id, req.user);
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
   * Access: SUPERVISOR only
   */
  @Post(':id/assign')
  @Roles(UserRole.SUPERVISOR)
  assign(
    @Param('id') id: string,
    @Body('technicianId') technicianId: number,
    @Body('technicianIds') technicianIds: number[],
    @Body('scheduledAt') scheduledAt: string,
    @Body('scheduleReason') scheduleReason: string,
    @Request() req,
  ) {
    // Support both single (backward compat) and array
    const ids = technicianIds || (technicianId ? [technicianId] : []);
    const scheduledDate = scheduledAt ? new Date(scheduledAt) : undefined;
    return this.incidentsService.assign(id, ids, req.user.id, scheduledDate, scheduleReason || undefined);
  }

  /**
   * Reassign incident to technician(s)
   * Access: SUPERVISOR only
   * Requires reason for reassignment
   */
  @Post(':id/reassign')
  @Roles(UserRole.SUPERVISOR)
  reassign(
    @Param('id') id: string,
    @Body('technicianId') technicianId: number,
    @Body('technicianIds') technicianIds: number[],
    @Body('reassignReason') reassignReason: string,
    @Request() req,
  ) {
    // Support both single (backward compat) and array
    const ids = technicianIds || (technicianId ? [technicianId] : []);
    return this.incidentsService.reassign(
      id,
      ids,
      reassignReason,
      req.user.id,
    );
  }

  /**
   * ========================================
   * TECHNICIAN WORKFLOW - NEW ENDPOINTS
   * ========================================
   */

  /**
   * Submit Response: Technician provides ETA and message before going onsite
   * Access: TECHNICIAN only (assigned technician)
   * Status: Must be ASSIGNED
   *
   * Optional action that is tracked for performance scoring.
   * Sends email notification to configured close_notification_to email.
   */
  @Post(':id/response')
  @Roles(UserRole.TECHNICIAN)
  submitResponse(
    @Param('id') id: string,
    @Body() dto: SubmitResponseDto,
    @Request() req,
  ) {
    return this.incidentsService.submitResponse(id, req.user.id, dto);
  }

  /**
   * Check-in: Upload before photos and start work
   * Access: TECHNICIAN only (assigned technician)
   * Status: ASSIGNED → IN_PROGRESS
   *
   * Workflow:
   * 1. Technician arrives at site
   * 2. Takes before photos (max 5)
   * 3. GPS location is captured automatically
   * 4. Uploads photos → auto check-in
   * 5. Status changes to IN_PROGRESS
   */
  @Post(':id/checkin')
  @Roles(UserRole.TECHNICIAN)
  checkin(
    @Param('id') id: string,
    @Body('beforePhotos') beforePhotos: string[],
    @Body('checkInLatitude') checkInLatitude: number | undefined,
    @Body('checkInLongitude') checkInLongitude: number | undefined,
    @Request() req,
  ) {
    return this.incidentsService.checkin(
      id,
      beforePhotos,
      req.user.id,
      checkInLatitude,
      checkInLongitude,
    );
  }

  /**
   * Add more before photos after check-in
   * Access: TECHNICIAN only (assigned technician)
   * Status: Must be IN_PROGRESS
   * Max total: 5 photos
   */
  @Post(':id/add-before-photos')
  @Roles(UserRole.TECHNICIAN)
  addBeforePhotos(
    @Param('id') id: string,
    @Body('beforePhotos') beforePhotos: string[],
    @Request() req,
  ) {
    return this.incidentsService.addBeforePhotos(id, beforePhotos, req.user.id);
  }

  /**
   * Resolve incident with optional spare parts
   * Access: TECHNICIAN only (assigned technician)
   * Status: IN_PROGRESS → RESOLVED
   *
   * Workflow:
   * 1. Technician completes repair
   * 2. Fills resolution note
   * 3. Indicates if spare parts used
   * 4. If yes: adds spare parts details (unlimited)
   * 5. Uploads after photos (max 20)
   * 6. Status changes to RESOLVED
   * 7. Waits for Help Desk confirmation
   */
  @Post(':id/resolve')
  @Roles(UserRole.TECHNICIAN, UserRole.IT_MANAGER)
  resolve(
    @Param('id') id: string,
    @Body() resolveDto: ResolveIncidentDto,
    @Request() req,
  ) {
    return this.incidentsService.resolveIncident(id, resolveDto, req.user.id);
  }

  /**
   * Update resolution before Help Desk confirms
   * Access: TECHNICIAN only (who resolved it)
   * Status: Must be RESOLVED (not yet CLOSED)
   * 
   * Use cases:
   * - Found additional issue
   * - Need to add more photos
   * - Update spare parts list
   * - Correct resolution note
   */
  @Patch(':id/update-resolve')
  @Roles(UserRole.TECHNICIAN, UserRole.IT_MANAGER)
  updateResolve(
    @Param('id') id: string,
    @Body() updateDto: UpdateResolveDto,
    @Request() req,
  ) {
    return this.incidentsService.updateResolve(id, updateDto, req.user.id);
  }

  /**
   * Technician confirms their resolve
   * Access: TECHNICIAN only (assigned technician)
   * Sets techConfirmedAt, sends notification to Help Desk
   */
  @Post(':id/tech-confirm')
  @Roles(UserRole.TECHNICIAN, UserRole.IT_MANAGER)
  techConfirmResolve(@Param('id') id: string, @Request() req) {
    return this.incidentsService.techConfirmResolve(id, req.user.id);
  }

  /**
   * Help Desk confirms incident closure
   * Access: HELP_DESK only
   * Status: RESOLVED → CLOSED
   * 
   * Workflow:
   * 1. Help Desk reviews resolution
   * 2. Checks photos
   * 3. Verifies spare parts (if any)
   * 4. Confirms closure
   * 5. Status changes to CLOSED
   * 
   * Note: After confirmation, technician can no longer edit
   */
  @Post(':id/confirm-close')
  @Roles(UserRole.HELP_DESK, UserRole.IT_MANAGER)
  confirmClose(@Param('id') id: string, @Request() req) {
    return this.incidentsService.confirmClose(id, req.user.id);
  }

  /**
   * Direct close incident by Helpdesk (Phone Support / Remote Support)
   * OPEN → CLOSED without technician assignment
   */
  @Post(':id/direct-close')
  @Roles(UserRole.HELP_DESK)
  directClose(
    @Param('id') id: string,
    @Body('resolutionType') resolutionType: 'PHONE_SUPPORT' | 'REMOTE_SUPPORT',
    @Body('resolutionNote') resolutionNote: string,
    @Request() req,
  ) {
    return this.incidentsService.directClose(id, resolutionType, resolutionNote, req.user.id);
  }

  /**
   * Request onsite support - marks incident for Supervisor assignment
   * Status stays OPEN, resolutionType → ONSITE
   */
  @Post(':id/request-onsite')
  @Roles(UserRole.HELP_DESK)
  requestOnsite(@Param('id') id: string, @Request() req) {
    return this.incidentsService.requestOnsite(id, req.user.id);
  }

  /**
   * Get spare parts list for incident
   * Access: All authenticated users
   */
  @Get(':id/spare-parts')
  @Roles(
    UserRole.IT_MANAGER,
    UserRole.SUPERVISOR,
    UserRole.HELP_DESK,
    UserRole.TECHNICIAN,
    UserRole.READ_ONLY,
  )
  getSpareParts(@Param('id') id: string) {
    return this.incidentsService.getSpareParts(id);
  }

  /**
   * Get related incidents (parent and children)
   * Access: All authenticated users
   *
   * Returns:
   * - parent: The parent incident if this is a child (e.g., return job)
   * - children: Any child incidents (e.g., return jobs created from this incident)
   * - hasRelated: Boolean indicating if there are any related incidents
   */
  @Get(':id/related')
  @Roles(
    UserRole.IT_MANAGER,
    UserRole.SUPERVISOR,
    UserRole.HELP_DESK,
    UserRole.TECHNICIAN,
    UserRole.END_USER,
    UserRole.READ_ONLY,
  )
  getRelatedIncidents(@Param('id') id: string) {
    return this.incidentsService.getRelatedIncidents(id);
  }

  /**
   * Create return job (return equipment incident)
   * Access: HELP_DESK only
   *
   * Creates a new incident linked to the parent incident for
   * returning equipment that was replaced during repair.
   *
   * Workflow:
   * 1. Help Desk creates return job from resolved/closed incident
   * 2. New incident is created with type RETURN_EQUIPMENT
   * 3. Linked to parent via relatedIncidentId
   * 4. Can be assigned immediately or left open
   */
  @Post(':id/create-return-job')
  @Roles(UserRole.HELP_DESK)
  createReturnJob(
    @Param('id') id: string,
    @Body() dto: { title?: string; description?: string; priority?: string; assigneeId?: number },
    @Request() req,
  ) {
    return this.incidentsService.createReturnJob(id, dto, req.user.id);
  }

  /**
   * Get incident history/timeline
   * Access: All authenticated users
   */
  @Get(':id/history')
  @Roles(
    UserRole.IT_MANAGER,
    UserRole.SUPERVISOR,
    UserRole.HELP_DESK,
    UserRole.TECHNICIAN,
    UserRole.END_USER,
    UserRole.READ_ONLY,
  )
  getHistory(@Param('id') id: string) {
    return this.historyService.getHistory(id);
  }

  /**
   * ========================================
   * LEGACY ENDPOINTS (Keep for compatibility)
   * ========================================
   */

  /**
   * Accept incident (Legacy - optional)
   * Access: TECHNICIAN only
   * 
   * Note: With new workflow, check-in replaces accept
   * This is kept for backward compatibility
   */
  @Post(':id/accept')
  @Roles(UserRole.TECHNICIAN)
  accept(@Param('id') id: string, @Request() req) {
    return this.incidentsService.accept(id, req.user.id);
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
   * ✅ UPDATED: Reopen incident with tracking
   * Access: HELP_DESK only
   * Status: CLOSED → IN_PROGRESS
   *
   * Use cases:
   * - Issue recurs after closing
   * - Incomplete repair discovered
   * - Customer reports same problem again
   *
   * Features:
   * - Tracks reopen count
   * - Records who reopened and when
   * - Can reassign to different technician
   * - Updates reopen reason
   */
  @Post(':id/reopen')
  @Roles(UserRole.HELP_DESK)
  reopen(
    @Param('id') id: string,
    @Body() reopenDto: ReopenIncidentDto,
    @Request() req,
  ) {
    return this.incidentsService.reopen(
      id,
      reopenDto.reason,
      reopenDto.assignTo,
      req.user.id,
    );
  }

  /**
   * Generate service report token
   * Access: TECHNICIAN only
   */
  @Post(':id/generate-service-report')
  @Roles(UserRole.TECHNICIAN)
  async generateServiceReport(@Param('id') id: string) {
    return this.incidentsService.generateServiceReportTokenEndpoint(id);
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

  // ─── SLA Defense Endpoints ──────────────────────────────────────────────────

  /**
   * Submit SLA Defense request
   * Access: TECHNICIAN, SUPERVISOR
   */
  @Post(':id/sla-defense')
  @Roles(UserRole.TECHNICIAN, UserRole.SUPERVISOR, UserRole.SUPER_ADMIN)
  submitSlaDefense(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @Request() req,
  ) {
    return this.incidentsService.submitSlaDefense(id, req.user.id, reason);
  }

  /**
   * Get SLA Defense status for an incident
   * Access: All authenticated roles
   */
  @Get(':id/sla-defense')
  @Roles(
    UserRole.IT_MANAGER,
    UserRole.SUPERVISOR,
    UserRole.HELP_DESK,
    UserRole.TECHNICIAN,
    UserRole.END_USER,
    UserRole.READ_ONLY,
    UserRole.SUPER_ADMIN,
  )
  getSlaDefense(@Param('id') id: string) {
    return this.incidentsService.getSlaDefense(id);
  }

  /**
   * List all pending SLA Defense requests
   * Access: IT_MANAGER, SUPER_ADMIN
   */
  @Get('sla-defenses/pending')
  @Roles(UserRole.IT_MANAGER, UserRole.SUPER_ADMIN)
  getPendingSlaDefenses(@Request() req) {
    const userRole = (Array.isArray(req.user.roles) ? req.user.roles[0] : req.user.role) as UserRole;
    return this.incidentsService.getPendingSlaDefenses(req.user.id, userRole);
  }

  /**
   * List approved SLA Defense requests (for revocation)
   * Access: IT_MANAGER, SUPER_ADMIN
   */
  @Get('sla-defenses/approved')
  @Roles(UserRole.IT_MANAGER, UserRole.SUPER_ADMIN)
  getApprovedSlaDefenses(@Request() req) {
    const userRole = (Array.isArray(req.user.roles) ? req.user.roles[0] : req.user.role) as UserRole;
    return this.incidentsService.getApprovedSlaDefenses(req.user.id, userRole);
  }

  /**
   * Approve a SLA Defense request
   * Access: IT_MANAGER, SUPER_ADMIN
   */
  @Post('sla-defenses/:defenseId/approve')
  @Roles(UserRole.IT_MANAGER, UserRole.SUPER_ADMIN)
  approveSlaDefense(
    @Param('defenseId') defenseId: string,
    @Body('reviewNote') reviewNote: string,
    @Request() req,
  ) {
    const userRole = (Array.isArray(req.user.roles) ? req.user.roles[0] : req.user.role) as UserRole;
    return this.incidentsService.reviewSlaDefense(
      parseInt(defenseId),
      req.user.id,
      userRole,
      true,
      reviewNote,
    );
  }

  /**
   * Reject a SLA Defense request
   * Access: IT_MANAGER, SUPER_ADMIN
   */
  @Post('sla-defenses/:defenseId/reject')
  @Roles(UserRole.IT_MANAGER, UserRole.SUPER_ADMIN)
  rejectSlaDefense(
    @Param('defenseId') defenseId: string,
    @Body('reviewNote') reviewNote: string,
    @Request() req,
  ) {
    const userRole = (Array.isArray(req.user.roles) ? req.user.roles[0] : req.user.role) as UserRole;
    return this.incidentsService.reviewSlaDefense(
      parseInt(defenseId),
      req.user.id,
      userRole,
      false,
      reviewNote,
    );
  }
}

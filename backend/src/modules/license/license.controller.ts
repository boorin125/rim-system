// src/modules/license/license.controller.ts

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
  Ip,
  Headers,
} from '@nestjs/common';
import { LicenseService } from './license.service';
import { CanaryService } from './canary.service';
import {
  CreateLicenseDto,
  UpdateLicenseDto,
  ActivateLicenseDto,
  RenewLicenseDto,
  SetConfigDto,
} from './dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { VendorGuard } from './vendor.guard';
import { UserRole } from '@prisma/client';

/**
 * License & Activation Controller
 *
 * Feature 17: License & Activation System
 *
 * LICENSE MANAGEMENT (SUPER_ADMIN only):
 * - POST   /api/license/create           - Create new license
 * - GET    /api/license/list             - List all licenses
 * - GET    /api/license/:id              - Get license details
 * - PUT    /api/license/:id              - Update license
 * - DELETE /api/license/:id              - Delete license
 * - POST   /api/license/:id/renew        - Renew license
 * - POST   /api/license/:id/suspend      - Suspend license
 * - POST   /api/license/:id/revoke       - Revoke license
 *
 * ACTIVATION (Public or Authenticated):
 * - POST   /api/license/activate         - Activate license
 * - GET    /api/license/validate         - Validate current license
 * - GET    /api/license/current          - Get current license info
 * - GET    /api/license/machine-id       - Get machine ID
 * - GET    /api/license/limits           - Check usage limits
 * - GET    /api/license/feature/:name    - Check feature availability
 *
 * SYSTEM CONFIG:
 * - GET    /api/license/config           - Get all configs
 * - GET    /api/license/config/:key      - Get config by key
 * - POST   /api/license/config           - Set config
 * - DELETE /api/license/config/:key      - Delete config
 *
 * STATS:
 * - GET    /api/license/stats            - Get license statistics
 */

@Controller('license')
export class LicenseController {
  constructor(
    private readonly licenseService: LicenseService,
    private readonly canaryService: CanaryService,
  ) {}

  // ==========================================
  // LICENSE MANAGEMENT (SUPER_ADMIN)
  // ==========================================

  /**
   * Create new license — requires VendorGuard (x-vendor-secret header)
   */
  @Post('create')
  @UseGuards(VendorGuard, JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  async createLicense(@Body() dto: CreateLicenseDto) {
    return this.licenseService.createLicense(dto);
  }

  /**
   * Get all licenses — requires VendorGuard
   */
  @Get('list')
  @UseGuards(VendorGuard, JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  async getLicenses(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('licenseType') licenseType?: string,
  ) {
    return this.licenseService.getLicenses({
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
      status,
      licenseType,
    });
  }

  /**
   * Get license details — requires VendorGuard
   */
  @Get('detail/:id')
  @UseGuards(VendorGuard, JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  async getLicense(@Param('id', ParseIntPipe) id: number) {
    return this.licenseService.getLicense(id);
  }

  /**
   * Update license — requires VendorGuard
   */
  @Put(':id')
  @UseGuards(VendorGuard, JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  async updateLicense(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateLicenseDto,
  ) {
    return this.licenseService.updateLicense(id, dto);
  }

  /**
   * Delete license — requires VendorGuard
   */
  @Delete(':id')
  @UseGuards(VendorGuard, JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  async deleteLicense(@Param('id', ParseIntPipe) id: number) {
    return this.licenseService.deleteLicense(id);
  }

  /**
   * Renew license — requires VendorGuard
   */
  @Post(':id/renew')
  @UseGuards(VendorGuard, JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async renewLicense(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RenewLicenseDto,
  ) {
    return this.licenseService.renewLicense(id, dto);
  }

  /**
   * Suspend license — requires VendorGuard
   */
  @Post(':id/suspend')
  @UseGuards(VendorGuard, JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async suspendLicense(
    @Param('id', ParseIntPipe) id: number,
    @Body('reason') reason: string,
  ) {
    return this.licenseService.suspendLicense(id, reason);
  }

  /**
   * Revoke license — requires VendorGuard
   */
  @Post(':id/revoke')
  @UseGuards(VendorGuard, JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async revokeLicense(
    @Param('id', ParseIntPipe) id: number,
    @Body('reason') reason: string,
  ) {
    return this.licenseService.revokeLicense(id, reason);
  }

  // ==========================================
  // ACTIVATION (Public or Authenticated)
  // ==========================================

  /**
   * Activate license (can be called without auth during initial setup)
   */
  @Post('activate')
  @HttpCode(HttpStatus.OK)
  async activateLicense(
    @Body() dto: ActivateLicenseDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.licenseService.activateLicense(dto, ip, userAgent);
  }

  /**
   * Deactivate license from current server (release machine binding for transfer)
   */
  @Post('deactivate')
  @HttpCode(HttpStatus.OK)
  async deactivateLicense(
    @Body('licenseKey') licenseKey: string,
    @Body('machineId') machineId?: string,
  ) {
    return this.licenseService.deactivateLicense(licenseKey, machineId);
  }

  /**
   * Force transfer — clear machine binding without needing old server (SUPER_ADMIN + VendorGuard)
   */
  @Post(':id/force-transfer')
  @UseGuards(VendorGuard, JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async forceTransfer(
    @Param('id', ParseIntPipe) id: number,
    @Body('adminNote') adminNote?: string,
    @Body('revokeMachineId') revokeMachineId?: string,
  ) {
    return this.licenseService.forceTransfer(id, adminNote, revokeMachineId);
  }

  /**
   * Validate current license
   */
  @Get('validate')
  async validateLicense(@Query('machineId') machineId?: string) {
    return this.licenseService.validateLicense(machineId);
  }

  /**
   * Get current license info
   */
  @Get('current')
  async getCurrentLicense() {
    return this.licenseService.getCurrentLicense();
  }

  /**
   * Get machine ID (legacy)
   */
  @Get('machine-id')
  getMachineId() {
    return { machineId: this.licenseService.getMachineId() };
  }

  /**
   * Get full machine info including VM detection
   */
  @Get('machine-info')
  getMachineInfo() {
    return this.licenseService.getMachineInfo();
  }

  /**
   * Check usage limits
   */
  @Get('limits')
  @UseGuards(JwtAuthGuard)
  async checkLimits() {
    return this.licenseService.checkLimits();
  }

  /**
   * Check feature availability
   */
  @Get('feature/:name')
  @UseGuards(JwtAuthGuard)
  async checkFeature(@Param('name') name: string) {
    const enabled = await this.licenseService.checkFeature(name);
    return { feature: name, enabled };
  }

  // ==========================================
  // SYSTEM CONFIG
  // ==========================================

  /**
   * Get all configs
   */
  @Get('config')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.IT_MANAGER)
  async getAllConfigs(@Query('category') category?: string) {
    return this.licenseService.getAllConfigs(category);
  }

  /**
   * Get config by key
   */
  @Get('config/:key')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.IT_MANAGER)
  async getConfig(@Param('key') key: string) {
    const value = await this.licenseService.getConfig(key);
    return { key, value };
  }

  /**
   * Set config
   */
  @Post('config')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  async setConfig(@Body() dto: SetConfigDto) {
    return this.licenseService.setConfig(dto);
  }

  /**
   * Delete config
   */
  @Delete('config/:key')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  async deleteConfig(@Param('key') key: string) {
    return this.licenseService.deleteConfig(key);
  }

  // ==========================================
  // STATS
  // ==========================================

  /**
   * Get license statistics
   */
  @Get('stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  async getStats() {
    return this.licenseService.getStats();
  }

  // ==========================================
  // HONEYPOT (Layer 4)
  // Endpoint name looks like a routine health check.
  // Frontend calls this on every app boot — logs build fingerprint + IP.
  // If stolen code is deployed elsewhere, this call arrives from unknown IP.
  // ==========================================

  /**
   * Integrity check — called silently by frontend on boot.
   * No auth required (must work even before login).
   */
  @Get('_sys/integrity-check')
  @HttpCode(HttpStatus.OK)
  async integrityCheck(
    @Ip() ip: string,
    @Headers('x-client-build') buildId: string,
    @Headers('x-machine-id') machineId: string,
    @Headers('user-agent') ua: string,
  ) {
    void this.canaryService.logIntegrityCheck({
      ts: new Date().toISOString(),
      ip,
      buildId: buildId || 'unset',
      machineId: machineId || 'unset',
      ua: ua || '',
      path: 'integrity-check',
    });

    // Always respond 200 with innocuous body — caller must not know they're being logged
    return { status: 'ok', ts: Date.now() };
  }

  /**
   * View honeypot access logs — SUPER_ADMIN + VendorGuard only
   */
  @Get('_sys/integrity-logs')
  @UseGuards(VendorGuard, JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  async getIntegrityLogs(@Query('limit') limit?: string) {
    return this.canaryService.getIntegrityLogs(limit ? parseInt(limit) : 50);
  }
}

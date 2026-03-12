// src/modules/license/vendor-portal.controller.ts
// Vendor Portal API — only requires x-vendor-secret header (no JWT needed)

import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { LicenseService } from './license.service';
import { CreateLicenseDto, RenewLicenseDto } from './dto';
import { VendorGuard } from './vendor.guard';

@Controller('vendor')
@UseGuards(VendorGuard)
export class VendorPortalController {
  constructor(private readonly licenseService: LicenseService) {}

  /**
   * POST /api/vendor/auth
   * Verify vendor secret — used by portal login page
   */
  @Post('auth')
  @HttpCode(HttpStatus.OK)
  async verifyAuth() {
    return { success: true, message: 'Vendor authenticated' };
  }

  /**
   * GET /api/vendor/licenses
   * List all licenses with pagination & filters
   */
  @Get('licenses')
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
   * POST /api/vendor/licenses
   * Create new license key
   */
  @Post('licenses')
  async createLicense(@Body() dto: CreateLicenseDto) {
    return this.licenseService.createLicense(dto);
  }

  /**
   * GET /api/vendor/licenses/:id
   * Get license detail with activation logs
   */
  @Get('licenses/:id')
  async getLicenseDetail(@Param('id', ParseIntPipe) id: number) {
    return this.licenseService.getLicense(id);
  }

  /**
   * POST /api/vendor/licenses/:id/renew
   * Renew/extend license expiration
   */
  @Post('licenses/:id/renew')
  @HttpCode(HttpStatus.OK)
  async renewLicense(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RenewLicenseDto,
  ) {
    return this.licenseService.renewLicense(id, dto);
  }

  /**
   * POST /api/vendor/licenses/:id/suspend
   * Suspend license (blocks activation)
   */
  @Post('licenses/:id/suspend')
  @HttpCode(HttpStatus.OK)
  async suspendLicense(
    @Param('id', ParseIntPipe) id: number,
    @Body('reason') reason?: string,
  ) {
    return this.licenseService.suspendLicense(id, reason || 'Suspended via Vendor Portal');
  }

  /**
   * POST /api/vendor/licenses/:id/revoke
   * Revoke license permanently
   */
  @Post('licenses/:id/revoke')
  @HttpCode(HttpStatus.OK)
  async revokeLicense(
    @Param('id', ParseIntPipe) id: number,
    @Body('reason') reason?: string,
  ) {
    return this.licenseService.revokeLicense(id, reason || 'Revoked via Vendor Portal');
  }

  /**
   * POST /api/vendor/licenses/:id/force-transfer
   * Clear machine binding (for server migration)
   */
  @Post('licenses/:id/force-transfer')
  @HttpCode(HttpStatus.OK)
  async forceTransfer(
    @Param('id', ParseIntPipe) id: number,
    @Body('notes') notes?: string,
  ) {
    return this.licenseService.forceTransfer(id, notes || 'Force transfer via Vendor Portal');
  }
}

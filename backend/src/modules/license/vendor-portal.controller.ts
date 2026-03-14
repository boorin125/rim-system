// src/modules/license/vendor-portal.controller.ts
// Vendor Portal API — only requires x-vendor-secret header (no JWT needed)

import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  Req,
  Res,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { Request, Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';
import { LicenseService } from './license.service';
import { PatchService } from './patch.service';
import { CreateLicenseDto, RenewLicenseDto } from './dto';
import { VendorGuard } from './vendor.guard';

@Controller('vendor')
@UseGuards(VendorGuard)
export class VendorPortalController {
  constructor(
    private readonly licenseService: LicenseService,
    private readonly patchService: PatchService,
  ) {}

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

  // ─── Patch Management ────────────────────────────────────────────────────────

  /**
   * GET /api/vendor/patches
   * List all patches (vendor view — includes unpublished)
   */
  @Get('patches')
  async listPatches(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.patchService.listPatches(
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
    );
  }

  /**
   * POST /api/vendor/patches
   * Upload a new patch file + create record
   * multipart/form-data: file, version, patchType, title, changelog
   */
  @Post('patches')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const dir = path.join(process.cwd(), 'uploads', 'patches');
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (req, file, cb) => {
          const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = path.extname(file.originalname);
          cb(null, `patch-${unique}${ext}`);
        },
      }),
      limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB max
      fileFilter: (req, file, cb) => {
        const allowed = ['.zip', '.tar', '.gz', '.exe', '.sh', '.run', '.pkg', '.dmg'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowed.includes(ext)) {
          cb(null, true);
        } else {
          cb(new BadRequestException(`File type ${ext} not allowed`), false);
        }
      },
    }),
  )
  async uploadPatch(
    @UploadedFile() file: Express.Multer.File,
    @Body('version') version: string,
    @Body('patchType') patchType: string,
    @Body('title') title: string,
    @Body('changelog') changelog: string,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    if (!version || !patchType || !title || !changelog) {
      // Clean up uploaded file
      fs.unlinkSync(file.path);
      throw new BadRequestException('version, patchType, title, changelog are required');
    }

    const relPath = path.join('uploads', 'patches', file.filename);

    return this.patchService.createPatch({
      version,
      patchType,
      title,
      changelog,
      fileName: file.originalname,
      filePath: relPath,
      fileSize: file.size,
    });
  }

  /**
   * GET /api/vendor/patches/:id
   */
  @Get('patches/:id')
  async getPatch(@Param('id', ParseIntPipe) id: number) {
    return this.patchService.getPatch(id);
  }

  /**
   * POST /api/vendor/patches/:id/publish
   * Publish + send email to all active license contacts
   */
  @Post('patches/:id/publish')
  @HttpCode(HttpStatus.OK)
  async publishPatch(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request,
  ) {
    const frontendUrl =
      process.env.FRONTEND_URL ||
      `${req.protocol}://${req.get('host')}`.replace(':3000', ':3001');
    return this.patchService.publishPatch(id, frontendUrl);
  }

  /**
   * POST /api/vendor/patches/:id/unpublish
   */
  @Post('patches/:id/unpublish')
  @HttpCode(HttpStatus.OK)
  async unpublishPatch(@Param('id', ParseIntPipe) id: number) {
    return this.patchService.unpublishPatch(id);
  }

  /**
   * DELETE /api/vendor/patches/:id
   */
  @Delete('patches/:id')
  @HttpCode(HttpStatus.OK)
  async deletePatch(@Param('id', ParseIntPipe) id: number) {
    return this.patchService.deletePatch(id);
  }

  /**
   * GET /api/vendor/patches/:id/download
   * Vendor download (bypasses isPublished check)
   */
  @Get('patches/:id/download')
  async downloadPatchVendor(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    const patch = await this.patchService.getPatch(id);
    const filePath = this.patchService.getFilePath(patch);
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('Patch file not found on disk');
    }
    res.setHeader('Content-Disposition', `attachment; filename="${patch.fileName}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  }
}

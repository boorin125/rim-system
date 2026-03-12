// src/modules/version/version.controller.ts

import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { VersionService } from './version.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

const UPLOAD_TEMP = './uploads/patches';

@Controller('version')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VersionController {
  constructor(private readonly versionService: VersionService) {}

  /** GET /version — current version info (all authenticated users) */
  @Get()
  getCurrentVersion() {
    return this.versionService.getCurrentVersion();
  }

  /** GET /version/history — full version history (SUPER_ADMIN only) */
  @Get('history')
  @Roles(UserRole.SUPER_ADMIN)
  getHistory() {
    return this.versionService.getHistory();
  }

  /** GET /version/snapshots — list backups (SUPER_ADMIN only) */
  @Get('snapshots')
  @Roles(UserRole.SUPER_ADMIN)
  listSnapshots() {
    return this.versionService.listSnapshots();
  }

  /** POST /version/validate — validate a patch file before installing (SUPER_ADMIN only) */
  @Post('validate')
  @Roles(UserRole.SUPER_ADMIN)
  @UseInterceptors(
    FileInterceptor('patch', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          if (!fs.existsSync(UPLOAD_TEMP)) fs.mkdirSync(UPLOAD_TEMP, { recursive: true });
          cb(null, UPLOAD_TEMP);
        },
        filename: (req, file, cb) => cb(null, `validate-${Date.now()}.rim-patch`),
      }),
      fileFilter: (req, file, cb) => {
        if (!file.originalname.endsWith('.rim-patch')) {
          return cb(new BadRequestException('Only .rim-patch files are allowed'), false);
        }
        cb(null, true);
      },
    }),
  )
  async validatePatch(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No patch file uploaded');
    try {
      const result = await this.versionService.validatePatch(file.path);
      fs.unlinkSync(file.path); // clean up after validation
      return result;
    } catch (err) {
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      throw err;
    }
  }

  /** POST /version/install — install a patch (SUPER_ADMIN only) */
  @Post('install')
  @Roles(UserRole.SUPER_ADMIN)
  @UseInterceptors(
    FileInterceptor('patch', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          if (!fs.existsSync(UPLOAD_TEMP)) fs.mkdirSync(UPLOAD_TEMP, { recursive: true });
          cb(null, UPLOAD_TEMP);
        },
        filename: (req, file, cb) => cb(null, `patch-${Date.now()}.rim-patch`),
      }),
      fileFilter: (req, file, cb) => {
        if (!file.originalname.endsWith('.rim-patch')) {
          return cb(new BadRequestException('Only .rim-patch files are allowed'), false);
        }
        cb(null, true);
      },
    }),
  )
  async installPatch(@UploadedFile() file: Express.Multer.File, @Request() req: any) {
    if (!file) throw new BadRequestException('No patch file uploaded');
    return this.versionService.installPatch(file.path, req.user.id);
  }

  /** POST /version/rollback/:version — rollback to a previous version (SUPER_ADMIN only) */
  @Post('rollback/:version')
  @Roles(UserRole.SUPER_ADMIN)
  async rollback(@Param('version') version: string, @Request() req: any) {
    return this.versionService.rollback(version, req.user.id);
  }
}

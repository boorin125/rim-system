// src/modules/system/system.controller.ts

import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { SystemService } from './system.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';

@Controller('system')
export class SystemController {
  constructor(private readonly system: SystemService) {}

  /** GET /system/version — public: running version (used by the updater's health check too) */
  @Get('version')
  version() {
    return this.system.version();
  }

  /** GET /system/update — version, updater status, last check (SUPER_ADMIN) */
  @Get('update')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  overview() {
    return this.system.overview();
  }

  /** POST /system/update/check — check the release channel in the background */
  @Post('update/check')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  check() {
    return this.system.startCheck();
  }

  /** POST /system/update/install — { version, commit } from the last check */
  @Post('update/install')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  install(@Body() body: { version: string; commit: string }) {
    return this.system.install(body?.version, body?.commit);
  }

  /** GET /system/update/status — progress of the running install */
  @Get('update/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  status() {
    return this.system.status();
  }
}

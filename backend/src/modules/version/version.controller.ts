// src/modules/version/version.controller.ts

import { Controller, Get, UseGuards } from '@nestjs/common';
import { VersionService } from './version.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@Controller('version')
@UseGuards(JwtAuthGuard)
export class VersionController {
  constructor(private readonly versionService: VersionService) {}

  /** GET /version — current version info (Settings › Info, sidebar) */
  @Get()
  getCurrentVersion() {
    return this.versionService.getCurrentVersion();
  }
}

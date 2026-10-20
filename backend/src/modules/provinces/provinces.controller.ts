// src/modules/provinces/provinces.controller.ts
import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { ProvincesService } from './provinces.service';

@Controller('provinces')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProvincesController {
  constructor(private readonly provincesService: ProvincesService) {}

  /** Canonical 77 provinces [{ en, th }] — any logged-in user */
  @Get()
  list() {
    return this.provincesService.list();
  }

  /** Stored values that aren't canonical (after automatic normalisation) */
  @Get('audit')
  @Roles(UserRole.SUPER_ADMIN, UserRole.IT_MANAGER)
  audit() {
    return this.provincesService.audit();
  }

  @Post('remap')
  @Roles(UserRole.SUPER_ADMIN, UserRole.IT_MANAGER)
  remap(@Body() body: { from: string; to: string }) {
    return this.provincesService.remap(body?.from, body?.to);
  }

  /** Re-run automatic normalisation (also runs on every backend start) */
  @Post('normalize')
  @Roles(UserRole.SUPER_ADMIN, UserRole.IT_MANAGER)
  normalize() {
    return this.provincesService.normalizeAll();
  }
}

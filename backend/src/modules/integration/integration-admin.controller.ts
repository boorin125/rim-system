// src/modules/integration/integration-admin.controller.ts
// Settings › Integration (SUPER_ADMIN) + the RSM link for the incident page button (any logged-in user)
import { BadRequestException, Body, Controller, Get, Param, ParseIntPipe, Post, Put, Request, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { IntegrationService } from './integration.service';
import { RsmClientService } from './rsm-client.service';

@Controller('integration')
@UseGuards(JwtAuthGuard, RolesGuard)
export class IntegrationAdminController {
  constructor(private readonly integration: IntegrationService, private readonly rsm: RsmClientService) {}

  /** RSM URL for the "เบิกอะไหล่ (RSM)" button — null = no button */
  @Get('rsm-link')
  rsmLink() {
    return this.integration.rsmLink();
  }

  @Get('admin')
  @Roles(UserRole.SUPER_ADMIN)
  async overview() {
    return { ...(await this.integration.adminOverview()), hasRsmKey: await this.rsm.hasKey() };
  }

  /** Key that RSM issued for THIS RIM server (RIM → RSM calls, e.g. pulling issued S/N) — write-only */
  @Put('admin/rsm-key')
  @Roles(UserRole.SUPER_ADMIN)
  setRsmKey(@Body() body: { rsmKey?: string | null }) {
    if (body?.rsmKey != null && typeof body.rsmKey !== 'string') throw new BadRequestException('rsmKey ต้องเป็นข้อความ');
    return this.rsm.setKey(body?.rsmKey);
  }

  @Post('admin/rsm-test')
  @Roles(UserRole.SUPER_ADMIN)
  testRsm() {
    return this.rsm.testConnection();
  }

  @Post('admin/keys')
  @Roles(UserRole.SUPER_ADMIN)
  createKey(@Body() body: { name?: string; callerUrl?: string; scopes?: string[] }, @Request() req: any) {
    if (typeof body?.name !== 'string' || typeof body?.callerUrl !== 'string') {
      throw new BadRequestException('name และ callerUrl ต้องเป็นข้อความ');
    }
    if (body.scopes !== undefined && (!Array.isArray(body.scopes) || body.scopes.some((s) => typeof s !== 'string'))) {
      throw new BadRequestException('scopes ต้องเป็นรายการข้อความ');
    }
    const u = req.user || {};
    const name = [u.firstName, u.lastName].filter(Boolean).join(' ') || u.username || null;
    return this.integration.createKey({ name: body.name, callerUrl: body.callerUrl, scopes: body.scopes }, { id: u.id, name });
  }

  @Post('admin/keys/:id/revoke')
  @Roles(UserRole.SUPER_ADMIN)
  revoke(@Param('id', ParseIntPipe) id: number) {
    return this.integration.revokeKey(id);
  }

  @Put('admin/rsm-url')
  @Roles(UserRole.SUPER_ADMIN)
  setRsmUrl(@Body() body: { rsmUrl?: string | null }) {
    if (body?.rsmUrl != null && typeof body.rsmUrl !== 'string') throw new BadRequestException('rsmUrl ต้องเป็นข้อความ');
    return this.integration.setRsmUrl(body?.rsmUrl);
  }

  @Get('admin/logs')
  @Roles(UserRole.SUPER_ADMIN)
  logs() {
    return this.integration.recentLogs(200);
  }
}

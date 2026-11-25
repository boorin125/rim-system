// src/modules/integration/integration-v1.controller.ts
// Integration API v1 — server-to-server, read-only (spec §6–§7). Auth = API key (not JWT).
import { Controller, Get, Param, Query, Request, UseFilters, UseGuards } from '@nestjs/common';
import { IntegrationService } from './integration.service';
import { IntegrationAuthGuard, IntegrationScope } from './integration-auth.guard';
import { IntegrationExceptionFilter } from './integration-exception.filter';

const toInt = (v: any, def: number, min: number, max: number) => {
  const n = parseInt(String(v ?? ''), 10);
  return Number.isFinite(n) ? Math.min(Math.max(n, min), max) : def;
};

@Controller('integration/v1')
@UseGuards(IntegrationAuthGuard)
@UseFilters(IntegrationExceptionFilter)
export class IntegrationV1Controller {
  constructor(private readonly integration: IntegrationService) {}

  @Get('meta')
  @IntegrationScope('meta:read')
  async meta(@Request() req: any) {
    return { data: await this.integration.meta(req.integrationKey.scopes) };
  }

  // Declared before :ticketNumber so "by-serial" is never read as a ticket number
  @Get('incidents/by-serial/:serial')
  @IntegrationScope('incidents:read')
  bySerial(
    @Param('serial') serial: string,
    @Query('role') role?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.integration.incidentsBySerial(
      serial,
      (role || 'removed').toLowerCase(),
      toInt(page, 1, 1, 100000),
      toInt(pageSize, 50, 1, 200),
    );
  }

  @Get('incidents/:ticketNumber')
  @IntegrationScope('incidents:read')
  async incident(@Param('ticketNumber') ticketNumber: string) {
    return { data: await this.integration.incidentByTicket(ticketNumber) };
  }

  // ── RIM Demand v1 §A (scope stats:read) — totals only ──

  @Get('stats/repairs')
  @IntegrationScope('stats:read')
  async repairStats(@Query('from') from?: string, @Query('to') to?: string) {
    return { data: await this.integration.repairStats(from, to) };
  }

  @Get('stats/installed-base')
  @IntegrationScope('stats:read')
  async installedBase() {
    return { data: await this.integration.installedBase() };
  }

  // ── Store Lifecycle v1 §A5 (scope projects:read) ──

  @Get('project-tasks')
  @IntegrationScope('projects:read')
  projectTasks(
    @Query('workType') workType?: string,
    @Query('status') status?: string,
    @Query('since') since?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.integration.projectTasks({ workType, status, since }, toInt(page, 1, 1, 100000), toInt(pageSize, 50, 1, 200));
  }

  @Get('project-tasks/:ticketNo')
  @IntegrationScope('projects:read')
  async projectTask(@Param('ticketNo') ticketNo: string) {
    return { data: await this.integration.projectTaskByTicket(ticketNo) };
  }

  @Get('stores/:code')
  @IntegrationScope('projects:read')
  async store(@Param('code') code: string) {
    return { data: await this.integration.storeByCode(code) };
  }
}

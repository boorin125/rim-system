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
}

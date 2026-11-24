// src/modules/integration/integration.module.ts — Integration API v1 (RSM ↔ RIM …)
import { Module } from '@nestjs/common';
import { IntegrationService } from './integration.service';
import { IntegrationAuthGuard } from './integration-auth.guard';
import { IntegrationV1Controller } from './integration-v1.controller';
import { IntegrationAdminController } from './integration-admin.controller';
import { RsmClientService } from './rsm-client.service';

@Module({
  controllers: [IntegrationV1Controller, IntegrationAdminController],
  providers: [IntegrationService, IntegrationAuthGuard, RsmClientService],
  exports: [IntegrationService, RsmClientService],
})
export class IntegrationModule {}

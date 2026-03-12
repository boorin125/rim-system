// src/modules/license/license.module.ts

import { Module } from '@nestjs/common';
import { LicenseController } from './license.controller';
import { VendorPortalController } from './vendor-portal.controller';
import { LicenseService } from './license.service';
import { LicenseGuard } from './license.guard';
import { VendorGuard } from './vendor.guard';
import { CanaryService } from './canary.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [LicenseController, VendorPortalController],
  providers: [LicenseService, LicenseGuard, VendorGuard, CanaryService],
  exports: [LicenseService, LicenseGuard, VendorGuard, CanaryService],
})
export class LicenseModule {}

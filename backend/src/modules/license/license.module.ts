// src/modules/license/license.module.ts

import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { LicenseController } from './license.controller';
import { VendorPortalController } from './vendor-portal.controller';
import { PatchPublicController } from './patch-public.controller';
import { LicenseService } from './license.service';
import { PatchService } from './patch.service';
import { LicenseGuard } from './license.guard';
import { VendorGuard } from './vendor.guard';
import { CanaryService } from './canary.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { EmailModule } from '../../email/email.module';

@Module({
  imports: [PrismaModule, EmailModule, MulterModule.register()],
  controllers: [LicenseController, VendorPortalController, PatchPublicController],
  providers: [LicenseService, PatchService, LicenseGuard, VendorGuard, CanaryService],
  exports: [LicenseService, LicenseGuard, VendorGuard, CanaryService],
})
export class LicenseModule {}

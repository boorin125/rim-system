// src/settings/settings.module.ts

import { Module } from '@nestjs/common';
import { SettingsController } from './settings.controller';
import { SettingsPublicController } from './settings-public.controller';
import { SettingsService } from './settings.service';
import { PrismaModule } from '../prisma/prisma.module';
import { EmailModule } from '../email/email.module';
import { BackupModule } from '../modules/backup/backup.module';

@Module({
  imports: [PrismaModule, EmailModule, BackupModule],
  controllers: [SettingsController, SettingsPublicController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}

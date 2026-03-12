// src/modules/backup/backup.module.ts

import { Module } from '@nestjs/common';
import { BackupController } from './backup.controller';
import { BackupService } from './backup.service';
import { BackupSchedulerService } from './backup-scheduler.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditTrailModule } from '../audit-trail/audit-trail.module';

@Module({
  imports: [PrismaModule, AuditTrailModule],
  controllers: [BackupController],
  providers: [BackupService, BackupSchedulerService],
  exports: [BackupService],
})
export class BackupModule {}

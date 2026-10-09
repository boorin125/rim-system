import { Module } from '@nestjs/common';
import { PmController, PmPublicController } from './pm.controller';
import { PmService } from './pm.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { EmailModule } from '../../email/email.module';
import { SettingsModule } from '../../settings/settings.module';
import { AuditTrailModule } from '../audit-trail/audit-trail.module';
import { EquipmentModule } from '../../equipment/equipment.module';

@Module({
  imports: [PrismaModule, EmailModule, SettingsModule, AuditTrailModule, EquipmentModule],
  controllers: [PmController, PmPublicController],
  providers: [PmService],
  exports: [PmService],
})
export class PmModule {}

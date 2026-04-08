import { Module } from '@nestjs/common';
import { PmController, PmPublicController } from './pm.controller';
import { PmService } from './pm.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { EmailModule } from '../../email/email.module';
import { SettingsModule } from '../../settings/settings.module';

@Module({
  imports: [PrismaModule, EmailModule, SettingsModule],
  controllers: [PmController, PmPublicController],
  providers: [PmService],
  exports: [PmService],
})
export class PmModule {}

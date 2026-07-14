// src/modules/outsource/outsource.module.ts

import { Module } from '@nestjs/common';
import { OutsourceController } from './outsource.controller';
import { OutsourceService } from './outsource.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { NotificationsModule } from '../../notifications/notifications.module';
import { EmailModule } from '../../email/email.module';

@Module({
  imports: [PrismaModule, NotificationsModule, EmailModule],
  controllers: [OutsourceController],
  providers: [OutsourceService],
  exports: [OutsourceService],
})
export class OutsourceModule {}

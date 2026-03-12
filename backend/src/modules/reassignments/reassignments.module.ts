// src/modules/reassignments/reassignments.module.ts

import { Module } from '@nestjs/common';
import { ReassignmentsController } from './reassignments.controller';
import { ReassignmentsService } from './reassignments.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { NotificationsModule } from '../../notifications/notifications.module';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [ReassignmentsController],
  providers: [ReassignmentsService],
  exports: [ReassignmentsService],
})
export class ReassignmentsModule {}

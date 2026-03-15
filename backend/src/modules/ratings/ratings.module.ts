// src/modules/ratings/ratings.module.ts

import { Module } from '@nestjs/common';
import { RatingsController, PublicRatingsController } from './ratings.controller';
import { RatingsService } from './ratings.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { NotificationsModule } from '../../notifications/notifications.module';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [RatingsController, PublicRatingsController],
  providers: [RatingsService],
  exports: [RatingsService],
})
export class RatingsModule {}

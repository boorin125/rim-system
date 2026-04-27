// src/setup/setup.module.ts
import { Module } from '@nestjs/common';
import { SetupController } from './setup.controller';
import { SetupService } from './setup.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SetupController],
  providers: [SetupService],
})
export class SetupModule {}

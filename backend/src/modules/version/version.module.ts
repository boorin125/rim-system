// src/modules/version/version.module.ts

import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { VersionController } from './version.controller';
import { VersionService } from './version.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule, MulterModule.register({})],
  controllers: [VersionController],
  providers: [VersionService],
  exports: [VersionService],
})
export class VersionModule {}

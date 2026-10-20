// src/modules/provinces/provinces.module.ts
import { Module } from '@nestjs/common';
import { ProvincesController } from './provinces.controller';
import { ProvincesService } from './provinces.service';

@Module({
  controllers: [ProvincesController],
  providers: [ProvincesService],
  exports: [ProvincesService],
})
export class ProvincesModule {}

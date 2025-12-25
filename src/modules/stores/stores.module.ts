// src/modules/stores/stores.module.ts

import { Module } from '@nestjs/common';
import { StoresController } from './stores.controller';
import { StoresService } from './stores.service';
import { ExcelService } from './services/excel.service';
import { TemplateService } from './services/template.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [StoresController],
  providers: [
    StoresService,
    ExcelService,      // ✅ Excel parsing & generation
    TemplateService,   // ✅ Template generation
  ],
  exports: [StoresService],
})
export class StoresModule {}
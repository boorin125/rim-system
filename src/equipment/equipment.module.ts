import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { EquipmentService } from './equipment.service';
import { EquipmentTemplateService } from './services/equipment-template.service';
import { EquipmentExcelService } from './services/equipment-excel.service';
import { EquipmentTrackingService } from './services/equipment-tracking.service';
import { EquipmentController } from './equipment.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    MulterModule.register({
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB max file size
      },
    }),
  ],
  controllers: [EquipmentController],
  providers: [
    EquipmentService,
    EquipmentTemplateService,
    EquipmentExcelService,
    EquipmentTrackingService,
  ],
  exports: [
    EquipmentService,
    EquipmentTemplateService,
    EquipmentExcelService,
    EquipmentTrackingService,
  ],
})
export class EquipmentModule {}

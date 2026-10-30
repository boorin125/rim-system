import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { EquipmentService } from './equipment.service';
import { EquipmentTemplateService } from './services/equipment-template.service';
import { EquipmentExcelService } from './services/equipment-excel.service';
import { EquipmentTrackingService } from './services/equipment-tracking.service';
import { BulkDeviceService } from './services/bulk-device.service';
import { EquipmentController } from './equipment.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditTrailModule } from '../modules/audit-trail/audit-trail.module';

@Module({
  imports: [
    PrismaModule,
    AuditTrailModule,
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
    BulkDeviceService,
  ],
  exports: [
    EquipmentService,
    EquipmentTemplateService,
    EquipmentExcelService,
    EquipmentTrackingService,
  ],
})
export class EquipmentModule {}

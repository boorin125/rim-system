import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditTrailService } from './audit-trail.service';
import { AuditTrailController } from './audit-trail.controller';

@Module({
  imports: [PrismaModule],
  controllers: [AuditTrailController],
  providers: [AuditTrailService],
  exports: [AuditTrailService],
})
export class AuditTrailModule {}

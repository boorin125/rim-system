import { Module } from '@nestjs/common';
import { IncidentsService } from './incidents.service';
import { IncidentsController } from './incidents.controller';
import { IncidentsPublicController } from './incidents-public.controller';
import { ServiceReportPublicController } from './service-report-public.controller';
import { IncidentHistoryService } from './incident-history.service';
import { SlaMonitorService } from './sla-monitor.service';
import { IncidentsAnalyticsService } from './incidents-analytics.service';
import { IncidentsAnalyticsController } from './incidents-analytics.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { EmailModule } from '../email/email.module';
import { SlaModule } from '../sla/sla.module';
import { SettingsModule } from '../settings/settings.module';
import { AuditTrailModule } from '../modules/audit-trail/audit-trail.module';
import { RatingsModule } from '../modules/ratings/ratings.module';
import { PmModule } from '../modules/pm/pm.module';
import { LicenseModule } from '../modules/license/license.module';

@Module({
  imports: [PrismaModule, NotificationsModule, EmailModule, SlaModule, SettingsModule, AuditTrailModule, RatingsModule, PmModule, LicenseModule],
  providers: [IncidentsService, IncidentHistoryService, SlaMonitorService, IncidentsAnalyticsService],
  controllers: [IncidentsController, IncidentsAnalyticsController, IncidentsPublicController, ServiceReportPublicController],
  exports: [IncidentHistoryService],
})
export class IncidentsModule {}

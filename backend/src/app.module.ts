// src/app.module.ts

import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { StoresModule } from './modules/stores/stores.module';
import { IncidentsModule } from './incidents/incidents.module';
import { PrismaModule } from './prisma/prisma.module';
import { EquipmentModule } from './equipment/equipment.module';
import { CommentsModule } from './comments/comments.module';
import { NotificationsModule } from './notifications/notifications.module';
import { EmailModule } from './email/email.module';
import { CategoriesModule } from './categories/categories.module';
import { SlaModule } from './sla/sla.module';
import { RolesModule } from './roles/roles.module';
import { ReassignmentsModule } from './modules/reassignments/reassignments.module';
import { RatingsModule } from './modules/ratings/ratings.module';
import { PerformanceModule } from './modules/performance/performance.module';
import { OutsourceModule } from './modules/outsource/outsource.module';
import { KnowledgeBaseModule } from './modules/knowledge-base/knowledge-base.module';
import { BackupModule } from './modules/backup/backup.module';
import { LicenseModule } from './modules/license/license.module';
import { SettingsModule } from './settings/settings.module';
import { AuditTrailModule } from './modules/audit-trail/audit-trail.module';
import { PmModule } from './modules/pm/pm.module';
import { VersionModule } from './modules/version/version.module';
import { AppMobileModule } from './modules/app-mobile/app-mobile.module';
import { PushModule } from './modules/push/push.module';
import { SetupModule } from './setup/setup.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    SetupModule,
    AuthModule,
    UsersModule,
    StoresModule,
    IncidentsModule,
    EquipmentModule,
    CommentsModule,
    NotificationsModule,
    EmailModule,
    CategoriesModule,
    SlaModule,
    RolesModule,
    ReassignmentsModule,
    RatingsModule,
    PerformanceModule,
    OutsourceModule,
    KnowledgeBaseModule,
    BackupModule,
    LicenseModule,
    SettingsModule,
    AuditTrailModule,
    PmModule,
    VersionModule,
    AppMobileModule,
    PushModule,
  ],
})
export class AppModule {}
// src/modules/project/project.module.ts
import { Module } from '@nestjs/common';
import { ProjectController } from './project.controller';
import { ProjectPublicController } from './project-public.controller';
import { ProjectService } from './project.service';
import { ProjectLifecycleService } from './project-lifecycle.service';
import { ProjectModuleGuard } from './project-module.guard';
import { EmailModule } from '../../email/email.module';
import { NotificationsModule } from '../../notifications/notifications.module';
import { SettingsModule } from '../../settings/settings.module';
import { StoresModule } from '../stores/stores.module';
import { IntegrationModule } from '../integration/integration.module';

@Module({
  imports: [EmailModule, NotificationsModule, SettingsModule, StoresModule, IntegrationModule],
  controllers: [ProjectController, ProjectPublicController],
  providers: [ProjectService, ProjectLifecycleService, ProjectModuleGuard],
  exports: [ProjectService],
})
export class ProjectModule {}

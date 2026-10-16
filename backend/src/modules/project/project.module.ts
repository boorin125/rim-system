// src/modules/project/project.module.ts
import { Module } from '@nestjs/common';
import { ProjectController } from './project.controller';
import { ProjectService } from './project.service';
import { ProjectModuleGuard } from './project-module.guard';
import { EmailModule } from '../../email/email.module';
import { NotificationsModule } from '../../notifications/notifications.module';
import { SettingsModule } from '../../settings/settings.module';
import { StoresModule } from '../stores/stores.module';

@Module({
  imports: [EmailModule, NotificationsModule, SettingsModule, StoresModule],
  controllers: [ProjectController],
  providers: [ProjectService, ProjectModuleGuard],
  exports: [ProjectService],
})
export class ProjectModule {}

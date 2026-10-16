// src/modules/project/project-module.guard.ts
import { CanActivate, ForbiddenException, Injectable } from '@nestjs/common';
import { SettingsService } from '../../settings/settings.service';

/**
 * Blocks every Project endpoint unless Settings › Modules › Project is enabled.
 * The flag is cached briefly so each request doesn't hit system_configs.
 */
@Injectable()
export class ProjectModuleGuard implements CanActivate {
  private cache: { enabled: boolean; at: number } | null = null;
  private static readonly TTL_MS = 10_000;

  constructor(private readonly settingsService: SettingsService) {}

  async canActivate(): Promise<boolean> {
    const now = Date.now();
    if (!this.cache || now - this.cache.at > ProjectModuleGuard.TTL_MS) {
      const { project } = await this.settingsService.getModules();
      this.cache = { enabled: project, at: now };
    }
    if (!this.cache.enabled) {
      throw new ForbiddenException('โมดูล Project ยังไม่เปิดใช้งาน (Settings › Modules)');
    }
    return true;
  }
}

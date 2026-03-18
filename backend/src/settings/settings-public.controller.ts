// src/settings/settings-public.controller.ts
// Public endpoint — no JWT required (used by Login/Register page)

import { Controller, Get } from '@nestjs/common';
import { SettingsService } from './settings.service';

@Controller('settings/public')
export class SettingsPublicController {
  constructor(private readonly settingsService: SettingsService) {}

  /**
   * GET /settings/public/branding
   * Returns org name, logo path, and theme colors for Login/Register page.
   * No authentication required.
   */
  @Get('branding')
  async getBranding() {
    const [org, theme] = await Promise.all([
      this.settingsService.getOrganizationSettings(),
      this.settingsService.getThemeSettings(),
    ]);

    return {
      organizationName: org.organizationName || '',
      logoPath: org.logoPath || '',
      theme: {
        bgStart: theme.bgStart || '#0f172a',
        bgEnd: theme.bgEnd || '#1e293b',
      },
    };
  }
}

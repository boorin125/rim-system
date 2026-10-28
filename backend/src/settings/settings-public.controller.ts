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
  /**
   * GET /settings/public/maintenance
   * Returns maintenance window for banner display. No auth required.
   */
  @Get('maintenance')
  async getMaintenance() {
    return this.settingsService.getMaintenanceWindow();
  }

  @Get('branding')
  async getBranding() {
    const [org, theme, google] = await Promise.all([
      this.settingsService.getOrganizationSettings(),
      this.settingsService.getThemeSettings(),
      this.settingsService.getGoogleSettings(),
    ]);

    return {
      organizationName: org.organizationName || '',
      logoPath: org.logoPath || '',
      appName: org.appName,
      isTestServer: org.isTestServer,
      // show the "Sign in with Google" button only when this server has an OAuth client
      googleEnabled: google.enabled,
      theme: {
        bgStart: theme.bgStart || '#0f172a',
        bgEnd: theme.bgEnd || '#1e293b',
      },
    };
  }
}

import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Public endpoints for RIM Mobile App (Technician)
 * No authentication required — used during server discovery
 */
@Controller('app')
export class AppMobileController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * GET /api/app/config
   * Returns organization branding config for Mobile App
   * This endpoint is PUBLIC — no JWT required
   */
  @Get('config')
  async getAppConfig() {
    // Fetch all config in one query
    const configs = await this.prisma.systemConfig.findMany({
      where: {
        key: { in: ['organization_name', 'organization_logo', 'theme_bg_start'] },
      },
    });

    const map = Object.fromEntries(configs.map((c) => [c.key, c.value]));

    return {
      companyName: (map['organization_name'] as string) ?? 'RIM System',
      logoPath: (map['organization_logo'] as string) ?? null,
      themeColor: (map['theme_bg_start'] as string) ?? '#6366f1',
      serverVersion: process.env.npm_package_version ?? '1.0.0',
    };
  }
}

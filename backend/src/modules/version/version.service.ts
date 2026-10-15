// src/modules/version/version.service.ts

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { VersionStatus } from '@prisma/client';

// Installing new versions is done by the rim-updater (Settings › System Update, see modules/system).
// This service only reports the running version.
@Injectable()
export class VersionService {
  constructor(private readonly prisma: PrismaService) {}

  async getCurrentVersion() {
    const current = await this.prisma.appVersion.findFirst({
      where: { status: VersionStatus.CURRENT },
      include: { appliedBy: { select: { id: true, firstName: true, lastName: true } } },
    });
    const base = current ?? { version: '1.0.0', status: 'CURRENT', releaseNotes: null, changes: [], appliedAt: null, appliedBy: null };
    return {
      ...base,
      version: process.env.APP_VERSION || process.env.RIM_VERSION || base.version,
      gitCommit: process.env.GIT_COMMIT || 'unknown',
      buildDate: process.env.BUILD_DATE || null,
    };
  }
}

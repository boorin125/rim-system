// src/modules/license/license.guard.ts

import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { LicenseService } from './license.service';

/**
 * LicenseGuard — blocks write/advanced endpoints when license is expired, invalid, or in Grace Period.
 * Apply with @UseGuards(JwtAuthGuard, LicenseGuard) on specific controller methods.
 *
 * Trial phases:
 *   Day 1–7   (FULL)    → valid: true  → guard passes — all features available
 *   Day 8–30  (GRACE)   → valid: false → guard BLOCKS Level 1 features
 *   Day 31+   (EXPIRED) → valid: false → guard BLOCKS Level 1 features
 *
 * Blocked features (Level 1):
 *   - Create new Incident / User / Store / Equipment
 *   - Export Reports (PDF/CSV/Excel/HTML)
 *   - Performance analytics
 *   - Realtime Tracking
 *   - Outsource Marketplace
 */
@Injectable()
export class LicenseGuard implements CanActivate {
  constructor(private readonly licenseService: LicenseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const result = await this.licenseService.validateLicense();

    if (!result.valid) {
      const reason = (result as any).reason || 'INVALID';
      let message: string;

      switch (reason) {
        case 'GRACE_PERIOD':
          message = `อยู่ในช่วง Grace Period — ฟีเจอร์นี้ถูกปิดชั่วคราว กรุณา Activate License (เหลือ ${(result as any).trialDaysRemaining ?? 0} วัน)`;
          break;
        case 'TRIAL_EXPIRED':
          message = 'ระยะทดลองใช้งาน 30 วันสิ้นสุดแล้ว กรุณา Activate License เพื่อใช้งานต่อ';
          break;
        case 'EXPIRED':
          message = 'License หมดอายุแล้ว ฟีเจอร์นี้ถูกปิดชั่วคราว กรุณาต่ออายุ License';
          break;
        default:
          message = 'ระบบยังไม่มี License ที่ถูกต้อง กรุณา Activate License ก่อนใช้งาน';
      }

      throw new ForbiddenException({ code: 'LICENSE_EXPIRED', reason, message });
    }

    return true;
  }
}

// src/modules/license/vendor.guard.ts

import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

/**
 * VendorGuard — protects license management endpoints (create/update/delete/renew/suspend/revoke/force-transfer).
 *
 * Every request to these endpoints must include a correct `x-vendor-secret` header
 * matching the value set in `LICENSE_VENDOR_SECRET` environment variable on the VENDOR's
 * development/management server.
 *
 * Customers running the installed product have NO access to this secret value,
 * so even with full source code visibility they cannot bypass this check.
 */
@Injectable()
export class VendorGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const vendorSecret = process.env.LICENSE_VENDOR_SECRET;

    if (!vendorSecret) {
      // Vendor secret not configured — block all management operations
      throw new ForbiddenException({
        code: 'VENDOR_MODE_DISABLED',
        message: 'License management is not available on this server. Contact your vendor.',
      });
    }

    const request = context.switchToHttp().getRequest();
    const providedSecret = request.headers['x-vendor-secret'];

    if (!providedSecret || providedSecret !== vendorSecret) {
      throw new ForbiddenException({
        code: 'INVALID_VENDOR_SECRET',
        message: 'Invalid or missing vendor secret. License management requires vendor authorization.',
      });
    }

    return true;
  }
}

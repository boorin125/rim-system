// src/auth/guards/roles.guard.ts

import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    if (!user) {
      return false;
    }

    // Extract roles from various formats
    const userRoles: string[] = [];

    // Handle array of roles
    if (Array.isArray(user.roles)) {
      user.roles.forEach((r: any) => {
        if (typeof r === 'string') {
          userRoles.push(r);
        } else if (r?.role) {
          // Handle { role: 'IT_MANAGER' } or { role: { name: 'IT_MANAGER' } }
          const roleName = typeof r.role === 'object' ? r.role?.name : r.role;
          if (roleName) userRoles.push(roleName);
        } else if (r?.name) {
          // Handle { name: 'IT_MANAGER' }
          userRoles.push(r.name);
        }
      });
    }

    // Handle legacy single role
    if (user.role && typeof user.role === 'string' && !userRoles.includes(user.role)) {
      userRoles.push(user.role);
    }

    // Check if user has any of the required roles
    return requiredRoles.some((role) => userRoles.includes(role));
  }
}

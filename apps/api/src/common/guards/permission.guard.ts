import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSION_KEY } from '../decorators/require-permission.decorator';
import { hasPermission, type Permission } from '../permissions/permissions';
import type { AuthUser } from '../decorators/current-user.decorator';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required) return true;

    const req = context.switchToHttp().getRequest<{ user: AuthUser }>();
    const user = req.user;

    if (!user) return false;

    // SUPER_ADMIN bypasses all permission checks
    if (user.role === 'SUPER_ADMIN') return true;

    const storeRole = user.storeRole;
    if (!storeRole) {
      throw new ForbiddenException('No store membership found');
    }

    if (!hasPermission(storeRole, required)) {
      throw new ForbiddenException(`Permission denied: ${required}`);
    }

    return true;
  }
}

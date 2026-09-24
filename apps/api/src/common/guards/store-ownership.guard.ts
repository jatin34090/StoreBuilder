import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import type { Request } from 'express';
import type { AuthUser } from '../decorators/current-user.decorator';

// TenantMiddleware sets this sentinel when no real store is resolved from the request
// (no x-store-id / x-store-slug header, no subdomain, no custom domain). It is never
// a real store UUID — treat it as "no tenant context" in security checks.
const PLATFORM_FALLBACK_STORE_ID = '00000000-0000-0000-0000-000000000001';

/**
 * Ensures that an authenticated ADMIN user can only operate on the store
 * they belong to (as recorded in their JWT token). SUPER_ADMIN bypasses
 * this check and may operate on any store context.
 *
 * This guard MUST run after JwtAuthGuard so that request.user is populated.
 *
 * Attack prevented: an ADMIN of Store A sends x-store-id: store-B-id to
 * manipulate Store B's data. Without this guard the RolesGuard only checks
 * user.role === ADMIN, not store membership.
 */
@Injectable()
export class StoreOwnershipGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Skip for public routes
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const user = req.user;

    // Unauthenticated — let JwtAuthGuard handle the 401
    if (!user) return true;

    // SUPER_ADMIN may inspect any store
    if (user.role === 'SUPER_ADMIN') return true;

    // Non-ADMIN roles (CUSTOMER, agents, etc.) use middleware-resolved storeId
    // for their own customer-facing operations — no cross-store risk since their
    // operations are further scoped by userId in the service layer.
    if (user.role !== 'ADMIN') return true;

    const reqStoreId = req.storeId;

    // No real store targeted — no cross-tenant risk. Allow through.
    // This covers /users/me, onboarding routes, and any endpoint that does not
    // require a store header (including admins who have not completed store setup).
    if (!reqStoreId || reqStoreId === PLATFORM_FALLBACK_STORE_ID) return true;

    // A real store IS being targeted. ADMIN must have storeId in their JWT or
    // they are in an invalid session state (registered before onboarding completed).
    if (!user.storeId) {
      throw new ForbiddenException('Your session has no store context. Please log out and log in again.');
    }

    // JWT store must match the middleware-resolved store.
    // This prevents x-store-id / x-store-slug header spoofing.
    if (user.storeId !== reqStoreId) {
      throw new ForbiddenException('You do not have access to this store');
    }

    return true;
  }
}

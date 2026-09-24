import { Reflector } from '@nestjs/core';
import { ForbiddenException } from '@nestjs/common';
import { StoreOwnershipGuard } from './store-ownership.guard';
import type { ExecutionContext } from '@nestjs/common';
import type { AuthUser } from '../decorators/current-user.decorator';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STORE_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const STORE_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const FALLBACK = '00000000-0000-0000-0000-000000000001';

function makeCtx(opts: {
  isPublic?: boolean;
  user?: Partial<AuthUser> | null;
  reqStoreId?: string;
}): ExecutionContext {
  const reflector = { getAllAndOverride: () => opts.isPublic ?? false } as unknown as Reflector;
  const req = {
    user: opts.user === null ? undefined : {
      id: 'user-1',
      role: 'ADMIN',
      storeId: STORE_A,
      ...opts.user,
    },
    storeId: opts.reqStoreId,
  };

  return {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler:   () => ({}),
    getClass:     () => ({}),
    _reflector:   reflector,
  } as unknown as ExecutionContext;
}

function makeGuard(isPublic = false): StoreOwnershipGuard {
  const reflector = {
    getAllAndOverride: () => isPublic,
  } as unknown as Reflector;
  return new StoreOwnershipGuard(reflector);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('StoreOwnershipGuard', () => {

  // ── PHASE K: Test 1 — Admin A + x-store-id Store B → 403 ──────────────────
  it('[T1] blocks ADMIN whose JWT store differs from resolved request store', () => {
    const guard = makeGuard();
    const ctx = makeCtx({ user: { role: 'ADMIN', storeId: STORE_A }, reqStoreId: STORE_B });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('[T1b] blocks ADMIN spoofing via x-store-slug (same check — middleware already resolved to real ID)', () => {
    const guard = makeGuard();
    // TenantMiddleware resolves slug→real ID; guard sees real IDs
    const ctx = makeCtx({ user: { role: 'ADMIN', storeId: STORE_A }, reqStoreId: STORE_B });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  // ── PHASE K: Test 2 — Admin A + Store B resource ID (service-layer, no guard) ───
  // This test documents that the guard cannot prevent ID-level IDOR on its own —
  // service-layer scoping (findFirst({ id, storeId })) is the defence there.
  // See categories.service.ts findOrThrow, banners.service.ts findOneOrFail, etc.

  // ── PHASE K: Test 3 — Customer browsing any store must still work ─────────
  it('[T3] allows CUSTOMER role through (no cross-tenant risk; scoped by userId)', () => {
    const guard = makeGuard();
    const ctx = makeCtx({ user: { role: 'CUSTOMER', storeId: undefined }, reqStoreId: STORE_B });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('[T3b] allows unauthenticated request through (JwtAuthGuard handles 401)', () => {
    const guard = makeGuard();
    const ctx = makeCtx({ user: null, reqStoreId: STORE_B });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  // ── PHASE K: Test 4 — SUPER_ADMIN platform operation ─────────────────────
  it('[T4] allows SUPER_ADMIN regardless of store context', () => {
    const guard = makeGuard();
    const ctx = makeCtx({ user: { role: 'SUPER_ADMIN', storeId: undefined }, reqStoreId: STORE_B });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  // ── PHASE K: Test 5 — Admin A legitimate Store A request ─────────────────
  it('[T5] allows ADMIN whose JWT store matches resolved request store', () => {
    const guard = makeGuard();
    const ctx = makeCtx({ user: { role: 'ADMIN', storeId: STORE_A }, reqStoreId: STORE_A });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  // ── PHASE K: Test 6 — Missing store context → no 500 ────────────────────
  it('[T6a] ADMIN with no req.storeId (undefined) passes guard cleanly', () => {
    const guard = makeGuard();
    const ctx = makeCtx({ user: { role: 'ADMIN', storeId: STORE_A }, reqStoreId: undefined });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('[T6b] ADMIN with FALLBACK sentinel req.storeId (no real store resolved) passes guard', () => {
    const guard = makeGuard();
    const ctx = makeCtx({ user: { role: 'ADMIN', storeId: STORE_A }, reqStoreId: FALLBACK });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('[T6c] ADMIN with no storeId in JWT gets 403 when a real store IS targeted — cross-tenant blocked', () => {
    const guard = makeGuard();
    // reqStoreId = real STORE_B → guard must verify ownership → no JWT storeId → 403
    const ctx = makeCtx({ user: { role: 'ADMIN', storeId: undefined }, reqStoreId: STORE_B });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('[T6d] ADMIN with no storeId + FALLBACK req.storeId passes — no real store targeted (e.g. /users/me)', () => {
    const guard = makeGuard();
    // No real store is being targeted so there is no cross-tenant risk.
    // This covers admins who completed registration but not onboarding.
    const ctx = makeCtx({ user: { role: 'ADMIN', storeId: undefined }, reqStoreId: FALLBACK });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('[T6e] ADMIN with no storeId + absent req.storeId passes — no real store targeted', () => {
    const guard = makeGuard();
    const ctx = makeCtx({ user: { role: 'ADMIN', storeId: undefined }, reqStoreId: undefined });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  // ── PHASE K: Test 7 — Upload cross-tenant attempt ────────────────────────
  it('[T7] blocks upload cross-tenant: ADMIN A JWT + x-store-id Store B', () => {
    const guard = makeGuard();
    const ctx = makeCtx({ user: { role: 'ADMIN', storeId: STORE_A }, reqStoreId: STORE_B });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  // ── Public route bypass ───────────────────────────────────────────────────
  it('skips check for public routes', () => {
    const guard = makeGuard(true); // isPublic = true
    // Even ADMIN with store mismatch should pass on @Public() routes
    const ctx = makeCtx({ user: { role: 'ADMIN', storeId: STORE_A }, reqStoreId: STORE_B });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  // ── DELIVERY_AGENT bypass ─────────────────────────────────────────────────
  it('allows DELIVERY_AGENT role through (delivery data scoped by assignment)', () => {
    const guard = makeGuard();
    const ctx = makeCtx({ user: { role: 'DELIVERY_AGENT' as AuthUser['role'], storeId: undefined }, reqStoreId: STORE_B });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  // ── Header combination: empty store ID ───────────────────────────────────
  it('treats empty string req.storeId as no-store context — ADMIN passes', () => {
    const guard = makeGuard();
    const ctx = makeCtx({ user: { role: 'ADMIN', storeId: STORE_A }, reqStoreId: '' });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  // ── Multiple stores: ADMIN can only operate on their JWT store ───────────
  it('blocks ADMIN even if they know a valid store ID that is not theirs', () => {
    const guard = makeGuard();
    const STORE_C = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
    const ctx = makeCtx({ user: { role: 'ADMIN', storeId: STORE_A }, reqStoreId: STORE_C });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});

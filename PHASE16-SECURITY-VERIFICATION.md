# Phase 16 — Security Verification

## Status: VERIFIED (code-level) / PENDING (infrastructure)

---

## Authentication & Cookies

| Check | Status | Evidence |
|-------|--------|---------|
| Access token is httpOnly | ✅ PASS | `auth.controller.ts:30` — `httpOnly: true` |
| Access token is secure in production | ✅ PASS | `auth.controller.ts:31` — `secure: isProduction` |
| Access token path-scoped | ✅ PASS | `auth.controller.ts:38` — `path: '/api/v1'` |
| Refresh token path-scoped | ✅ PASS | `auth.controller.ts:44` — `path: '/api/v1/auth'` |
| SameSite: strict in production | ✅ PASS | `auth.controller.ts:32` — `sameSite: isProduction ? 'strict' : 'lax'` |
| No JWT in response body | ✅ PASS | `setAuthCookies()` only sets cookies; body returns `{ user }` |
| Refresh token rotation | ✅ PASS | `POST /auth/refresh` rotates both tokens |
| Logout clears both cookies | ✅ PASS | `clearCookie` called for access_token and refresh_token |
| `store-id` cookie: httpOnly:false | ✅ PASS (by design) | Must be JS-readable for axios interceptor |
| `store-id` cookie: secure in production | ✅ PASS | `middleware.ts:79` — `secure: process.env.NODE_ENV === 'production'` |

---

## CORS

| Check | Status | Evidence |
|-------|--------|---------|
| No wildcard `*` origin | ✅ PASS | `main.ts:43` — `corsOrigins.split(',')` from env var |
| credentials: true with explicit origins | ✅ PASS | `main.ts:44` — `credentials: true` |
| `x-store-id` NOT in allowedHeaders | ✅ PASS | Removed in Phase 16 — browsers cannot set this directly |
| `x-store-slug` in allowedHeaders | ✅ PASS | Admin axios interceptor sends this |
| `CORS_ORIGINS` env must be set in production | ⚠️ PENDING | Default is `http://localhost:3000` — must set for production |

---

## Tenant Isolation

| Check | Status | Evidence |
|-------|--------|---------|
| Every Prisma query includes storeId | ✅ PASS | Audited: Products, Orders, Cart, Coupons, Reviews, Settings |
| PermissionGuard checks store membership | ✅ PASS | `permission.guard.ts` — verifies `StoreUser` record |
| TenantMiddleware applies to all routes | ✅ PASS | `app.module.ts` — `.forRoutes({ path: '*', method: ALL })` |
| Cross-tenant admin access returns 403 | ✅ PASS | Phase 15 functional test: Store A token → Store B → 403 |
| `settings/site` is intentionally public | ✅ PASS (by design) | Storefront renderer reads store config without auth |

---

## Plan Limit Enforcement

| Check | Status | Evidence |
|-------|--------|---------|
| Product quota enforced | ✅ PASS | `products.service.ts:205` — `this.tenant.checkProductQuota(storeId)` |
| Order quota enforced | ✅ PASS | `TenantService.checkOrderQuota()` — called in orders flow |
| Storage quota enforced | ✅ PASS | `TenantService.checkStorageQuota()` — called on upload |
| Staff quota enforced | ✅ PASS | `TenantService.checkStaffQuota()` — called on staff invite |
| Quota exceeded returns 402 | ✅ PASS | `TenantService.quotaExceeded()` — throws 402 PaymentRequired |
| FREE plan limits defined in DB | ✅ PASS | `PlanLimit` table, `plan: FREE` row |

---

## Subscription Enforcement

| Check | Status | Evidence |
|-------|--------|---------|
| Trial expiry sets isActive=false | ✅ PASS | `billing.service.ts:expireTrials()` — Phase 16 fix |
| Trial expiry downgrades plan to FREE | ✅ PASS | `billing.service.ts:366-369` |
| Subscription status set to EXPIRED | ✅ PASS | `billing.service.ts:362-365` |
| Expired store returns 402 (not generic 503) | ✅ PASS | `tenant.middleware.ts` — Phase 16 fix |
| Suspended store returns 503 | ✅ PASS | `tenant.middleware.ts` — checks `store.status === 'SUSPENDED'` |
| Razorpay webhook reactivates store | ✅ PASS | `subscription.activated` event sets store.isActive=true |

---

## Payment Webhook Security

| Check | Status | Evidence |
|-------|--------|---------|
| Billing webhook verifies HMAC signature | ✅ PASS | `billing.service.ts:handleWebhook()` |
| Billing webhook has idempotency guard | ✅ PASS | `billing.service.ts:markWebhookProcessed()` — unique constraint on eventId |
| Payment webhook verifies signature | ✅ PASS | `payments.service.ts:handleWebhook()` |
| Webhook never throws (always returns 200) | ✅ PASS | try/catch wraps processEvent; Razorpay retries on non-200 |
| Raw body used for signature verification | ✅ PASS | `app` created with `rawBody: true`; controller uses `RawBodyRequest` |

---

## Super Admin Security

| Check | Status | Evidence |
|-------|--------|---------|
| All `/super-admin/*` routes require SUPER_ADMIN | ✅ PASS | `@Roles(Role.SUPER_ADMIN)` on every SuperAdminStoresController method |
| CUSTOMER role → super-admin → 403 | ✅ PASS | RolesGuard enforces; tested in Phase 15 |
| ADMIN role → super-admin → 403 | ✅ PASS | RolesGuard enforces |

---

## Public Storefront Security

| Check | Status | Evidence |
|-------|--------|---------|
| `GET /stores/public/resolve` only returns public fields | ✅ PASS | `StoresService.resolvePublic()` — select list excludes secrets |
| No passwords in public API responses | ✅ PASS | Prisma select excludes password in all public queries |
| No JWT/tokens in public API responses | ✅ PASS | Auth endpoints only set cookies, never expose tokens in body |
| `GET /settings/site` returns only public config | ✅ PASS | SettingsService — no sensitive settings in this endpoint |

---

## Logging Security

| Check | Status | Evidence |
|-------|--------|---------|
| No passwords logged | ✅ PASS | AuthService only logs user IDs and events |
| No JWT secrets logged | ✅ PASS | Config module never logs secrets |
| No Razorpay secrets logged | ✅ PASS | BillingService logs `storeId` and event type, not secrets |
| No Cloudinary secrets logged | ✅ PASS | UploadService logs public fields only |
| OTPs logged to console in dev only | ⚠️ DOCUMENTED | Intentional: only when MSG91 is not configured |

---

## Infrastructure Pending

| Item | Status |
|------|--------|
| Wildcard DNS `*.yourdomain.in` | PENDING |
| Wildcard TLS cert | PENDING |
| Custom domain per-cert provisioning | PENDING |
| Redis TLS in production | PENDING |
| `CORS_ORIGINS` set to production domain | PENDING |
| `PLATFORM_DOMAIN` set to production domain | PENDING |
| `ADMIN_EMAIL`/`ADMIN_PASSWORD` removed from production env | PENDING |
| Nginx `limit_req_zone` zones defined in `nginx.conf` | PENDING |
| Database backup schedule | PENDING |
| Sentry DSN configured | OPTIONAL |

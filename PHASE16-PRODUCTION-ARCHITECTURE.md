# Phase 16 — Production Deployment Architecture

## Status: DOCUMENTED (infrastructure items require deployment)

---

## Overview

Multi-tenant SaaS platform. One shared PostgreSQL database, one NestJS API instance, one Next.js frontend. Store isolation enforced at the API layer via `storeId` on every query, not at the database/schema level.

---

## Component Map

```
                          ┌──────────────────────────────────────────┐
                          │             Cloudflare / DNS             │
                          │  yourdomain.in → server IP               │
                          │  *.yourdomain.in → server IP             │
                          │  CNAME: shop.mybrand.com → yourdomain.in │
                          └──────────────────────────────────────────┘
                                           │
                          ┌────────────────▼────────────────────────┐
                          │     Nginx (TLS termination + routing)    │
                          │  Port 80 → HTTPS redirect                │
                          │  Port 443 → Next.js (3000) or API (3001) │
                          │  TLS 1.2/1.3, ECDHE ciphers, HSTS       │
                          └───────────────┬─────────────────────────┘
                                          │
               ┌──────────────────────────┴──────────────────────┐
               │                                                  │
  ┌────────────▼──────────────┐              ┌────────────────────▼─────────────────┐
  │    Next.js (port 3000)    │              │       NestJS API (port 3001)         │
  │  App Router + middleware  │ ────────────>│  /api/v1/*                           │
  │  Resolves store from host │  HTTP        │  JWT cookies, CORS, Helmet           │
  │  Injects x-store-id hdr  │              │  TenantMiddleware (every request)     │
  │  Sets store-id cookie     │              │  Guard chain: Throttler→JWT→Roles→   │
  └───────────────────────────┘              │    PermissionGuard→FeatureGuard      │
                                             └──────────────────┬───────────────────┘
                                                                │
                              ┌─────────────────────────────────┴──────────────────────┐
                              │                                                         │
               ┌──────────────▼──────────────┐              ┌──────────────▼──────────┐
               │     PostgreSQL (Neon)        │              │     Redis               │
               │  One DB, storeId on rows     │              │  Store cache (5 min)    │
               │  SSL required                │              │  OTP state              │
               │  Connection pooling (Prisma) │              │  Rate limiting          │
               └─────────────────────────────┘              │  Bull job queues        │
                                                            └─────────────────────────┘
```

---

## Tenant Resolution Flow

### Subdomain: `mybrand.yourdomain.in`
1. Nginx wildcard `*.yourdomain.in` → proxy to Next.js port 3000
2. Next.js middleware: `parseHostname('mybrand.yourdomain.in')` → `slug = 'mybrand'`
3. Middleware calls `GET /api/v1/stores/public/resolve?slug=mybrand` (cached 60s in Next.js)
4. API returns `{ data: { id, name, slug, plan, isActive, ... } }`
5. Middleware sets `x-store-id`, `x-store-slug`, `x-store-name` headers → server components
6. Middleware sets `store-id` cookie (httpOnly:false, secure:prod, 60s) → axios interceptor

### Custom domain: `shop.mybrand.com`
1. DNS: CNAME `shop.mybrand.com` → `yourdomain.in` (or A record → server IP)
2. Nginx catches the request (custom domain server block or wildcard)
3. Next.js middleware: `parseHostname('shop.mybrand.com')` → `isCustomDomain: true`
4. Middleware calls `GET /api/v1/stores/public/resolve?domain=shop.mybrand.com`
5. API resolves via `StoreDomain` table (ACTIVE records) → store
6. Same header injection as subdomain path

### API tenant resolution (`TenantMiddleware`)
Priority order (first match wins):
1. `x-store-id` header (set by Next.js middleware → server, not from browsers)
2. `x-store-slug` header (set by axios interceptor for admin routes)
3. Custom domain from `Host` header (if not localhost or PLATFORM_DOMAIN)
4. Subdomain extraction from `Host` header

---

## Store Lifecycle

| Status | isActive | Public storefront | Admin access | API response |
|--------|----------|-------------------|--------------|--------------|
| DRAFT | true | Preview only | Yes | 200 |
| SETUP | true | Preview only | Yes | 200 |
| ACTIVE | true | Public | Yes | 200 |
| SUSPENDED | false | Blocked | Limited | 503 |
| CLOSED | false | Blocked | Read-only | 503 |
| Trial expired | false | Blocked | Dashboard only | 402 |

**Trial expiry flow:**
1. Cron `expireTrials()` runs daily
2. Finds `StoreSubscription` where `status=TRIALING` and `trialEnd < now`
3. Sets: `subscription.status=EXPIRED`, `store.plan=FREE`, `store.isActive=false`
4. Invalidates Redis cache
5. API returns 402 for that store's public endpoints

**Store owner reactivation:**
1. Owner visits admin dashboard (admin routes still accessible via JWT)
2. Upgrades to paid plan via `/admin/billing/subscribe`
3. Razorpay webhook `subscription.activated` fires → `store.isActive=true`

---

## Security Layers

### Authentication
- JWT (RS256) in httpOnly, secure, path-scoped cookies
- Access token: 15 min, path `/api/v1`
- Refresh token: 30 days, path `/api/v1/auth`
- SameSite: strict (production), lax (development)

### Authorization (guard chain)
1. `ThrottlerGuard` — global 500 req/60s per IP
2. `JwtAuthGuard` — validates access_token cookie
3. `TenantRateLimitGuard` — per-tenant rate limits from `PlanLimit.maxApiPerDay`
4. `RolesGuard` — platform role (CUSTOMER/ADMIN/DELIVERY_AGENT/SUPER_ADMIN)
5. `PermissionGuard` — store membership + permission bits
6. `FeatureGuard` — plan feature flags (e.g. analytics, custom domains)

### Tenant isolation
- Every Prisma query includes `storeId` — no cross-tenant data access possible
- `PermissionGuard` checks `StoreUser` membership before any admin operation
- `TenantService.assertUserBelongsToStore()` enforces cross-tenant boundary

### Plan enforcement
- `TenantService.checkProductQuota()` — throws 402 when `productCount >= maxProducts`
- `TenantService.checkOrderQuota()` — throws 402 when monthly order count exceeded
- `TenantService.checkStorageQuota()` — throws 402 for upload limit
- `TenantService.checkStaffQuota()` — throws 402 when staff invite exceeds limit

---

## Nginx Rate Limiting

Defined in `nginx.conf` (main config):
```nginx
limit_req_zone $binary_remote_addr zone=auth:10m rate=5r/m;
limit_req_zone $binary_remote_addr zone=api:10m rate=100r/m;
limit_conn_zone $binary_remote_addr zone=conn:10m;
```

Applied in site config:
- Auth endpoints (`/auth/send-otp`, `/auth/verify-otp`, `/auth/login`): `burst=10 nodelay`
- API general: `burst=40 nodelay` + `limit_conn conn 50`

---

## Infrastructure Requirements (PENDING for production)

| Item | Status | Required by |
|------|--------|-------------|
| DNS A record: `yourdomain.in` → server IP | PENDING | Go-live |
| DNS A/CNAME: `*.yourdomain.in` → server IP | PENDING | Subdomain tenants |
| Let's Encrypt wildcard cert | PENDING | HTTPS for subdomains |
| Nginx `limit_req_zone` definitions in `nginx.conf` | PENDING | Rate limiting |
| `PLATFORM_DOMAIN=yourdomain.in` in production `.env` | PENDING | Subdomain resolution |
| `CORS_ORIGINS=https://yourdomain.in,https://*.yourdomain.in` | PENDING | CORS |
| Redis prod instance (not localhost) | PENDING | Caching/queues |
| Database SSL (`sslmode=require`) | REQUIRED | Connection security |
| Razorpay production keys | PENDING | Payment processing |
| Sentry DSN | OPTIONAL | Error tracking |

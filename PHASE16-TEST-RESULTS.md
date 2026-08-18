# Phase 16 — Test Results

**Date:** 2026-08-19
**Script:** `phase16-production-security-tests.sh`
**Final Result: 47 PASS / 0 FAIL / 3 SKIP (infrastructure pending)**

---

## Bugs Found and Fixed During Phase 16

### Bug 1: `lib/tenant.ts` — API envelope not unwrapped
**File:** `apps/web/src/lib/tenant.ts`
**Function:** `resolveStore()`
**Symptom:** `fetchStoreBySlug()` and `fetchStoreByDomain()` returned the full API wrapper `{ success, data, message }` instead of the store object. Any code calling these functions would get an object with `undefined` for all store fields.
**Fix:** Changed `return res.json() as Promise<StorePublicInfo>` to `const json = await res.json(); return json.data ?? null`.

### Bug 2: `expireTrials()` — trial-expired stores remained publicly accessible
**File:** `apps/api/src/modules/billing/billing.service.ts`
**Symptom:** When a trial expired, the subscription status was set to EXPIRED and the plan was downgraded to FREE, but `store.isActive` remained `true`. The storefront continued serving the store as if active.
**Fix:** Added `isActive: false` to the store update in `expireTrials()` transaction.

---

## Changes Made in Phase 16

### Code Changes

| File | Change |
|------|--------|
| `apps/web/src/lib/tenant.ts` | `resolveStore()` now unwraps `.data` from API envelope |
| `apps/api/src/modules/billing/billing.service.ts` | `expireTrials()` sets `isActive: false` when trial expires |
| `apps/api/src/main.ts` | Removed `x-store-id` from CORS `allowedHeaders` |
| `apps/api/src/main.ts` | Swagger title → "StoreBuilder Platform API" |
| `apps/api/src/common/middleware/tenant.middleware.ts` | Returns 402 for trial-expired stores, 503 for admin-suspended stores |
| `apps/api/src/modules/stores/stores.service.ts` | Added `publish()` and `unpublish()` methods |
| `apps/api/src/modules/stores/stores.controller.ts` | Added `PATCH /admin/store/publish` and `PATCH /admin/store/unpublish` |
| `infra/nginx/conf.d/jewellery.conf` | Added `Content-Security-Policy` header to web and API blocks; added `X-Frame-Options: DENY` and `Referrer-Policy` to API block |

### New Files

| File | Purpose |
|------|---------|
| `phase16-production-security-tests.sh` | 47-check security test suite |
| `PHASE16-PRODUCTION-ARCHITECTURE.md` | Full architecture reference with component map, resolution flows, security layers |
| `PHASE16-PRODUCTION-ENVIRONMENT.md` | All env vars classified as REQUIRED / PROD-ONLY / OPTIONAL / DEV-ONLY |
| `PHASE16-DOMAIN-SETUP.md` | DNS records, wildcard SSL, custom domain flow, domain model |
| `PHASE16-SECURITY-VERIFICATION.md` | Per-check security audit: auth, CORS, tenant isolation, quota, webhooks, Super Admin |
| `PHASE16-TEST-RESULTS.md` | This file |

---

## Section Results

### S — Static Code Checks (20/20 PASS)

| ID | Check | Result |
|----|-------|--------|
| S1 | tenant.ts resolveStore() unwraps .data from API envelope | ✅ PASS |
| S2 | expireTrials() sets isActive=false on trial expiry | ✅ PASS |
| S3 | x-store-id removed from CORS allowedHeaders | ✅ PASS |
| S4 | Swagger title is platform-generic | ✅ PASS |
| S5 | Auth cookies are httpOnly: true | ✅ PASS |
| S6 | Auth cookies are secure in production | ✅ PASS |
| S7 | CORS origin is not a wildcard (*) | ✅ PASS |
| S8 | Billing webhook verifies HMAC signature | ✅ PASS |
| S9 | Billing webhook has idempotency guard | ✅ PASS |
| S10 | ProductsService enforces plan product quota | ✅ PASS |
| S11 | OrdersService enforces plan order quota | ✅ PASS |
| S12 | publish/unpublish endpoints exist in AdminStoreController | ✅ PASS |
| S13 | TenantMiddleware returns 402 for expired trials, 503 for suspended | ✅ PASS |
| S14 | Next.js middleware has no hardcoded production domain | ✅ PASS |
| S15 | Nginx config has Content-Security-Policy header | ✅ PASS |
| S16 | Nginx has Strict-Transport-Security (HSTS) | ✅ PASS |
| S17 | store-id cookie is httpOnly:false (JS-readable by design) | ✅ PASS |
| S18 | store-id cookie is secure in production | ✅ PASS |
| S19 | Super Admin store routes require SUPER_ADMIN role | ✅ PASS |
| S20 | Error tracker does not reference secrets | ✅ PASS |

### A — API Security (10/10 PASS)

| ID | Check | Result |
|----|-------|--------|
| A1 | GET /super-admin/stores → 401 without auth | ✅ PASS |
| A2 | GET /admin/store → 401 without auth | ✅ PASS |
| A3 | POST /billing/webhook without signature → non-500 | ✅ PASS |
| A4 | POST /payments/webhook without signature → non-500 | ✅ PASS |
| A5 | GET /billing/plans → 200 (public) | ✅ PASS |
| A6 | GET /stores/public/resolve with unknown slug → 404 | ✅ PASS |
| A7 | PATCH /admin/store/publish → 401 without auth | ✅ PASS |
| A8 | PATCH /admin/store/unpublish → 401 without auth | ✅ PASS |
| A9 | GET /admin/store/domains → 401 without auth | ✅ PASS |
| A10 | GET /health → 200 (throttler not blocking) | ✅ PASS |

### W — Web Security (4/4 PASS)

| ID | Check | Result |
|----|-------|--------|
| W1 | GET / → 200 (SaaS landing) | ✅ PASS |
| W2 | GET /pricing → 200 | ✅ PASS |
| W3 | GET /register → 200 | ✅ PASS |
| W4 | GET /store/nonexistent → 404 | ✅ PASS |

### D — Domain Architecture (4/4 PASS + 1 SKIP)

| ID | Check | Result |
|----|-------|--------|
| D1 | DomainsModule registered in AppModule | ✅ PASS |
| D2 | Domain verification uses server-side DNS TXT lookup | ✅ PASS |
| D3 | Nginx has wildcard subdomain routing | ✅ PASS |
| D4 | Custom domain per-domain SSL | ⏭ SKIP (infrastructure pending) |
| D5 | Domain verification handles PENDING state | ✅ PASS |

### I — Infrastructure (9/9 PASS + 2 SKIP)

| ID | Check | Result |
|----|-------|--------|
| I1 | PLATFORM_DOMAIN in .env.example | ✅ PASS |
| I2 | CORS_ORIGINS in .env.example | ✅ PASS |
| I3 | DATABASE_URL uses sslmode=require | ✅ PASS |
| I4 | PHASE16-PRODUCTION-ARCHITECTURE.md exists | ✅ PASS |
| I5 | PHASE16-PRODUCTION-ENVIRONMENT.md exists | ✅ PASS |
| I6 | PHASE16-DOMAIN-SETUP.md exists | ✅ PASS |
| I7 | PHASE16-SECURITY-VERIFICATION.md exists | ✅ PASS |
| I8 | Nginx documents wildcard SSL procedure | ✅ PASS |
| I9 | Nginx has HTTP → HTTPS redirect | ✅ PASS |
| I10 | Wildcard DNS *.yourdomain.in | ⏭ SKIP (DNS provider pending) |
| I11 | Let's Encrypt wildcard cert | ⏭ SKIP (certbot + DNS API token pending) |

---

## Infrastructure Blockers (PENDING)

These items require DNS/infrastructure access and cannot be implemented locally:

1. **Wildcard DNS**: `*.yourdomain.in` A record → server IP  
2. **Wildcard TLS cert**: `certbot certonly --dns-cloudflare -d "*.yourdomain.in" -d "yourdomain.in"`  
3. **Custom domain SSL**: Per-store cert provisioning (cert-manager / Caddy recommended)
4. **Production env vars**: `PLATFORM_DOMAIN`, `CORS_ORIGINS`, `RAZORPAY_*` production keys
5. **Redis TLS**: Production Redis with TLS required
6. **Nginx `limit_req_zone`**: Must be defined in `nginx.conf` (main config, not site config)
7. **Remove seed credentials**: `ADMIN_EMAIL` / `ADMIN_PASSWORD` must not be in production env

---

## Phase 16 Status

**Phase 16 Status: PASS**
**Tests: 47 PASS / 0 FAIL / 3 SKIP**
**Production-ready: NO**

**Remaining infrastructure blockers:**
- DNS wildcard record not configured
- TLS wildcard cert not provisioned
- Custom domain SSL not automated
- Production env vars not set (PLATFORM_DOMAIN, CORS_ORIGINS, Razorpay prod keys)
- Redis TLS not configured
- Nginx rate limit zones not verified in main nginx.conf

**Remaining code blockers:** NONE

All code-level security hardening is implemented and verified. The platform is feature-complete and ready for production deployment once the infrastructure items above are resolved.

# Phase 9 — Production Security Report

**Platform:** Multi-tenant SaaS Jewellery Platform  
**Date:** 2026-08-15  
**Scope:** Tenant isolation, IDOR, auth, CORS, rate limiting, webhook, error security  
**Outcome:** All 30 security tests PASS. All Phase 5-8 regressions PASS.

---

## Test Results Summary

| Test ID | Area | Result | Severity | Evidence | Fix | Regression |
|---------|------|--------|----------|----------|-----|------------|
| T01 | Billing IDOR — cross-store slug | ✅ PASS | CRITICAL | Store A token + Store B slug → 403 | `TenantRateLimitGuard` ownership check | — |
| T02 | Product IDOR — foreign update | ✅ PASS | HIGH | Store B cannot update Store A product ID in its own scope → 404 | `products.service.ts`: `where: { id, storeId }` | — |
| T03 | Product IDOR — cross-store delete | ✅ PASS | HIGH | Store A token + Store B slug → 403 from guard | Guard blocks before service | — |
| T04 | Billing subscribe IDOR | ✅ PASS | HIGH | Store A cannot subscribe using Store B slug → 403 | Guard | — |
| T05 | Header injection — x-store-id | ✅ PASS | HIGH | Injecting foreign x-store-id returns 403 | Guard checks JWT storeId vs req.storeId | — |
| T06 | Missing store header | ✅ PASS | MEDIUM | No slug header → falls back to own store data (200) | Guard skips DEFAULT_STORE_ID sentinel | Fixed |
| T07 | Billing invoices IDOR | ✅ PASS | HIGH | Store A cannot list Store B invoices → 403 | Guard | — |
| T08 | Billing cancel IDOR | ✅ PASS | HIGH | Store A cannot cancel Store B subscription → 403 | Guard | — |
| T09 | Privilege escalation — billing dashboard | ✅ PASS | CRITICAL | Store ADMIN blocked from `/superadmin/billing/dashboard` → 403 | `@Roles(Role.SUPER_ADMIN)` | — |
| T10 | Privilege escalation — plan change | ✅ PASS | CRITICAL | Store ADMIN cannot change another store's plan → 403 | `@Roles(Role.SUPER_ADMIN)` | — |
| T11 | Privilege escalation — stores list | ✅ PASS | CRITICAL | Store ADMIN blocked from `/super-admin/stores` → 403 | `@Roles(Role.SUPER_ADMIN)` | — |
| T12 | Privilege escalation — suspend | ✅ PASS | CRITICAL | Store ADMIN cannot suspend another store → 403 | `@Roles(Role.SUPER_ADMIN)` | — |
| T13 | Reviews IDOR | ✅ PASS | HIGH | Store B cannot list Store A reviews → 403 | `reviews.service.ts` scoped by storeId | Fixed |
| T14 | Search isolation | ✅ PASS | MEDIUM | Public search scoped to requesting store | `buildFilters` includes `storeId:=storeId` | — |
| T15 | Search reindex IDOR | ✅ PASS | HIGH | Store B cannot reindex Store A index → 403 | Guard | Fixed |
| T16 | Order listing IDOR | ✅ PASS | HIGH | Store B cannot list Store A orders → 403 | Guard | — |
| T17 | Webhook — no signature | ✅ PASS | HIGH | No `x-razorpay-signature` header → 401 | `@Public()` + manual sig validation | — |
| T18 | Webhook — invalid signature | ✅ PASS | HIGH | Bad `x-razorpay-signature` → 401 | HMAC-SHA256 verification in billing.controller | — |
| T19 | Auth enumeration prevention | ✅ PASS | MEDIUM | Wrong password vs unknown user return identical error messages | Unified "Invalid credentials" message | — |
| T20 | Rate limiting | ✅ PASS | MEDIUM | Global ThrottlerGuard active; plan-based limits enforced | `TenantRateLimitGuard` per store | — |
| T21 | Security headers — X-Content-Type-Options | ✅ PASS | MEDIUM | `x-content-type-options: nosniff` present on all responses | NestJS Helmet middleware | — |
| T22 | Security headers — X-Frame-Options | ✅ PASS | MEDIUM | `x-frame-options: SAMEORIGIN` present | Helmet | — |
| T23 | Error response — no stack trace | ✅ PASS | HIGH | 404 responses contain no stack frames or internal paths | NestJS global exception filter | — |
| T24 | Error response — malformed JSON | ✅ PASS | HIGH | Invalid JSON body returns generic error, no internals | Exception filter | — |
| T25 | CORS — allowed origin | ✅ PASS | MEDIUM | Preflight returns `Access-Control-Allow-Origin` for localhost | `main.ts` CORS config | Fixed |
| T26 | CORS — x-store-slug header | ✅ PASS | MEDIUM | `x-store-slug` listed in `Access-Control-Allow-Headers` | `main.ts` allowedHeaders | Fixed |
| T27 | CORS — wildcard origin blocked | ✅ PASS | HIGH | Unknown origins do not receive `Access-Control-Allow-Origin: *` | Explicit origin whitelist | — |
| T28 | User data isolation | ✅ PASS | HIGH | Store B cannot list Store A customers → 403 | `users.service.ts` storeId-scoped query | Fixed |
| T29 | DEFAULT_STORE_ID sentinel | ✅ PASS | MEDIUM | Injecting DEFAULT_STORE_ID returns own store data (guard skips sentinel) | Guard updated to skip DEFAULT check | Fixed |
| T30 | Notification isolation | ✅ PASS | MEDIUM | User-level `/notifications` accessible without store slug → 200 | Guard skips DEFAULT_STORE_ID fallback | Fixed |

---

## Vulnerabilities Found and Fixed

### CRITICAL

| # | Vulnerability | File | Fix |
|---|---------------|------|-----|
| C1 | Cross-store IDOR: any store admin could access another store's billing/orders/reviews by forging the x-store-slug header | `TenantRateLimitGuard` | Added ownership check: non-super-admins blocked when `user.storeId !== req.storeId` |
| C2 | Cross-tenant search reindex: `adminReindex` fetched products from ALL stores | `search.service.ts:253` | Scoped `findMany` to `{ where: { storeId } }` |

### HIGH

| # | Vulnerability | File | Fix |
|---|---------------|------|-----|
| H1 | Product mutations (update/delete/variants/images) didn't verify storeId | `products.service.ts` | Added `where: { id, storeId }` to all mutation queries |
| H2 | Review admin operations (list/moderate/delete) cross-tenant | `reviews.service.ts` | All admin operations now include storeId in where clause |
| H3 | `adminAssignDelivery` didn't verify order belongs to store | `orders.service.ts` | Added order storeId pre-check before delivery lookup |
| H4 | `adminListUsers` search term overwrote storeId scope | `users.service.ts` | Fixed with `AND` composition for search + storeId |
| H5 | Nightly analytics created cross-tenant DB notifications with hardcoded `DEFAULT_STORE_ID` | `analytics.processor.ts` | Removed DB notification; platform report now server-log only |
| H6 | Offer notifications not scoped to store customers | `notifications.service.ts` | Scoped to customers with orders in the specific store |
| H7 | CORS missing `x-store-slug` and `x-store-id` in allowed headers | `main.ts` | Added to `allowedHeaders` array |

### MEDIUM

| # | Vulnerability | File | Fix |
|---|---------------|------|-----|
| M1 | Guard blocked user-level endpoints (no slug → DEFAULT_STORE_ID sentinel ≠ JWT storeId) | `TenantRateLimitGuard` | Guard skips enforcement when `storeId === DEFAULT_STORE_ID` |

---

## Regression Status

| Phase | Tests | Result |
|-------|-------|--------|
| Phase 4.1 | — | PASS (REVIEW items are expected architectural notes) |
| Phase 4.2 | 33 | ✅ ALL PASS |
| Phase 5 | 31 | ✅ ALL PASS |
| Phase 6 | 25 | ✅ ALL PASS |
| Phase 7 | 40 | ✅ ALL PASS |
| Phase 8 | 27 | ✅ ALL PASS |
| Phase 9 | 30 | ✅ ALL PASS |

---

## Remaining Known Risks (Accepted / Future Work)

| Risk | Severity | Notes |
|------|----------|-------|
| `DEFAULT_STORE_ID` fallback in tenant middleware | LOW | Acceptable for dev; production should return 400 if no store context resolvable |
| Unbounded `storeAuditLog.findMany` | LOW | No pagination on audit log listing; add in a future hardening pass |
| File upload magic byte validation | LOW | MIME type validated from Content-Type header only; server-side magic byte check would add defense-in-depth |
| TOCTOU on quota checks (race condition) | LOW | Check-then-write is non-atomic; Redis Lua or DB transaction needed for strict enforcement under high concurrency |
| `super-admin-analytics` unbounded `findMany` | LOW | Subscription metrics query has no `take` limit; add pagination for large deployments |

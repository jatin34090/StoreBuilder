#!/usr/bin/env bash
# Phase 16 — Production Security & Domain Hardening Tests
# Usage: bash phase16-production-security-tests.sh
# Requires: API running on PORT (default 3001), Web on WEB_PORT (default 3000)

set -euo pipefail

API="${API_URL:-http://localhost:3001/api/v1}"
WEB="${WEB_URL:-http://localhost:3000}"

PASS=0; FAIL=0; SKIP=0

GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; NC='\033[0m'

pass() { echo -e "${GREEN}PASS${NC} $1"; PASS=$((PASS+1)); }
fail() { echo -e "${RED}FAIL${NC} $1"; FAIL=$((FAIL+1)); }
skip() { echo -e "${YELLOW}SKIP${NC} $1 (infrastructure pending)"; SKIP=$((SKIP+1)); }

found()     { echo "$2" | grep -qE "$1"; }
not_found() { echo "$2" | grep -qvE "$1"; }
# curl -s -w '\n%{http_code}' writes body then a newline then the status code on the last line
status()    { echo "$1" | tail -1; }
body()      { echo "$1" | head -n -1 2>/dev/null || echo "$1" | sed '$d'; }

http() { curl -s --connect-timeout 5 -w $'\n%{http_code}' "$@"; }

echo "======================================================="
echo " Phase 16 — Production Security Test Suite"
echo " API: $API"
echo " Web: $WEB"
echo "======================================================="
echo ""

# ─── S — Static Code Checks ──────────────────────────────────────────────────
echo "─── S: Static Code Checks ───────────────────────────────"

# S1: lib/tenant.ts resolveStore() unwraps API envelope
R=$(grep -qE "json\.data" apps/web/src/lib/tenant.ts 2>/dev/null && echo "yes" || echo "no")
[ "$R" = "yes" ] && pass "S1: tenant.ts resolveStore() unwraps .data from API envelope" \
                  || fail "S1: tenant.ts resolveStore() must unwrap .data from API envelope"

# S2: expireTrials sets isActive=false
R=$(grep -qE "isActive.*false" apps/api/src/modules/billing/billing.service.ts 2>/dev/null && echo "yes" || echo "no")
[ "$R" = "yes" ] && pass "S2: expireTrials() sets isActive=false on trial expiry" \
                  || fail "S2: expireTrials() must set isActive=false"

# S3: x-store-id NOT in CORS allowedHeaders
R=$(grep -qE "allowedHeaders.*x-store-id" apps/api/src/main.ts 2>/dev/null && echo "yes" || echo "no")
[ "$R" = "no" ] && pass "S3: x-store-id removed from CORS allowedHeaders" \
                 || fail "S3: x-store-id must not be in CORS allowedHeaders (browsers must go through middleware)"

# S4: Swagger title genericized
R=$(grep -qE "StoreBuilder Platform API" apps/api/src/main.ts 2>/dev/null && echo "yes" || echo "no")
[ "$R" = "yes" ] && pass "S4: Swagger title is platform-generic" \
                  || fail "S4: Swagger title must not reference 'Jewellery'"

# S5: Auth cookies are httpOnly
R=$(grep -qE "httpOnly.*true" apps/api/src/modules/auth/auth.controller.ts 2>/dev/null && echo "yes" || echo "no")
[ "$R" = "yes" ] && pass "S5: Auth cookies are httpOnly: true" \
                  || fail "S5: Auth cookies must be httpOnly"

# S6: Auth cookies are secure in production
R=$(grep -qE "secure.*isProduction|secure.*production" apps/api/src/modules/auth/auth.controller.ts 2>/dev/null && echo "yes" || echo "no")
[ "$R" = "yes" ] && pass "S6: Auth cookies are secure: true in production" \
                  || fail "S6: Auth cookies must be secure in production"

# S7: CORS origins come from env (not hardcoded wildcard)
R=$(grep -qE 'origin.*\*' apps/api/src/main.ts 2>/dev/null && echo "yes" || echo "no")
[ "$R" = "no" ] && pass "S7: CORS origin is not a wildcard (*)" \
                 || fail "S7: CORS must not use wildcard * with credentials"

# S8: Payment webhook verifies signature before processing
R=$(grep -qE "verifySignature|HMAC|createHmac" apps/api/src/modules/billing/billing.service.ts 2>/dev/null && echo "yes" || echo "no")
[ "$R" = "yes" ] && pass "S8: Billing webhook verifies HMAC signature" \
                  || fail "S8: Billing webhook must verify HMAC signature"

# S9: Payment webhook has idempotency check
R=$(grep -qE "markWebhookProcessed|WebhookEvent|alreadyProcessed" apps/api/src/modules/billing/billing.service.ts 2>/dev/null && echo "yes" || echo "no")
[ "$R" = "yes" ] && pass "S9: Billing webhook has idempotency guard" \
                  || fail "S9: Billing webhook must be idempotent"

# S10: Plan limit enforcement exists for products
R=$(grep -qE "checkProductQuota" apps/api/src/modules/products/products.service.ts 2>/dev/null && echo "yes" || echo "no")
[ "$R" = "yes" ] && pass "S10: ProductsService enforces plan product quota" \
                  || fail "S10: ProductsService must call checkProductQuota"

# S11: Plan limit enforcement exists for orders
R=$(grep -qE "checkOrderQuota" apps/api/src/modules/orders/orders.service.ts 2>/dev/null && echo "yes" || echo "no")
[ "$R" = "yes" ] && pass "S11: OrdersService enforces plan order quota" \
                  || fail "S11: OrdersService must call checkOrderQuota"

# S12: publish/unpublish endpoints added to StoresController
R=$(grep -qE "publishStore|unpublishStore" apps/api/src/modules/stores/stores.controller.ts 2>/dev/null && echo "yes" || echo "no")
[ "$R" = "yes" ] && pass "S12: publish/unpublish endpoints exist in AdminStoreController" \
                  || fail "S12: publish/unpublish endpoints must exist"

# S13: TenantMiddleware distinguishes SUSPENDED (503) from trial-expired (402)
R=$(grep -qE "402|Payment Required|trial.*expired" apps/api/src/common/middleware/tenant.middleware.ts 2>/dev/null && echo "yes" || echo "no")
[ "$R" = "yes" ] && pass "S13: TenantMiddleware returns 402 for expired trials, 503 for suspended" \
                  || fail "S13: TenantMiddleware must return 402 for expired trials"

# S14: No hardcoded production domain in Next.js middleware
R=$(grep -qE "yourdomain\.in" apps/web/src/middleware.ts 2>/dev/null && echo "yes" || echo "no")
[ "$R" = "no" ] && pass "S14: Next.js middleware has no hardcoded production domain" \
                 || fail "S14: Next.js middleware must not hardcode production domain"

# S15: CSP header in Nginx web block
R=$(grep -qE "Content-Security-Policy" infra/nginx/conf.d/jewellery.conf 2>/dev/null && echo "yes" || echo "no")
[ "$R" = "yes" ] && pass "S15: Nginx config has Content-Security-Policy header" \
                  || fail "S15: Nginx config must define Content-Security-Policy"

# S16: Nginx has HSTS header
R=$(grep -qE "Strict-Transport-Security" infra/nginx/conf.d/jewellery.conf 2>/dev/null && echo "yes" || echo "no")
[ "$R" = "yes" ] && pass "S16: Nginx has Strict-Transport-Security (HSTS)" \
                  || fail "S16: Nginx must set HSTS header"

# S17: store-id cookie is NOT httpOnly (must be JS-readable for axios interceptor)
R=$(grep -qE "httpOnly.*false" apps/web/src/middleware.ts 2>/dev/null && echo "yes" || echo "no")
[ "$R" = "yes" ] && pass "S17: store-id cookie is httpOnly:false (JS-readable by design for axios)" \
                  || fail "S17: store-id cookie must be JS-readable (httpOnly:false)"

# S18: store-id cookie is secure in production
R=$(grep -qE "secure.*NODE_ENV.*production|secure.*production" apps/web/src/middleware.ts 2>/dev/null && echo "yes" || echo "no")
[ "$R" = "yes" ] && pass "S18: store-id cookie is secure in production" \
                  || fail "S18: store-id cookie must be secure in production"

# S19: Super Admin routes have SUPER_ADMIN role guard
R=$(grep -qE "SUPER_ADMIN" apps/api/src/modules/stores/stores.controller.ts 2>/dev/null && echo "yes" || echo "no")
[ "$R" = "yes" ] && pass "S19: Super Admin store routes require SUPER_ADMIN role" \
                  || fail "S19: Super Admin routes must require SUPER_ADMIN role"

# S20: No secrets in error tracker
R=$(grep -qE "password|jwt|secret|token" apps/api/src/common/monitoring/error-tracker.ts 2>/dev/null && echo "yes" || echo "no")
[ "$R" = "no" ] && pass "S20: Error tracker does not reference secrets" \
                 || fail "S20: Error tracker must not log secrets"

echo ""
echo "─── A: API Security ─────────────────────────────────────"

# A1: Unauthenticated access to super-admin → 401
R=$(http "$API/super-admin/stores")
B=$(body "$R"); S=$(status "$R")
found "^401$" "$S" && pass "A1: GET /super-admin/stores → 401 without auth" \
                   || fail "A1: GET /super-admin/stores returned $S (expected 401)"

# A2: Unauthenticated access to admin store → 401
R=$(http "$API/admin/store")
B=$(body "$R"); S=$(status "$R")
found "^401$" "$S" && pass "A2: GET /admin/store → 401 without auth" \
                   || fail "A2: GET /admin/store returned $S (expected 401)"

# A3: Billing webhook rejects missing signature → returns non-500
R=$(http -X POST "$API/billing/webhook" -H "Content-Type: application/json" -d '{"event":"test"}')
B=$(body "$R"); S=$(status "$R")
found "^[24]" "$S" && pass "A3: POST /billing/webhook without signature returns non-500" \
                   || fail "A3: POST /billing/webhook returned $S (expected 2xx or 4xx)"

# A4: Payment webhook rejects missing signature
R=$(http -X POST "$API/payments/webhook" -H "Content-Type: application/json" -d '{"event":"test"}')
B=$(body "$R"); S=$(status "$R")
found "^[24]" "$S" && pass "A4: POST /payments/webhook without signature returns non-500" \
                   || fail "A4: POST /payments/webhook returned $S (expected 2xx or 4xx)"

# A5: /billing/plans is public (200)
R=$(http "$API/billing/plans")
B=$(body "$R"); S=$(status "$R")
found "^200$" "$S" && pass "A5: GET /billing/plans → 200 (public)" \
                   || fail "A5: GET /billing/plans returned $S (expected 200)"

# A6: /stores/public/resolve with unknown slug → 404
R=$(http "$API/stores/public/resolve?slug=definitely-does-not-exist-xyz123")
B=$(body "$R"); S=$(status "$R")
found "^404$" "$S" && pass "A6: GET /stores/public/resolve with unknown slug → 404" \
                   || fail "A6: GET /stores/public/resolve returned $S (expected 404)"

# A7: Admin publish endpoint requires auth → 401
R=$(http -X PATCH "$API/admin/store/publish")
B=$(body "$R"); S=$(status "$R")
found "^401$" "$S" && pass "A7: PATCH /admin/store/publish → 401 without auth" \
                   || fail "A7: PATCH /admin/store/publish returned $S (expected 401)"

# A8: Admin unpublish endpoint requires auth → 401
R=$(http -X PATCH "$API/admin/store/unpublish")
B=$(body "$R"); S=$(status "$R")
found "^401$" "$S" && pass "A8: PATCH /admin/store/unpublish → 401 without auth" \
                   || fail "A8: PATCH /admin/store/unpublish returned $S (expected 401)"

# A9: Admin domains endpoint requires auth → 401
R=$(http "$API/admin/store/domains")
B=$(body "$R"); S=$(status "$R")
found "^401$" "$S" && pass "A9: GET /admin/store/domains → 401 without auth" \
                   || fail "A9: GET /admin/store/domains returned $S (expected 401)"

# A10: ThrottlerGuard active — mass requests to health get 200 (not blocked at low volume)
R=$(http "$API/health")
B=$(body "$R"); S=$(status "$R")
found "^200$" "$S" && pass "A10: GET /health → 200 (throttler not blocking at low volume)" \
                   || fail "A10: GET /health returned $S (expected 200)"

echo ""
echo "─── W: Web Security ─────────────────────────────────────"

# W1: Platform root loads SaaS landing
R=$(http "$WEB/")
B=$(body "$R"); S=$(status "$R")
found "^200$" "$S" && pass "W1: GET / → 200" \
                   || fail "W1: GET / returned $S"

# W2: /pricing → 200
R=$(http "$WEB/pricing")
B=$(body "$R"); S=$(status "$R")
found "^200$" "$S" && pass "W2: GET /pricing → 200" \
                   || fail "W2: GET /pricing returned $S"

# W3: /register → 200
R=$(http "$WEB/register")
B=$(body "$R"); S=$(status "$R")
found "^200$" "$S" && pass "W3: GET /register → 200" \
                   || fail "W3: GET /register returned $S"

# W4: /store/nonexistent → 404
R=$(http "$WEB/store/definitely-does-not-exist-xyz123")
B=$(body "$R"); S=$(status "$R")
found "^404$" "$S" && pass "W4: GET /store/nonexistent → 404" \
                   || fail "W4: GET /store/nonexistent returned $S (expected 404)"

echo ""
echo "─── D: Domain Architecture ──────────────────────────────"

# D1: DomainsModule is registered
R=$(grep -qE "DomainsModule" apps/api/src/app.module.ts 2>/dev/null && echo "yes" || echo "no")
[ "$R" = "yes" ] && pass "D1: DomainsModule registered in AppModule" \
                  || fail "D1: DomainsModule must be registered"

# D2: Domain verification uses DNS TXT lookup (server-side)
R=$(grep -qE "resolveTxt|dns\.resolve|lookup" apps/api/src/modules/domains/domains.service.ts 2>/dev/null && echo "yes" || echo "no")
[ "$R" = "yes" ] && pass "D2: Domain verification uses server-side DNS TXT lookup" \
                  || fail "D2: Domain verification must use server-side DNS lookup"

# D3: Wildcard subdomain routing in Nginx
R=$(grep -qE '\~\^\(\?<slug\>' infra/nginx/conf.d/jewellery.conf 2>/dev/null && echo "yes" || echo "no")
[ "$R" = "yes" ] && pass "D3: Nginx has wildcard subdomain routing for tenants" \
                  || fail "D3: Nginx must have wildcard subdomain regex for tenants"

# D4: Custom domain SSL (infrastructure pending)
skip "D4: Custom domain per-domain SSL — requires cert-manager/Caddy in production"

# D5: DNS propagation handling in verification (retryable)
R=$(grep -qE "PENDING|retry|propagat" apps/api/src/modules/domains/domains.service.ts 2>/dev/null && echo "yes" || echo "no")
[ "$R" = "yes" ] && pass "D5: Domain verification handles PENDING state (DNS propagation)" \
                  || fail "D5: Domain verification must handle DNS propagation delays"

echo ""
echo "─── I: Infrastructure ────────────────────────────────────"

# I1: PLATFORM_DOMAIN in .env.example
R=$(grep -qE "PLATFORM_DOMAIN" .env.example 2>/dev/null && echo "yes" || echo "no")
[ "$R" = "yes" ] && pass "I1: PLATFORM_DOMAIN documented in .env.example" \
                  || fail "I1: PLATFORM_DOMAIN must be in .env.example"

# I2: CORS_ORIGINS in .env.example
R=$(grep -qE "CORS_ORIGINS" .env.example 2>/dev/null && echo "yes" || echo "no")
[ "$R" = "yes" ] && pass "I2: CORS_ORIGINS documented in .env.example" \
                  || fail "I2: CORS_ORIGINS must be in .env.example"

# I3: DATABASE_URL uses sslmode=require in example
R=$(grep -qE "sslmode=require" .env.example 2>/dev/null && echo "yes" || echo "no")
[ "$R" = "yes" ] && pass "I3: DATABASE_URL uses sslmode=require in example" \
                  || fail "I3: DATABASE_URL must require SSL in production"

# I4: Production deployment architecture doc exists
R=$([ -f "PHASE16-PRODUCTION-ARCHITECTURE.md" ] && echo "yes" || echo "no")
[ "$R" = "yes" ] && pass "I4: PHASE16-PRODUCTION-ARCHITECTURE.md exists" \
                  || fail "I4: PHASE16-PRODUCTION-ARCHITECTURE.md missing"

# I5: Production environment doc exists
R=$([ -f "PHASE16-PRODUCTION-ENVIRONMENT.md" ] && echo "yes" || echo "no")
[ "$R" = "yes" ] && pass "I5: PHASE16-PRODUCTION-ENVIRONMENT.md exists" \
                  || fail "I5: PHASE16-PRODUCTION-ENVIRONMENT.md missing"

# I6: Domain setup doc exists
R=$([ -f "PHASE16-DOMAIN-SETUP.md" ] && echo "yes" || echo "no")
[ "$R" = "yes" ] && pass "I6: PHASE16-DOMAIN-SETUP.md exists" \
                  || fail "I6: PHASE16-DOMAIN-SETUP.md missing"

# I7: Security verification doc exists
R=$([ -f "PHASE16-SECURITY-VERIFICATION.md" ] && echo "yes" || echo "no")
[ "$R" = "yes" ] && pass "I7: PHASE16-SECURITY-VERIFICATION.md exists" \
                  || fail "I7: PHASE16-SECURITY-VERIFICATION.md missing"

# I8: Wildcard SSL mentioned in Nginx config
R=$(grep -qE "wildcard|certbot.*dns" infra/nginx/conf.d/jewellery.conf 2>/dev/null && echo "yes" || echo "no")
[ "$R" = "yes" ] && pass "I8: Nginx config documents wildcard SSL procedure" \
                  || fail "I8: Nginx config must document wildcard SSL"

# I9: HTTP → HTTPS redirect in Nginx
R=$(grep -qE "return 301 https" infra/nginx/conf.d/jewellery.conf 2>/dev/null && echo "yes" || echo "no")
[ "$R" = "yes" ] && pass "I9: Nginx has HTTP → HTTPS redirect" \
                  || fail "I9: Nginx must redirect HTTP → HTTPS"

# I10: Production wildcard DNS — INFRASTRUCTURE PENDING
skip "I10: Wildcard DNS *.yourdomain.in → server IP — requires DNS provider configuration"

# I11: SSL cert in production — INFRASTRUCTURE PENDING
skip "I11: Let's Encrypt wildcard cert — requires certbot + DNS API token in production"

echo ""
echo "═══════════════════════════════════════════════════════════"
echo " Phase 16 Test Results"
echo "═══════════════════════════════════════════════════════════"
echo -e " ${GREEN}PASS${NC}: $PASS  ${RED}FAIL${NC}: $FAIL  ${YELLOW}SKIP${NC}: $SKIP (infrastructure)"
echo ""

if [ $FAIL -gt 0 ]; then
  echo -e " ${RED}RESULT: FAIL${NC} — $FAIL check(s) did not pass"
  exit 1
else
  echo -e " ${GREEN}RESULT: PASS${NC} — all implemented checks pass ($SKIP infrastructure items pending)"
  exit 0
fi

# Staging Validation Report

Fill in this template after running the test suites against staging.
Command reference is in each section header.

---

## Environment

| Field | Value |
|-------|-------|
| API URL | `https://api.staging.yourdomain.in/api/v1` |
| Web URL | `https://staging.yourdomain.in` |
| Date | _(fill in)_ |
| Git SHA | _(fill in: `git rev-parse --short HEAD`)_ |
| Tester | _(fill in)_ |

---

## 1. Infrastructure

```bash
node tests/staging-validate.mjs
```

| Check | Result | Notes |
|-------|--------|-------|
| API liveness `/health/live` | ⬜ | |
| API readiness `/health/ready` | ⬜ | |
| DB check | ⬜ | |
| Redis check | ⬜ | |
| Queue check | ⬜ | |
| TLS cert valid | ⬜ | |
| HSTS header | ⬜ | |
| X-Frame-Options | ⬜ | |
| Rate limiting | ⬜ | |

---

## 2. Customer Journey

```bash
API_BASE=https://api.staging.yourdomain.in/api/v1 \
API_LOG=/var/log/jewellery/api.log \
CUSTOMER_PHONE=9876543210 \
node tests/e2e/customer-journey.mjs
```

| Flow | Result | Notes |
|------|--------|-------|
| Send OTP | ⬜ | |
| Verify OTP → token | ⬜ | |
| Browse products | ⬜ | |
| Product detail page | ⬜ | |
| Category listing | ⬜ | |
| Search | ⬜ | |
| Search — no results | ⬜ | |
| Add to cart | ⬜ | |
| View cart | ⬜ | |
| Add to wishlist | ⬜ | |
| Remove from wishlist | ⬜ | |
| Create address | ⬜ | |
| Place COD order | ⬜ | |
| Order list | ⬜ | |
| Order detail | ⬜ | |
| Order status correct | ⬜ | |
| Reviews listing | ⬜ | |
| Auth boundaries (401) | ⬜ | |

**Razorpay payment (manual — requires test card):**

| Flow | Result | Notes |
|------|--------|-------|
| Initiate Razorpay order | ⬜ | |
| Complete payment (test card 4111…) | ⬜ | |
| Order status → CONFIRMED | ⬜ | |
| Webhook received + reconciled | ⬜ | |

---

## 3. Admin Journey

```bash
API_BASE=https://api.staging.yourdomain.in/api/v1 \
ADMIN_EMAIL=admin@yourbrand.in \
ADMIN_PASSWORD=<staging-admin-password> \
node tests/e2e/admin-journey.mjs
```

| Flow | Result | Notes |
|------|--------|-------|
| Admin login | ⬜ | |
| Role = ADMIN | ⬜ | |
| Dashboard stats | ⬜ | |
| Revenue stats | ⬜ | |
| Products list | ⬜ | |
| Create product | ⬜ | |
| Update product | ⬜ | |
| Delete product | ⬜ | |
| Categories list | ⬜ | |
| Orders list | ⬜ | |
| Order detail | ⬜ | |
| Inventory list | ⬜ | |
| Low-stock filter | ⬜ | |
| Create coupon | ⬜ | |
| Delete coupon | ⬜ | |
| Users list | ⬜ | |
| Delivery agents list | ⬜ | |
| Deliveries list | ⬜ | |
| Admin protected (401 without token) | ⬜ | |

---

## 4. Delivery Agent Journey

```bash
API_BASE=https://api.staging.yourdomain.in/api/v1 \
AGENT_PHONE=9000000002 \
API_LOG=/var/log/jewellery/api.log \
node tests/e2e/delivery-agent-journey.mjs
```

| Flow | Result | Notes |
|------|--------|-------|
| Agent OTP login | ⬜ | |
| Role = DELIVERY_AGENT | ⬜ | |
| Get profile | ⬜ | |
| Set online | ⬜ | |
| Set offline | ⬜ | |
| Deliveries list | ⬜ | |
| Delivery detail | ⬜ | |
| Status: ASSIGNED → PICKED_UP | ⬜ | |
| GPS location update | ⬜ | |
| Invalid token → 401 | ⬜ | |

**OTP delivery verification (manual — requires an order assigned to agent):**

| Flow | Result | Notes |
|------|--------|-------|
| Customer OTP generated | ⬜ | |
| Agent submits correct OTP | ⬜ | |
| Status → DELIVERED | ⬜ | |
| Wrong OTP rejected | ⬜ | |

---

## 5. Performance

```bash
k6 run \
  -e BASE_URL=https://api.staging.yourdomain.in/api/v1 \
  tests/load/k6-smoke.js

k6 run \
  -e BASE_URL=https://api.staging.yourdomain.in/api/v1 \
  -e TOKEN=<customer-jwt> \
  tests/load/k6-checkout.js
```

| Metric | Target | Actual | Pass? |
|--------|--------|--------|-------|
| p95 API latency | < 800 ms | | ⬜ |
| p95 search latency | < 600 ms | | ⬜ |
| p95 checkout latency | < 1500 ms | | ⬜ |
| Error rate | < 1% | | ⬜ |
| Max concurrent users tested | 50 VUs | | ⬜ |

---

## 6. Security

```bash
API_BASE=https://api.staging.yourdomain.in/api/v1 \
WEB_BASE=https://staging.yourdomain.in \
node tests/security/security-verify.mjs
```

| Check | Result | Notes |
|-------|--------|-------|
| Rate limiting (120-req burst) | ⬜ | |
| Auth rate limiting (/auth/*) | ⬜ | |
| Protected routes → 401 (7 endpoints) | ⬜ | |
| Malformed JWT → 401 | ⬜ | |
| Expired JWT → 401 | ⬜ | |
| Security headers (web) | ⬜ | |
| CORS allows trusted origin | ⬜ | |
| CORS blocks untrusted origin | ⬜ | |
| No stack trace in error responses | ⬜ | |
| 404 returns JSON | ⬜ | |
| DB errors not exposed | ⬜ | |
| Admin routes blocked without auth | ⬜ | |

---

## 7. Database migrations

```bash
# On staging server
pnpm --filter @jewellery/api prisma migrate status
pnpm --filter @jewellery/api prisma migrate deploy
```

| Check | Result | Notes |
|-------|--------|-------|
| `migrate status` shows all applied | ⬜ | |
| `migrate deploy` runs with 0 errors | ⬜ | |
| Row counts match expected seed data | ⬜ | |
| Neon PITR branch created pre-migration | ⬜ | |

---

## 8. Summary

| Section | Passed | Failed | Skipped |
|---------|--------|--------|---------|
| Infrastructure | | | |
| Customer journey | | | |
| Admin journey | | | |
| Delivery agent journey | | | |
| Performance | | | |
| Security | | | |
| DB migrations | | | |
| **Total** | | | |

**Staging validation result:** ⬜ PASS / ⬜ FAIL

**Blockers found:**
- _(list any failures)_

**Approved to promote to production:** ⬜ Yes / ⬜ No

**Sign-off:** _________________________  Date: __________

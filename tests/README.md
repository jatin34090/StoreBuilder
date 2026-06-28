# Testing

## Quick reference

| Layer | Command | When to run |
|-------|---------|-------------|
| Unit (API) | `pnpm --filter @jewellery/api test` | Every PR, pre-deploy |
| Typecheck | `pnpm -r typecheck` | Every PR |
| Staging infra | `node tests/staging-validate.mjs` | After every staging deploy |
| Customer E2E | `node tests/e2e/customer-journey.mjs` | Before every release |
| Admin E2E | `node tests/e2e/admin-journey.mjs` | Before every release |
| Agent E2E | `node tests/e2e/delivery-agent-journey.mjs` | Before every release |
| Load (smoke) | `k6 run tests/load/k6-smoke.js` | Weekly + before release |
| Load (checkout) | `k6 run tests/load/k6-checkout.js` | Before release |
| Security | `node tests/security/security-verify.mjs` | Before release + after security changes |
| Mobile API | `node tests/verify-mobile-api.mjs` | Before mobile release |

---

## Environment variables

```bash
export API_BASE=https://api.staging.yourdomain.in/api/v1
export WEB_BASE=https://staging.yourdomain.in
export API_LOG=/var/log/jewellery/api.log   # for OTP reading in E2E tests
export CUSTOMER_PHONE=9876543210
export AGENT_PHONE=9000000002
export ADMIN_EMAIL=admin@yourbrand.in
export ADMIN_PASSWORD=<staging-admin-password>
# k6 only:
export BASE_URL=https://api.staging.yourdomain.in/api/v1
export TOKEN=<customer-jwt>
```

---

## Unit tests

ts-jest (`apps/api/jest.config.js`). Covers pure / security-critical logic:

- `@jewellery/utils` — slug, money conversions, masking, clamp (7 cases)
- **Razorpay HMAC-SHA256** — valid, tampered, wrong-secret, malformed, deterministic (5 cases)

---

## E2E test suites

### Customer journey (`tests/e2e/customer-journey.mjs`)
OTP login → catalogue → search → cart → wishlist → COD checkout →
order tracking → reviews → auth boundaries.

Requires `API_LOG` for OTP steps; all other sections run without it.

### Admin journey (`tests/e2e/admin-journey.mjs`)
Password login → dashboard stats → product CRUD → orders → inventory →
coupons → users → delivery management → role protection.

### Delivery agent journey (`tests/e2e/delivery-agent-journey.mjs`)
OTP login → profile → online toggle → deliveries → detail → status update →
GPS location → auth boundaries.

---

## Load / performance tests

### Smoke (`tests/load/k6-smoke.js`)
50 VUs — health, products, search. Gate: `p95 < 800ms`, `errors < 1%`.

### Checkout (`tests/load/k6-checkout.js`)
50 VUs — search, catalogue, cart, orders. Separate `search_latency` and
`checkout_latency` trends.

Install k6: https://k6.io/docs/get-started/installation/

---

## Security verification (`tests/security/security-verify.mjs`)

- Rate limiting (120-burst + auth-burst)
- Auth boundaries (7 endpoints × 3 token states)
- Security headers, CORS, error exposure, admin isolation

---

## Mobile API verification (`tests/verify-mobile-api.mjs`)

Agent contract: auth → profile → deliveries → 401 handling.
Full delivery flow requires `API_LOG`.

---

## Payment flow

Razorpay HMAC is unit-tested. Manual staging test:

1. Test card `4111 1111 1111 1111`, any future expiry, any CVV
2. Confirm: order → `payment.verify` → CONFIRMED → webhook reconciled

---

## Staging validation report

See [docs/STAGING_VALIDATION.md](../docs/STAGING_VALIDATION.md) for the
fill-in checklist to complete after a full staging run before each production
promotion.

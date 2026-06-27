# Testing

| Layer | Where | Run |
|-------|-------|-----|
| Unit (API) | `apps/api/src/**/*.spec.ts` | `pnpm --filter @jewellery/api test` |
| E2E (API) | `apps/api/test/*.e2e-spec.ts` | `pnpm --filter @jewellery/api test:e2e` |
| Type checks | all apps | `pnpm -r typecheck` |
| Load / smoke | `tests/load/k6-smoke.js` | `k6 run -e BASE_URL=… tests/load/k6-smoke.js` |
| Mobile API contract | `tests/verify-mobile-api.mjs` | `node tests/verify-mobile-api.mjs` |

## Unit tests

Run with ts-jest (`apps/api/jest.config.js`). Cover pure/critical logic:

- `@jewellery/utils` — slug, money conversions, masking, clamp.
- **Razorpay payment signature** — HMAC-SHA256 verification scheme
  (`signature.spec.ts`): accepts valid, rejects tampered/wrong-secret/malformed,
  constant-time compare. Mirrors `PaymentsService.verifyPaymentSignature`.

## Load testing (k6)

Ramps to 50 VUs against read-heavy public endpoints (health, products, search).
Thresholds (`p95 < 800ms`, `errors < 1%`) fail the run — usable as a CI gate.
Install k6: https://k6.io/docs/get-started/installation/

## Payment flow verification

The signature unit test proves the HMAC scheme used for both checkout
verification and the webhook receiver. End-to-end payment requires Razorpay test
keys; verify in staging with a test card and confirm:
order → `payment.verify` (signature) → order CONFIRMED → webhook reconciliation.

## Mobile API verification

`verify-mobile-api.mjs` exercises the agent contract the mobile app depends on
(auth → profile → deliveries → 401 handling; full status→OTP→DELIVERED flow when
`API_LOG` points at the dev log so [DEV] OTPs can be read). CI/staging-friendly.

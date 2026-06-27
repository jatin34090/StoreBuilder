# Release Checklist — v5-production-ready

Complete every item before opening traffic to production.

## Pre-deploy

- [ ] All three apps type-check clean (`pnpm -r typecheck` — 0 errors)
- [ ] Unit tests pass (`pnpm --filter @jewellery/api test`)
- [ ] No `TODO / FIXME / console.log` left in committed code
- [ ] `.env.production` filled from `.env.production.example` — no placeholder values remain
- [ ] Neon DB credentials rotated (old credentials were in git history; see [SECRETS.md](SECRETS.md))
- [ ] `JWT_PRIVATE_KEY` / `JWT_PUBLIC_KEY` generated and stored in secret manager
- [ ] `REDIS_PASSWORD` set (non-empty)
- [ ] `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` are **live** keys (not `rzp_test_*`)
- [ ] `SENTRY_DSN` set and `@sentry/node` installed (`pnpm --filter @jewellery/api add @sentry/node`)
- [ ] TLS certificates issued by certbot for `yourdomain.in` + `api.yourdomain.in`
- [ ] DNS A-records pointing at production server IP
- [ ] Neon PITR retention confirmed in dashboard; restore drill completed

## Deploy

- [ ] `git pull origin main` on production server
- [ ] `pnpm --filter @jewellery/api prisma migrate deploy` succeeds with 0 failed migrations
- [ ] `docker compose -f docker-compose.prod.yml up -d` starts all 4 services
- [ ] All containers reach **healthy** state within 60 s  
      (`docker compose ps` — Status column shows `healthy`)

## Post-deploy smoke test

- [ ] `GET /api/v1/health/live` → 200
- [ ] `GET /api/v1/health/ready` → 200 (DB + Redis + queue all green)
- [ ] `GET /api/v1/health` → 200, all checks listed
- [ ] Homepage loads at `https://yourdomain.in`
- [ ] Product listing loads
- [ ] Admin login at `https://yourdomain.in/admin` works
- [ ] Agent mobile app connects (OTP flow end-to-end)
- [ ] Rate limiting active: rapid-fire 120 requests → 429 on the 100th+
- [ ] Nginx access log shows HTTPS requests, no HTTP fallthrough

## Monitoring

- [ ] Sentry project receiving events (trigger a test error)
- [ ] Uptime monitor configured on `/api/v1/health/ready` (target: alert if down > 1 min)
- [ ] Alert rules set in Sentry: error rate spike, p95 latency > 1 s
- [ ] Log aggregation (Papertrail / Logtail / CloudWatch) receiving structured JSON from API

## Mobile release

- [ ] EAS build on `production` profile succeeded for iOS + Android
- [ ] Internal test flight / APK tested on physical device
- [ ] App Store Connect / Google Play submission in review
- [ ] Push notification credentials configured in EAS (`EXPO_PUSH_TOKEN_URL` etc.)

## Sign-off

- [ ] QA sign-off on golden path: browse → add to cart → checkout → pay → order confirmation
- [ ] QA sign-off on admin: order management, delivery assignment
- [ ] QA sign-off on agent app: receive delivery, OTP verify, mark delivered
- [ ] On-call rotation set up; runbook URL shared with team ([RUNBOOK.md](RUNBOOK.md))

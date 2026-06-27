# Production Readiness Audit

Status of each readiness dimension for the jewellery platform (API + Web +
Mobile). ✅ ready · ⚠️ ready with action · ⛔ blocker.

| Area | Status | Evidence / Notes |
|------|:------:|------------------|
| **API deployment** | ✅ | Multi-stage `apps/api/Dockerfile` (non-root, Prisma openssl, health probe). CI deploys to Render via deploy hook on `main`; image also published to GHCR (`docker.yml`). |
| **Web deployment** | ✅ | Next.js `output: 'standalone'` + `apps/web/Dockerfile`; CI builds on every push; GHCR image. Behind nginx TLS. |
| **Mobile build generation** | ✅ | `mobile.yml` runs lint+typecheck gate, then EAS build (`production` + `production-agent` profiles); `eas submit` on release. |
| **Database migrations** | ✅ | Prisma migrations in `prisma/migrations` (`_init`). `prisma migrate deploy` runs in CI and is the documented release step. `DIRECT_URL` used for migrations. |
| **Backup strategy** | ⚠️ | Neon provides automated backups + point-in-time restore + branching. **Action:** confirm PITR retention window on the production project and document restore drill. |
| **Rollback strategy** | ✅ | Immutable image tags (`:<sha>`) on GHCR; Render keeps previous deploys (one-click rollback); git tags per phase (`v1`…`v5`). Migrations are additive; see runbook for the down-migration policy. |
| **Monitoring** | ✅ | `/health/live`, `/health/ready` (DB+Redis+queue), `/health`. Docker/compose health checks wired to these. |
| **Logging** | ✅ | Structured JSON error logs for 5xx (method/path/status/requestId); nginx access+error logs; pino available for request logging. |
| **Alerts** | ⚠️ | Error-tracking hook (Sentry) ready — **action:** set `SENTRY_DSN` and install `@sentry/node`, then configure alert rules (error rate, p95 latency, health-check failures) in Sentry + uptime monitor on `/health/ready`. |
| **Secrets** | ⚠️ | Templates sanitised; `docs/SECRETS.md` complete. **Action:** rotate the Neon credentials exposed in earlier git history before go-live. |
| **Security** | ✅ | OWASP audit (`docs/SECURITY.md`); global rate limiting fixed & verified; helmet + nginx headers; admin-only uploads; RS256 + rotating refresh. |
| **Type safety / build** | ✅ | API, Web, Mobile all type-check with 0 errors; unit + e2e tests in CI. |

## Outstanding actions before go-live

1. **Rotate** the Neon database password (exposed in git history) and any other previously committed secret.
2. **Confirm** Neon PITR retention and run a restore drill (document timing).
3. **Enable alerting**: set `SENTRY_DSN`, install `@sentry/node`, add Sentry alert rules + an uptime monitor hitting `/api/v1/health/ready`.
4. **Provision** production secrets in the platform secret store from `.env.production.example`.
5. **Issue TLS certs** (certbot) for `yourdomain.in` + `api.yourdomain.in` and deploy the nginx config.

## Verified in this phase

- Health endpoints return 200 with DB/Redis/queue checks (live).
- Rate limiting enforced (120-req burst → 99×200 + 21×429).
- Unit tests green (12); mobile-API contract verification green (5/5).
- All three apps type-check clean.

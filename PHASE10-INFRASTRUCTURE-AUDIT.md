# Phase 10 — Infrastructure Audit

**Date:** 2026-08-15  
**Platform:** Multi-tenant SaaS Jewellery Platform (NestJS + Next.js + PostgreSQL + Redis)

---

## Audit Format

| Field | Meaning |
|---|---|
| Component | System component |
| Current Implementation | What exists today |
| Dev Setup | Local development experience |
| Production Readiness | Ready / Partial / Missing |
| Risk | Impact if not addressed |
| Recommended Change | Action needed |

---

## 1. Frontend (Next.js)

| Field | Detail |
|---|---|
| **Component** | Next.js 14 App Router storefront + admin dashboard |
| **Current Implementation** | `apps/web/`. `output: 'standalone'` for Docker. Security headers set in `next.config.ts` (X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy). Image domains restricted to `res.cloudinary.com`. Avif+WebP image formats. Sentry integrated in production. |
| **Dev Setup** | `pnpm dev` on port 3000 |
| **Production Readiness** | Partial |
| **Risk** | Build uses placeholder `api.yourdomain.in` in `web.yml` CI workflow — production build requires correct `NEXT_PUBLIC_API_URL` |
| **Recommended Change** | Set `NEXT_PUBLIC_API_URL` as a GitHub Actions variable per environment; verify no localhost URLs remain in production bundle |

---

## 2. Backend API (NestJS)

| Field | Detail |
|---|---|
| **Component** | NestJS REST API |
| **Current Implementation** | `apps/api/`. Global guard chain (6 guards). Helmet, CORS, ValidationPipe, ResponseInterceptor, AllExceptionsFilter. Swagger disabled in production. RS256 JWT via HttpOnly cookie. |
| **Dev Setup** | `pnpm dev` on port 3001 |
| **Production Readiness** | Partial |
| **Risk (fixed in Phase 10)** | No graceful shutdown — SIGTERM killed process without draining requests or closing DB/Redis. No body size limit set at Express level. No request ID middleware. |
| **Phase 10 fixes** | Added `enableShutdownHooks()`, `express.json({ limit: '1mb' })`, X-Request-ID middleware |

---

## 3. Background Workers (Bull/BullMQ)

| Field | Detail |
|---|---|
| **Component** | Bull queue processors (notifications, analytics) |
| **Current Implementation** | `NotificationsProcessor`, `AnalyticsProcessor` run inside the API process. Two queues: `notifications` (push, broadcast) and `analytics` (nightly-report, reset-daily-quota, reset-monthly-quota). Cron jobs registered on `onModuleInit`. |
| **Dev Setup** | Workers share the API process — no separate worker binary |
| **Production Readiness** | Partial |
| **Risk** | Workers run in same process as API — heavy background work competes with request handling. No retry config was set (0 retries by default). Cron jobs will fire on every API instance in a multi-replica setup. |
| **Phase 10 fixes** | Added `DEFAULT_JOB_OPTIONS` (3 attempts, exponential backoff 5s, keepLast 100/200) to both queues |
| **Remaining risk** | Multi-replica cron duplication — Bull's repeatable job keys in Redis prevent duplicate scheduling but each instance will call `registerCron` on startup, which removes + re-adds the repeatable job. Idempotent in Redis but noisy. In production, consider running workers in a dedicated process or using `RedisService` distributed locking before repeatable job registration. |

---

## 4. PostgreSQL / Prisma

| Field | Detail |
|---|---|
| **Component** | PostgreSQL via Neon (managed serverless Postgres) |
| **Current Implementation** | Prisma ORM. Two-URL pattern: `DATABASE_URL` (pooled via Neon's connection pooler) for app queries; `DIRECT_URL` (unpooled) for `prisma migrate`. PrismaService retries connect up to 5×, keeps alive with 4-minute `SELECT 1` ping to prevent cold suspend. |
| **Dev Setup** | `docker-compose.yml` starts local Postgres 16 for dev. CI uses postgres service container. |
| **Production Readiness** | Partial |
| **Risk** | No migration step in the production deploy workflow — migrations must be run manually before/after deploying. `prisma migrate dev` must never run in production. |
| **Recommended Change** | Add `prisma migrate deploy` to the CI/CD deploy job before the new API starts. Use `DIRECT_URL` for migrations only. |

---

## 5. Redis

| Field | Detail |
|---|---|
| **Component** | Redis for rate limiting, caching, queues, push-notification tokens |
| **Current Implementation** | `redis.service.ts` wraps ioredis with in-memory fallback when `REDIS_URL` is absent. Production compose uses Redis 7 with AOF persistence and password auth. `BullModule` configured with `enableOfflineQueue: false`, `connectTimeout: 2000`, `maxRetriesPerRequest: 0`. |
| **Dev Setup** | `docker-compose.yml` starts Redis 7 locally |
| **Production Readiness** | Partial |
| **Risk** | In-memory fallback means rate limits and queue state are process-local — not tenant-isolated across replicas. Domain cache key (`store:domain:{domain}`) was not invalidated on store update (fixed Phase 10). |
| **Redis failure policy** | Rate limiting: FAIL OPEN (returns `true` if Redis unavailable). Analytics cache: FAIL OPEN (bypasses cache, queries DB). Queues: FAIL CLOSED (Bull will error if Redis is down). |
| **Phase 10 fixes** | Fixed `invalidateStoreCache` to also delete domain cache key |

---

## 6. Cloudinary / File Storage

| Field | Detail |
|---|---|
| **Component** | Cloudinary for product images, avatars, category banners |
| **Current Implementation** | `CloudinaryService` in `upload` module. Files are validated by Multer (5 MB size limit). MIME type check via Content-Type header (not magic bytes). Uploads are namespaced by `storeSlug/productId`. Storage quota tracked per tenant in `StoreQuotaUsage.storageBytes`. |
| **Dev Setup** | Requires `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` env vars |
| **Production Readiness** | Partial |
| **Risk** | Storage quota check is not atomic — two concurrent uploads near the limit could both pass and exceed it. No magic byte validation (only Content-Type header, which can be spoofed). SVG uploads not blocked (XSS risk via SVG). |
| **Recommended Change** | Use a Prisma transaction or `$executeRaw UPDATE ... WHERE storageBytes + $size <= maxBytes` for atomic quota enforcement. Block `image/svg+xml` MIME type explicitly. |

---

## 7. Queues — Architecture Detail

| Queue | Jobs | Producer | Processor | Retries (Phase 10) |
|---|---|---|---|---|
| `notifications` | `send-push`, `broadcast` | NotificationsService | NotificationsProcessor | 3× exponential 5s |
| `analytics` | `nightly-report`, `reset-daily-quota`, `reset-monthly-quota` | AnalyticsProcessor (cron) | AnalyticsProcessor | 3× exponential 5s |

Failed jobs are retained in Redis (`removeOnFail: 200`) for inspection. No external dead-letter queue configured — failed job visibility requires Bull board or manual `queue.getFailed()` call.

---

## 8. Environment Configuration

| Variable | Required | Default | Notes |
|---|---|---|---|
| `DATABASE_URL` | ✅ YES | — | Pooled connection |
| `DIRECT_URL` | ✅ YES | — | Unpooled for migrations |
| `JWT_PRIVATE_KEY` | ✅ YES | — | RS256 private key (base64) |
| `JWT_PUBLIC_KEY` | ✅ YES | — | RS256 public key (base64) |
| `API_URL` | ✅ YES | — | Public API base URL |
| `WEB_URL` | ✅ YES | — | Public frontend URL |
| `CORS_ORIGINS` | ✅ YES | — | Comma-separated allowed origins |
| `REDIS_URL` | Optional | `'memory'` | Falls back to in-memory if absent |
| `PORT` | Optional | `3001` | API listen port |
| `RAZORPAY_*` | Optional | placeholder | Payment integration |
| `CLOUDINARY_*` | Optional | placeholder | File storage |
| `SENTRY_DSN` | Optional | `''` | Error monitoring |

Validation: Joi schema in `apps/api/src/config/config.schema.ts`. App fails to start if required variables are missing. Unknown variables cause startup failure (`allowUnknown: false` in module options).

---

## 9. Docker

| File | Status | Notes |
|---|---|---|
| `apps/api/Dockerfile` | ✅ EXISTS | Multi-stage, non-root user, HEALTHCHECK on `/api/v1/health/live` |
| `apps/web/Dockerfile` | ✅ EXISTS | Multi-stage, standalone output, non-root user, HEALTHCHECK |
| `docker-compose.yml` | ✅ EXISTS | Dev only — Postgres + Redis + Typesense |
| `docker-compose.prod.yml` | ✅ EXISTS | Production — API + Web + Redis + Typesense, AOF enabled |
| `.dockerignore` | ✅ EXISTS | Excludes node_modules, .env files, .git |

---

## 10. Nginx

| Field | Detail |
|---|---|
| **File** | `infra/nginx/nginx.conf` |
| **Status** | Main config exists; **server block conf.d files are absent from the repo** |
| **Config** | `server_tokens off`, `client_max_body_size 12m`, rate-limit zones (api: 20r/s, auth: 5r/s), keepalive upstream to API and Web, gzip level 6 |
| **Risk** | SSL termination and routing rules are not in source control — they must be configured manually on the server or via a separate provisioning system |
| **Recommended Change** | Add `infra/nginx/conf.d/jewellery.conf.example` with the HTTPS server block, proxy_pass rules, and Let's Encrypt setup as a reference template |

---

## 11. CI/CD

| Workflow | Trigger | Actions | Gap |
|---|---|---|---|
| `api.yml` | Push to main/develop, PR | typecheck, lint, test, deploy to Render | No `prisma migrate deploy` in deploy job |
| `docker.yml` | Push to main/develop, PR | Build+push API+Web images to GHCR | Good |
| `web.yml` | Push to main/develop | typecheck, lint, build | Hardcoded placeholder `api.yourdomain.in` in build env |
| `mobile.yml` | Push to main, GitHub release | EAS build + submit | Good |

---

## 12. Health Checks

| Endpoint | Type | Checks | Notes |
|---|---|---|---|
| `GET /api/v1/health/live` | Liveness | Process alive | Used by Docker HEALTHCHECK |
| `GET /api/v1/health/ready` | Readiness | DB (`SELECT 1`) + Redis (`PING`) | Returns 503 if any dependency fails |
| `GET /api/v1/health` | Full report | DB + Redis | Returns `degraded` status with detail |

All endpoints are `@Public()` — no auth required.

---

## 13. Logging

| Layer | Implementation | Gap |
|---|---|---|
| API request logs | NestJS built-in `Logger` (text output) | No structured per-request log (no pino-http) |
| Error logs | `AllExceptionsFilter` emits JSON string for 5xx | Not a proper structured pipeline |
| Query logs | Prisma `{ emit: 'event', level: 'query' }` | Events not forwarded to pino — debug only |
| Worker logs | NestJS `Logger` calls in each processor | No job ID or store ID in log fields |

pino and pino-http are installed but not wired. Structured logging is an improvement for production observability but is not blocking for deployment.

---

## 14. Request ID

| Field | Detail |
|---|---|
| **Before Phase 10** | `x-request-id` header was only read (never generated) in `AllExceptionsFilter` |
| **Phase 10 fix** | Middleware in `main.ts` generates `randomUUID()` if no `x-request-id` header present; sets `req.requestId`; echoes as `X-Request-ID` response header |

---

## 15. Graceful Shutdown

| Field | Detail |
|---|---|
| **Before Phase 10** | `app.enableShutdownHooks()` not called — SIGTERM killed the process without draining requests or closing DB/Redis |
| **Phase 10 fix** | `app.enableShutdownHooks()` added to `main.ts`. On SIGTERM/SIGINT, NestJS calls `onModuleDestroy()` on all providers — PrismaService disconnects, RedisService calls `client.quit()`. |

---

## 16. Security

| Area | Status | Notes |
|---|---|---|
| HTTPS | ✅ Nginx configured | Nginx conf.d missing from repo — cert/redirect must be provisioned separately |
| HttpOnly cookies | ✅ | JWT sent as HttpOnly cookie, not localStorage |
| Helmet | ✅ | All default headers applied |
| CORS | ✅ | Origin whitelist from env, no wildcard with credentials |
| CSRF | ✅ | SameSite cookie + CORS origin whitelist provides protection |
| Rate limiting | ✅ | Global ThrottlerGuard + per-tenant TenantRateLimitGuard |
| Input validation | ✅ | Global ValidationPipe (whitelist + forbidNonWhitelisted) |
| SQL injection | ✅ | Prisma parameterized queries; `$queryRaw` uses `Prisma.sql` |
| Tenant IDOR | ✅ (Phase 9) | 30/30 security tests pass |
| Secrets in git | ✅ | .env files excluded; .gitignore updated (Phase 10) |

---

## 17. Database Indexes

Reviewed tenant-heavy query patterns. Existing indexes cover FK relationships. High-value composite indexes that may be missing:

| Table | Suggested Composite Index | Query Pattern |
|---|---|---|
| `Order` | `(storeId, status)` | Admin order list filtered by status |
| `Order` | `(storeId, createdAt DESC)` | Admin order list sorted by date |
| `Product` | `(storeId, isActive)` | Public storefront product list |
| `Notification` | `(userId, isRead)` | Unread notification count |
| `StoreAuditLog` | `(storeId, createdAt DESC)` | Audit log list for a store |

Note: Prisma auto-generates indexes for `@unique` and `@@unique` fields. FK fields get indexes if `@relation` references them. The above are *additional* composite indexes for query performance — not yet added to the schema. Recommend adding via a new migration after benchmarking with production data volume.

---

## 18. Known Remaining Risks (Not Blocking Deployment)

| Risk | Severity | Mitigation |
|---|---|---|
| Storage quota race condition (concurrent uploads) | MEDIUM | Use atomic DB update for quota enforcement |
| Multi-replica cron duplication | LOW | Workers re-add repeatable jobs idempotently via Redis; no double execution |
| Nginx conf.d not in source control | MEDIUM | Add reference template; provision via IaC or documented runbook |
| Magic byte file validation | LOW | Add server-side MIME sniffing for uploads |
| No dead-letter queue UI | LOW | Failed jobs visible via Bull board or `queue.getFailed()` |
| Migration not automated in deploy | MEDIUM | Add `prisma migrate deploy` step to CI deploy job |

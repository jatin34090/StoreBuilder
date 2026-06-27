# Operations Runbook

Quick reference for on-call engineers. Always check this doc before escalating.

---

## Health checks

| Endpoint | What it checks | Expected |
|----------|----------------|---------|
| `GET /api/v1/health/live` | Process alive | 200 `{ status: "ok" }` |
| `GET /api/v1/health/ready` | DB + Redis + queue | 200 all green, 503 if any down |
| `GET /api/v1/health` | Full JSON breakdown | 200 |

---

## Common incidents

### API container not starting

```bash
docker compose -f docker-compose.prod.yml logs api --tail=50
```

- **`PrismaClientInitializationError`** — Neon DB cold-start (auto-suspends after 5 min idle). Wait 15-20 s, retry. If persistent: check `DATABASE_URL` in env.
- **`Error: JWT_PRIVATE_KEY is required`** — secret not set. Check `.env.production`.
- **Port already in use** — `lsof -ti:3001 | xargs kill -9` then restart.

---

### DB migrations failing on deploy

```bash
pnpm --filter @jewellery/api prisma migrate deploy
```

- **`P1001` cannot reach DB** — use `DIRECT_URL` (unpooled Neon URL). PgBouncer blocks DDL.
- **Migration already applied** — safe to ignore, Prisma is idempotent.
- **Drift detected** — run `prisma migrate resolve --applied <migration_name>` on staging first; never on prod without review.

---

### Redis unavailable (`/health/ready` → 503, queue: "error")

```bash
docker compose -f docker-compose.prod.yml logs redis --tail=30
docker compose -f docker-compose.prod.yml restart redis
```

BullMQ jobs will queue in memory (limited) until Redis recovers. No data loss for jobs already enqueued with persistence (`AOF` is enabled).

---

### High error rate (Sentry alert)

1. Check structured logs: `docker compose logs api --tail=200 | grep '"level":"error"'`
2. Look for recurring `path` + `statusCode` pattern.
3. If 5xx spike on `/api/v1/payments/*` — check Razorpay dashboard for webhook failures.
4. If 429 storm — a client is hammering; check `$binary_remote_addr` in nginx logs, block IP if needed.

---

### Nginx not serving (site down)

```bash
docker compose -f docker-compose.prod.yml logs nginx --tail=50
nginx -t   # inside container: docker exec nginx nginx -t
```

- **SSL cert expired** — `certbot renew` then `docker exec nginx nginx -s reload`.
- **Upstream 502** — API or Web container unhealthy. Check health endpoint directly on container network: `docker exec nginx curl http://api:3001/api/v1/health/live`.

---

### Rollback a bad deploy

```bash
# Option 1: Render dashboard → Deploys → "Rollback to previous"

# Option 2: Docker image tag rollback
export PREV_TAG=<sha-from-ghcr>
sed -i "s|ghcr.io/org/jewellery-api:.*|ghcr.io/org/jewellery-api:${PREV_TAG}|" docker-compose.prod.yml
docker compose -f docker-compose.prod.yml up -d --no-deps api

# Option 3: Git tag checkout
git checkout v4-mobile-delivery-app
docker compose -f docker-compose.prod.yml up -d --build
```

**Never roll back migrations without a DBA review.** Add a compensating migration instead.

---

### Mobile app push notifications not delivered

1. Check `EXPO_PUSH_TOKEN_URL` is set on the API.
2. Check Expo Push Notification logs in EAS dashboard.
3. Verify device token is saved in DB: `SELECT * FROM "AgentProfile" WHERE id = '<agent-id>'`.

---

## Maintenance window procedure

1. Put up maintenance page (update nginx `default.conf` to return 503 with custom page).
2. Drain BullMQ: wait for active job count to reach 0 (`GET /api/v1/health` → check `queue.waiting`).
3. Take Neon snapshot branch: `neon branch create --name maintenance-$(date +%Y%m%d)`.
4. Run maintenance tasks.
5. Remove maintenance page, reload nginx.
6. Run smoke tests (see [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md) — post-deploy section).

---

## Useful commands

```bash
# Real-time API logs
docker compose -f docker-compose.prod.yml logs -f api

# Open psql on Neon (requires DIRECT_URL)
pnpm --filter @jewellery/api prisma studio

# Flush Redis (dev/staging only!)
docker exec redis redis-cli -a $REDIS_PASSWORD FLUSHALL

# Check rate-limit counters (nginx)
docker exec nginx cat /var/log/nginx/access.log | grep " 429 "

# Rebuild a single service without downtime
docker compose -f docker-compose.prod.yml up -d --no-deps --build api
```

---

## Escalation contacts

| Role | Responsibility |
|------|---------------|
| Backend on-call | API, DB, Redis, payments |
| DevOps | Server, Docker, nginx, TLS |
| Mobile on-call | EAS builds, push notifications |
| Razorpay support | Payment gateway issues |
| Neon support | Database issues beyond cold-start |

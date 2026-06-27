# Disaster Recovery

## RTO / RPO targets

| Scenario | RTO | RPO |
|----------|-----|-----|
| Single container crash | < 1 min (Docker auto-restart) | 0 |
| Full server failure | < 30 min (re-deploy from image) | < 5 min (Neon PITR) |
| Data corruption / accidental delete | < 2 hours | point-in-time (Neon PITR) |
| Region-level outage | Manual — follow plan below | point-in-time |

---

## 1. Neon database backup

Neon provides continuous WAL-based backups with point-in-time restore.

### Verify retention window

1. Open [console.neon.tech](https://console.neon.tech) → your project → **Settings → Restore**.
2. Confirm "History retention" shows the expected window (Free: 7 days; Pro: 30 days).
3. Document the value in the team wiki.

### Run a restore drill (do this before go-live)

```bash
# 1. Create a restore branch from 1 hour ago
neon branch create \
  --name restore-drill-$(date +%Y%m%d) \
  --timestamp "$(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%SZ)"

# 2. Get the connection string for the new branch
neon connection-string restore-drill-$(date +%Y%m%d)

# 3. Spot-check data integrity
psql "<restore-branch-url>" \
  -c "SELECT COUNT(*) FROM \"Order\";" \
  -c "SELECT MAX(\"createdAt\") FROM \"Order\";"

# 4. Delete the drill branch when done
neon branch delete restore-drill-$(date +%Y%m%d)
```

Record results: branch name, row counts, timestamp of oldest recoverable record.

### Production restore procedure

```bash
# 1. Identify the restore point (ISO 8601, UTC)
RESTORE_TO="2026-01-15T10:30:00Z"

# 2. Create restore branch
neon branch create --name prod-restore --timestamp "$RESTORE_TO"

# 3. Promote branch to replace production (Neon console: Branch → Make Primary)
#    OR update DATABASE_URL / DIRECT_URL in secret manager to point at the restore branch.

# 4. Restart API containers so they pick up the new connection string
docker compose -f docker-compose.prod.yml restart api

# 5. Verify /health/ready returns 200
curl https://api.yourdomain.in/api/v1/health/ready

# 6. Once stable, delete the old branch to avoid extra cost
```

---

## 2. Redis recovery

Redis uses AOF persistence (`appendonly yes`). Data survives container restarts.

**If Redis data is corrupted:**

```bash
# Stop the container
docker compose -f docker-compose.prod.yml stop redis

# Back up the AOF file
cp /var/lib/docker/volumes/jewellery_redis_data/_data/appendonly.aof \
   /backup/redis-$(date +%Y%m%d%H%M).aof

# Remove corrupted file and let Redis rebuild from a cold start
# (Queue jobs will re-process from DB state; cache will warm on next requests)
docker compose -f docker-compose.prod.yml rm -f redis
docker compose -f docker-compose.prod.yml up -d redis
```

---

## 3. Full server failure (re-deploy from scratch)

```bash
# On a fresh Ubuntu 22.04 server:

# 1. Install Docker
curl -fsSL https://get.docker.com | sh

# 2. Install certbot
apt install -y certbot

# 3. Clone the repo (or pull from GHCR — no source code needed for production)
git clone https://github.com/your-org/jewellery-platform.git
cd jewellery-platform

# 4. Restore secrets
# Copy .env.production from your secret manager (e.g. 1Password, AWS Secrets Manager)

# 5. Issue TLS certs
certbot certonly --standalone -d yourdomain.in -d api.yourdomain.in

# 6. Run migrations
pnpm --filter @jewellery/api prisma migrate deploy

# 7. Start all services
docker compose -f docker-compose.prod.yml up -d

# 8. Smoke test
curl https://api.yourdomain.in/api/v1/health/ready
```

Total time estimate: 20–30 minutes assuming secrets are accessible.

---

## 4. Rollback a bad deployment

See [RUNBOOK.md](RUNBOOK.md) — "Rollback a bad deploy" section.

---

## 5. Post-incident checklist

- [ ] Services restored and `/health/ready` returning 200
- [ ] Checked for data loss (compare row counts before/after)
- [ ] Sentry incident resolved or suppressed
- [ ] Root cause identified and documented
- [ ] `docs/INCIDENTS.md` entry created (date, impact, RCA, action items)
- [ ] Alert thresholds reviewed to catch this earlier next time

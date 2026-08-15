# Disaster Recovery Runbook

**Platform:** Multi-tenant SaaS Jewellery Platform  
**Last updated:** 2026-08-15

---

## Recovery Objectives

| Objective | Target | Basis |
|---|---|---|
| **RPO** (Recovery Point Objective) | ≤ 24 hours | Neon managed backups (daily); continuous WAL for paid tiers |
| **RTO** (Recovery Time Objective) | ≤ 2 hours | Time to provision new infra, restore DB, redeploy application |

> **Note:** The RPO/RTO above reflect Neon's free/starter tier. Neon Pro provides point-in-time recovery (PITR) with continuous WAL archival — this reduces RPO to minutes. Upgrade to Pro for production businesses requiring tighter RPO.

---

## 1. Database Recovery

### 1.1 Backup Strategy

**Provider:** Neon managed PostgreSQL  
**Automatic backups:** Neon automatically snapshots the database (daily for free tier, continuous WAL for Pro tier).  
**Retention:** 7 days (free tier), configurable on Pro.

**Manual backup before risky operations:**

```bash
# Export full database (run against DIRECT_URL, not pooled URL)
pg_dump "$DIRECT_URL" \
  --no-owner --no-acl --format=custom \
  -f "backup-$(date +%Y%m%d-%H%M%S).dump"
```

**Recommended: Automated daily backup script** (run via cron or CI schedule):

```bash
#!/bin/bash
set -euo pipefail
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="jewellery-db-${TIMESTAMP}.dump"
pg_dump "$DIRECT_URL" --no-owner --no-acl --format=custom -f "/backups/$BACKUP_FILE"
# Upload to S3/GCS/R2:
# aws s3 cp /backups/$BACKUP_FILE s3://your-bucket/db-backups/
echo "Backup complete: $BACKUP_FILE"
```

**Retention policy:** Keep 30 daily backups. Delete backups older than 30 days.

---

### 1.2 Restore Procedure

> **WARNING:** Never restore against the production database directly. Always restore to a staging environment first to verify integrity.

**Step 1 — Restore to a new database:**

```bash
# Create a new empty database (via Neon console or CLI)
# Then restore:
pg_restore \
  --no-owner --no-acl \
  --dbname="$RESTORE_DATABASE_URL" \
  backup-YYYYMMDD-HHMMSS.dump
```

**Step 2 — Verify restored data:**

```sql
-- Count key tables
SELECT COUNT(*) FROM "User";
SELECT COUNT(*) FROM "Store";
SELECT COUNT(*) FROM "Product";
SELECT COUNT(*) FROM "Order";
SELECT COUNT(*) FROM "StoreSubscription";
SELECT COUNT(*) FROM "Invoice";
```

**Step 3 — Run Prisma migrations to ensure schema is current:**

```bash
DATABASE_URL="$RESTORE_DATABASE_URL" \
DIRECT_URL="$RESTORE_DATABASE_URL" \
npx prisma migrate deploy --schema=prisma/schema.prisma
```

**Step 4 — Update application DATABASE_URL** to point to the restored database.

**Step 5 — Smoke test** critical flows (see §6 Smoke Test).

---

### 1.3 Point-in-Time Recovery (PITR)

Available on Neon Pro. Use the Neon console to branch from a specific timestamp:

1. Go to Neon console → Project → Branches → Create branch
2. Select "From timestamp" and enter the recovery point
3. Use the new branch's connection string as `DATABASE_URL`

---

## 2. Redis Recovery

Redis stores: rate limit counters, store/slug cache, plan feature cache, Bull queue state.

**Redis data is ephemeral by design** — all caches will rebuild from PostgreSQL on first access. Rate limit counters reset on Redis restart (acceptable: brief window where limits are not enforced).

**Bull queue state** (pending/active jobs) is stored in Redis. Jobs in the `active` state at the time of Redis failure may be re-queued as duplicates when the queue reconnects. Bull's job IDs prevent exact duplicates only if the job was already completed.

**Recovery steps:**
1. Restart Redis (data will be empty)
2. Restart API and workers — they reconnect automatically (ioredis `lazyConnect`)
3. Cache rebuilds from DB on first request per store
4. Re-queue any manually identified missed jobs if needed

**If using Redis AOF persistence** (enabled in `docker-compose.prod.yml`): Redis will replay the AOF log on startup and recover pending queue state automatically.

---

## 3. Application Recovery

### 3.1 Full Redeployment

```bash
# 1. Pull latest image from GHCR
docker pull ghcr.io/your-org/jewellery-api:latest
docker pull ghcr.io/your-org/jewellery-web:latest

# 2. Run database migrations before starting new API
docker run --rm \
  --env-file .env.production \
  ghcr.io/your-org/jewellery-api:latest \
  npx prisma migrate deploy --schema=prisma/schema.prisma

# 3. Start production stack
docker-compose -f docker-compose.prod.yml up -d
```

### 3.2 Rollback

**Application rollback** — specify the previous image tag:

```bash
# Identify the previous working image tag (from GHCR or CI artifact)
PREV_TAG=sha-abc1234

docker pull ghcr.io/your-org/jewellery-api:$PREV_TAG
# Update docker-compose.prod.yml image tag, then:
docker-compose -f docker-compose.prod.yml up -d
```

**Database rollback** — Prisma migrations are generally NOT reversible. Use PITR (see §1.3) or restore from backup. Prefer forward-compatible migrations (expand/contract pattern) to avoid needing rollbacks.

---

## 4. Storage Recovery (Cloudinary)

Cloudinary stores all product images, avatars, and category banners. Cloudinary provides:
- Built-in CDN with multi-region redundancy
- Asset versioning per resource ID
- Backup available via Cloudinary's account settings (on paid plans)

**Recovery steps if assets are accidentally deleted:**
1. Check Cloudinary's activity log for the deletion event
2. Use Cloudinary's backup feature (if enabled on paid plan) to restore
3. If assets are permanently lost, request merchants to re-upload; product records in DB remain intact

---

## 5. Environment Recovery

**Required secrets to recover:**

| Secret | Storage | Recovery |
|---|---|---|
| `DATABASE_URL` | Password manager / secrets vault | Re-provision from Neon console |
| `JWT_PRIVATE_KEY` / `JWT_PUBLIC_KEY` | Password manager | All existing JWTs will become invalid — users must re-login |
| `RAZORPAY_*` | Password manager | Re-fetch from Razorpay dashboard |
| `CLOUDINARY_*` | Password manager | Re-fetch from Cloudinary dashboard |
| `REDIS_PASSWORD` | Password manager | Reset in Redis config, update env |

> **If JWT keys are rotated:** All existing sessions are invalidated. Users will see "session expired" and must log in again. This is safe — no data loss, just a forced re-authentication.

---

## 6. Smoke Test After Recovery

Run these checks after any recovery operation:

```bash
# 1. Health check
curl https://your-api-domain.com/api/v1/health/ready

# 2. Public plan listing
curl https://your-api-domain.com/api/v1/billing/plans

# 3. Register a test user
curl -X POST https://your-api-domain.com/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"DR Test","email":"drtest@recovery.test","password":"DrTest@123456"}'

# 4. Login
# 5. Provision store
# 6. Check admin billing status
# 7. View products (storefront)
# 8. Verify store isolation
```

Use the Phase 8 and Phase 9 test scripts in `scratchpad/` for a full automated verification.

---

## 7. DNS / Domain Recovery

If the primary domain is inaccessible:

1. Update DNS A record to point to the new server IP
2. TTL propagation: 5 minutes (if TTL was set low) to 48 hours (if TTL was high)
3. Re-issue TLS certificate: `certbot renew` or Let's Encrypt auto-renewal
4. Verify Nginx upstream health checks pass

---

## 8. Data Retention Policy

| Data | Retention | Notes |
|---|---|---|
| Orders | Permanent | Business records |
| Invoices | 7 years | Legal/tax requirement |
| Audit logs (`StoreAuditLog`) | 2 years | Compliance |
| Notifications | 90 days | Can be pruned after read |
| Failed Bull jobs | 7 days (Redis TTL) | Inspect within 7 days |
| Application logs | 30 days | Rotate on log server |
| Uploaded files (Cloudinary) | Permanent (until deleted by store owner) | Storage cost applies |

---

## 9. Contacts / Escalation

| Role | Action |
|---|---|
| On-call engineer | Check `/health/ready` first; check Sentry for error spike |
| Database incident | Check Neon status page; trigger PITR if needed |
| Payment incident | Razorpay support + check webhook failure logs |
| Storage incident | Cloudinary status page |

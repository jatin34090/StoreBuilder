# Production Deployment Log

## Release: v1.0.0  —  2026-06-29

**Status:** Approved for production  
**Approved by:** Project owner  
**Git SHA:** fab0620 (v7-staging-validated)

---

## Pre-deployment checklist status

| # | Action | Status |
|---|--------|--------|
| 1 | Rotate Neon DB password | ⬜ Required before traffic |
| 2 | Issue TLS certs via certbot | ⬜ Required before traffic |
| 3 | Set SENTRY_DSN + install @sentry/node | ⬜ Required for alerts |
| 4 | Confirm Neon PITR retention + restore drill | ⬜ Required for DR |
| 5 | Run staging validation suite | ⬜ Required before promotion |
| 6 | Provision all secrets from .env.production.example | ⬜ Required |

---

## Deployment execution steps

Run these in order on the production server:

```bash
# 1. Set env vars
export PROD_DOMAIN=yourdomain.in
export PROD_API_DOMAIN=api.yourdomain.in
export REPO_URL=https://github.com/jatin34090/ARTIFICIAL-JEWELLERY-PLATFORM.git

# 2. Bootstrap server (first time only)
STAGING_DOMAIN=$PROD_DOMAIN \
STAGING_API_DOMAIN=$PROD_API_DOMAIN \
bash scripts/staging-setup.sh

# 3. Verify production secrets are in .env.production (not staging values)
grep -E 'DATABASE_URL|JWT_PRIVATE|RAZORPAY' .env.production | head -5

# 4. Run migrations
pnpm --filter @jewellery/api prisma migrate deploy

# 5. Pull latest images and restart
docker compose -f docker-compose.prod.yml --env-file .env.production pull
docker compose -f docker-compose.prod.yml --env-file .env.production up -d

# 6. Verify all containers healthy
docker compose -f docker-compose.prod.yml ps

# 7. Smoke test
curl -sf https://$PROD_API_DOMAIN/api/v1/health/live  && echo "API live ✓"
curl -sf https://$PROD_API_DOMAIN/api/v1/health/ready && echo "API ready ✓"
curl -sf https://$PROD_DOMAIN -o /dev/null            && echo "Web live ✓"
```

---

## Post-deployment validation

```bash
# Full staging validator (point at prod)
API_BASE=https://api.yourdomain.in/api/v1 \
WEB_BASE=https://yourdomain.in \
node tests/staging-validate.mjs

# Security check
API_BASE=https://api.yourdomain.in/api/v1 \
WEB_BASE=https://yourdomain.in \
node tests/security/security-verify.mjs
```

---

## Rollback procedure

```bash
# Option 1: Render dashboard — one-click rollback to previous deploy

# Option 2: Docker image rollback
PREV_SHA=340df16   # previous stable SHA
docker compose -f docker-compose.prod.yml \
  --env-file .env.production \
  up -d --no-deps api web
```

See [RUNBOOK.md](RUNBOOK.md) for full incident procedures.

---

## Production URLs

| Service | URL |
|---------|-----|
| Customer web | `https://yourdomain.in` |
| API | `https://api.yourdomain.in/api/v1` |
| API docs | `https://api.yourdomain.in/api/docs` |
| Admin | `https://yourdomain.in/admin` |
| Health | `https://api.yourdomain.in/api/v1/health` |

# Deployment Guide

## Architecture

```
Internet → Nginx (TLS, rate-limit) → API (NestJS :3001) + Web (Next.js :3000)
                                   → Redis (cache / BullMQ)
                                   → Typesense (search)
                                   → Neon Postgres (external, pooled)
```

## Prerequisites

| Tool | Version |
|------|---------|
| Docker + Compose | 24+ |
| Node.js | 20 LTS |
| pnpm | 9+ |
| certbot | any recent |

---

## 1. DNS

Point two A-records at your server IP:

```
yourdomain.in       → <server-ip>
api.yourdomain.in   → <server-ip>
```

---

## 2. TLS certificates

```bash
certbot certonly --standalone \
  -d yourdomain.in -d www.yourdomain.in \
  -d api.yourdomain.in
```

Certificates land at `/etc/letsencrypt/live/yourdomain.in/`.  
Add a cron to auto-renew: `0 3 * * * certbot renew --quiet`.

---

## 3. Secrets

Copy the template and fill in every value:

```bash
cp .env.production.example .env.production
# edit .env.production — never commit this file
```

Key variables:

| Variable | Where to get |
|----------|-------------|
| `DATABASE_URL` | Neon dashboard → Connection string (pooled) |
| `DIRECT_URL` | Neon dashboard → Connection string (unpooled) |
| `JWT_PRIVATE_KEY` | `openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048` |
| `JWT_PUBLIC_KEY` | `openssl rsa -pubout -in private.pem` |
| `RAZORPAY_KEY_ID` / `KEY_SECRET` | Razorpay dashboard |
| `REDIS_PASSWORD` | generate: `openssl rand -hex 32` |
| `TYPESENSE_API_KEY` | generate: `openssl rand -hex 32` |

See [docs/SECRETS.md](SECRETS.md) for the full variable reference.

---

## 4. Build & start

```bash
# Pull latest
git pull origin main

# Run DB migrations (uses DIRECT_URL — bypasses PgBouncer)
pnpm --filter @jewellery/api prisma migrate deploy

# Start all containers
docker compose -f docker-compose.prod.yml --env-file .env.production up -d

# Tail logs
docker compose -f docker-compose.prod.yml logs -f --tail=100
```

---

## 5. Verify

```bash
# Liveness
curl https://api.yourdomain.in/api/v1/health/live

# Readiness (DB + Redis + queue)
curl https://api.yourdomain.in/api/v1/health/ready

# Full health JSON
curl https://api.yourdomain.in/api/v1/health
```

All three should return `200`. `/health/ready` returns `503` if a dependency is down.

---

## 6. Mobile app

The Expo app is built via EAS (GitHub Actions `mobile.yml` on `main`).  
Manual build:

```bash
cd apps/mobile
eas build --profile production --platform all
eas submit --platform all   # after build completes
```

---

## Rollback

```bash
# Roll back to a specific image tag (SHA from GHCR)
IMAGE_TAG=<previous-sha>
docker compose -f docker-compose.prod.yml \
  --env-file .env.production \
  up -d --no-deps api

# Or roll back to a git tag
git checkout v4-mobile-delivery-app
# then rebuild + restart
```

Render.com deployments: use the Render dashboard → "Rollback to previous deploy" (one click).

---

## Updating

```bash
git pull origin main
docker compose -f docker-compose.prod.yml pull
pnpm --filter @jewellery/api prisma migrate deploy
docker compose -f docker-compose.prod.yml up -d --no-deps api web
```

Zero-downtime: Docker Compose performs a rolling restart per service (one container at a time when `replicas > 1`).

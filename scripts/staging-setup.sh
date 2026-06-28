#!/usr/bin/env bash
# =============================================================================
# Staging Server Setup Script
# Run on a fresh Ubuntu 22.04 VPS as root.
# Usage: bash scripts/staging-setup.sh
# =============================================================================
set -euo pipefail

DOMAIN="${STAGING_DOMAIN:-staging.yourdomain.in}"
API_DOMAIN="${STAGING_API_DOMAIN:-api.staging.yourdomain.in}"
REPO="${REPO_URL:-https://github.com/your-org/jewellery-platform.git}"
APP_DIR="/opt/jewellery"

echo "=== [1/8] System packages ==="
apt-get update -qq
apt-get install -y -qq curl git certbot nginx

echo "=== [2/8] Docker ==="
if ! command -v docker &>/dev/null; then
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker
fi

echo "=== [3/8] Node 20 + pnpm ==="
if ! command -v node &>/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
npm install -g pnpm@10

echo "=== [4/8] Clone / pull repo ==="
if [ -d "$APP_DIR" ]; then
  git -C "$APP_DIR" pull origin main
else
  git clone "$REPO" "$APP_DIR"
fi
cd "$APP_DIR"

echo "=== [5/8] Secrets ==="
if [ ! -f .env.staging ]; then
  echo "ERROR: .env.staging not found. Copy .env.staging.example and fill all values."
  exit 1
fi
echo ".env.staging found."

echo "=== [6/8] TLS certificates ==="
if [ ! -d "/etc/letsencrypt/live/$DOMAIN" ]; then
  certbot certonly --standalone --non-interactive --agree-tos \
    -m "admin@yourdomain.in" \
    -d "$DOMAIN" -d "www.$DOMAIN" -d "$API_DOMAIN"
else
  echo "Certificates already exist, skipping."
fi

echo "=== [7/8] Database migrations ==="
pnpm --filter @jewellery/api prisma migrate deploy

echo "=== [8/8] Start containers ==="
docker compose -f docker-compose.prod.yml --env-file .env.staging up -d

echo ""
echo "=== Health checks ==="
sleep 10
curl -sf "https://$API_DOMAIN/api/v1/health/live"  && echo "  live ✓"
curl -sf "https://$API_DOMAIN/api/v1/health/ready" && echo "  ready ✓"
curl -sf "https://$DOMAIN" -o /dev/null             && echo "  web ✓"

echo ""
echo "Staging setup complete."
echo "  API:  https://$API_DOMAIN"
echo "  Web:  https://$DOMAIN"
echo ""
echo "Next: run staging validation suite:"
echo "  API_BASE=https://$API_DOMAIN/api/v1 WEB_BASE=https://$DOMAIN \\"
echo "    node tests/staging-validate.mjs"

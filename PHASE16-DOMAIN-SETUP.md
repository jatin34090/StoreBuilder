# Phase 16 — Domain Setup Guide

## Status: DOCUMENTED (DNS/SSL steps require infrastructure access)

---

## 1. Platform Domain (yourdomain.in)

### DNS Records
```
yourdomain.in.         A      <server-IP>
www.yourdomain.in.     CNAME  yourdomain.in.
api.yourdomain.in.     A      <server-IP>
*.yourdomain.in.       A      <server-IP>   ← wildcard for tenant subdomains
```

### SSL Certificate
Obtain a wildcard cert covering `yourdomain.in` and `*.yourdomain.in`:
```bash
certbot certonly \
  --dns-cloudflare \
  --dns-cloudflare-credentials /etc/cloudflare.ini \
  -d "yourdomain.in" \
  -d "*.yourdomain.in"
```
Certificate paths used in Nginx:
- `ssl_certificate /etc/letsencrypt/live/yourdomain.in/fullchain.pem`
- `ssl_certificate_key /etc/letsencrypt/live/yourdomain.in/privkey.pem`

Auto-renewal via cron:
```bash
0 12 * * * /usr/bin/certbot renew --quiet && nginx -s reload
```

---

## 2. Tenant Platform Subdomain

When a store is provisioned, a `StoreDomain` record is created automatically:
- `domain`: `{slug}.yourdomain.in`
- `type`: `PLATFORM_SUBDOMAIN`
- `status`: `ACTIVE`
- `isPrimary`: `true`

The wildcard cert and Nginx wildcard server_name handle these automatically — no per-store cert needed.

**Required env var:**
```
PLATFORM_DOMAIN=yourdomain.in
```

---

## 3. Custom Domain Flow (store owner)

### Step 1: Store owner adds domain in dashboard
`POST /api/v1/admin/store/domains` with `{ domain: "shop.mybrand.com" }`

The API:
- Validates domain format
- Checks reserved subdomains
- Generates `sv_<48-hex>` TXT verification token
- Creates `StoreDomain` record with `status: PENDING`
- Returns verification instructions

### Step 2: Store owner creates DNS records
Two records required:
```
Type: TXT
Name: _store-verification.shop.mybrand.com
Value: sv_<token>

Type: CNAME (for proxying through Cloudflare) or A (direct)
Name: shop.mybrand.com
Value: yourdomain.in  (or <server-IP>)
```

### Step 3: Verification
`POST /api/v1/admin/store/domains/:id/verify`

The API:
- Performs server-side DNS TXT lookup on `_store-verification.shop.mybrand.com`
- Compares TXT record value against stored token
- On match: sets `status: ACTIVE`, `verifiedAt: now()`
- DNS propagation typically takes 5–60 minutes

### Step 4: Set as primary
`PATCH /api/v1/admin/store/domains/:id/primary`

The API:
- Validates domain is ACTIVE
- Unsets all other primary flags in a transaction
- Sets this domain as `isPrimary: true`
- Invalidates domain cache in Redis

### Step 5: SSL for custom domain
Per-domain SSL cannot be handled by the platform wildcard cert.

Options:
1. **Cloudflare proxy** (recommended): Store owner proxies `shop.mybrand.com` through Cloudflare → SSL is handled by Cloudflare's edge. No server-side cert needed.
2. **Cert-manager** (Kubernetes): Automatically provisions Let's Encrypt certs per custom domain.
3. **Caddy**: Automatic HTTPS with HTTP Challenge — add a Caddy reverse proxy layer.

Current Nginx config: Custom domain SSL provisioning is **INFRASTRUCTURE PENDING**. See the commented template at the bottom of `infra/nginx/conf.d/jewellery.conf`.

---

## 4. Domain Resolution Priority

When a request arrives, the Next.js middleware resolves the store in this order:

1. **Platform subdomain**: `mybrand.yourdomain.in` → `parseHostname()` returns slug → API lookup by slug
2. **Custom domain**: `shop.mybrand.com` → API lookup by domain (via `StoreDomain` ACTIVE records)
3. **Path-based (dev only)**: `localhost:3000/store/mybrand` → slug from path

In production, only 1 and 2 are active. Path-based routing is blocked by the `isLocalhost` check.

---

## 5. API Domain Resolution

The `TenantMiddleware` in the NestJS API resolves the store independently:

```
x-store-id header (set by Next.js) → TenantService.resolveById()
x-store-slug header (set by admin axios) → TenantService.resolveBySlug()
Host: shop.mybrand.com → TenantService.resolveByDomain() → StoreDomain lookup
Host: mybrand.yourdomain.in → slug extraction → TenantService.resolveBySlug()
```

Custom domain resolution: checks `StoreDomain` table for ACTIVE records, falls back to `Store.customDomain` field for backwards compatibility.

---

## 6. Domain Model

```prisma
model StoreDomain {
  id               String       @id @default(uuid())
  storeId          String
  domain           String       @unique
  normalizedDomain String       @unique
  type             DomainType   // PLATFORM_SUBDOMAIN | CUSTOM_DOMAIN
  status           DomainStatus // PENDING | VERIFIED | ACTIVE | FAILED | DISABLED
  isPrimary        Boolean      @default(false)
  verificationToken String?
  verifiedAt       DateTime?
  createdAt        DateTime     @default(now())
  updatedAt        DateTime     @updatedAt
  store            Store        @relation(...)
}
```

Constraints enforced by the service:
- Cannot remove a primary domain
- Cannot remove a PLATFORM_SUBDOMAIN type
- Cannot set unverified domain as primary
- Cannot have two primary domains (transaction ensures atomicity)
- One unique normalized domain per table (uniqueness constraint)

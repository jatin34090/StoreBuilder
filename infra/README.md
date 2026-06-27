# Production Infrastructure

Reverse proxy (Nginx) terminating TLS in front of the Web (Next.js) and API
(NestJS) containers.

```
            ┌─────────── 443 (TLS) ───────────┐
 client ──▶ │ nginx                            │
            │  yourdomain.in      → web:3000   │
            │  api.yourdomain.in  → api:3001   │  (+ WebSocket upgrade)
            └──────────────────────────────────┘
```

## Files

| File | Mount to |
|------|----------|
| `nginx/nginx.conf` | `/etc/nginx/nginx.conf` |
| `nginx/conf.d/jewellery.conf` | `/etc/nginx/conf.d/jewellery.conf` |
| `nginx/conf.d/proxy_common.conf` | `/etc/nginx/conf.d/proxy_common.conf` |

## Features

- **TLS 1.2/1.3** with OCSP stapling and session cache; HTTP→HTTPS redirect.
- **HTTP/2** on both vhosts.
- **gzip** compression (brotli ready if `ngx_brotli` is present).
- **Caching headers**: `/_next/static` → 1-year immutable; images/fonts → 30 days.
- **Rate limiting**: 20 r/s general API, 5 r/s on auth/OTP, connection caps.
- **WebSocket upgrade** for socket.io delivery tracking.
- **Security headers**: HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy.
- **Upload size**: `client_max_body_size 12m` for image uploads.
- **CORS** is enforced by the API (`CORS_ORIGINS`); nginx forwards the Origin only.

## SSL certificates (Let's Encrypt / certbot)

```bash
# Issue certs (webroot challenge served from /var/www/certbot)
certbot certonly --webroot -w /var/www/certbot \
  -d yourdomain.in -d www.yourdomain.in -d api.yourdomain.in

# Auto-renew (cron/systemd timer)
certbot renew --quiet && nginx -s reload
```

## Running with the stack

Add an `nginx` service to `docker-compose.prod.yml` (or run on the host):

```yaml
nginx:
  image: nginx:1.27-alpine
  restart: unless-stopped
  ports: ['80:80', '443:443']
  volumes:
    - ./infra/nginx/nginx.conf:/etc/nginx/nginx.conf:ro
    - ./infra/nginx/conf.d:/etc/nginx/conf.d:ro
    - ./certbot/conf:/etc/letsencrypt:ro
    - ./certbot/www:/var/www/certbot:ro
  depends_on: [web, api]
  networks: [jewellery]
```

Validate config before reload: `nginx -t`.

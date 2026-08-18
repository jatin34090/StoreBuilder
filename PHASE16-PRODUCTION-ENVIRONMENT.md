# Phase 16 — Production Environment Variables

## Status: DOCUMENTED

All variables are classified below. Never commit `.env.production` to git.

---

## Classification

| Symbol | Meaning |
|--------|---------|
| ✅ REQUIRED | Must be set or the app will fail to start |
| ⚠️ PROD-ONLY | Optional in dev, required in production |
| 🔵 OPTIONAL | Safe to leave unset; feature degrades gracefully |
| 🔧 DEV-ONLY | Never set in production |

---

## API (`apps/api/.env.production`)

### Database
| Variable | Classification | Notes |
|----------|---------------|-------|
| `DATABASE_URL` | ✅ REQUIRED | Postgres with `?sslmode=require&pgbouncer=true` |
| `DIRECT_URL` | ✅ REQUIRED | Direct connection for migrations (no pgbouncer) |

### App
| Variable | Classification | Notes |
|----------|---------------|-------|
| `NODE_ENV` | ✅ REQUIRED | Must be `production` |
| `PORT` | ✅ REQUIRED | API port (3001) |
| `WEB_URL` | ✅ REQUIRED | Used for OAuth redirect, email links |
| `API_URL` | ✅ REQUIRED | Public API URL for webhook registration |

### Security
| Variable | Classification | Notes |
|----------|---------------|-------|
| `JWT_ACCESS_SECRET` | ✅ REQUIRED | RS256 private key (base64 PEM) |
| `JWT_REFRESH_SECRET` | ✅ REQUIRED | RS256 private key for refresh tokens |
| `CORS_ORIGINS` | ⚠️ PROD-ONLY | Comma-separated origins, e.g. `https://yourdomain.in` |

### Platform / Domain
| Variable | Classification | Notes |
|----------|---------------|-------|
| `PLATFORM_DOMAIN` | ✅ REQUIRED | e.g. `yourdomain.in` — used for subdomain resolution and domain verification CNAME target |

### Redis
| Variable | Classification | Notes |
|----------|---------------|-------|
| `REDIS_URL` | ✅ REQUIRED | Redis connection string (TLS in production) |

### Payments (Razorpay)
| Variable | Classification | Notes |
|----------|---------------|-------|
| `RAZORPAY_KEY_ID` | ✅ REQUIRED | Razorpay live key ID |
| `RAZORPAY_KEY_SECRET` | ✅ REQUIRED | Razorpay live key secret — NEVER LOG |
| `RAZORPAY_WEBHOOK_SECRET` | ✅ REQUIRED | Billing webhook HMAC secret — NEVER LOG |
| `RAZORPAY_PLAN_ID_STARTER` | ⚠️ PROD-ONLY | Razorpay plan ID for STARTER plan |
| `RAZORPAY_PLAN_ID_PROFESSIONAL` | ⚠️ PROD-ONLY | Razorpay plan ID for PROFESSIONAL plan |
| `RAZORPAY_PLAN_ID_ENTERPRISE` | ⚠️ PROD-ONLY | Razorpay plan ID for ENTERPRISE plan |

### File Storage (Cloudinary)
| Variable | Classification | Notes |
|----------|---------------|-------|
| `CLOUDINARY_CLOUD_NAME` | ✅ REQUIRED | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | ✅ REQUIRED | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | ✅ REQUIRED | Cloudinary API secret — NEVER LOG |

### Messaging (OTP)
| Variable | Classification | Notes |
|----------|---------------|-------|
| `MSG91_AUTH_KEY` | ⚠️ PROD-ONLY | MSG91 API key. Without it, OTPs are logged to console (dev only) |
| `MSG91_TEMPLATE_ID` | ⚠️ PROD-ONLY | OTP SMS template ID |

### Email
| Variable | Classification | Notes |
|----------|---------------|-------|
| `RESEND_API_KEY` | ⚠️ PROD-ONLY | Resend API key for transactional email |
| `EMAIL_FROM` | ⚠️ PROD-ONLY | Sender address, e.g. `noreply@yourdomain.in` |

### Search
| Variable | Classification | Notes |
|----------|---------------|-------|
| `TYPESENSE_HOST` | 🔵 OPTIONAL | Typesense server host |
| `TYPESENSE_API_KEY` | 🔵 OPTIONAL | Typesense search-only API key |
| `TYPESENSE_ADMIN_KEY` | 🔵 OPTIONAL | Typesense admin key — NEVER LOG |

### Auth (OAuth)
| Variable | Classification | Notes |
|----------|---------------|-------|
| `GOOGLE_CLIENT_ID` | 🔵 OPTIONAL | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | 🔵 OPTIONAL | Google OAuth secret — NEVER LOG |

### Logistics
| Variable | Classification | Notes |
|----------|---------------|-------|
| `SHIPROCKET_EMAIL` | 🔵 OPTIONAL | Shiprocket account email |
| `SHIPROCKET_PASSWORD` | 🔵 OPTIONAL | Shiprocket password — NEVER LOG |
| `DELHIVERY_API_TOKEN` | 🔵 OPTIONAL | Delhivery API token — NEVER LOG |

### Observability
| Variable | Classification | Notes |
|----------|---------------|-------|
| `SENTRY_DSN` | 🔵 OPTIONAL | Sentry project DSN |

### Dev only (must NOT be set in production)
| Variable | Classification | Notes |
|----------|---------------|-------|
| `ADMIN_EMAIL` | 🔧 DEV-ONLY | Seed admin email — remove for production |
| `ADMIN_PASSWORD` | 🔧 DEV-ONLY | Seed admin password — NEVER in production |

---

## Web (`apps/web/.env.production`)

| Variable | Classification | Notes |
|----------|---------------|-------|
| `NEXT_PUBLIC_API_URL` | ✅ REQUIRED | Public API URL, e.g. `https://api.yourdomain.in/api/v1` |
| `NEXT_PUBLIC_WEB_URL` | ✅ REQUIRED | Platform root URL, e.g. `https://yourdomain.in` |
| `NEXT_PUBLIC_ROOT_DOMAIN` | ✅ REQUIRED | Root domain, e.g. `yourdomain.in` — used by `parseHostname()` |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | ⚠️ PROD-ONLY | Razorpay public key (safe to expose) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | 🔵 OPTIONAL | Web push VAPID public key |
| `SENTRY_DSN` | 🔵 OPTIONAL | Sentry DSN (server-side Next.js error tracking) |

---

## Security Rules

**Never log:**
- `password`, `JWT`, `access_token`, `refresh_token`
- `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`
- `CLOUDINARY_API_SECRET`
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`
- `GOOGLE_CLIENT_SECRET`
- `SHIPROCKET_PASSWORD`, `DELHIVERY_API_TOKEN`

**Never send to Sentry:**
- Any of the above
- Full request Authorization headers
- Authentication cookies
- Database connection strings

**Never commit to git:**
- `.env.production`
- `.env.local`
- Any file containing actual secret values

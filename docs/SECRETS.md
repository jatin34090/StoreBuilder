# Secrets & Environment Reference

Authoritative validation lives in `apps/api/src/config/config.schema.ts` (Joi).
The API **fails fast on boot** if a required variable is missing or malformed.

> ⚠️ **Security note — credential rotation required.**
> A previous commit of `.env.example` contained real Neon database credentials.
> Although the template is now sanitised, the old values remain in git history.
> **Rotate the Neon database password (and any other exposed secret) before
> going live.** Treat every value below as a secret managed by your platform's
> secret store — never commit real `.env` files.

## Environment files

| File | Purpose | Committed? |
|------|---------|------------|
| `.env.example` | Local dev template (placeholders) | ✅ |
| `.env.staging.example` | Staging template | ✅ |
| `.env.production.example` | Production template | ✅ |
| `.env`, `.env.*.local` | Real values | ❌ (gitignored) |
| `apps/web/.env.local` | Web public vars (`NEXT_PUBLIC_*`) | ❌ |
| `apps/mobile/.env` | Mobile public vars (`EXPO_PUBLIC_*`) | ❌ |

## API secrets

| Variable | Required (prod) | Source / Notes |
|----------|:---:|----------------|
| `DATABASE_URL` / `DIRECT_URL` | ✅ | Neon (pooled / unpooled). Direct URL used for migrations. |
| `REDIS_URL` | ✅ | Upstash or managed Redis. Optional in dev (in-memory fallback). |
| `JWT_PRIVATE_KEY` / `JWT_PUBLIC_KEY` | ✅ | RS256 keypair, base64-encoded. **Unique per environment.** |
| `JWT_ACCESS_EXPIRES_IN` / `JWT_REFRESH_EXPIRES_IN` | ➖ | Defaults `15m` / `30d`. |
| `RAZORPAY_KEY_ID` / `KEY_SECRET` / `WEBHOOK_SECRET` | ✅ | Razorpay dashboard. Use `rzp_live_*` in prod. |
| `CLOUDINARY_CLOUD_NAME` / `API_KEY` / `API_SECRET` | ✅ | Cloudinary console. |
| `MSG91_AUTH_KEY` / `TEMPLATE_ID_OTP` / `SENDER_ID` | ✅ | MSG91. Blank in dev → OTP logged to console. |
| `RESEND_API_KEY` / `FROM_EMAIL` / `FROM_NAME` | ✅ | Resend. Blank in dev → email logged. |
| `GOOGLE_CLIENT_ID` / `CLIENT_SECRET` / `CALLBACK_URL` | ➖ | Google Cloud OAuth. Strategy skipped when blank. |
| `TYPESENSE_HOST` / `PORT` / `PROTOCOL` / `API_KEY` | ✅ | Typesense Cloud or self-hosted. Blank → Postgres search fallback. |
| `SHIPROCKET_EMAIL` / `PASSWORD` / `PICKUP_PINCODE` | ✅ | Shiprocket. |
| `DELHIVERY_API_TOKEN` / `CLIENT_NAME` / `PICKUP_PINCODE` | ➖ | Delhivery (secondary courier). |
| `VAPID_PUBLIC_KEY` / `PRIVATE_KEY` / `SUBJECT` | ➖ | `npx web-push generate-vapid-keys`. Web push. |
| `SENTRY_DSN` | ➖ (recommended) | Sentry project DSN for error tracking. |
| `SUPABASE_URL` / `SERVICE_ROLE_KEY` | ➖ | Optional storage backend. |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | ✅ | Seed admin. Rotate password after first login. |
| `CORS_ORIGINS` | ✅ | Comma-separated allowed origins. No localhost in prod. |

## Web (`NEXT_PUBLIC_*`, inlined at build time)

| Variable | Notes |
|----------|-------|
| `NEXT_PUBLIC_API_URL` | e.g. `https://api.yourdomain.in/api/v1` |
| `NEXT_PUBLIC_WEB_URL` | Canonical site URL |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Public key id only (never the secret) |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | Public cloud name |

## Mobile (`EXPO_PUBLIC_*`)

| Variable | Notes |
|----------|-------|
| `EXPO_PUBLIC_API_URL` | LAN IP for devices; `10.0.2.2` for Android emulator |
| `EXPO_PUBLIC_EAS_PROJECT_ID` | From `app.json > extra.eas.projectId` (push notifications) |

## Generating keys

```bash
# JWT RS256 keypair (base64 single-line)
openssl genrsa -out private.pem 2048
openssl rsa -in private.pem -pubout -out public.pem
base64 -w0 private.pem   # → JWT_PRIVATE_KEY
base64 -w0 public.pem    # → JWT_PUBLIC_KEY

# VAPID
npx web-push generate-vapid-keys
```

## Rotation policy

- JWT keypair: rotate on suspected compromise; rolling refresh tokens limit blast radius.
- Razorpay / MSG91 / Resend / Cloudinary: rotate from each provider console; update the secret store; redeploy.
- Database: rotate the password in Neon, update `DATABASE_URL`/`DIRECT_URL`, redeploy.
- Never paste secrets into logs, issues, or commits.

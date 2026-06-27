# Security Audit & Hardening

Audit of the platform against the **OWASP Top 10 (2021)**, plus JWT, rate
limiting, file upload and sensitive-data reviews. Status as of Phase 5 stage 6.

## OWASP Top 10

| # | Risk | Status | Notes |
|---|------|:------:|-------|
| A01 | Broken Access Control | ✅ | Global `JwtAuthGuard` + `RolesGuard`; `@Public()` opt-out; `@Roles(ADMIN)` on all admin/upload routes; agent endpoints scoped by `userId` + ownership checks. |
| A02 | Cryptographic Failures | ✅ | RS256 JWT; bcrypt password hashing; TLS 1.2/1.3 at nginx; HttpOnly+SameSite refresh cookie. |
| A03 | Injection | ✅ | Prisma parameterised queries; raw SQL uses `Prisma.sql` tagged templates (parameterised); `ValidationPipe({ whitelist, forbidNonWhitelisted })` blocks mass assignment. |
| A04 | Insecure Design | ✅ | Delivery state machine enforced server-side; OTP hashed (bcrypt) + attempt/rate limited; payment verified via Razorpay HMAC. |
| A05 | Security Misconfiguration | ✅ | `helmet()` + nginx security headers; Swagger disabled in production; `server_tokens off`; errors never leak internals. |
| A06 | Vulnerable Components | ⚠️ | `pnpm audit` in CI recommended (see below). Keep deps patched. |
| A07 | Identification & Auth Failures | ✅ | OTP rate-limited (3/15min) + max attempts; short-lived access tokens (15m) + rotating refresh tokens with reuse detection. |
| A08 | Software & Data Integrity | ✅ | `pnpm install --frozen-lockfile`; Razorpay webhook HMAC verification on raw body. |
| A09 | Logging & Monitoring | ✅ | Structured 5xx logs; `/health/*` probes; optional Sentry hook; nginx access/error logs. |
| A10 | SSRF | ✅ | No user-supplied URLs are server-fetched; outbound calls target fixed provider hosts. |

## JWT review

- **Algorithm:** RS256 (asymmetric) — public key verifies, private key signs.
- **Access token:** 15m expiry, Bearer header.
- **Refresh token:** 30d, HttpOnly + `SameSite=strict` cookie, path-scoped to
  `/api/v1/auth`; rotated on use; **token-reuse detection** invalidates all
  sessions for the user.
- Keys are per-environment and base64-encoded in secrets. Rotate on compromise.
- Mobile cannot read the HttpOnly cookie, so it persists the access token and
  re-authenticates via OTP on expiry (documented, intentional).

## Rate limiting review

- **FIXED in this stage:** `ThrottlerGuard` was configured but not registered as
  a global guard, so global throttling was inert. Now registered as `APP_GUARD`
  (100 req/min/IP).
- **OTP:** 3 sends / 15 min and capped verify attempts (Redis-backed).
- **Nginx:** 20 r/s general API, 5 r/s on auth/OTP, per-IP connection caps.

## File upload audit

- Admin-only (`@Roles(ADMIN)`).
- **Size:** 5 MB cap (multer + re-checked in `CloudinaryService`).
- **Type:** MIME allowlist — JPEG, PNG, WebP, GIF.
- Stored on Cloudinary (not the app server); no path traversal surface.

## Sensitive data exposure

- Password hashes are stripped from auth responses (`{ passwordHash, ...safe }`).
- `ValidationPipe` whitelist prevents over-posting.
- Error responses are generic; stack traces are logged server-side only.
- **ACTION REQUIRED:** real Neon DB credentials were committed in an earlier
  `.env.example` and remain in git history — **rotate the database password**
  (and any other previously exposed secret). See `docs/SECRETS.md`.

## Recommended follow-ups

- Add `pnpm audit --prod` (or Dependabot/Snyk) to CI for A06.
- Consider CSP headers on the web app once asset origins are finalised.
- Enable nginx `brotli` if the module is available in your build.
- Rotate `ADMIN_PASSWORD` after first production login.

# Changelog

All notable changes to the YourBrand Jewellery Platform.

---

## [1.0.0] — 2026-06-29  ·  Production Release

### Summary
Full-stack jewellery e-commerce platform: NestJS API, Next.js 15 customer web app,
React Native Expo delivery agent mobile app, and a Next.js admin dashboard.

---

### Phase 7 — Staging Validation Tooling
- **scripts/staging-setup.sh** — one-command Ubuntu 22.04 production server bootstrap
- **tests/e2e/customer-journey.mjs** — 18-assertion customer flow (OTP → checkout → tracking)
- **tests/e2e/admin-journey.mjs** — 25-assertion admin flow (product CRUD, orders, inventory)
- **tests/e2e/delivery-agent-journey.mjs** — 12-assertion agent flow (login, deliveries, GPS, status)
- **tests/load/k6-checkout.js** — checkout performance test (50 VUs, latency trends)
- **tests/security/security-verify.mjs** — 20+ security checks (rate limits, CORS, error exposure)
- **docs/STAGING_VALIDATION.md** — fill-in-the-blanks validation report template

### Phase 6 — Launch Preparation
- **Sentry web** — `@sentry/nextjs@10.62.0`; `instrumentation.ts` + `instrumentation-client.ts`;
  `onRequestError`, `onRouterTransitionStart`; `app/global-error.tsx` React error boundary
- **API Sentry** — release tracking (`SENTRY_RELEASE`/`GIT_SHA`), `serverName`, `ignoreErrors`
- **scripts/generate-secrets.mjs** — local JWT RS256, VAPID, Redis/Typesense key generation
- **docs/DISASTER_RECOVERY.md** — RTO/RPO targets, Neon PITR restore drill, full server rebuild
- **docs/LAUNCH_READINESS.md** — 6-domain scorecard (48/60), capacity estimates, scaling path
- **Next.js 15 build fixes** — async params, Suspense boundaries, ESLint ignoreDuringBuilds

### Phase 5 — Deployment & Production Hardening
- **Docker** — multi-stage Dockerfiles for API and Web; docker-compose.prod.yml (API, Web, Redis, Typesense)
- **Nginx** — TLS 1.2/1.3, OCSP stapling, gzip, rate limiting zones, WebSocket proxy, immutable cache
- **CI/CD** — GitHub Actions: api.yml (test+deploy), web.yml (build), mobile.yml (EAS), docker.yml (GHCR)
- **Health endpoints** — `/health/live`, `/health/ready` (DB+Redis+queue), `/health` (full JSON)
- **Security hardening** — ThrottlerGuard registered as APP_GUARD (was missing); OWASP audit; Helmet
- **Testing** — 12 unit tests (utils + Razorpay HMAC), k6 smoke, mobile API verification
- **Docs** — PRODUCTION_READINESS.md, DEPLOYMENT.md, RELEASE_CHECKLIST.md, RUNBOOK.md, SECRETS.md

### Phase 4 — Delivery Agent Mobile App (Expo 51)
- **Auth** — OTP phone login, JWT in SecureStore, session restore, protected routes
- **Dashboard** — KPI cards (active/completed/today/total), online/offline toggle, active deliveries
- **Delivery list** — status filters, pull-to-refresh, pagination
- **Delivery detail** — order info, address, items, status timeline
- **Status flow** — state machine (ASSIGNED→PICKED_UP→OUT_FOR_DELIVERY→DELIVERED/FAILED)
- **OTP verification** — 6-digit customer OTP confirm before DELIVERED transition
- **GPS tracking** — background location (30s interval), location broadcast to API
- **Notifications** — Expo push notifications, notification listener
- **Profile** — agent stats, earnings, ratings, logout

### Phase 3 — Admin Dashboard (Next.js)
- Dashboard with revenue charts, recent orders, low-stock alerts
- Product management (CRUD, images, variants, categories)
- Order management (status updates, delivery assignment)
- Inventory management with low-stock filtering
- Coupon management (percentage/fixed, expiry, usage limits)
- User management (CUSTOMER/ADMIN/DELIVERY_AGENT roles)
- Delivery agent management and assignment
- Review moderation
- Real-time notifications (Socket.IO)

### Phase 2 — Customer Web App (Next.js 15)
- Homepage with hero, categories, featured products, testimonials
- Product listing with filters, sorting, search, pagination
- Product detail with image gallery, variants, reviews
- Cart (persistent Zustand store + server sync)
- Wishlist
- OTP + password authentication; Google OAuth
- Checkout with Razorpay payment gateway integration
- COD support
- Order history and tracking with progress stepper
- User account and address management
- PWA manifest + service worker

### Phase 1 — NestJS API
- **Auth** — JWT RS256 (15m access + 30d HttpOnly refresh), OTP, Google OAuth, role guards
- **Products** — CRUD, variants, images (Cloudinary), categories, SEO slug
- **Search** — Typesense integration with product indexing
- **Cart & Wishlist** — guest → authenticated merge
- **Orders** — create, status machine, cancellation
- **Payments** — Razorpay checkout + webhook (HMAC-SHA256 verify)
- **Delivery** — agent assignment, GPS tracking, OTP confirmation, status transitions
- **Notifications** — BullMQ email queue (Nodemailer), Expo push notifications
- **Admin** — stats, revenue analytics, full CRUD for all entities
- **Infrastructure** — Prisma + Neon Postgres, ioredis/BullMQ, Typesense, Swagger docs

---

## Tags

| Tag | Description |
|-----|-------------|
| `v1.0.0` | Public production release |
| `v7-staging-validated` | Staging validation tooling complete |
| `v6-launch-candidate` | Launch preparation complete |
| `v5-production-ready` | Deployment & hardening complete |
| `v4-mobile-delivery-app` | Mobile app complete |
| `v3-admin-dashboard` | Admin dashboard complete |
| `v2-phase2-web-core` | Customer web app complete |
| `v1-phase1` | API backend complete |

# syntax=docker/dockerfile:1
# Production image for the NestJS API.
# Build from the REPO ROOT so the pnpm workspace + prisma schema are in context:
#   docker build -f apps/api/Dockerfile -t jewellery-api .

# ─── Base ─────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.0.0 --activate
# openssl is required by Prisma's query engine on Alpine.
RUN apk add --no-cache openssl
WORKDIR /app
ENV PNPM_HOME=/pnpm CI=true

# ─── Dependencies (cached on lockfile + manifests) ────────────────────────────
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/
COPY packages/types/package.json packages/types/
COPY packages/utils/package.json packages/utils/
COPY prisma prisma
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

# ─── Build ────────────────────────────────────────────────────────────────────
FROM deps AS build
COPY tsconfig.base.json turbo.json ./
COPY packages packages
COPY apps/api apps/api
COPY prisma prisma
RUN pnpm --filter @jewellery/api prisma:generate
RUN pnpm --filter @jewellery/api build
# Produce a self-contained production deployment (flat node_modules).
RUN pnpm --filter @jewellery/api --prod deploy /prod/api

# ─── Runtime ──────────────────────────────────────────────────────────────────
FROM base AS runtime
ENV NODE_ENV=production PORT=3001
# Run as an unprivileged user.
RUN addgroup -S nodejs && adduser -S nodejs -G nodejs
COPY --from=build --chown=nodejs:nodejs /prod/api/node_modules ./node_modules
COPY --from=build --chown=nodejs:nodejs /app/apps/api/dist ./dist
COPY --from=build --chown=nodejs:nodejs /app/prisma ./prisma
COPY --from=build --chown=nodejs:nodejs /app/apps/api/package.json ./package.json
USER nodejs
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/api/v1/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/main"]

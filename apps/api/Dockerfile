# syntax=docker/dockerfile:1
# Production image for the NestJS API.
# Build from the REPO ROOT so the pnpm workspace + prisma schema are in context:
#   docker build -f apps/api/Dockerfile -t jewellery-api .

# ─── Base ─────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.0.0 --activate
RUN apk add --no-cache openssl python3 make g++
WORKDIR /app
ENV PNPM_HOME=/pnpm CI=true

# ─── Dependencies ─────────────────────────────────────────────────────────────
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
RUN pnpm --filter @jewellery/types --filter @jewellery/utils build
RUN pnpm --filter @jewellery/api prisma:generate
RUN pnpm --filter @jewellery/api build

# ─── Runtime ──────────────────────────────────────────────────────────────────
FROM base AS runtime
ENV NODE_ENV=production PORT=3001

RUN addgroup -S nodejs && adduser -S nodejs -G nodejs

# Copy workspace manifests and lockfile so pnpm can install prod deps
COPY --chown=nodejs:nodejs package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY --chown=nodejs:nodejs apps/api/package.json apps/api/
COPY --chown=nodejs:nodejs packages/types/package.json packages/types/
COPY --chown=nodejs:nodejs packages/utils/package.json packages/utils/

# Install only production dependencies (skip prepare/husky which needs git)
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --prod --ignore-scripts && \
    pnpm rebuild bcrypt msgpackr-extract

# Generate Prisma client for the runtime environment
COPY --chown=nodejs:nodejs prisma ./prisma
RUN ./node_modules/.bin/prisma generate --schema=./prisma/schema.prisma

# Copy built artifacts
COPY --from=build --chown=nodejs:nodejs /app/apps/api/dist ./apps/api/dist
COPY --from=build --chown=nodejs:nodejs /app/prisma ./prisma
COPY --from=build --chown=nodejs:nodejs /app/packages/types/dist ./packages/types/dist
COPY --from=build --chown=nodejs:nodejs /app/packages/utils/dist ./packages/utils/dist

USER nodejs
WORKDIR /app/apps/api
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/api/v1/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/main"]

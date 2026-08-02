# ── BASE STAGE: SETUP & DEPS ───────────────────────────────────────────────
FROM node:22-alpine AS base
WORKDIR /app

# Copy lockfiles and package manifests for caching
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/

# Install dependencies for all workspaces
RUN npm ci

# ── BUILD STAGE ─────────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app

# Copy configuration and sources
COPY tsconfig.base.json ./
COPY packages/shared/ ./packages/shared/
COPY apps/api/ ./apps/api/
COPY apps/web/ ./apps/web/

# Build workspaces in order
RUN npm run build -w packages/shared
RUN npm run build -w apps/api
RUN npm run build -w apps/web

# Prune dev dependencies for production runner
RUN npm prune --omit=dev

# ── API RUNNER STAGE ────────────────────────────────────────────────────────
FROM node:22-alpine AS api-runner
WORKDIR /app
ENV NODE_ENV=production

# Copy node_modules and built dependencies
COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/
COPY --from=builder /app/apps/api/migrations ./apps/api/migrations

EXPOSE 4000
CMD ["sh", "-c", "npm run db:migrate:prod -w apps/api && npm run start -w apps/api"]

# ── WEB RUNNER STAGE ────────────────────────────────────────────────────────
FROM node:22-alpine AS web-runner
WORKDIR /app
ENV NODE_ENV=production

# Copy node_modules and built dependencies
COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/apps/web/package.json ./apps/web/
COPY --from=builder /app/apps/web/.next ./apps/web/.next
COPY --from=builder /app/apps/web/public ./apps/web/public

EXPOSE 3000
CMD ["npm", "run", "start", "-w", "apps/web"]

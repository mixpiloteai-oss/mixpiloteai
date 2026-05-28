# ============================================================
# NEUROTEK AI — Backend Dockerfile (production multi-stage)
# ============================================================
# Stage 1: Build — installs all deps, compiles TypeScript
# Stage 2: Runtime — copies only compiled output + prod deps
#           Runs as non-root (node) user for security
# ============================================================

# ── Stage 1: Build ────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Copy manifests first for layer cache efficiency
COPY package*.json ./
RUN npm ci --include=dev

COPY . .
RUN npm run build

# ── Stage 2: Runtime ──────────────────────────────────────────
FROM node:22-alpine AS runtime

# Install dumb-init for proper signal handling (PID 1)
RUN apk add --no-cache dumb-init

WORKDIR /app

# Non-root user (node user ships with the official image)
USER node

# Copy compiled output + production deps only
COPY --chown=node:node package*.json ./
RUN npm ci --omit=dev --ignore-scripts

COPY --chown=node:node --from=builder /app/dist ./dist

# Environment
ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

# Healthcheck — /health returns 200 in < 3 seconds
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:8080/health || exit 1

# dumb-init wraps node so SIGTERM is forwarded correctly
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]

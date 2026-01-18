# ContextOS Server
# Production multi-stage Dockerfile

# ===== Build Stage =====
FROM node:20-alpine AS builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@8

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/core/package.json packages/core/
COPY packages/cli/package.json packages/cli/
COPY packages/mcp/package.json packages/mcp/
COPY packages/cloud/package.json packages/cloud/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source
COPY . .

# Build all packages
RUN pnpm build

# ===== Production Stage =====
FROM node:20-alpine AS runner

WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 contextos && \
    adduser --system --uid 1001 contextos

# Install pnpm for global CLI
RUN npm install -g pnpm@8

# Copy built artifacts
COPY --from=builder --chown=contextos:contextos /app/packages/core/dist ./packages/core/dist
COPY --from=builder --chown=contextos:contextos /app/packages/core/package.json ./packages/core/
COPY --from=builder --chown=contextos:contextos /app/packages/cli/dist ./packages/cli/dist
COPY --from=builder --chown=contextos:contextos /app/packages/cli/package.json ./packages/cli/
COPY --from=builder --chown=contextos:contextos /app/packages/mcp/dist ./packages/mcp/dist
COPY --from=builder --chown=contextos:contextos /app/packages/mcp/package.json ./packages/mcp/
COPY --from=builder --chown=contextos:contextos /app/packages/cloud/dist ./packages/cloud/dist
COPY --from=builder --chown=contextos:contextos /app/packages/cloud/package.json ./packages/cloud/
COPY --from=builder --chown=contextos:contextos /app/node_modules ./node_modules
COPY --from=builder --chown=contextos:contextos /app/package.json ./
COPY --from=builder --chown=contextos:contextos /app/pnpm-workspace.yaml ./

# Create data directory
RUN mkdir -p /data && chown contextos:contextos /data

USER contextos

# Environment
ENV NODE_ENV=production
ENV PORT=3100
ENV HOST=0.0.0.0
ENV DATA_DIR=/data

# Expose ports
EXPOSE 3100

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3100/health || exit 1

# Default command - run cloud server
CMD ["node", "packages/cloud/dist/server.js"]

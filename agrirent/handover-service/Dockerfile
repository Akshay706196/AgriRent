# Multi-stage Dockerfile for AgriRent Handover, Return & Late-Fine Service
# Stage 1: Build & Dependencies
FROM node:24-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci --only=production

# Stage 2: Production Non-Root Runner
FROM node:24-alpine AS runner

WORKDIR /usr/src/app

ENV NODE_ENV=production
ENV PORT=4005

# Create data directory for SQLite with non-root ownership
RUN mkdir -p /usr/src/app/data && chown -R node:node /usr/src/app

COPY --chown=node:node --from=builder /usr/src/app/node_modules ./node_modules
COPY --chown=node:node . .

# Switch to non-root user
USER node

EXPOSE 4005

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4005/health', (res) => res.statusCode === 200 ? process.exit(0) : process.exit(1)).on('error', () => process.exit(1))"

CMD ["node", "src/server.js"]

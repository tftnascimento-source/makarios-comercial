# ─── Stage 1: deps ───────────────────────────────────────────────────────────
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ─── Stage 2: builder ─────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build-time env vars (not secrets — only NEXT_PUBLIC_* is embedded in JS)
ARG NEXT_PUBLIC_APP_URL=https://comercial.makarios.com.br
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL

# These are needed so env.ts doesn't throw at build time (Next.js
# evaluates server modules during static page generation).
# Use placeholder values here; real secrets come at runtime.
ENV DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder
ENV REDIS_URL=redis://:placeholder@localhost:6379
ENV JWT_SECRET=placeholder-build-time-secret-minimum-32-chars
ENV AUTH_SECRET=placeholder-build-time-secret-minimum-32-chars
ENV NODE_ENV=production

RUN npm run build

# ─── Stage 3: runner ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Non-root user for least-privilege
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

# Copy standalone output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]

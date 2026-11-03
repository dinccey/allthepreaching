# syntax=docker/dockerfile:1
# Frontend Dockerfile — Next.js 16 + React 19 + Tailwind CSS 4
#
# Built from the MONOREPO ROOT context, because package-lock.json lives at the
# root: the previous `context: ./fe` layout had no lockfile in reach, so the
# deps stage fell through to a bare `npm install` and every image was built
# from whatever the registry happened to serve that day.
#
#   docker build -f fe/Dockerfile \
#     --build-arg NEXT_PUBLIC_API_URL=https://api.allthepreaching.com \
#     --build-arg NEXT_PUBLIC_SITE_URL=https://allthepreaching.com \
#     -t atp-frontend:local .
#
# docker compose and .github/workflows/ci.yml already pass `context: .`.

# Node 26 is the active LTS ("Lithium", since 2026-10-28; EOL 2029-04-30).
# Node 24 ("Krypton") dropped to maintenance-only on 2026-10-20.
# Override for a one-off: --build-arg NODE_VERSION=24
ARG NODE_VERSION=26

FROM node:${NODE_VERSION}-alpine AS base
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

# ---- dependencies: pinned by package-lock.json ----
FROM base AS deps
COPY package.json package-lock.json ./
COPY fe/package.json ./fe/
COPY be/package.json ./be/
RUN npm ci

# ---- build ----
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY fe ./fe

ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL

RUN npm run build --workspace fe

# ---- production image ----
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

# `output: 'standalone'` in a workspace emits the monorepo layout:
# the traced tree is rooted at the workspace root, so the server lands in
# ./fe/server.js and the hoisted dependencies in ./node_modules.
COPY --from=builder --chown=nextjs:nodejs /app/fe/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/fe/.next/static ./fe/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/fe/public ./fe/public

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Checks "/" (a prerendered page) rather than /api/health: the API route proxies
# to the backend, and an unhealthy FE is not the same fact as a down API.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD node -e "require('http').get('http://127.0.0.1:3000/', (r) => { process.exit(r.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

CMD ["node", "fe/server.js"]

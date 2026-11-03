# syntax=docker/dockerfile:1
# Backend Dockerfile — Express 4 API (Postgres + MySQL clients)
#
# Built from the MONOREPO ROOT context so `npm ci` can see package-lock.json
# (see the note in fe/Dockerfile for why the old ./be context could not).
#
#   docker build -f be/Dockerfile -t atp-backend:local .

# Node 26 = active LTS ("Lithium", since 2026-10-28, EOL 2029-04-30).
# Node 24 = maintenance-only since 2026-10-20.
ARG NODE_VERSION=26

# ---- dependencies: production only, pinned, no dependency lifecycle scripts ----
FROM node:${NODE_VERSION}-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY fe/package.json ./fe/
COPY be/package.json ./be/
# --omit=dev keeps jest/nodemon/supertest out of the shipped image: the old
# build installed them and ran as root, so every dev-only advisory in the
# lock became reachable from production.
# --ignore-scripts: express, pg and mysql2 are pure JS and need no install hooks.
RUN npm ci --omit=dev --ignore-scripts --workspace be

# ---- production image ----
FROM node:${NODE_VERSION}-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=deps --chown=node:node /app/node_modules ./node_modules
# be/data/bible ships (bibleService.js reads it at runtime);
# be/data/scripture-video is excluded by .dockerignore (2.3 GB, offline renders only).
COPY --chown=node:node be ./be

WORKDIR /app/be

USER node

EXPOSE 3001

# Concatenation instead of a `${}` template literal: Dockerfile instructions
# undergo build-time variable expansion, and while the odd characters here mean
# it is left alone in practice, avoiding the syntax removes the ambiguity.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD ["node", "-e", "require('http').get('http://127.0.0.1/'+(process.env.PORT||3001)+'/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"]

CMD ["node", "server.js"]

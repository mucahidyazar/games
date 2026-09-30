# syntax=docker/dockerfile:1
#
# One image for the games portal or a standalone game: the API also serves the built site.
#
#   docker build -t mucahid-games .
#   docker build --build-arg VITE_SITE=traptheorb -t trap-the-orb .
#   docker run -p 3102:3102 --env-file .env.production mucahid-games
#
# NODE_ENV=production is set here; the env file must provide DATABASE_URL,
# BETTER_AUTH_SECRET and BETTER_AUTH_URL (see apps/api/README.md).

ARG NODE_VERSION=24

# ------------------------------------------------------------------ build
FROM node:${NODE_VERSION}-alpine AS builder
WORKDIR /repo
RUN corepack enable

# Dependencies first, so this layer stays cached until a manifest or the lockfile changes.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/contract/package.json packages/contract/
COPY packages/trap-the-orb-engine/package.json packages/trap-the-orb-engine/
RUN pnpm install --frozen-lockfile

COPY . .

# Public, build-time settings of the site: Vite embeds VITE_* values in the JavaScript bundle.
ARG VITE_SITE=portal
ARG VITE_SITE_URL=
ARG VITE_CONTACT_EMAIL=
ARG VITE_GTM_ID=
ARG VITE_GA_ID=
ARG VITE_ADSENSE_CLIENT=
ARG VITE_ADSENSE_SLOT_SIDEBAR=
ARG VITE_ADSENSE_ENABLED=false
RUN pnpm --filter web build \
 && pnpm --filter api build

# ------------------------------------------------------------------ runtime
FROM node:${NODE_VERSION}-alpine AS runtime

ENV NODE_ENV=production \
    API_PORT=3102 \
    STATIC_DIR=/app/web

WORKDIR /app/api
# The API bundle inlines every dependency, so no node_modules are needed.
COPY --from=builder --chown=node:node /repo/apps/api/dist ./dist
COPY --from=builder --chown=node:node /repo/apps/api/drizzle ./drizzle
COPY --from=builder --chown=node:node /repo/apps/web/dist /app/web

USER node
EXPOSE 3102

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.API_PORT || 3102) + '/api/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"

# Pending migrations are applied on start (set DB_MIGRATE=off to run `node dist/migrate.js` yourself).
CMD ["node", "dist/server.js"]

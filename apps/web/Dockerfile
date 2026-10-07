# Build context is the repo root: docker build -f apps/web/Dockerfile .
FROM node:24-slim AS base
# Corepack reads the pinned pnpm version from the root package.json; the env var
# stops it from asking for confirmation before downloading pnpm in a CI build.
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable

FROM base AS build
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile
# Web imports core types only, but build core first so type resolution cannot fail.
RUN pnpm --filter @alihdrndm/roomlist-core build \
 && pnpm --filter web build
RUN pnpm --filter web deploy --prod /out
# deploy copies only files that npm would publish; make sure the build output is there.
RUN test -d /out/.next || cp -r apps/web/.next /out/.next
RUN test -d /out/public || cp -r apps/web/public /out/public
RUN test -f /out/next.config.ts || cp apps/web/next.config.ts /out/next.config.ts

FROM node:24-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
# API_BASE_URL and API_KEY are read at runtime (apps/web/src/env.ts), not baked in.
COPY --from=build --chown=node:node /out ./
USER node
EXPOSE 3010
# node:24-slim has no curl; Node's built-in fetch does the probe.
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3010/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "node_modules/next/dist/bin/next", "start", "--port", "3010"]

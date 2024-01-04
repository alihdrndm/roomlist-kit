# Build context is the repo root: docker build -f apps/api/Dockerfile .
FROM node:24-slim AS base
# Corepack reads the pinned pnpm version from the root package.json; the env var
# stops it from asking for confirmation before downloading pnpm in a CI build.
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable

FROM base AS build
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile
# The API build resolves the core package through its dist folder.
RUN pnpm --filter @alihdrndm/roomlist-core build \
 && pnpm --filter api build
# Production-only node_modules for the API, with core copied in as a real package.
RUN pnpm --filter api deploy --prod /out
# api has no "files" field and dist is gitignored, so add the build output explicitly.
RUN test -d /out/dist || cp -r apps/api/dist /out/dist
# Fail the image build here, not at container start, if core's dist is missing.
RUN test -d /out/node_modules/@alihdrndm/roomlist-core/dist

FROM node:24-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=4010
COPY --from=build --chown=node:node /out ./
# Run as the unprivileged user that the base image already provides.
USER node
EXPOSE 4010
# node:24-slim has no curl; Node's built-in fetch does the probe.
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4010/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/main.js"]

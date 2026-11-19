# syntax=docker/dockerfile:1
FROM node:24-alpine AS base
ENV PNPM_HOME=/pnpm
RUN apk add --no-cache openssl && corepack enable
WORKDIR /repo

FROM base AS prune
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm dlx turbo@2.11.12 prune api --docker

FROM base AS install
COPY --from=prune /repo/out/json/ .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --prod
COPY --from=prune /repo/out/full/ .
RUN cd apps/api && ./node_modules/.bin/prisma generate

FROM node:24-alpine AS runtime
RUN apk add --no-cache openssl
ENV NODE_ENV=production
WORKDIR /repo
COPY --from=install /repo /repo
WORKDIR /repo/apps/api
USER node
EXPOSE 3333
HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${APPLICATION_PORT:-3333}/api/health >/dev/null || exit 1
ENTRYPOINT ["sh", "./docker-entrypoint.sh"]

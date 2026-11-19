# syntax=docker/dockerfile:1
FROM node:24-alpine AS base
ENV PNPM_HOME=/pnpm
RUN corepack enable
WORKDIR /repo

FROM base AS prune
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm dlx turbo@2.11.12 prune web --docker

FROM base AS build
COPY --from=prune /repo/out/json/ .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
COPY --from=prune /repo/out/full/ .
RUN pnpm --filter web build

FROM nginx:1.31-alpine AS runtime
ENV APPLICATION_API_URL=http://iframe-name-api:3333 \
    APPLICATION_FRAME_ANCESTORS="https://*.chatplataforma.com.br" \
    APPLICATION_NGINX_RESOLVER=127.0.0.11
COPY apps/web/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/ >/dev/null || exit 1

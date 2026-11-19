# App para o Chat Plataforma

App exibido em iframe (384px) dentro do atendimento do Chat Plataforma.

```
apps/api        API REST em Fastify, Node 24 (TS nativo, sem build) + Prisma/MySQL, em Clean Architecture: core/ (contratos), infrastructure/ (use cases, repository, libs), presentation/ (routes, schemas, controllers), server/ (bootstrap, middlewares)
apps/web        React + Vite + InnovUI (@innovui/react) → estáticos servidos por nginx, que também faz proxy de /api/* para a API
packages/shared schemas zod e constantes compartilhados (contexto do iframe, envelope de resposta, headers, ticket)
```

Cada app vira um container separado; o domínio público é o do **web** (= `rootUrl` no Backstage).
O front é uma tela única: navegação entre telas em memória (`apps/web/src/lib/navigation.tsx`), a URL nunca muda.

## Rodando local (Node 24 + pnpm)

```bash
git init                                   # antes do install, para o Lefthook instalar os hooks
pnpm install
docker compose -f docker-compose.dev.yml up -d
pnpm --filter api db:migrate --name init   # primeira vez (comite prisma/migrations)
pnpm dev                                   # api :3333 + web :8080 (Vite faz proxy de /api)
CHATPLATAFORMA_TEST_API_KEY=<key de uma conta de teste> pnpm --filter api dev:install
# assina e envia o install como o Backstage (corpo plano, chave = value do campo) e imprime a URL que simula o iframe
```

Swagger: http://localhost:3333/api/docs · Guia para importar no Apidog: `docs/api/README.md` (regenerar: `pnpm --filter api openapi:schema > docs/api/openapi.json`) · Stack completa em containers: `docker compose -f docker-compose.dev.yml up -d` (cria a rede `app-net`), depois `docker compose -f apps/api/docker-compose.yml up -d --build` e `docker compose -f apps/web/docker-compose.yml up -d --build` (o web não publica porta no host, porque o Coolify não aceita `ports:`; para ver a tela localmente use `pnpm dev`)

## Cadastro no Backstage

- `rootUrl`: domínio público do container web, na raiz, **sem barra final** (até 100 caracteres). A plataforma concatena `{rootUrl}/api/...`.
- `credentialsSchema`: cole a saída de `pnpm --filter api credentials:schema` (formato `{ "fields": [...] }` do Backstage, não JSON Schema). O `value` de cada campo é a chave que o app recebe (o `label` é só exibição): **não renomeie um value no Backstage sem mudar `CREDENTIAL_FIELDS`**.
- `clientSecret`: gerado pelo Backstage ao criar o app (64 hex, aparece uma vez). Vai em `CHATPLATAFORMA_CLIENT_SECRET`. Rotacionar no Backstage invalida o antigo na hora: atualize a env do container no mesmo momento.

## Deploy (Coolify, um recurso por app)

| Recurso | Dockerfile | Env |
|---|---|---|
| web (domínio público) | `apps/web/Dockerfile` | `APPLICATION_API_URL`, `APPLICATION_FRAME_ANCESTORS` |
| api (rede interna) | `apps/api/Dockerfile` | `apps/api/.env.example` (inclui `AXIOM_TOKEN`/`AXIOM_DATASET`) |

Banco em produção: MySQL 8 do DBaaS (Magalu Cloud), acessível só pela VPC, com banco e usuário próprios do app (privilégios de DDL para o `prisma migrate deploy` que roda no start). `DATABASE_TLS=true` se o banco aceitar TLS; `DATABASE_POOL_SIZE` por réplica.

Build context = raiz do repo. Auto-deploy desligado: `.github/workflows/ci-cd.yml` roda só o que mudou (web e/ou api): lint, typecheck, testes, build e teste do docker compose; na `main`, se tudo passou, chama o webhook do Coolify só do app alterado. Secrets: `COOLIFY_TOKEN`, `COOLIFY_WEBHOOK_API`, `COOLIFY_WEBHOOK_WEB`.

# iframe-name

Base de iframe da Zappy Contabil (monorepo pnpm + Turborepo + Biome). Largura do iframe: **420px**.

Origem: branch `zappy` do repositório `iframe-base`. O texto `iframe-name` é o placeholder do nome do projeto (serviços e containers do compose, título do Swagger e da aba); o `scripts/scaffold.sh` da skill o troca pelo nome real.

## Estrutura

```
apps/api        API REST em Fastify, Node 24 (TS nativo, sem build) + Prisma/MySQL + ZDK (Zappy), em Clean Architecture: config/, core/ (contratos), infrastructure/ (libs, repository, use-cases), presentation/ (routes, schemas, controllers), server/ (bootstrap, middlewares, plugins, workers)
apps/web        React + Vite + Tailwind v4 + TanStack Query + InnovUI (@innovui/react) → estáticos servidos por nginx, que também faz proxy de /api/* para a API
packages/shared schemas zod e constantes compartilhados (contexto do iframe, headers, envelope de resposta, utilitários); o index.ts é o da Zappy, o resto vem de assets/common
```

- Contrato do iframe: só abre com `?tenantId=...&userId=...`; sem eles o app mostra "Acesso negado". O front manda `x-tenant-id` e `x-user-id` em toda chamada a `/api/app/*`; a API responde 400 se faltarem, 404 se o tenant não existe e 403 se está inativo.
- Navegação em memória (`apps/web/src/lib/navigation.tsx`): a URL nunca muda.
- ZDK: contrato em `apps/api/src/core/repository/zappy-client.interface.ts`, implementação em `infrastructure/libs/zappy/client.ts` (uma instância por tenant, via `ZappyClientFor`).
- Tenants: o model `Tenant` (`prisma/schema.prisma`) guarda a URL da instância e o token da Zappy **cifrado** (AES-256-GCM, `APPLICATION_ENCRYPTION_KEY`). O primeiro projeto roda `pnpm --filter api db:migrate --name init` e acrescenta os models dele.
- `docker-compose.dev.yml` (MySQL e Redis para desenvolvimento, cria a rede `app-net`), igual ao do Chat Plataforma. Não há compose de staging: o CI testa o `docker-compose.yml` de cada app.
- `docs/`: arquitetura, escopo, segurança e features. `.claude/agents`: `frontend`, `backend` e `qa`. `CLAUDE.md`: regras do projeto.
- `.github/workflows/ci-cd.yml`: CI/CD igual ao do Chat Plataforma (vem de `assets/common`): só o que mudou, lint, testes, build, teste do compose e deploy no Coolify só se tudo passar. Secrets: `COOLIFY_TOKEN`, `COOLIFY_WEBHOOK_API`, `COOLIFY_WEBHOOK_WEB`.

## Rotas prontas

Resposta de sucesso `{ "body": ... }`, erro `{ "error": { "message": "..." } }`. Swagger em `/api/docs`; guia para importar no Apidog em `docs/api/README.md`.

| Rota | Headers | Erros |
|---|---|---|
| `POST /api/tenants` `{ name, zappyUrl, zappyToken }` | `x-comhub-key` | 401 chave, 409 URL repetida, 422 dados ou token recusado, 502 instância fora do ar |
| `GET /api/tenants` | `x-comhub-key` | 401 |
| `PATCH /api/tenants/:tenantId` `{ active }` | `x-comhub-key` | 401, 404, 422 |
| `DELETE /api/tenants/:tenantId` | `x-comhub-key` | 401, 404 |
| `GET /api/app/connections` | `x-tenant-id`, `x-user-id` | 400, 403 inativo, 404 tenant, 502 |
| `GET /api/app/tickets/:ticketId` | `x-tenant-id`, `x-user-id` | 400, 403, 404 tenant ou atendimento, 422 id, 502 |
| `POST /api/app/client-logs` | `x-tenant-id`, `x-user-id` | 400, 403, 404, 422 |

`x-comhub-key` é o valor de `APPLICATION_X_COMHUB_KEY` (mín. 16 caracteres; o scaffold gera um em `apps/api/.env`). Não há login: quem opera o sistema usa a chave. O token do tenant nunca é devolvido nem logado.

Primeiro tenant (a API prova o token na instância antes de gravar; o `id` devolvido é o `tenantId` do iframe):

```bash
curl -X POST http://localhost:3333/api/tenants \
  -H "x-comhub-key: $(grep ^APPLICATION_X_COMHUB_KEY apps/api/.env | cut -d= -f2-)" \
  -H 'content-type: application/json' \
  -d '{"name":"<nome do cliente>","zappyUrl":"https://api-<empresa>.zapcontabil.chat","zappyToken":"<token de API>"}'
```

## Rodando local (Node 24 + pnpm)

```bash
git init                                   # antes do install, para o Lefthook instalar os hooks
cp apps/api/.env.example apps/api/.env     # preencha APPLICATION_ENCRYPTION_KEY (openssl rand -base64 32) e APPLICATION_X_COMHUB_KEY (openssl rand -hex 32); o scaffold já faz isso
pnpm install
docker compose -f docker-compose.dev.yml up -d
pnpm --filter api db:migrate --name init   # cria a tabela tenants
pnpm dev                                   # api :3333 + web :8080 (Vite faz proxy de /api)
```

Abra http://localhost:8080/?tenantId=1&userId=1. Swagger: http://localhost:3333/api/docs. Testes: `pnpm test`; tipos: `pnpm typecheck`; lint: `pnpm lint`.

Stack em containers: `docker compose -f docker-compose.dev.yml up -d` (cria a rede `app-net`), depois `docker compose -f apps/api/docker-compose.yml -f apps/api/docker-compose.ci.yml up -d --build` e o mesmo para `apps/web`. O web não publica porta no host (o Coolify não aceita `ports:`).

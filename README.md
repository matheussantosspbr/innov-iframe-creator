# innov-iframe-creator

Plugin do Claude Code com a skill **`innov-iframe-creator`**, que cria e migra iframes da Innov para duas plataformas diferentes:

| | Chat Plataforma | Zappy Contabil |
|---|---|---|
| Largura do iframe | 384px | 420px |
| Como o iframe abre | `accountId`, `agentId`, `ticketId`...; a plataforma provisiona o app por HMAC e chama o diagnóstico com JWT | `tenantId` e `userId`; login por projeto |
| API da plataforma | `api.chatplataforma.com.br` com `x-api-key` (cliente HTTP próprio) | ZDK |
| Template | `skills/innov-iframe-creator/assets/chat-plataforma/` | `skills/innov-iframe-creator/assets/zappy-contabil/` |
| Referências | `references/chat-plataforma/` | `references/zappy-contabil/` |

Os dois partem da mesma base: monorepo pnpm + Turborepo + Biome, Node 24, API Fastify em Clean Architecture (porta **3333**), Prisma + MySQL, web React + Vite com InnovUI e TanStack Query (porta **8080**), Axiom para logs, CI/CD no GitHub Actions e deploy no Coolify.

## Instalação

Este repositório é um plugin com marketplace próprio (`.claude-plugin/`). Para testar localmente, a partir de qualquer pasta:

```
claude --plugin-dir /caminho/para/innov-iframe-creator
```

Para instalar pelo marketplace (passos do Claude Code, ainda não testados com este repositório):

```
/plugin marketplace add matheussantosspbr/innov-iframe-creator
/plugin install innov@innov
```

Com o plugin carregado, a skill aparece como `/innov:innov-iframe-creator` (o nome pode variar conforme a versão do Claude Code; digite `/innov` para ver).

## Como usar

Rode a skill com o argumento `start`:

```
/innov:innov-iframe-creator start
```

Ela faz um questionário, uma pergunta por vez:

1. **Tipo:** Criação ou Migração.
2. **Plataforma:** em Criação, para qual plataforma é o iframe; em Migração, a direção (Zappy para Chat Plataforma, ou o contrário).
3. **Nome do iframe** (por exemplo `Pipedrive`). Dele saem o nome da pasta, os serviços do compose, o dataset do Axiom e os pacotes.
4. **Só em Migração:** o nome do repositório de origem (um, ou dois se for frontend e backend separados). A skill procura **no seu computador**, nunca na internet, e trata a origem como somente leitura.
5. **Serviços locais**, em caixas de seleção: MySQL, Redis de filas, Redis de cache. Só os marcados entram no `docker-compose.dev.yml`.

Depois ela gera o projeto com o `scripts/scaffold.sh`. Em Migração, ela segue um fluxo de engenharia reversa: levanta as regras de negócio da origem, monta a tabela de equivalências para a plataforma de destino, escreve a spec e executa em etapas com os agentes `backend`, `frontend` e `qa` do projeto gerado, que trabalham em paralelo quando as tarefas são independentes.

Sem o argumento `start`, a skill funciona como guia para criar ou evoluir um app já existente.

### Gerar um projeto sem o questionário

```
# Chat Plataforma (padrão)
bash skills/innov-iframe-creator/scripts/scaffold.sh <destino> <nome-kebab> ["Nome de exibição"]

# Zappy Contabil, só com MySQL e Redis de cache
PLATFORM=zappy-contabil SERVICES=mysql,redis-cache \
  bash skills/innov-iframe-creator/scripts/scaffold.sh <destino> <nome-kebab>
```

- `SERVICES` aceita `mysql`, `redis-queue` e `redis-cache`, separados por vírgula. Sem a variável entram os três; vazia, o projeto sai sem compose de dev.
- Com o nome `onvio`, os serviços e o dataset ficam `onvio-api`, `onvio-web` e `onvio` na Zappy, e `onvio-cp-api`, `onvio-cp-web` e `onvio-cp` no Chat Plataforma.

## O que tem no repositório

```
.claude-plugin/            plugin.json e marketplace.json
skills/innov-iframe-creator/
  SKILL.md                 instruções da skill (o questionário, a migração e as regras)
  scripts/scaffold.sh      gera o projeto a partir dos templates
  scripts/check-dependency.mjs   checagem de segurança antes de um pnpm add
  assets/
    common/                o que é igual nos dois templates (copiado primeiro)
    chat-plataforma/       template do Chat Plataforma
    zappy-contabil/        template da Zappy Contabil
  references/
    chat-plataforma/       contrato, arquitetura, stack, testes, banco, observabilidade...
    zappy-contabil/        ZDK: guia, métodos, modelos, erros, quirks e a versão 0.x
```

`assets/common/` guarda o que é idêntico nos dois: `CLAUDE.md` e `.claude/settings.json`, o workflow `.github/workflows/ci-cd.yml`, o `docker-compose.dev.yml` (com `docker/mysql-init`), `biome.json`, `turbo.json`, `lefthook.yml`, `pnpm-workspace.yaml` e o pacote `packages/shared` (`@app/shared`, com máscaras, validadores, consulta de CNPJ com fallback entre APIs, e os `biome` e `tsconfig` base). Mudou lá, mudou nas duas plataformas.

## O que cada projeto gerado traz

- `apps/api`: Fastify + Zod + Prisma, Clean Architecture (`config`, `core`, `infrastructure`, `presentation`, `server`), logs com Pino e Axiom, Swagger em `/api/docs`, e a documentação da API para o Apidog em `docs/api/` (gerada por `pnpm --filter api openapi:schema`).
  - **Chat Plataforma:** provisionamento (`/api/provision/*` com HMAC), diagnóstico com JWT, rota de exemplo de tickets e logs do front.
  - **Zappy:** tenants (`/api/tenants`, protegidas por `x-comhub-key`), rotas do iframe via ZDK (`/api/app/connections` e `/api/app/tickets/:ticketId`) e o middleware `tenant-context`. Não traz login nem rotas de negócio.
- `apps/web`: React + Vite + Tailwind v4 + InnovUI + TanStack Query, com navegação em memória e tratamento de erro. Servido por nginx na porta 8080, com `Content-Security-Policy: frame-ancestors` por plataforma.
- **CI/CD** (`.github/workflows/ci-cd.yml`): roda só o que mudou (web e/ou api): lint, typecheck, testes unitários e e2e, build e teste do docker compose. O deploy no Coolify só acontece em push na `main`, só do que mudou, e só se nada falhou. Com o GitHub App do Coolify, desligue o deploy automático. Secrets: `COOLIFY_TOKEN`, `COOLIFY_WEBHOOK_API`, `COOLIFY_WEBHOOK_WEB`.

## Regras da base

- **Variáveis de ambiente** sempre com prefixo de dono: `APPLICATION_` para o que é do app, e o nome do serviço para o resto (`DATABASE_`, `REDIS_`, `AXIOM_`, `CHATPLATAFORMA_`...). Exceções só das definidas por terceiros (`NODE_ENV`, `MYSQL_*`, `PNPM_HOME`, `VITE_*`). Cada app tem o seu `.env.example`.
- **Portas:** backend 3333, frontend 8080, nos dois templates.
- **Node 24** e pnpm 12. O pnpm 12 recusa versões publicadas há menos de 24 horas, então atualize dependências com `pnpm update -r --latest` e, se a instalação acusar a violação, baixe o pacote para a versão anterior.
- **Deploy:** nenhum compose usa `ports:` (o Coolify não aceita). A porta vem do `EXPOSE` do Dockerfile.

## Como alterar a skill

1. Edite o template em `assets/chat-plataforma/` ou `assets/zappy-contabil/`, ou o que for comum em `assets/common/`.
2. Gere um projeto de teste com o scaffold, e dentro dele rode `pnpm install --frozen-lockfile`, `pnpm exec biome check .` e `pnpm exec turbo run typecheck test`.
3. Mexeu em dependências? Gere de novo o `pnpm-lock.yaml` dos dois templates montando `assets/common` + template numa pasta e rodando `pnpm install --lockfile-only` com o lock antigo (veja `references/chat-plataforma/stack.md`).
4. Atualize `SKILL.md` e os `references` se o comportamento mudou.

## Limites conhecidos

- A skill e o `start` ainda não foram exercitados numa sessão real do Claude Code com o plugin instalado.
- A CI no GitHub e o deploy no Coolify não foram executados; o workflow só passou no `actionlint`.
- O template da Zappy não cobre webhooks, e a documentação do ZDK vem do pacote npm (a pasta `docs/` do repositório dele não foi lida).
- A importação no Apidog não foi testada; o `docs/api/README.md` de cada template marca esses passos como não verificados.

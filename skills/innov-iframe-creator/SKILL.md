---
name: innov-iframe-creator
description: Cria e migra iframes da Innov para duas plataformas diferentes: Chat Plataforma (iframe de 384px; rotas /api/provision/install|configure|uninstall com HMAC e /api/instances/:externalId/diagnostics com JWT; API api.chatplataforma.com.br por x-api-key) e Zappy Contabil (iframe de 420px, aberto com tenantId e userId, SDK ZDK). Os dois partem da mesma base: monorepo pnpm + Turborepo, Node 24, API Fastify em Clean Architecture (porta 3333), Prisma + MySQL, web React/Vite com InnovUI e TanStack Query (porta 8080), Biome, Axiom, CI/CD com deploy no Coolify. Use sempre que o usuário falar em app/aplicativo/integração/plugin/widget/painel lateral/iframe para o Chat Plataforma ou para a Zappy, em migrar um iframe de uma plataforma para a outra, ZDK, Backstage, rootUrl, credentialsSchema, accountId/ticketId, tenantId/userId, provisionamento, diagnóstico, webhooks da plataforma, ou em consumir a API do Chat Plataforma a partir de um app, mesmo sem dizer "skill". Com o argumento `start` (/innov-iframe-creator start), abre o questionário de criação ou migração.
---

# Innov Iframe Creator

Esta skill cria e migra iframes para **duas plataformas diferentes**. Não confunda:

| | Chat Plataforma | Zappy Contabil |
|---|---|---|
| Largura do iframe | 384px | 420px |
| Como abre | `accountId`, `agentId`, `ticketId`...; a plataforma provisiona o app por HMAC e chama o diagnóstico com JWT | `tenantId` e `userId`; login próprio |
| API da plataforma | `api.chatplataforma.com.br` com `x-api-key` (cliente HTTP próprio) | ZDK |
| Template | `assets/chat-plataforma/` | `assets/zappy-contabil/` |
| Referências | `references/chat-plataforma/` | `references/zappy-contabil/` |

O que é igual nos dois: monorepo `apps/web` (porta 8080) e `apps/api` (porta 3333), `packages/shared`, Clean Architecture, Node 24, CI/CD e deploy no Coolify. As seções abaixo sobre credentials, provisionamento, diagnóstico e a API da plataforma valem só para o **Chat Plataforma**.

## Chat Plataforma: como é um app

Um app do Chat Plataforma é **um serviço web com duas faces**:
1. **Tela no iframe** (largura fixa de 384px), aberta pelo atendente dentro de um ticket: `rootUrl?accountId=…&agentId=…&ticketId=…&ticketConnectionId=…[&contactId&ticketAgentId&ticketSectorId&ticketGroupId]`.
2. **API REST com contrato fixo**, chamada server-to-server pela plataforma em `{rootUrl}/api/...`: install, configure e uninstall (assinados com HMAC) e diagnostics (Bearer JWT). Tudo responde `{ "body": … }` ou `{ "error": { "message" } }`.

O elo entre as duas é o **`externalId`**: o app gera no install, a plataforma devolve no configure, uninstall e diagnostics e manda como **`accountId`** no iframe. Com ele o backend acha as credentials da organização.

O contrato e a API foram verificados **no código do backend do Chat Plataforma** (`chat-contabil-server`). A documentação pública diverge em pontos que quebram o app (corpo do install, formato do `credentialsSchema`, status aceitos, formato das respostas da API). Siga as referências desta skill, não a doc pública.

## Recursos desta skill

| Arquivo | Quando ler |
|---|---|
| `references/chat-plataforma/integration-contract.md` | Ao mexer em provisionamento, diagnóstico, `credentialsSchema`, parâmetros do iframe ou ciclo de vida da instalação. |
| `references/chat-plataforma/architecture.md` | Antes de criar ou mover arquivo na API: Clean Architecture (core, infrastructure, presentation, server), regras de import, como crescer, e os padrões de fila (BullMQ), idempotência e logs para automações. |
| `references/chat-plataforma/api/README.md` | Antes de consumir a API do Chat Plataforma: `x-api-key`, envelope `{ message, body }`, formatos de erro, rate limit, paginação, enums e pegadinhas. |
| `references/chat-plataforma/api/routes.md` | Para saber se um endpoint existe, o path exato (singular/plural) e a permissão RBAC. |
| `references/chat-plataforma/api/{tickets-messages,contacts-tags-groups,auth-agents-webhooks,apps-connections-organization}.md` | Detalhe de cada endpoint: body, validações, mensagens de erro, efeitos colaterais, webhooks. Use grep pelo path. |
| `references/chat-plataforma/stack.md` | Ao estender o template: Node 24/TS nativo, enumerados e imutabilidade (§2.1), feature de ponta a ponta, front (navegação, composição, TanStack Query, InnovUI), credenciais, Turbo/Biome/Lefthook, containers e CI/CD, mapa do código (§12), tabela de variáveis de ambiente (§13), incluindo `@app/shared/masks`, `@app/shared/validators` e `@app/shared/cnpj` (consulta de CNPJ com fallback entre APIs). |
| `references/chat-plataforma/database.md` | Antes de criar ou alterar model Prisma (snake_case, tipos e tamanhos, constraints nomeadas, FKs) e para o banco de produção no DBaaS. |
| `references/chat-plataforma/testing.md` | Antes de escrever testes: harness (`makeApp`, assinatura HMAC, token do diagnóstico), matchers de contrato, testes de use case e de arquitetura (`tests/unit`, `tests/e2e`, `tests/support`), Testing Library no web. |
| `references/chat-plataforma/realtime.md` | Antes de qualquer atualização "ao vivo" (refetch → polling → SSE → WebSocket) e para receber webhooks da plataforma. |
| `references/chat-plataforma/observability-and-integrations.md` | Axiom (já integrado), `requestId`, mensagens de erro para leigos; Resend (e-mail) e Langfuse self-host (IA) só quando necessário. |
| `references/chat-plataforma/dependencies.md` + `scripts/check-dependency.mjs <pacote> <dir>` | Antes de qualquer `pnpm add`: quando não usar lib e a checagem automática (deprecado, sem release, CVEs HIGH/CRITICAL, licença, postinstall, peers). |
| `references/zappy-contabil/zdk.md` | Ao trabalhar com a API da Zappy: guia do ZDK (SDK TypeScript), configuração, erros, rate limit e como os projetos o usam. Só a API; o contrato do iframe da Zappy ainda não está documentado. |
| `references/zappy-contabil/zdk-metodos.md` | Todos os métodos do ZDK 1.0 e as 48 operações da API: parâmetros, query, corpo e respostas. Use grep pelo método ou pelo path. |
| `references/zappy-contabil/zdk-modelos.md` | Os 47 modelos do contrato (campos, tipos, enums): `Ticket`, `Contact`, `Message`, `Connection`, `MessageTemplate`... |
| `references/zappy-contabil/zdk-tipos.md` | `ZdkOptions`, retry, rate limit, erros e tipos auxiliares, em trechos literais do pacote. |
| `references/zappy-contabil/zdk-quirks.md` | As 24 quirks (desvios do contrato corrigidos pelo ZDK), texto integral. |
| `references/zappy-contabil/zdk-0x.md` | ZDK 0.x (API antiga, ainda usada em vários projetos): diferenças para a 1.0 e os tipos. |
| `assets/common/` | O que é igual nos dois templates e o scaffold copia antes do template: `CLAUDE.md` (regras do projeto, subagentes e fluxo), `.claude/settings.json`, `.github/workflows/ci-cd.yml` e a action de setup, `docker-compose.dev.yml` (com `docker/mysql-init`), `biome.json`, `turbo.json`, `lefthook.yml`, `pnpm-workspace.yaml`, `.gitignore` e `packages/shared`. Mudou aqui, mudou nas duas plataformas. |
| `assets/common/packages/shared/` | `@app/shared` (biome, tsconfig, máscaras e validadores, `src/index.ts` genérico): **igual nos dois templates**. O scaffold copia `common` para o projeto antes do template, e o `src/index.ts` do template sobrescreve o genérico. Mudou aqui, mudou nas duas plataformas: rode os testes dos dois e gere de novo os dois `pnpm-lock.yaml`. |
| `assets/chat-plataforma/` | Template do Chat Plataforma: monorepo pronto e verificado (testes, lint, typecheck e build ok, API em Node 24 atrás do nginx contra MySQL 8 e MariaDB). Base de todo app novo do Chat Plataforma. |
| `assets/zappy-contabil/` | Template da Zappy Contabil: monorepo base (branch `zappy` do `iframe-base`): `apps/web` (frontend) e `apps/api` (backend), os mesmos nomes do template do Chat Plataforma, `packages/shared` (vem de `assets/common`), compose dev, CI, agentes, `docs/` e `CLAUDE.md`. Tem o mesmo código-base do Chat Plataforma (API em Clean Architecture e web com TanStack Query e InnovUI), adaptado à Zappy: iframe só abre com `tenantId` e `userId`, tela de acesso negado, model `Tenant` (token cifrado), rotas de operação `/api/tenants` protegidas por `x-comhub-key` (sem login), `tenant-context` que resolve o tenant e rotas do iframe via ZDK (`GET /api/app/connections` e `/api/app/tickets/:ticketId`, a rota de exemplo). O primeiro projeto acrescenta as rotas e os models dele. Largura do iframe: 420px. |
| `scripts/scaffold.sh <destino> <nome-kebab> ["Nome de exibição"]` | Copia o template, aplica o nome do projeto (pacote raiz, README, título da aba, Swagger, dataset do Axiom) e gera os `.env` de desenvolvimento (um por app) com segredos aleatórios. |

## Comando `start`

Se a skill for invocada com o argumento `start` (`/innov-iframe-creator start`), antes de qualquer outra coisa conduza este questionário com a ferramenta de perguntas, **uma pergunta por vez**, esperando a resposta de cada uma:

1. **Tipo de start:** Criação ou Migração.
2. **Se Criação:** para qual plataforma é o iframe, Zappy ou Chat Plataforma.
   **Se Migração:** qual a direção, Zappy para Chat Plataforma ou Chat Plataforma para Zappy.
3. **Nome do iframe** (resposta livre, ex.: Pipedrive). Pergunte em mensagem normal e espere.
4. **Só se Migração: o nome do repositório do projeto de origem** (o iframe que será migrado). Na direção **Zappy para Chat Plataforma** podem ser **dois repositórios**, o do frontend e o do backend: pergunte o nome dos dois e aceite um só se for monorepo. Na direção Chat Plataforma para Zappy costuma ser um só. **Procure o repositório no computador do usuário**, nunca na internet: os repositórios são privados, então não use `git clone`, `gh`, busca na web nem URL. Procure por nome de pasta (`find` com limite de profundidade, ignorando `node_modules` e `.git`) a partir de `/home/comhub/code`, começando por `work/zappy/` (projetos da Zappy; frontend e backend costumam ser `<nome>/client` e `<nome>/server`) e `work/chat-plataforma/`. Achou um só, confirme o caminho com o usuário; achou vários, mostre e pergunte qual; não achou, peça o caminho local. O repositório de origem é **somente leitura**: nunca altere nada nele.
5. **Só se Criação: serviços locais**, com a ferramenta de perguntas em **caixas de seleção** (várias respostas): **MySQL**, **Redis de filas** (BullMQ, `noeviction`) e **Redis de cache** (`allkeys-lru`). Só os marcados entram no `docker-compose.dev.yml` do projeto; os Redis desmarcados também ficam comentados no `apps/api/.env.example`. O template usa MySQL (instalações ou tenants): desmarcar o MySQL significa que o banco será externo e o `DATABASE_URL` aponta para ele; avise o usuário disso. Nenhum marcado: o projeto sai sem `docker-compose.dev.yml`.

Do nome, derive o **kebab** (minúsculas, sem acento, espaços viram hífen: "Conta Azul" vira `conta-azul`) e mostre-o ao usuário antes de criar. O nome vale em todo lugar que precisar dele:
- pasta do projeto: `./<kebab>` no diretório atual (ou onde o usuário indicar);
- pacote raiz, dataset do Axiom (`<kebab>` na Zappy e `<kebab>-cp` no Chat Plataforma, ex.: `onvio` e `onvio-cp`), README, título da aba e do Swagger (nome de exibição como digitado);
- serviços, redes e demais nomes dos compose: no template, onde o nome entra use o placeholder `iframe-name` (ex.: `iframe-name-api`), que o scaffold troca pelo kebab na **Zappy** (`onvio-api`, `onvio-web`) e por `<kebab>-cp` no **Chat Plataforma** (`onvio-cp-api`, `onvio-cp-web`). Ao criar arquivo novo no template que precise do nome, use esse placeholder.

O scaffold faz tudo isso: `SERVICES=<mysql,redis-queue,redis-cache conforme as caixas marcadas> bash <skill>/scripts/scaffold.sh <kebab> <kebab> "<Nome de exibição>"` (com `SERVICES=` vazio ele não cria o compose de dev; sem a variável, entram os três) (destino = pasta com o nome do iframe; `PLATFORM=zappy-contabil` escolhe o template da Zappy Contabil, o padrão é `chat-plataforma`).

O que fazer com as respostas:

| Respostas | Ação |
|---|---|
| Criação + Chat Plataforma | Siga o "Fluxo para um app novo" (o nome já foi respondido, não pergunte de novo). |
| Migração (qualquer direção) | Siga a seção "Migração de um iframe entre plataformas": template de destino, levantamento, engenharia reversa, spec e execução em paralelo pelos agentes. O nome e o(s) repositório(s) já foram respondidos, não pergunte de novo. |
| Criação + Zappy | Rode o scaffold com `PLATFORM=zappy-contabil` (base em `assets/zappy-contabil/`, iframe de 420px). O ZDK está documentado em `references/zappy-contabil/`, e o contrato do iframe da Zappy (parâmetros `tenantId` e `userId`) está nos `docs/` do template, que já traz tenants cifrados, rotas do iframe via ZDK e o middleware de chave de operação `x-comhub-key` (sem login): não use as regras de provisionamento do Chat Plataforma (HMAC, JWT da plataforma) para um iframe da Zappy. As portas são as mesmas nos dois templates (API 3333, web 8080). A implementação segue o fluxo dos agentes do `CLAUDE.md` do template. |

Sem argumento, ou com outro argumento, a skill se comporta normalmente.

## Migração de um iframe entre plataformas

Migrar é refazer, na plataforma de destino, o que o iframe de origem faz hoje, com a lógica revisada e refatorada. O objetivo é **paridade de comportamento**: nada que o iframe de origem fazia pode se perder sem decisão registrada. Direções: Zappy para Chat Plataforma (origem em 2 repositórios, frontend e backend, ou 1 monorepo) e Chat Plataforma para Zappy.

Documentos da migração ficam no projeto novo, em `docs/migracao/`. O repositório de origem fica **fora** dele e é só leitura.

1. **Template do destino.** Rode o scaffold com o nome já respondido: Zappy para Chat Plataforma usa `PLATFORM=chat-plataforma`; Chat Plataforma para Zappy usa `PLATFORM=zappy-contabil`. O projeto novo já vem com `.claude/agents` (`backend`, `frontend`, `qa`), o `CLAUDE.md` com o fluxo dos agentes e o plugin `agent-skills` (que traz a skill `spec-driven-development`) habilitado em `.claude/settings.json`.
2. **Levantamento da origem** (somente leitura) em `docs/migracao/01-levantamento.md`: stack, ponto de entrada, telas e fluxos do frontend, rotas e contratos do backend, modelo de dados, integrações externas (na Zappy, o ZDK; no Chat Plataforma, a API da plataforma), como o iframe identifica quem o abriu (Zappy: `tenantId` e `userId`; Chat Plataforma: `accountId`, `agentId`, `ticketId`...), autenticação, filas e jobs, variáveis de ambiente, **regras de negócio**, validações, casos de borda e mensagens de erro, e a **cor principal do sistema de origem** (veja "Cor da marca" abaixo). Com dois repositórios, leia frontend e backend em paralelo com subagentes de leitura (Explore) e junte o resultado. Dúvida sobre o que o código faz: leia o código, não suponha.
3. **Engenharia reversa** em `docs/migracao/02-equivalencias.md`: uma tabela, capacidade da origem para como ela é feita no destino. Consulte o contrato do destino (Chat Plataforma: `references/chat-plataforma/integration-contract.md` e `references/chat-plataforma/api/`; Zappy: `references/zappy-contabil/` e os `docs/` do template). O que não tem equivalente no destino fica marcado e vai para o usuário decidir.
4. **Spec** com a skill `spec-driven-development` em `docs/migracao/SPEC.md`: objetivo, escopo, requisitos e critérios de aceite por feature, cada item classificado como **manter**, **melhorar** ou **descartar**, com o motivo. **Mostre a spec ao usuário e espere a aprovação** antes de implementar.
5. **Etapas** em `docs/migracao/03-tarefas.md`: quebre a spec em tarefas pequenas e verificáveis (uma feature de ponta a ponta, backend e frontend separados), marcando dependências e o que pode rodar em paralelo.
6. **Execução pelos agentes do projeto novo**, seguindo o `CLAUDE.md` dele:
   - Tarefas independentes de backend e frontend rodam **em paralelo** (várias chamadas de agente na mesma mensagem); o que depende de contrato roda depois: o `backend` entrega o contrato dos endpoints, o `frontend` consome.
   - O `qa` valida cada entrega e registra testes de caracterização do comportamento da origem; reprovou, o bug volta ao agente responsável.
   - Cada agente **não vê esta conversa**: o pedido leva a spec, as equivalências, o contrato, os critérios de aceite e os casos de erro. Para o `qa`, leve também o resumo de quem implementou.
   - Uma etapa só termina com o `qa` aprovando.
   - O `frontend` aplica a cor principal registrada no levantamento como base de todo o visual do iframe (veja "Cor da marca"); o `qa` confere que nenhum componente ficou com o roxo padrão do InnovUI.
7. **Fechamento:** revisão final (`/review`) comparando o projeto novo com a spec, e plano de transição (skill `deprecation-and-migration`): como e quando os clientes saem do iframe antigo e quando ele é desligado.

**Cor da marca (só na Migração; na Criação o iframe fica com o tema padrão do InnovUI).**
- No levantamento, ache a cor principal do sistema de origem: variável de tema ou config do Tailwind (`primary`, `brand`), CSS do botão principal, ou o logo. Registre em `01-levantamento.md` o hex, **onde achou** e as variantes (hover, ativo) se existirem. Achou mais de uma cor candidata, ou nenhuma: pergunte ao usuário, não adivinhe.
- Aplique **uma vez**, em `apps/web/src/styles.css`, sobrescrevendo os tokens de cor primária do InnovUI depois dos imports (receita e lista de tokens em `references/chat-plataforma/stack.md`, seção do front). Os componentes continuam usando só tokens, sem hex. Isso vale para o iframe todo: botões, foco, seleção, toggles, spinner e links.
- Confira o contraste do texto sobre a cor (mínimo 4.5:1, WCAG AA) e escolha texto branco ou escuro de acordo. Cor clara demais ou sem contraste: avise o usuário.

Regras:
- Nunca descarte uma regra da origem sem registrá-la na spec como **descartar**, com motivo.
- Não copie código da origem que dependa da infraestrutura dela (ZDK, banco, filas): reimplemente pelo contrato do destino.
- Mudou a spec no meio do caminho: atualize `SPEC.md` e avise o usuário antes de seguir.

## Fluxo para um app novo

1. **Entenda a feature** em termos do atendimento: o que o atendente vê e faz no painel de 384px, quais dados do ticket e do contato usa, quais sistemas externos entram. Se faltar informação essencial (qual ERP, quais campos), pergunte; o resto, assuma e declare. **O nome do projeto é obrigatório:** se o usuário não informou, pergunte o nome em kebab-case (ex.: `pedidos-erp`) e, se quiser, o nome de exibição (ex.: "Pedidos do ERP").
2. **Scaffold:** `bash <skill>/scripts/scaffold.sh <destino> <nome-kebab> ["Nome de exibição"]`. O script troca o nome em todos os lugares (pacote raiz, README, `<title>` do web, título do Swagger, `AXIOM_DATASET=<kebab>-cp` (Chat Plataforma) ou `AXIOM_DATASET=<kebab>` (Zappy)) e falha se o template mudar e algum ponto não for encontrado; não renomeie à mão. Sem o nome de exibição, ele é derivado do kebab (`pedidos-erp` → "Pedidos Erp"). Não reescreva o que o template já resolve: raw body + HMAC, JWT do diagnóstico, envelope e status, cifra das credentials, validação da API key no install, logs no Axiom, nginx com CSP para iframe e proxy de `/api`, navegação em memória, Dockerfiles otimizados, CI com deploy por app afetado. Máscaras e validações de telefone, moeda, CPF, CNPJ (inclusive alfanumérico), CEI e e-mail já existem em `@app/shared` (`@app/shared/masks`, `@app/shared/validators`); consulta de CNPJ (BrasilAPI, CNPJá e ReceitaWS, com fallback) em `@app/shared/cnpj`: importe, não reimplemente.
3. **Credentials:** em `apps/api/src/core/utils/credentials.ts`, cada campo entra em `CREDENTIAL_FIELDS` (chave interna → `label`, `type`, `required`, `secret`) e em `credentialsSchema` (zod). Normalmente é só a **API key do Chat Plataforma**; acrescente outras só se o app integrar com sistema do cliente. Ajuste `REQUIRED_PERMISSIONS` (`infrastructure/libs/chatplataforma/permissions.ts`) com as permissões que o app usa. Chaves da nossa infra (Axiom, Redis, Resend, Langfuse) são env vars.
4. **Endpoints da plataforma:** confira path e permissão em `references/chat-plataforma/api/routes.md` e o comportamento no arquivo do domínio. Adicione o método em `infrastructure/libs/chatplataforma/client.ts` (e no contrato `core/repository/chat-plataforma-client.interface.ts`) com `requestParsed(schema, ...)` e um schema zod **só com os campos usados**.
5. **API em Clean Architecture** (`references/chat-plataforma/architecture.md`): cada ação é um use case, com interface em `apps/api/src/core/use-cases/` e implementação em `infrastructure/use-cases/<acao>.use-case.ts`; HTTP em `presentation/{routes,schemas,controllers}/`; dado próprio em `core/repository/` (interface) + `infrastructure/repository/`; sistemas externos em `infrastructure/libs/<sistema>/` (contrato em `core/repository/`). Ligue tudo em `server/bootstrap.ts` e registre as rotas lá (rotas do iframe dentro do bloco `/api/app`, que exige `x-account-id`).
6. **Telas** em `apps/web/src/screens/`, ligadas pela navegação em memória (`lib/navigation.tsx` + `case` no `App.tsx`), nunca por rota de URL. Toda UI com o **InnovUI** (`@innovui/react`): carregue a skill `innovui-react` se estiver disponível e consulte a página do componente antes de usá-lo (resumo em `references/chat-plataforma/stack.md` §5). Remova os exemplos (`get-ticket` e `tickets.*` na API, `TicketScreen`) se não forem usados.
7. **Diagnóstico:** um `check()` por dependência real (banco, Chat Plataforma, cada sistema externo) em `infrastructure/use-cases/get-diagnostics.use-case.ts`.
8. **Persistência própria** (se houver): siga `references/chat-plataforma/database.md`. Para automações, fila e idempotência seguem `references/chat-plataforma/architecture.md` §7.
9. **Testes** (`references/chat-plataforma/testing.md`): contrato HTTP de cada rota (sucesso, 401, 422, 404), regra de cada use case sem HTTP, telas com render e navegação. Rode `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
10. **Entregue** com o checklist do fim deste arquivo.

Para mudanças num app existente, siga os passos 3 a 9 só no que muda.

## Regras que não podem quebrar (e por quê)

### Variáveis de ambiente
- **Prefixo de dono em toda variável de ambiente:** `APPLICATION_` para o que é do app e o nome do serviço para o resto (`DATABASE_`, `REDIS_`, `AXIOM_`, `CHATPLATAFORMA_`...). Sem prefixo só as de terceiros (`NODE_ENV`, `MYSQL_*`, `PNPM_HOME`, `VITE_*`). Detalhes e tabela completa em `references/chat-plataforma/stack.md` §13.
- **Cada app tem o seu `.env.example`:** `apps/api/.env.example` (API) e `apps/web/.env.example` (container web). Não existe `.env` na raiz. Banco e Redis entram só por URL (`DATABASE_URL`, `REDIS_QUEUE_URL`, `REDIS_CACHE_URL`), porque em produção apontam para serviços externos. A configuração da infra local (usuário, senha, porta, versão do MySQL e do Redis) fica fixa no `docker-compose.dev.yml` da raiz, nunca no `.env`. A stack completa em container se divide por app: `apps/api/docker-compose.yml` (só a API) e `apps/web/docker-compose.yml` (só o nginx), ligados pela rede `app-net` que o `docker-compose.dev.yml` cria. Env no compose só a `DATABASE_URL` da API em container, fixa com host `mysql`. Variável nova do app entra primeiro no `.env.example` (com comentário) e depois no `env.ts` (zod).
- O scaffold copia cada `.env.example` para `.env` no mesmo app e, em `apps/api/.env`, gera `APPLICATION_ENCRYPTION_KEY` e `CHATPLATAFORMA_CLIENT_SECRET`. Segredo real nunca vai no `.env.example`. O `.gitignore` ignora `.env` e `.env.*`, exceto `.env.example`.

### Contrato com a plataforma
- **Rotas exatas sob `/api`:** `/api/provision/{install,configure,uninstall}` e `/api/instances/:externalId/diagnostics`. A plataforma não descobre rotas: qualquer variação faz o app não instalar.
- **Envelope e status:** a plataforma lê `response.body.body`. Install responde **201 ou 200** com `{ body: { externalId } }`; sem o `body`, o externalId fica nulo sem erro, e 204 é erro. Configure e uninstall respondem **200** (201 é erro). Diagnóstico só 200. Erro sempre `{ error: { message } }`: validação 422, assinatura ou token 401, externalId desconhecido 404, exceto no **uninstall, que é idempotente** (200 mesmo se não existir, senão a instalação fica presa).
- **Corpo do install é plano e indexado pelo label** (`{ "API Key do Chat Plataforma": "..." }`), sem wrapper `credentials`. **Configure é parcial:** campo ausente ou com a máscara `••••••••` mantém o valor salvo; `null` ou `""` apaga. Valide o conjunto final. Nunca renomeie um label no Backstage sem mudar `CREDENTIAL_FIELDS`.
- **Uninstall zera o `externalId` na plataforma:** salvar credenciais depois chama install de novo e gera outro `externalId`. Excluir a instalação não chama o app, então órfãos são possíveis.
- **HMAC sobre o raw body:** `hex(HMAC-SHA256(clientSecret, "<x-timestamp>:<rawBody>"))`, janela de 5 min, `timingSafeEqual`. Re-serializar o JSON muda bytes e quebra a assinatura. Autentique antes de validar o corpo (401 vence 422).
- **JWT do diagnóstico:** HS256 com o `clientSecret`, expira em 2 min; confira `scope === "diagnostics:read"` e `externalId` igual ao da URL. `status` ∈ `operational|degraded|outage`.
- **Timeout da plataforma é 10 s:** nada lento no provisionamento (o teste da API key usa 5 s) e nada dele vai para fila.
- **Mensagens de provisionamento e diagnóstico são lidas pelo admin da organização:** `ADMIN_MESSAGES`, em linguagem simples, dizendo o que fazer.
- **Dois identificadores da instalação:** `id` (INT, PK interna, FK das tabelas do app, nunca sai do backend) e `externalId` (UUID público: `accountId` do iframe e chave das chamadas da plataforma).

### Segurança
- **Credentials nunca no front** e nunca em texto puro no banco (AES-256-GCM). O front só fala com o próprio backend.
- **Nunca repasse ao front a resposta crua da API do Chat Plataforma:** `GET /v1/tickets/:id` traz o agente com `hashPassword`, e-mail e telefone. Projete com schema zod (`ticketViewSchema` em `packages/shared`).
- **Parâmetros do iframe não são assinados:** use só as credentials da instalação achada pelo `accountId` e confirme na API o que o front pediu. Nunca aja sobre um ID só porque veio do front.
- **Iframe precisa poder ser embutido:** sem `X-Frame-Options`; `frame-ancestors` liberando o domínio do Chat Plataforma.

### API e código
- **API em Clean Architecture (mesma do template da Zappy):** `core` é contrato e código puro (não importa fastify, Prisma nem as outras camadas); `presentation` (routes, schemas, controllers) só traduz HTTP ↔ use case e não importa `infrastructure`; o use case (em `infrastructure/use-cases/`) tem a regra e não conhece Fastify; só `infrastructure/repository` toca o Prisma; só `infrastructure/libs` chama API externa; `server/bootstrap.ts` liga tudo. `apps/api/tests/unit/architecture.test.ts` falha o CI se um import quebrar isso. Sem DDD completo.
- **Automação: fila, idempotência e logs.** Trabalho de mais de 1 a 2 s, lote ou webhook recebido vai para BullMQ + Redis, com `202 Accepted`. Evento que pode repetir (webhook, retry, duplo clique) passa por tabela com chave única pelo ID do evento antes do efeito. Todo job e toda falha de integração são logados com `requestId`/`jobId`.
- **Todo problema é rastreável por um ID que ninguém vê na tela:** `requestId` no header `x-request-id`, em todo log e repassado ao Chat Plataforma. A mensagem do envelope é só texto amigável (`USER_MESSAGES` para o atendente, `ADMIN_MESSAGES` para o admin); a causa técnica vai só para o log (`cause`).
- **Código e testes sem comentários:** o título do `describe`/`it` documenta a regra; arquitetura e "porquês" ficam em `references/chat-plataforma/`. Só `// biome-ignore <regra>: <motivo>` é permitido.
- **Enumerados com `Object.freeze({...} as const)` + `ValueOf<typeof X>`** (e `z.enum(X)` para validar); nunca `enum` do TS nem string solta repetida. **Imutabilidade pelo tipo** (`Readonly`, `readonly T[]`, `as const`, `.readonly()` do zod); `Object.freeze` só em constantes de módulo e em dado compartilhado por referência (a instalação do repository), nunca em retorno de factory, DTO por requisição ou objeto entregue a biblioteca (`references/chat-plataforma/stack.md` §2.1).
- **IDs como string:** snowflakes de 18+ dígitos; `Number()` corrompe. ID não numérico no path da plataforma vira 500: valide antes.
- **Node 24 com TS nativo:** imports relativos com `.ts` e só sintaxe apagável (sem `enum`, `namespace`, parameter properties). Não reintroduza tsx ou tsup.
- **Dependência só depois de análise:** o que a plataforma ou poucas linhas resolvem, sem lib; o que é complexo, lib madura. Rode `scripts/check-dependency.mjs` e o checklist de `references/chat-plataforma/dependencies.md` e informe a decisão na entrega.
- **Tempo real começa simples:** refetch ou polling do TanStack Query primeiro; SSE quando o servidor precisa avisar em segundos; WebSocket só com requisito bidirecional previsto (`references/chat-plataforma/realtime.md`).

### Front
- **384px e URL fixa:** coluna única; a URL do iframe não muda depois do boot (sem router, `pushState` ou links internos), para não perder o contexto do atendimento.
- **Design system InnovUI:** componentes de `@innovui/react` em vez de HTML estilizado à mão; Tailwind só para layout; cores só por token (`var(--color-…)`). Não invente componente "do InnovUI". Ícones só **Lucide** (`lucide-react`), com `aria-label` em `IconButton`.
- **Composição onde fizer sentido:** toda tela usa `Screen.Root/Header/Body/Footer`; partes opcionais por children ou slots, não por props booleanas; dados via TanStack Query em hooks de feature, visual na tela.
- **Erros para leigos:** `ErrorAlert` (estado de tela) ou `useErrorToast()` (ação), mensagem simples com "Tentar de novo", nenhum código ou ID na tela.

### Infra
- **Um container por app:** web (nginx, domínio público = `rootUrl`, proxy de `/api`) e api separados; o CI só redeploya o que o `turbo --affected` apontar. O start da API roda `prisma migrate deploy` e depois `exec node`, para o SIGTERM do Coolify chegar ao Node.
- **Banco de produção é MySQL de DBaaS** (Magalu Cloud, só IP privado na VPC). Conecte pelo `mariaDbConfigFrom` (o MySQL 8 exige `allowPublicKeyRetrieval` sem TLS, ou `DATABASE_TLS=true`); nunca passe a URL crua ao adapter.

## Consumindo a API do Chat Plataforma

Leia `references/chat-plataforma/api/README.md` antes. O essencial:
- Base `https://api.chatplataforma.com.br`, header **`x-api-key`** (`x-access-token` é login de usuário). O app age como o **agente de sistema** da key, com as permissões de quem a criou (key de Owner = admin).
- Sucesso vem em `{ message, body }`, e o cliente do template já devolve só o `body`. Erros: `{ message }` em regra de negócio (400/404/409/422, já em português para o atendente; o cliente repassa como 422), `{ error }` no 401, 403 por permissão, 429 no rate limit de **1200 req/10 s por organização**. O cliente converte tudo em `ChatPlataformaError` com mensagem amigável e `upstreamStatus`.
- Paths misturam singular e plural (`/v1/contact/:id`, `/v1/contacts/:id/tags`): copie de `routes.md`.
- Efeitos colaterais que surpreendem: listar mensagens de um ticket **marca o ticket como lido**; enviar mensagem sem ticket aberto **cria um ticket**; `PUT /v1/contacts/:id/tags` **substitui** a lista. Para enviar no ticket aberto, use `ticketConnectionId` como `connectionId` e o **telefone** do contato como `destinationId`. Não retente envio de mensagem automaticamente.
- Webhooks da plataforma: assinatura não verificável (autentique com token na URL), sem ordem, com duplicatas (deduplique pelo `id`) — `references/chat-plataforma/realtime.md`.
- Cerca de 20 pontos das referências estão marcados "não confirmado": o comportamento não pôde ser comprovado lendo o código (ex.: se a URL de mídia recebida vem no `body` da mensagem, se o modo de permissões em produção é `enforcing`). Se a feature depender de um deles, não trate como certo: escreva o código para o caso pior, cubra com teste e liste na entrega para ser conferido contra a plataforma real.

## Entrega

Ao terminar, informe ao usuário em poucas linhas:
- **Rodar local** (Node 24): `pnpm install`, `docker compose -f docker-compose.dev.yml up -d`, `pnpm --filter api db:migrate --name init`, `pnpm dev`, `CHATPLATAFORMA_TEST_API_KEY=<key de teste> pnpm --filter api dev:install`.
- **Cadastro no Backstage:** `rootUrl` (raiz do domínio público do web, sem barra final, até 100 caracteres), `credentialsSchema` (saída de `pnpm --filter api credentials:schema`, formato `{ fields }`), `clientSecret` gerado pelo Backstage em `CHATPLATAFORMA_CLIENT_SECRET`, e as permissões mínimas da API key (`REQUIRED_PERMISSIONS`) para orientar o cliente.
- **Banco:** MySQL do DBaaS na mesma VPC do Coolify, com banco e usuário próprios do app criados antes do primeiro deploy (`references/chat-plataforma/database.md`, "Produção"); comitar `prisma/migrations`.
- **Deploy:** nenhum compose usa `ports:` (o Coolify não aceita; a porta vem do `EXPOSE` do Dockerfile, e o domínio e a porta do web (8080) são configurados no recurso). Dois recursos no Coolify (web público com o env do `apps/web/.env.example`; api interna com o env do `apps/api/.env.example`, incluindo `AXIOM_*` e, se houver fila, `REDIS_QUEUE_URL`/`REDIS_CACHE_URL`); o deploy vem só do `.github/workflows/ci-cd.yml` (igual nos dois templates, em `assets/common`), que roda só o que mudou e só chama o Coolify se lint, testes, build e o teste do compose passarem; com o GitHub App do Coolify, desligue o auto-deploy. Secrets `COOLIFY_TOKEN`, `COOLIFY_WEBHOOK_API` e `COOLIFY_WEBHOOK_WEB` no GitHub.
- **Dependências adicionadas** e o resultado da análise.
- **O que precisa ser conferido na plataforma real:** cada comportamento da API em que o app se apoia e que a referência marca como "não confirmado", ou que não está documentado nela. Uma linha por item, dizendo o que foi assumido e onde isso aparece no código (ex.: "assumi que o `body` da mensagem recebida traz a URL da mídia; usado em `modules/attachments/attachments.service.ts`"). Se não houver nenhum, diga isso.

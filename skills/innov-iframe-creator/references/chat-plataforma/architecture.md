# Arquitetura da API: Clean Architecture

Leia antes de criar ou mover qualquer arquivo em `apps/api/src`. A API segue Clean Architecture (core, infrastructure, presentation, server), o mesmo padrão do template da Zappy (`assets/zappy-contabil/docs/architecture.md`). A regra de dependência é verificada por teste (§3).

A API é **REST com JSON**: recursos em paths, verbos HTTP, status codes e envelope `{ body }` / `{ error: { message } }`. A exceção são as rotas `/api/provision/*`, com formato de comando (`POST /install`), porque é o contrato que a plataforma impõe.

## Sumário
1. Camadas e responsabilidades
2. Estrutura de pastas e nomes
3. Regras (verificadas por teste)
4. Fluxo de uma requisição e de um erro
5. Adicionando uma feature
6. Crescendo de pequeno para médio
7. Automação e integrações: fila, idempotência e logs
8. Testes por camada

## 1. Camadas e responsabilidades

```
HTTP ─► middlewares ─► routes ─► controller ─► use case (interface do core)
                                                   │ implementado em infrastructure
                                                   ├─► repository ─► MySQL (Prisma)
                                                   └─► libs (clients) ─► APIs externas
fila ─► worker ─────────────────────────────► use case (o mesmo, sem HTTP)
```

Dependência aponta para dentro: `presentation` e `infrastructure` conhecem o `core`; o `core` não conhece ninguém; `server` conhece todos e monta tudo.

| Camada | Pasta | Faz | Não faz |
|---|---|---|---|
| **Core** | `core/` | Contratos e código puro: interfaces dos use cases (`core/use-cases/*-use-case.interface.ts`), interfaces de repository e de client externo (`core/repository/`), e utilitários de domínio (`core/utils/`: `AppError`, `credentials`, `diagnostics`, `messages`, `log-events`, `request-context`). | Importar `fastify`, Prisma, `infrastructure`, `presentation` ou `server`. |
| **Infrastructure** | `infrastructure/` | Implementa o core. **Use cases** (`use-cases/<acao>.use-case.ts`): regra de negócio e orquestração, lança `AppError`, registra `LOG_EVENT`. **Repository** (`repository/`): único lugar com Prisma, mais a versão em memória para testes. **Libs** (`libs/`): client do Chat Plataforma e de cada sistema externo, `crypto`, `hmac`, `jwt`, `database`, `prisma`. | Importar `presentation` ou `server`. Conhecer Fastify, `req` ou `reply`. |
| **Presentation** | `presentation/` | Camada HTTP. **Routes**: método, path, schema e autenticação (opção `authenticate`). **Schemas**: zod de params, query e body (`{ tags, params, body } satisfies FastifySchema`; não congele, o Fastify escreve nesses objetos). **Controllers**: traduzem HTTP ↔ use case (lê `req.params/body`, monta o `RequestContext`, devolve `ok(...)`, escolhe 201/202). `errors/api-error.ts` (`ok`, `fail`) e `http.ts` (`ZodRequest`, `contextOf`, `installationOf`). | Importar `infrastructure` ou Prisma. Regra de negócio. Controller chamar repository. |
| **Server** | `server/` | Composição e framework: `bootstrap.ts` (composition root com DI manual + `buildApp`), `server.ts` (Prisma, logger, listen, shutdown), `logger.ts`, `middlewares/` (HMAC, JWT do diagnóstico, instalação do iframe, request-id, error handler, parser JSON), `plugins/swagger.ts`, `workers/`. | Regra de negócio. |
| **Config** | `config/env.ts` | Lê e valida as variáveis de ambiente (zod). | Depender de outras camadas. |

Quando o módulo não lê nem grava nada (nem banco nem sistema externo), não há use case nem repository: `client-logs` só repassa o log. Quando há dado, o controller sempre passa pelo use case, mesmo que ele tenha uma linha (como `get-ticket`): o controller nunca chama repository ou client direto, e a regra que aparecer depois entra no use case sem mexer no controller.

## 2. Estrutura de pastas e nomes

```
apps/api/src/
  config/env.ts
  core/
    use-cases/           install | configure | uninstall | get-diagnostics | get-ticket  (*-use-case.interface.ts)
    repository/          installation.repository.interface.ts, chat-plataforma-client.interface.ts
    utils/               app-error, chat-plataforma-error, credentials, diagnostics,
                         log-events, messages, request-context
  infrastructure/
    use-cases/           <acao>.use-case.ts, assert-api-key-works.ts
    repository/          installation.repository.ts   (Prisma + memória)
    libs/                chatplataforma/{client,permissions}.ts, crypto, database, hmac, jwt, prisma
  presentation/
    routes/              <recurso>.routes.ts
    schemas/             <recurso>.schemas.ts
    controllers/         <recurso>.controller.ts
    errors/api-error.ts
    http.ts
  server/
    bootstrap.ts         composition root + buildApp
    server.ts            Prisma + repositório + logger + listen + shutdown
    logger.ts
    middlewares/         platform-signature, diagnostics-token, iframe-installation,
                         request-id, error-handler, json-body-parser
    plugins/swagger.ts
    workers/
  scripts/               dev-install.ts, print-credentials-schema.ts
```

Alias `#src/*` (campo `imports` do `package.json`) para imports entre camadas; o Node não lê `paths` do tsconfig. Início e dev: `src/server/server.ts`.

- Recurso do domínio no plural quando é coleção (`tickets`, `orders`, `contact-notes`), kebab-case.
- Presentation: `<recurso>.routes.ts`, `<recurso>.schemas.ts`, `<recurso>.controller.ts`. Fábricas `create<Recurso>Controller`, tipo `<Recurso>Controller` via `ReturnType`.
- Use case: um por ação (`<acao>.use-case.ts`, fábrica `create<Acao>UseCase`), com a interface `<acao>-use-case.interface.ts` no core (`interface GetTicketUseCase { execute(...) }`). O provisionamento são três use cases (install, configure, uninstall), não um `service`.
- Use cases, controllers e clients devolvem objetos simples, sem `Object.freeze`: o tipo já impede reatribuição (regra de imutabilidade em `references/chat-plataforma/stack.md` §2.1).
- Rotas do iframe ficam sob `/api/app` e herdam `requireInstallation`; rotas da plataforma, sob `/api/provision` e `/api/instances`.

## 3. Regras (verificadas por teste)

`apps/api/tests/unit/architecture.test.ts` lê os imports (alias `#src/` e relativos) e falha o CI se:
- o **core** importa `infrastructure`, `presentation`, `server`, `fastify` ou Prisma;
- a **presentation** importa `infrastructure` ou Prisma;
- um **controller** importa repository;
- uma **route** importa use case de `infrastructure/use-cases`;
- a **infrastructure** importa `presentation` ou `server`;
- qualquer arquivo fora de `infrastructure/repository/`, `infrastructure/libs/prisma*` e `server/server.ts` importa `generated/prisma`.

Além disso:
- Routes recebem a autenticação por opção (`authenticate`), montada no `bootstrap.ts` com o middleware de `server/middlewares/`. Assim a route não importa `server`.
- Dependências entram pela fábrica (`createInstallUseCase({ installations, clientFor })`), nunca por import de instância global. O `bootstrap.ts` liga tudo (DI manual, sem framework); é o que permite testar o use case com fakes.
- Use case depende de interface do core (`InstallationRepository`, `ClientFor`), não da implementação.
- Um use case pode chamar outro quando a regra é dele. Ciclo entre use cases é sinal de que a regra está no lugar errado.
- O `RequestContext` (`{ requestId, log }`, em `core/utils/request-context.ts`) é o único "pedaço" da requisição que chega ao use case: dá log correlacionado e repassa o `x-request-id` aos clients.

## 4. Fluxo de uma requisição e de um erro

`GET /api/app/tickets/:ticketId`:
1. `onRequest` → `requireInstallation` (`server/middlewares/iframe-installation.ts`) acha a instalação pelo `x-account-id` e põe `externalId`, `agentId` e `ticketId` no logger da requisição.
2. O zod valida `ticketId` (`getTicketSchema`) → 422 com `USER_MESSAGES.invalidRequest` se inválido.
3. `ticketsController.getTicket` chama `getTicket.execute(installationOf(req), ticketId, contextOf(req))`.
4. O use case (`infrastructure/use-cases/get-ticket.use-case.ts`) usa `clientFor(credentials, { requestId })`; o client (`infrastructure/libs/chatplataforma/client.ts`) faz a chamada, valida a resposta com `ticketViewSchema` e descarta o resto.
5. O controller devolve `ok(ticket)`.

Erro: qualquer camada **lança** `AppError(status, mensagem amigável, { cause })` (`core/utils/app-error.ts`), e ninguém captura para "tratar" no meio do caminho. O `errorHandler` (`server/middlewares/error-handler.ts`) loga com `requestId` e a causa, e responde `{ error: { message } }` via `fail`. Só capture quando for mudar a decisão (ex.: o use case de install converte o 401 do Chat Plataforma em 422 para o admin).

## 5. Adicionando uma feature

> **Exemplo ilustrativo:** `orders` e os arquivos dele (`list-orders`, `orders.schemas.ts`) são um exemplo hipotético: **não existe no template**. Crie só quando o app precisar, nas camadas indicadas.

Exemplo: "o atendente vê os últimos pedidos do cliente no ERP".
1. **Client externo:** `infrastructure/libs/erp/client.ts` com `listOrdersByPhone(phone)`, timeout, schema zod da resposta e erro traduzido. O contrato (tipo do client e `ErpClientFor`) entra em `core/repository/erp-client.interface.ts`. A credencial do ERP entra em `CREDENTIAL_FIELDS` (`core/utils/credentials.ts`).
2. **Interface do use case:** `core/use-cases/list-orders-use-case.interface.ts` com `execute(installation, ticketId, ctx)`.
3. **Use case:** `infrastructure/use-cases/list-orders.use-case.ts` → busca o ticket no Chat Plataforma, pega o telefone, chama o ERP, ordena e corta em 5. Fábrica `createListOrdersUseCase({ clientFor, erpFor })`.
4. **Schemas, controller e routes:** `presentation/schemas/orders.schemas.ts` (`params: { ticketId }`), `presentation/controllers/orders.controller.ts` (`ok(await listOrders.execute(...))`), `presentation/routes/orders.routes.ts` (`GET /orders?ticketId=`, recebe `controller` por opção).
5. **Composição:** em `server/bootstrap.ts`, crie o use case em `useCases`, o controller em `controllers` e registre `ordersRoutes` dentro do bloco do iframe.
6. **Repository:** só se o app guardar dado próprio: interface em `core/repository/`, implementação (Prisma + memória) em `infrastructure/repository/` (ver `references/chat-plataforma/database.md`).
7. **Testes:** HTTP via `makeApp` (contrato, 401, 422) em `tests/e2e/` e use case com fakes (regra) em `tests/unit/infrastructure/use-cases/`. Ver §8.

## 6. Crescendo de pequeno para médio

A mesma estrutura serve até algumas dezenas de rotas. Sinais e o que fazer:
- **Use case com mais de ~300 linhas ou com responsabilidades separáveis:** divida em use cases menores (um por ação) e extraia helpers puros para `core/utils/` (como `assert-api-key-works.ts` fez no provisionamento).
- **Regra usada por vários use cases:** vira função pura em `core/utils/` ou use case próprio. Não coloque regra de negócio em `infrastructure/libs/`.
- **Mesmo sistema externo com muitos endpoints:** quebre o client por recurso (`infrastructure/libs/erp/orders.ts`, `infrastructure/libs/erp/customers.ts`) com uma base comum de request; o contrato continua em `core/repository/`.
- **Pastas com muitos arquivos:** agrupe por recurso dentro da camada (`use-cases/orders/`), sem criar camadas novas.
- **Trabalho demorado ou em lote:** fila (§7.1).
- Só considere algo além disso (eventos de domínio, módulos por contexto) com um problema concreto que a estrutura atual não resolva. Registre o motivo.

## 7. Automação e integrações: fila, idempotência e logs

> **Exemplo ilustrativo:** O código desta seção (`infrastructure/libs/queue.ts`, `server/workers/orders.worker.ts`, `ProcessedEventRepository` e a fila `orders-sync`) **não existe no template**. Crie só quando o app precisar, nas camadas indicadas.

Apps que integram sistemas e rodam sozinhos precisam destes três pilares. Logs já vêm no template. Fila e idempotência entram **quando a feature precisar**, seguindo os padrões abaixo (verificados com BullMQ 6.3 + Redis 7 e com MySQL 8).

### 7.1 Fila: não faça o cliente esperar

Use quando o trabalho levar mais de 1 a 2 s (gerar PDF, várias APIs externas em sequência, lote), quando precisar de retry com backoff, ou para processar webhook recebido. A rota valida, enfileira e responde **`202 Accepted`** com um identificador; o worker faz o trabalho.

Não enfileire o provisionamento: o install precisa devolver o `externalId` na resposta, e a plataforma espera no máximo 10 s.

**Escolha: BullMQ + Redis** (`bullmq` + `ioredis`). Retry com backoff, concorrência, agendamento e deduplicação já vêm prontos, e é a mesma tecnologia do backend do Chat Plataforma. Uma tabela de tarefas no MySQL evita o Redis, mas exige polling, lock (`SELECT … FOR UPDATE SKIP LOCKED`), retry e limpeza feitos à mão; só vale quando o app não puder ter Redis.

- **Instalação:** passe `bullmq` e `ioredis` pelo `scripts/check-dependency.mjs` antes de instalar. A partir do BullMQ 6, o `ioredis` é peer opcional e precisa ser instalado junto.
- **Infra:** um Redis no Coolify, com persistência AOF ligada (sem ela, uma reinicialização perde os jobs pendentes). Env `REDIS_QUEUE_URL` (instância de fila; o cache usa outra, `REDIS_CACHE_URL`) no container da API.
- **Onde fica:** a infra da fila em `infrastructure/libs/queue.ts`. Cada fila e o processador dela em `server/workers/<f>.worker.ts` (a pasta `server/workers/` já existe no template). O processador é uma "porta de entrada", como o controller: monta o contexto e chama o **mesmo use case**. O worker roda no mesmo processo da API; separe em outro container só se a carga pedir. O `bootstrap.ts` (ou o `server.ts`) cria a fila e inicia o worker.

`infrastructure/libs/queue.ts`:

```ts
import type { DefaultJobOptions } from 'bullmq'
import { Redis } from 'ioredis'

export const createRedis = (url: string) => new Redis(url, { maxRetriesPerRequest: null })

export const DEFAULT_JOB_OPTIONS = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 2_000 },
  removeOnComplete: 1_000,
  removeOnFail: 5_000,
} satisfies DefaultJobOptions
```

`server/workers/orders.worker.ts`:

```ts
import { Queue, Worker } from 'bullmq'
import type { Redis } from 'ioredis'
import type { FastifyBaseLogger } from 'fastify'
import type { SyncOrderUseCase } from '#src/core/use-cases/sync-order-use-case.interface.ts'
import { DEFAULT_JOB_OPTIONS } from '#src/infrastructure/libs/queue.ts'

export const ORDERS_QUEUE = 'orders-sync'

export type SyncOrderJob = Readonly<{ installationId: number; orderId: string; requestId: string }>

export const createOrdersQueue = (connection: Redis) =>
  new Queue<SyncOrderJob>(ORDERS_QUEUE, { connection, defaultJobOptions: DEFAULT_JOB_OPTIONS })

export const startOrdersWorker = (
  connection: Redis,
  syncOrder: SyncOrderUseCase,
  logger: FastifyBaseLogger,
) =>
  new Worker<SyncOrderJob>(
    ORDERS_QUEUE,
    async (job) => {
      const log = logger.child({ jobId: job.id, queue: ORDERS_QUEUE, attempt: job.attemptsMade + 1, requestId: job.data.requestId })
      await syncOrder.execute(job.data, { requestId: job.data.requestId, log })
    },
    { connection, concurrency: 5 },
  )
```

- **Rota:** o controller chama o use case `requestSync`, que faz `queue.add('sync', data, { jobId })` e devolve o `jobId`. O controller responde `reply.status(202).send(ok({ jobId }))`. A fila entra no use case por dependência (interface em `core/repository/`), como o repository.
- **Shutdown:** no `server/server.ts`, antes de `app.close()`, chame `await worker.close()` e `await queue.close()`. Assim o job em andamento termina antes do container parar.
- **Logs:** todo log do job leva `jobId`, `queue`, `attempt` e o `requestId` da requisição que o criou, então dá para seguir no Axiom do clique ao processamento. Logue falha definitiva (`worker.on('failed')` com `attemptsMade === attempts`) em `error`.
- **Testes:** teste o use case direto. O processador só monta o contexto e chama o use case.

### 7.2 Idempotência: o mesmo evento nunca roda duas vezes

Webhooks chegam repetidos (o Chat Plataforma retenta até 5 vezes e pode reenviar um lote), jobs são retentados e o usuário clica duas vezes. Garanta que o efeito aconteça **uma vez por ID de evento**.

**Durável: tabela com chave única.** É a garantia real, inclusive com requisições simultâneas: o banco aceita só um insert por chave. Verificado no MySQL 8: com 4 inserts simultâneos do mesmo evento, só um retornou `true`.

```prisma
model ProcessedEvent {
  id             Int          @id @default(autoincrement()) @db.UnsignedInt
  installationId Int          @map("installation_id") @db.UnsignedInt
  source         String       @db.VarChar(40)
  eventId        String       @map("event_id") @db.VarChar(100)
  createdAt      DateTime     @default(now()) @map("created_at") @db.DateTime(3)
  installation   Installation @relation(fields: [installationId], references: [id], onDelete: Cascade, map: "fk_processed_events_installation_id")

  @@unique([installationId, source, eventId], map: "uq_processed_events_installation_source_event")
  @@map("processed_events")
}
```

A interface (`ProcessedEventRepository`: `markProcessed`, `unmark`) fica em `core/repository/processed-event.repository.interface.ts`; a implementação em `infrastructure/repository/processed-event.repository.ts`:

```ts
import { Prisma, type PrismaClient } from '#src/generated/prisma/client.ts'

export const createProcessedEventRepository = (prisma: PrismaClient) => ({
  markProcessed: async (installationId: number, source: string, eventId: string) => {
    try {
      await prisma.processedEvent.create({ data: { installationId, source, eventId } })
      return true
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return false
      throw err
    }
  },
  unmark: (installationId: number, source: string, eventId: string) =>
    prisma.processedEvent.deleteMany({ where: { installationId, source, eventId } }),
})
```

Uso no use case, para efeito externo (API de terceiro):

```ts
if (!(await events.markProcessed(installation.id, 'chatplataforma', event.id))) {
  ctx.log.info({ eventId: event.id, event: LOG_EVENT.eventDuplicated }, 'evento repetido ignorado')
  return
}
try {
  await erp.createTicket(...)
} catch (err) {
  await events.unmark(installation.id, 'chatplataforma', event.id)
  throw err
}
```

- **Efeito só no próprio banco:** faça o `markProcessed` e a gravação na **mesma transação** (`prisma.$transaction`), sem precisar de `unmark`.
- **De onde vem o ID:** o `id` do envelope do webhook do Chat Plataforma, o ID do evento do sistema de origem ou um header `Idempotency-Key` enviado pelo cliente. Nunca um hash do corpo inteiro (o `timestamp` muda entre tentativas).
- **Na fila:** use o mesmo ID como `jobId` no `queue.add`. O BullMQ ignora job com `jobId` repetido enquanto o anterior estiver guardado (verificado), o que corta duplicatas cedo. Como ele apaga jobs antigos (`removeOnComplete`), isso não substitui a tabela.
- **Limpeza:** apague linhas com mais de 30 a 90 dias, conforme a janela de retentativa das origens, num job agendado do BullMQ ou manualmente.
- **Chamadas que você faz:** se a API externa aceita chave de idempotência, envie. Se não aceita, como no envio de mensagem do Chat Plataforma, **não retente automaticamente** depois de timeout: a mensagem pode ter saído. Registre a falha e deixe a decisão para o atendente.

### 7.3 Logs: saber o que falhou sem ninguém olhando

Já vem no template: pino → Axiom, `requestId` em todo log, `event: LOG_EVENT.*` para fatos de negócio e mensagens sem dados sensíveis (`references/chat-plataforma/observability-and-integrations.md`). Para automações:
- **Integrações:** todo erro de API externa vira `AppError` com `cause` contendo método, path, status e a mensagem da origem. O error handler loga a causa. Não logue o corpo da requisição nem o da resposta.
- **Jobs:** `jobId`, `queue`, `attempt` e `requestId` em todo log (§7.1). Falha definitiva em `error`, retentativa em `warn`.
- **Idempotência:** logue duplicatas ignoradas em `info` com `eventId`. Volume alto de duplicatas indica problema na origem.
- **Alertas no Axiom:** `level >= 50` e uma contagem de falhas definitivas por fila.

## 8. Testes por camada

Ficam em `apps/api/tests/{unit,e2e,support}`.

| O quê | Como | Arquivo |
|---|---|---|
| Contrato HTTP (status, envelope, auth, validação) | `makeApp` + supertest, com fakes de repository e client | `tests/e2e/*.test.ts` por contrato |
| Regra de negócio | use case direto, com `createMemoryRepository`, client fake e um `RequestContext` que grava os logs | `tests/unit/infrastructure/use-cases/use-cases.test.ts` |
| Código puro do core | função direta | `tests/unit/core/utils/*.test.ts` |
| Regras de arquitetura | leitura dos imports | `tests/unit/architecture.test.ts` |
| Integração externa | client com `fetcher` falso respondendo o formato real | `tests/e2e/app.test.ts` ("Cliente da API do Chat Plataforma") |

Detalhes do harness em `references/chat-plataforma/testing.md`.

# Observabilidade e integrações da casa

Chaves da nossa infra (Axiom, Redis, Resend, Langfuse) são **env vars do container da API**, não `credentials` (credentials são por organização instaladora).

| Serviço | Quando | Status no template |
|---|---|---|
| Axiom | sempre (logs da API + erros do front) | já integrado |
| Resend | só se o app envia e-mail | adicionar (seção 2) |
| Langfuse self-host (`https://langfuse.innovtech.solutions`) | só se o app usa IA/LLM | adicionar (seção 3) |

As chamadas às bibliotecas nos snippets abaixo foram verificadas com typecheck nas versões citadas (Node 24, TS 5.9, `erasableSyntaxOnly`). Tipos do app que aparecem neles (`RequestContext`, `LlmClient`) vêm do projeto.

## 1. Axiom (padrão)

Já pronto em `apps/api/src/server/logger.ts`: o logger do Fastify (pino) usa o transport `@axiomhq/pino` quando `AXIOM_TOKEN` e `AXIOM_DATASET` existem, e sempre escreve no stdout (Coolify mostra os logs). Sem as vars (dev/test) → só stdout. Headers sensíveis (`authorization`, `x-signature`, `x-api-key`, `x-account-id`) são redigidos; credentials nunca são logadas (há teste).

### requestId: um ID por requisição, do clique ao log

Boa prática: **correlation ID por requisição**, gerado na borda, propagado em header, presente em todo log daquela requisição e devolvido ao cliente. No template:

1. **nginx do web** gera `$request_id` (32 hex) e repassa como `X-Request-Id` para a API — vale para chamadas do iframe e da plataforma (install/diagnostics passam pelo mesmo domínio).
2. **Fastify** (`server/middlewares/request-id.ts` via `genReqId`): reaproveita o `x-request-id` recebido se tiver formato confiável (`[A-Za-z0-9-]{16,64}`, evita log injection); senão gera `randomUUID()`. `requestIdLogLabel: 'requestId'` → **todo log da requisição tem o campo `requestId`** (inclusive `incoming request`/`request completed` e os `req.log.*` das rotas).
3. **Resposta:** header `x-request-id` em toda resposta (sucesso ou erro).
4. **Mensagens de erro sem ID:** o envelope `{ error: { message } }` carrega só texto. O ID viaja **apenas no header `x-request-id`** e nos logs, então nada no corpo precisa ser limpo pelo front. A causa técnica (`cause`, stack, detalhe do zod) vai só para o log. Os textos vêm de duas constantes congeladas em `apps/api/src/core/utils/messages.ts`:
   - `USER_MESSAGES`: para o **atendente** (rotas `/api/app/*`). Linguagem simples e o que fazer: `unexpected`, `chatPlataformaUnavailable`, `chatPlataformaBusy`, `chatPlataformaRejected`, `integrationNeedsReconfiguration`, `integrationMissingPermission`, `installationNotFound` e `invalidRequest`. Erro de validação do zod nessas rotas vira `invalidRequest`, e o detalhe vai para o log. Erros de regra de negócio da própria plataforma (400/404/409/422, por exemplo a janela de 24h do WhatsApp oficial) já chegam em português para o atendente e são repassados como estão; 429 vira `chatPlataformaBusy`.
   - `ADMIN_MESSAGES`: para o **administrador da organização** (provision e diagnostics). A plataforma repassa o `error.message` do app, com o mesmo status, para a tela de aplicativos do painel. Por isso são frases para leigo que dizem o que fazer (`untrustedCall`, `invalidApiKey`, `apiKeyBlocked`, `installationNotFound`, `invalidRequest`, `chatPlataformaUnavailable`), e o detalhe do zod vai só para o log. Ver `references/chat-plataforma/integration-contract.md` §6.
   - Fluxo: o use case, o client ou o middleware lança `new AppError(status, USER_MESSAGES.x, { cause })`. O error handler (`server/middlewares/error-handler.ts`) loga com `requestId` e responde `{ error: { message } }`. O front mostra `error.message` como está (`friendlyMessage`) e só troca erro de rede do navegador por `FRONT_MESSAGES.offline`. Mensagem nova = chave nova na constante, nunca string solta.
5. **Front:** o atendente **nunca vê IDs** (ver "Erros para usuário leigo"). `ApiRequestError.requestId` lê o header só para correlação: falhas de query/mutation enviam `failedRequestId` em `/client-logs`, e erros de render (`ErrorBoundary`) enviam um `clientErrorId` — o log do front aponta para o log da API.
6. **Contexto de busca:** nas rotas `/api/app/*`, `req.log` vira child com `externalId` (instalação), `agentId` e `ticketId` (headers `x-agent-id`/`x-ticket-id` enviados pelo front, aceitos só se numéricos). Provisionamento loga `event: installation.installed|configured|uninstalled` com `externalId`; diagnóstico loga `event: diagnostics.checked` com status e componentes.

O cliente do Chat Plataforma repassa `x-request-id: req.id` (a plataforma aceita e devolve o header), então o mesmo ID aparece nos logs dos dois lados. Se o app chamar outros serviços próprios, faça o mesmo; em features de IA, ponha `requestId` no `metadata` do Langfuse.

### Consultas APL no Axiom

```kusto
// requestId (do header x-request-id ou de um alerta)
['<dataset>'] | where requestId == "3b9d7c2e-5a41-4f8e-9c6d-1e2f3a4b5c6d" | sort by _time asc

// erros do front ligados a uma requisição da API
['<dataset>'] | where source == "web" and (failedRequestId == "<id>" or clientErrorId == "<id>")

// erros de uma organização nas últimas 24h
['<dataset>'] | where externalId == "<externalId>" and level >= 50 | sort by _time desc

// o que aconteceu num atendimento
['<dataset>'] | where ticketId == "182736454928173645" | sort by _time asc

// saúde: diagnósticos não operacionais
['<dataset>'] | where event == "diagnostics.checked" and status != "operational"
```

Níveis pino: 30 info, 40 warn, 50 error. Crie no Axiom um monitor para `level >= 50` por dataset e um para `diagnostics.checked` com `status == "outage"`.

### Erros para usuário leigo (padrão de mercado)

Produtos para público não técnico (bancos digitais, apps de delivery, SaaS de atendimento) **não mostram IDs técnicos**: mostram o que aconteceu em linguagem simples e o que fazer; o suporte encontra o problema pelo contexto do usuário e por alertas, não por um código que o usuário repassa. Exibir `Request ID` é padrão de produto para devs (Stripe, Vercel). Decisão do template: **nenhum código de erro na UI** — o `requestId` vive só em header, envelope (para Backstage) e logs.

- **Mensagem:** sempre amigável e acionável, escrita no backend em `USER_MESSAGES` (`core/utils/messages.ts`) e no front em `FRONT_MESSAGES` (`lib/error-message.ts`): "Não conseguimos falar com o Chat Plataforma agora. Tente novamente em instantes.", "A integração precisa ser reconfigurada. Avise o administrador da sua empresa.", "Sem conexão com o servidor…". Nada de "Erro interno", "Failed to fetch", stack ou IDs na tela — detalhe técnico vai em `cause`, só para o log.
- **Ação principal:** "Tentar de novo" (retry). No `ErrorBoundary`, recarrega o iframe (a URL é fixa, então o contexto do atendimento é preservado).
- **Suporte pelo contexto:** o atendente diz "deu erro no atendimento tal, por volta das 14h". Todo log das rotas do iframe tem `externalId`, `agentId` e `ticketId`:

```kusto
['<dataset>'] | where ticketId == "<id do ticket>" and level >= 40 | sort by _time desc
['<dataset>'] | where agentId == "<id do atendente>" and _time > ago(2h) and level >= 50
['<dataset>'] | where externalId == "<externalId da empresa>" and level >= 50 | sort by _time desc
```

- **Alertas proativos > relato do usuário:** monitores no Axiom para `level >= 50` e `diagnostics.checked` com `outage` avisam o time antes de alguém reclamar; a notificação traz o `requestId` para abrir a requisição inteira.

### Convenções de log

- Mensagem curta e estável em PT (`'aplicativo instalado'`), dados em campos (`{ externalId, event }`), nunca interpolar dados na mensagem — facilita agrupar.
- `event: LOG_EVENT.<nome>` (`core/utils/log-events.ts`, valor `'<recurso>.<ação>'`) para fatos de negócio que você vai querer contar/alertar — adicione o evento novo na constante, nunca string solta.
- Nunca logar credentials, corpo de mensagens de clientes ou dados pessoais além de IDs.
- Um dataset por app (ex: `onvio` na Zappy e `onvio-cp` no Chat Plataforma); `service: 'api'` vem do logger base, `source: 'web'` nos logs vindos do front.
- O transport roda em worker thread: `app.close()` no SIGTERM (já no `server.ts`) faz o flush.
- Jobs de fila, idempotência e falhas de integração: campos e níveis em `references/chat-plataforma/architecture.md` §7.3.

## 2. Resend (só se enviar e-mail)

> **Exemplo ilustrativo:** O cliente de e-mail (`infrastructure/libs/` com o Resend) e o contrato em `core/repository/` **não existe no template**. Crie só quando o app precisar, nas camadas indicadas.

`pnpm --filter api add resend` (verificado com resend 6.x; passe antes pelo `scripts/check-dependency.mjs`). Env: `RESEND_API_KEY` e `RESEND_EMAIL_FROM` (ex.: `App <no-reply@seudominio.com>`, com domínio verificado no Resend). Adicione os dois ao `env.ts`, opcionais ou obrigatórios conforme o app dependa de e-mail.

O mailer é uma integração como as outras: o contrato (`Mailer`) fica em `core/repository/mailer.interface.ts`, a implementação em `infrastructure/libs/resend/mailer.ts`, entra pelo `server/bootstrap.ts` e é chamado pelo use case. Nos testes, o `bootstrap.ts` recebe um fake.

```ts
import { Resend } from 'resend'
import { AppError } from '#src/core/utils/app-error.ts'
import { USER_MESSAGES } from '#src/core/utils/messages.ts'

export type Mailer = ReturnType<typeof createMailer>

export const createMailer = (apiKey: string, from: string) => {
  const resend = new Resend(apiKey)
  return {
    send: async (to: string, subject: string, html: string) => {
      const { data, error } = await resend.emails.send({ from, to, subject, html })
      if (error) {
        throw new AppError(502, USER_MESSAGES.unexpected, { cause: new Error(`Resend: ${error.message}`) })
      }
      return data?.id
    },
  }
}
```

Logue o `id` devolvido, nunca o conteúdo nem o destinatário completo. Envio em lote ou com anexo pesado vai para a fila (`references/chat-plataforma/architecture.md` §7.1).

## 3. Langfuse self-host (só se usar IA)

> **Exemplo ilustrativo:** `infrastructure/libs/tracing.ts` e a chamada de `startTracing()` em `server/server.ts` **não existe no template**. Crie só quando o app precisar, nas camadas indicadas.

Instância: `https://langfuse.innovtech.solutions`. SDK v4+ (OpenTelemetry), verificado com `@langfuse/otel` e `@langfuse/tracing` 6.x.

`pnpm --filter api add @langfuse/otel @langfuse/tracing @opentelemetry/sdk-node`

Env do container da API: `LANGFUSE_BASE_URL=https://langfuse.innovtech.solutions`, `LANGFUSE_PUBLIC_KEY` e `LANGFUSE_SECRET_KEY` (um projeto por app no Langfuse).

`infrastructure/libs/tracing.ts`: chame `startTracing()` no topo do `server/server.ts`, antes do `buildApp`, e `await sdk?.shutdown()` no shutdown (faz o flush). Sem `LANGFUSE_SECRET_KEY` (dev e testes) não liga nada.

```ts
import { LangfuseSpanProcessor } from '@langfuse/otel'
import { NodeSDK } from '@opentelemetry/sdk-node'

export const startTracing = () => {
  if (!process.env.LANGFUSE_SECRET_KEY) return null
  const sdk = new NodeSDK({ spanProcessors: [new LangfuseSpanProcessor()] })
  sdk.start()
  return sdk
}
```

Uso no use case da feature de IA. O cliente do LLM é uma integração (contrato em `core/repository/`, implementação em `infrastructure/libs/<provedor>/client.ts`) injetada pelo `server/bootstrap.ts`; `sessionId = ticketId` e `userId = agentId` agrupam custo e qualidade por atendimento, e o `requestId` liga o trace ao log do Axiom:

```ts
import { propagateAttributes, startActiveObservation, startObservation } from '@langfuse/tracing'

export const summarizeTicket = (
  llm: LlmClient,
  input: { externalId: string; agentId: string; ticketId: string; transcript: string },
  ctx: RequestContext,
) =>
  propagateAttributes(
    {
      userId: input.agentId,
      sessionId: input.ticketId,
      metadata: { externalId: input.externalId, requestId: ctx.requestId },
    },
    () =>
      startActiveObservation('resumir-ticket', async (span) => {
        span.update({ input: { ticketId: input.ticketId } })
        const generation = startObservation(
          'llm',
          { model: llm.model, input: input.transcript },
          { asType: 'generation' },
        )
        const res = await llm.complete(input.transcript)
        generation
          .update({ output: res.text, usageDetails: { input: res.inputTokens, output: res.outputTokens } })
          .end()
        span.update({ output: res.text })
        return res.text
      }),
  )
```

Não mande credentials nem dados pessoais desnecessários em `input`. Adicione um `check('langfuse', …)` no diagnóstico só se a IA for essencial ao app.

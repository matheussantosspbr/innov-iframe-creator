# Tempo real: escolha a opção mais simples que resolve

Leia antes de implementar qualquer atualização "ao vivo" no iframe: status do ticket, contador, notificação, progresso de processamento etc.

## Regra

Suba de degrau só quando o anterior não atender um requisito **concreto**. Os requisitos que contam são latência exigida, volume, comunicação bidirecional ou algo já previsto no projeto. Registre o motivo da escolha no PR ou na entrega.

| Degrau | Quando usar | Custo |
|---|---|---|
| **0. Refetch sob demanda** | O dado só precisa estar certo quando o atendente olha. Já vem pronto no template: refetch ao focar o iframe, botão "Atualizar" e invalidação após mutation. | Zero. |
| **1. Polling** (`refetchInterval` do TanStack Query) | Atraso de 10 a 30s é aceitável, como status de processamento ou lista que muda pouco. | Uma linha. Gera uma requisição por intervalo por iframe aberto. |
| **2. SSE** (Server-Sent Events) | O servidor precisa **avisar** o front em segundos e o fluxo é de mão única, servidor → cliente. É o caso típico de evento vindo de webhook do Chat Plataforma ou de um job terminando. | Uma rota e um leitor no front (~40 linhas), sem lib. Passa pelo nginx do template sem mudança de configuração. |
| **3. WebSocket** | Comunicação **bidirecional** frequente e de baixa latência, como edição colaborativa, chat próprio do app ou presença. | Lib (`@fastify/websocket`), nginx com `Upgrade`, heartbeat, reconexão e, se houver mais de uma réplica, pub/sub compartilhado. |

As ações do usuário (salvar, aplicar tag) continuam sendo POST/PUT normais mesmo com SSE. Não é motivo para usar WebSocket.

## Trade-offs que pesam neste projeto

- **Iframe de 384px aberto por vários atendentes:** cada conexão aberta é um recurso preso no servidor. Polling de 15 a 30s com o padrão do TanStack Query (não atualiza com a aba oculta) costuma custar menos do que manter conexões abertas.
- **Uma réplica da API, que é o padrão no Coolify:** pub/sub em memória (um `Map` de tópicos) funciona. Se a API passar a ter mais de uma réplica, os eventos precisam de um barramento compartilhado (ex.: Redis pub/sub). Só faça isso quando escalar de fato.
- **nginx:** SSE funciona sem mudar o template, desde que a rota mande `X-Accel-Buffering: no` e um heartbeat a cada 25s, porque o `proxy_read_timeout` padrão é de 60s. WebSocket exige `proxy_set_header Upgrade $http_upgrade` e `Connection "upgrade"` numa `location` própria.
- **Autenticação:** o `EventSource` nativo **não envia headers**, então o `x-account-id` teria de ir na URL e apareceria nos logs. Por isso o leitor abaixo usa `fetch` com stream, que mantém os mesmos headers do resto do app.
- **Rate limit da organização:** a API do Chat Plataforma aceita 1200 requisições por 10 s **somando painel, integrações e todos os apps** da organização. Polling que chama a plataforma a cada ciclo, multiplicado pelos iframes abertos, consome esse limite. Prefira polling contra dados do próprio app ou cache curto no backend.
- **Efeito colateral de leitura:** `GET /v1/tickets/:id/messages` (e `contact-messages`/`group-messages`) zera o contador de não lidas do ticket. Nunca faça polling desses endpoints.
- **Origem dos eventos:** o Chat Plataforma tem webhooks de saída (seção "Recebendo webhooks" abaixo). O fluxo é: plataforma → webhook no backend → `publish` → SSE → iframe.

## Degrau 1: polling

```ts
export const ticketQuery = (api: Api, ticketId: string) =>
  queryOptions({
    queryKey: QUERY_KEYS.ticket(ticketId),
    queryFn: () => api.getTicket(ticketId),
    refetchInterval: 15_000,
  })
```

## Degrau 2: SSE sem lib (verificado através do nginx do template)

> **Exemplo ilustrativo:** `core/utils/realtime.ts` (o pub/sub) e o controller de eventos abaixo **não existe no template**. Crie só quando o app precisar, nas camadas indicadas.

O pub/sub em memória é código puro, sem Fastify nem Prisma, então fica em `core/utils/realtime.ts`: tanto o use case (publica) quanto o controller (assina) podem importá-lo sem quebrar a regra de dependência (`references/chat-plataforma/architecture.md` §3). Se trocar por Redis pub/sub, o contrato passa a ser uma interface em `core/repository/` e a implementação vai para `infrastructure/libs/`. Quem publica é o **use case** que mudou o dado (ou o processador do webhook), depois de gravar:

```ts
type Listener = (event: string, data: unknown) => void
const listeners = new Map<string, Set<Listener>>()

export const ticketTopic = (externalId: string, ticketId: string) => `${externalId}:ticket:${ticketId}`

export const subscribe = (topic: string, listener: Listener) => {
  const set = listeners.get(topic) ?? new Set()
  set.add(listener)
  listeners.set(topic, set)
  return () => {
    set.delete(listener)
    if (set.size === 0) listeners.delete(topic)
  }
}

export const publish = (topic: string, event: string, data: unknown) => {
  for (const listener of listeners.get(topic) ?? []) listener(event, data)
}
```

A rota fica em arquivos próprios (`presentation/routes/events.routes.ts` e `presentation/controllers/events.controller.ts`), registrada no bloco do iframe em `server/bootstrap.ts` (`GET /api/app/events`), que já autentica o `x-account-id`. O controller mantém a conexão aberta. O tópico sempre inclui o `externalId` da instalação, para que um iframe nunca receba eventos de outra organização:

```ts
export const createEventsController = () => ({
  stream: async (req: ZodRequest<typeof streamSchema>, reply: FastifyReply) => {
    const topic = ticketTopic(installationOf(req).externalId, req.query.ticketId)
    reply.raw.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
      [HEADERS.requestId]: req.id,
    })
    const send = (event: string, data: unknown) =>
      reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
    const unsubscribe = subscribe(topic, send)
    const heartbeat = setInterval(() => reply.raw.write(': ping\n\n'), 25_000)
    req.raw.on('close', () => {
      clearInterval(heartbeat)
      unsubscribe()
    })
    reply.hijack()
  },
})
```

`streamSchema` valida `querystring: { ticketId: z.string().regex(/^\d{1,20}$/) }`. Os nomes de evento entram num enumerado, por exemplo `REALTIME_EVENT = Object.freeze({ ticketUpdated: 'ticket.updated' } as const)`. Cada mensagem é um dado pequeno, porque o front invalida a query e busca de novo, em vez de receber o objeto inteiro.

No front, um leitor via `fetch` que mantém os headers:

```ts
export const readEvents = async (
  response: Response,
  onEvent: (event: string, data: unknown) => void,
) => {
  const reader = response.body?.pipeThrough(new TextDecoderStream()).getReader()
  if (!reader) return
  let buffer = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) return
    buffer += value
    let boundary = buffer.indexOf('\n\n')
    while (boundary !== -1) {
      const block = buffer.slice(0, boundary)
      buffer = buffer.slice(boundary + 2)
      const event = /^event: (.*)$/m.exec(block)?.[1] ?? 'message'
      const data = /^data: (.*)$/m.exec(block)?.[1]
      if (data) onEvent(event, JSON.parse(data))
      boundary = buffer.indexOf('\n\n')
    }
  }
}
```

Use num hook `useRealtimeInvalidation()` montado uma vez no `App`. Ele abre o stream com os headers do `createApi`, chama `queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ticket(id) })` a cada evento, reconecta com backoff (1s, 2s, 5s, até 30s) e fecha no unmount com `AbortController`. Se a conexão cair de vez, o refetch ao focar o iframe continua garantindo dado correto.

Testes: no backend, `publish` deve chegar só aos assinantes do tópico (inclusive não vazar para outro `externalId`) e o `close` deve remover o listener. No front, `readEvents` com um `Response` feito de string deve chamar `onEvent` na ordem certa.

## Degrau 3: WebSocket (só com justificativa)

Pré-requisitos antes de começar:
- requisito bidirecional real, já registrado;
- `@fastify/websocket` aprovado pelo checklist de `references/chat-plataforma/dependencies.md`;
- `location /api/ws` no `nginx.conf.template` com os headers de `Upgrade` e `proxy_read_timeout` maior;
- autenticação no handshake, porque não dá para mandar header customizado pelo browser: use um token curto emitido por `/api/app` em vez do `accountId` na URL;
- heartbeat e reconexão;
- plano para múltiplas réplicas.

## Recebendo webhooks do Chat Plataforma

Detalhe dos eventos e payloads em `references/chat-plataforma/api/auth-agents-webhooks.md` §5. O que muda no app:

- **Cadastro:** `POST /v1/webhooks` com `{ name, url, events, active: true }` (`name` é obrigatório na prática; sem ele dá 409 ou 500). Pode ser feito no install com a key da organização (permissão `webhooks:create`) ou manualmente pela organização. Guarde o `id` devolvido para remover no uninstall (`DELETE /v1/webhook/:id`, singular). O `secret` devolvido não serve para validar (abaixo).
- **Autenticação:** ⚠ o header `X-Webhook-Signature` **não é verificável** (a plataforma assina com uma chave aleatória a cada envio). Não rejeite por assinatura. Use um token aleatório longo por instalação **na URL** (`https://app/api/webhooks/chatplataforma/<token>`), compare em tempo constante e trate o evento só como aviso: confirme o estado na API antes de qualquer ação sensível.
- **Rota:** arquivos próprios (`presentation/routes/chatplataforma-webhooks.routes.ts` e o controller correspondente), fora de `/api/app` (não tem `x-account-id`) e fora de `/api/provision`. Guarde o token por instalação numa coluna própria (`webhook_token CHAR(64)` com índice único, ver `references/chat-plataforma/database.md`). Ache a instalação pelo token, valide o envelope `{ id, organizationId, event, timestamp, data }` com zod e responda **2xx rápido** (timeout de 10 s): o processamento vai para a fila (`references/chat-plataforma/architecture.md` §7.1) com o `id` do evento como `jobId`.
- **Entrega:** até 5 tentativas em cerca de 65 s (qualquer não-2xx é retentado, inclusive 4xx), depois o evento é descartado. Duplicatas são possíveis: **deduplique por `id`** com a tabela `processed_events` (padrão verificado em `references/chat-plataforma/architecture.md` §7.2) e use o mesmo `id` como `jobId` se enfileirar. **Sem ordem garantida:** use `timestamp` e o estado atual da API, nunca a ordem de chegada.
- **Cobertura:** não há evento de ticket criado, contato, tag, agente ou conexão; edições, reações e exclusões feitas pelo contato no WhatsApp não geram evento. Para esses casos, polling ou refetch.
- **IDs** chegam como string; o contato da mensagem pode vir `null` quando é o mesmo de `data.message.ticket.contact`.

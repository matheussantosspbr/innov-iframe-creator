# ZDK (Kit de Desenvolvimento Zappy)

> **Índice desta referência**
> - `zdk.md` (este arquivo): guia de uso, configuração, erros, como os projetos usam.
> - `zdk-metodos.md`: **todos os 52 métodos** do ZDK 1.0 e as 48 operações da API (parâmetros, query, corpo e respostas).
> - `zdk-modelos.md`: os 47 modelos (schemas) com todos os campos e enums.
> - `zdk-tipos.md`: configuração, retry, rate limit, erros e tipos auxiliares (trechos literais do pacote).
> - `zdk-quirks.md`: as 24 quirks do contrato, texto integral.
> - `zdk-0x.md`: a API antiga (0.4 a 0.7), ainda usada em vários projetos.

SDK TypeScript para a **API REST da Zappy**. É o equivalente, na Zappy, do cliente HTTP que o template do Chat Plataforma escreve à mão (`integrations/chatplataforma/client.ts`): em apps da Zappy use o ZDK, não escreva `fetch` na mão.

Fontes: README, `package.json` e declarações de tipos (`dist/index.d.ts`) da versão **1.0.0** instalada em `/home/comhub/code/work/zappy/veri/server/node_modules/zdk`, mais o uso real nos projetos de `/home/comhub/code/work/zappy/`. Repositório do pacote: `github.com/innovtech-developers/zdk`. A pasta `docs/` do repositório (MIGRATION, API-QUIRKS, API-DIVERGENCE, RESILIENCE, AUTH, RECIPES) **não vai no pacote npm** e não foi lida; este arquivo só afirma o que está no README, nos tipos e no código dos projetos.

## Versões

O ZDK tem uma quebra grande entre a 0.x e a 1.0. Nos projetos locais convivem as duas:

| Versão | Projetos (observado nos `package.json` e `node_modules`) |
|---|---|
| 1.0.0 | `veri/server` (instalada), `conexa` |
| 0.7.x | `onvio`, `pipedrive`, `crm-simples`, `jusbrasil`, `nibo`, `SCI` |
| 0.4.x a 0.6.x | `drive`, `ausent`, `innovchat`, `omie`, `conta-azul` |

**Em app novo use a 1.0.** O resto deste arquivo descreve a 1.0, salvo onde diz o contrário.

| | 0.x | 1.0 |
|---|---|---|
| Construtor | posicional: `new Zdk(url, token)` | objeto: `new Zdk({ baseUrl, token })` |
| Erro | devolve `T \| { error }` (checa-se `"error" in result`) | **sempre lança** uma subclasse de `ZdkError` |
| Tipos | prefixo `I` (`ITicket`) | sem prefixo (`Ticket`) |
| Origem | escrito à mão | derivado do contrato OpenAPI real (`/swagger.json`) |
| Dependências | `axios`, `form-data` | **zero**: `fetch`, `FormData` e `AbortController` nativos, Node 20 ou mais |

A migração 0.7 para 1.0 é uma quebra limpa, sem shims (o README aponta para `docs/MIGRATION.md`, que não está no pacote).

## Instalação e configuração

```sh
pnpm add zdk
```

Requer Node 20 ou mais. Com TypeScript, `@types/node` precisa estar nas `devDependencies` do próprio app (sem `lib: "dom"`, `Response`, `Headers` e `FormData` vêm de lá).

```ts
import { Zdk } from 'zdk'

const zdk = new Zdk({
  baseUrl: 'https://api-<tenant>.zapcontabil.chat', // ou .zapplataforma.chat
  token: '<chave de API, 250 caracteres>',
})
```

- `new Zdk(...)` é **síncrono e sem I/O**: só valida o formato de `baseUrl` e `token`, e lança `ZdkConfigError` se algo estiver errado.
- `baseUrl` precisa ter o host `api-<tenant>` em um dos dois domínios da Zappy (`zapcontabil.chat` ou `zapplataforma.chat`). A allowlist de domínio não tem exceção, porque o token vai no header `Authorization` de toda chamada.
- O token tem **250 caracteres**.
- `strictApiHost` e `strictTokenLength` relaxam só as checagens de ergonomia (formato do host e tamanho do token), nunca a allowlist de domínio. O `veri/server` os desliga (`false`) porque não confirmou que todo token já guardado tem 250 caracteres.
- Sem argumentos, `new Zdk()` lê `ZAPPY_URL` e `ZAPPY_TOKEN` de `process.env`. A lib **não** carrega `.env` sozinha: carregue antes de instanciar.

### Provar a credencial

`new Zdk()` nunca faz requisição. Para provar que a URL e o token funcionam:

```ts
const zdk = await Zdk.connect({ baseUrl, token }) // new Zdk + verify()
const { connections, rateLimit } = await zdk.verify() // numa instância existente
```

`verify()` reusa `GET /api/connections`, a mesma chamada de que qualquer envio precisa para saber o `connectionFrom`. Lança `ZdkAuthError` (401), `ZdkConfigError` (resposta 2xx sem `connections`, ou seja, o host não parece uma API Zappy) ou `ZdkNetworkError` (host inalcançável).

### Opções (`ZdkOptions`)

| Opção | Padrão | Para que serve |
|---|---|---|
| `retryConfig` | `attempts: 3`, `baseDelayMs: 250`, `maxDelayMs: 8000`, `maxRetryAfterMs: 30000`, `retryOnTimeout: false`, `retryOnRateLimit: true`, `retryUnsafeOnRateLimit: false`, `deadlineMs: null` | Retry automático (parcial, mescla com o padrão). |
| `defaultTimeoutMs` | `10_000` | Timeout de cada tentativa. |
| `verifyCapabilities` | `false` | Pré-checa se a operação existe na instância, antes de cada chamada. |
| `rateLimit` | `{ mode: "observe" }` | Comportamento de rate limit. Nunca dorme sozinho. |
| `onRateLimit` | nenhum | Callback com o orçamento de rate limit a cada resposta que traz os headers. |
| `semaphore` | nenhum | Limita concorrência. |
| `strictApiHost`, `strictTokenLength` | `true` | Ver acima. |

**Pior caso de uma chamada com os padrões:** `timeoutMs × attempts + backoff ≈ 10s × 3 + ~2,25s ≈ 32s`. `retryConfig.deadlineMs` limita o total. Num handler de 30s (serverless) ou numa tela de iframe que espera a resposta, isso é tempo demais; ajuste.

## Recursos

`Zdk` expõe 12 recursos, 1:1 com as 48 operações do contrato (`readonly`, um por propriedade):

| Propriedade | Cobre | Métodos |
|---|---|---|
| `zdk.connections` | Conexões do WhatsApp | `list`, `get(id)` (estrito), `findUsable(preferredId?)` |
| `zdk.contacts` | Contatos | `list`, `get`, `create`, `update`, `setTags` |
| `zdk.tags` | Tags | `list`, `get`, `create`, `update` |
| `zdk.queues` | Setores | `list`, `get`, `create`, `update`, `createMany`, `listWithUsers` |
| `zdk.users` | Usuários do sistema (só leitura) | `list`, `get` |
| `zdk.messages` | Mensagens avulsas | `list`, `get`, `sendText`, `sendMedia`, `sendMediaByUrl`, `sendMany` |
| `zdk.tickets` | Atendimentos (o maior, 11 operações) | `list`, `searchByContact`, `get`, `update`, `transfer`, `resolve`, `sendText`, `sendMedia`, `sendMediaByUrl`, `sendAndClose`, `info`, `sendTemplate` |
| `zdk.templates` | Templates da API Oficial | `list(connectionId)`, `send`, `sendBulk` |
| `zdk.storage` | Armazenamento | `signedUrl`, `uploadTemp` |
| `zdk.webhooks` | Webhooks | `list`, `get`, `create`, `update`, `delete` |
| `zdk.dashboard` | Relatórios agregados | `ticketsByAgent`, `ticketsByQualification`, `ticketsGrouped` |
| `zdk.metrics` | Métricas de mensagens | `messages` |

Pegadinhas dos recursos (dos comentários dos tipos):
- **Conexões:** não existe `GET /api/connections/{id}`; `get` e `findUsable` são helpers resolvidos no cliente. `findUsable` devolve a conexão preferida se estiver utilizável (`CONNECTED` ou `WHATSAPP_AUTH`) ou a primeira utilizável; lança `ZdkNotFoundError` se não houver nenhuma.
- **Ids:** `tickets`, `contacts`, `connections` e `webhooks` usam `id: number`; `tags`, `queues` e `users` usam `id: string`.
- **`messages.sendText(to, ...)`** devolve a `Message`. **`tickets.sendText(id, ...)`** devolve o `Ticket` atualizado, não a mensagem enviada. **`tickets.sendAndClose`** só aceita multipart e devolve `{ message, ticket }`.
- **Mídia:** `sendMedia` envia o arquivo binário (multipart) e `sendMediaByUrl` envia só a URL (json). O tipo é `image`, `video`, `audio`, `voice` ou `document`.
- **`tickets.resolve`** com `feedbackOption: "send-end-message"` dispara mensagem de encerramento ao contato (é uma operação "unsafe"). Se omitido, o padrão é `"none"`.
- **`contacts.setTags`** por padrão adiciona (não substitui); `replaceTags` troca; `createTagIfNotExists` cria a tag nova.
- **Paginação:** `list` aceita `page` e `pageSize`; a resposta traz `count`. `pageSize` não tem máximo no contrato (a duração da resposta é ilimitada).
- **Dashboard:** os filtros `userIds[]`, `queueIds[]` e `tagIds[]` são arrays reais, serializados como chave repetida.

## Quickstart

```ts
import { Zdk, ZdkOfficialApiWindowError } from 'zdk'

const zdk = await Zdk.connect({ baseUrl, token })
const connection = await zdk.connections.findUsable()

try {
  const message = await zdk.messages.sendText('5511999999999', {
    body: 'Olá! Como posso ajudar?',
    connectionFrom: connection.id,
  })
} catch (error) {
  if (error instanceof ZdkOfficialApiWindowError) {
    // API Oficial: 24h sem o contato responder, é preciso enviar template.
  } else {
    throw error
  }
}
```

## API Oficial (WhatsApp Cloud API)

Conexões da API Oficial aparecem com `status: "WHATSAPP_AUTH"`. Fora da janela de 24h, texto livre é rejeitado (`ZdkOfficialApiWindowError`) e é preciso enviar **template**:

```ts
const info = await zdk.tickets.info(ticketId)

if (info.canSendMessageWithOficialApi) {
  await zdk.messages.sendText(to, { body, connectionFrom })
} else {
  const templates = await zdk.templates.list(connection.id)
  const template = templates.find((t) => t.status === 'APPROVED' && t.id !== undefined)
  if (!template?.id) throw new Error('nenhum template aprovado disponível')

  await zdk.templates.send(to, { connectionFrom: connection.id, templateId: template.id.toString() })
}
```

`templates.sendBulk` devolve **falha parcial por número**, nunca lança pelo lote inteiro: confira `results[].status` (`"error"`).

## Erros tipados

Todo método lança, nunca devolve `T | { error }`. Hierarquia:

| Classe | Quando |
|---|---|
| `ZdkError` | base; `instanceof` pega qualquer erro do ZDK. Tem `code`, `attempts` e `retryable`. |
| `ZdkConfigError` | `baseUrl` ou `token` inválido; nunca chega a fazer requisição. |
| `ZdkNetworkError` | DNS, conexão recusada, socket derrubado. |
| `ZdkTimeoutError` | estourou o timeout da tentativa. |
| `ZdkAbortError` | o `AbortSignal` do próprio app disparou. |
| `ZdkUnsupportedOperationError` | a operação não existe **nesta instância** (ver "Capabilities"). |
| `ZdkHttpError` (base HTTP, tem `status`) | `ZdkValidationError` (400), `ZdkOfficialApiWindowError` (400 com janela de 24h fechada), `ZdkAuthError` (401/403), `ZdkNotFoundError` (404), `ZdkRateLimitError` (429, com `retryAfterMs`), `ZdkServerError` (5xx). |

`attempts` e `retryable` dizem quantas tentativas o retry automático já fez e se aquela classe de falha é do tipo que se repete. `ZdkAuthError.code` distingue `ERR_INVALID_API_KEY` (token errado) de `ERR_NO_AUTH_HEADER_PRESENT` (bug do SDK).

**Retry e efeitos externos:** a API **não tem `Idempotency-Key`** (Q11). Repetir um POST com efeito externo (enviar mensagem) pode duplicar o efeito; por isso `retryUnsafeOnRateLimit` é `false` e o `timeout` não repete por padrão.

## Capabilities: a API não é igual em toda instância

O contrato varia pela **versão implantada**, não pelo tenant: a mesma operação pode existir numa instância e não em outra (exemplo: Webhooks está ausente em algumas). Chamar uma operação inexistente vira `ZdkUnsupportedOperationError`, nunca um 404 cru.

```ts
if (zdk.supports('GET /api/webhooks')) { /* habilita a tela de webhook */ }
await zdk.capabilities() // carrega e cacheia o swagger da instância, uma vez
```

Por padrão a checagem só ocorre **sob demanda** (quando um 404 real acontece). `verifyCapabilities: true` faz a checagem prévia em toda chamada.

## Rate limit

`zdk.rateLimit` guarda o orçamento da última resposta com os headers `x-ratelimit-limit`, `remaining` e `reset` (o `reset` é um epoch absoluto do servidor). O modo padrão é `observe`: o ZDK **nunca dorme sozinho** esperando o limite. O 429 e o `Retry-After` não estão no contrato; foram observados em produção (Q8, Q14).

## Desvios conhecidos do contrato (as 24 "quirks")

O ZDK corrige em tipos e em runtime defeitos reais do contrato OpenAPI. Os mais importantes para quem consome (lista completa em `API_QUIRKS`, exportada pelo pacote):

| Id | Desvio |
|---|---|
| Q1 | O enum de status da conexão omite `WHATSAPP_AUTH` (API Oficial ativa) e `qrcode` (aguardando pareamento). |
| Q2, Q3, Q24 | O contrato marca quase tudo como opcional (Q2, Q3: faltam os `required`) e, ao contrário, o gerador marca como obrigatório o que tem `default` (Q24). O ZDK ajusta: `name` e `number` do contato são obrigatórios; `isGroup`, `blocked`, `noCheckNumber`, `feedbackOption`, `active`, `replaceTags` e `createTagIfNotExists` são opcionais. |
| Q6 | O erro de janela fechada (`ERR_OFFICIAL_API_WINDOW_CLOSED`) chega como 400 genérico; o ZDK mapeia para `ZdkOfficialApiWindowError`. |
| Q7 | Em `messages.sendMany` com arquivos, `messages` vai como JSON stringificado dentro do multipart. O método serializa. |
| Q9, Q10 | `pageSize` e o array `to` de `sendBulk` sem limite máximo. Template em massa responde 200 com falha parcial por número. |
| Q11 | Sem `Idempotency-Key`; retry de POST com efeito externo não é seguro. |
| Q12, Q16 | Token de 250 caracteres e host no formato `api-<tenant>.<domínio>`; nenhum dos dois documentado, ambos validados no `new Zdk`. |
| Q13 | O 401 só está documentado em 1 de 48 operações, mas ocorre em qualquer rota autenticada. |
| Q15 | O contrato varia por versão implantada, não por tenant (ver "Capabilities"). |
| Q17 | O corpo de erro real é `{ error, errorData }`; o schema só declara `error`. |
| Q18 | `connections.list()` responde `{ connections: Connection[] }`, não um objeto único. O ZDK desembrulha. |
| Q19, Q21 | `messages.sendText` responde `{ message: Message }` (confirmado com chamada real). Em `Message`, os campos `id`, `subtype`, `isMedia` e `myContact` contradizem o contrato; `id` é string (ID da mensagem no WhatsApp). |
| Q20 | O envio de mídia aceita dois content-types: multipart binário ou json com `url`. |
| Q22, Q23 | `templates.list` responde `{ templates: [...] }`; `type` e `status` do template trazem valores fora do enum documentado (por exemplo `"marketing-catalog"` e `"APPROVED"`). |

## Como os projetos usam o ZDK

Padrão observado nos projetos da Zappy:
- **Multi-tenant:** cada tenant (cliente) guarda a **URL da instância** e o **token** dele. O app instancia um `Zdk` por tenant (o `onvio` faz isso em `boot-pool-manager.ts` e em `tenant-service.ts`).
- **Validar o tenant ao cadastrar:** o app confere se a URL é de um domínio permitido e contém `api-`, e testa a credencial com `connections.list()` (na 1.0, `verify()` ou `Zdk.connect()`).
- **Token cifrado em repouso:** o `veri/server` guarda o token cifrado e o decifra ao criar o cliente (`decryptSecret`).
- **Embrulhar o ZDK num gateway do app** (`veri/server/src/infrastructure/libs/zappy.ts`): o domínio fala com uma interface própria (`ZappyGateway`), e a classe `ZappyClient` converte as respostas do ZDK. Isso isola o app das mudanças do SDK.
- **Criação preguiçosa do cliente:** `new Zdk()` pode lançar `ZdkConfigError` (token vazio ou fora do formato); criá-lo dentro do `try` de cada chamada faz um token ruim degradar como qualquer outra falha em vez de derrubar o app.

### Tempo e retry numa tela de iframe

O `veri/server` mediu numa instância real: `GET /api/connections` leva **3,3s a 7,7s**. Qualquer timeout menor que cerca de 10s lê uma instância saudável como se estivesse fora do ar. Como o iframe fica esperando essas chamadas, o retry padrão do ZDK (3 tentativas, backoff de até 8s) deixaria o widget em branco por perto de 30s. A escolha do projeto:

```ts
new Zdk({
  baseUrl, token,
  retryConfig: { attempts: 1 }, // uma tentativa generosa em vez de várias curtas
  defaultTimeoutMs: 10_000,
})
```

Uma falha deve **degradar** a tela, não quebrá-la. Não empilhe uma política de retry própria em cima da do ZDK: o ZDK 1.0 já cuida de timeout, retry e backoff, e duas políticas juntas fazem uma instância ruim demorar muito mais para desistir.

## Pendências desta referência

- O iframe da Zappy tem **420px** de largura (o do Chat Plataforma, 384px). O contrato do iframe da Zappy (parâmetros `tenantId` e `userId`) está só nos `docs/` do template `assets/zappy-contabil/`, que traz o código-base (API em Clean Architecture, web, tenants com token cifrado, middleware `tenant-context` que resolve o tenant, rotas de exemplo via ZDK, middleware de chave de operação `x-comhub-key` e o cliente do ZDK em `apps/api/src/infrastructure/libs/zappy/client.ts`), mas sem login nem rotas de negócio além dessas.
- Não foram lidos `docs/MIGRATION.md`, `AUTH.md`, `RESILIENCE.md`, `RECIPES.md` e `API-DIVERGENCE.md` do repositório do ZDK (não vão no pacote npm). Faltam a matriz completa de retry por classe de falha e as receitas prontas.
- Os eventos e o payload que a Zappy envia aos **webhooks** não estão no pacote (só os métodos de cadastro).
- A 0.x foi documentada pela versão 0.7.3, a única 0.7 instalada.
- Não rodei o ZDK contra uma instância real; tudo vem do código e da documentação do pacote.

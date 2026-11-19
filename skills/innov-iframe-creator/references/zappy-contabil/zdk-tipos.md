# ZDK 1.0: configuração, retry, rate limit, erros e tipos auxiliares

> Trechos **literais** de `dist/index.d.ts` (`zdk@1.0.0`), com os comentários originais. Para o uso, veja `zdk.md`.

## Configuração e instância

```ts
interface ZdkConfigInput {
    /** @default process.env.ZAPPY_URL */
    readonly baseUrl?: string;
    /** @default process.env.ZAPPY_TOKEN */
    readonly token?: string;
    readonly strictApiHost?: boolean;
    readonly strictTokenLength?: boolean;
}
```

```ts
/**
 * Fachada pública do ZDK v1 (§5.6/§5.7 da spec). Compõe os 12 recursos sobre
 * um `ApiClient` único; `new Zdk()` é síncrono e sem I/O — só valida
 * formato. Prova de credencial é sempre explícita, via `verify()` ou
 * `Zdk.connect()`.
 */

interface ZdkOptions extends ZdkConfigInput {
    readonly semaphore?: Semaphore;
    /** Parcial: mesclado por cima de DEFAULT_RETRY_CONFIG (não precisa especificar todos os campos). */
    readonly retryConfig?: Partial<RetryConfig>;
    /** Timeout global de fallback — só vale para operação sem motivo técnico próprio (§5.8.1). @default 10_000 */
    readonly defaultTimeoutMs?: number;
    /** Pré-checa `capabilities` em toda chamada, antes do HTTP. @default false */
    readonly verifyCapabilities?: boolean;
    /** Comportamento de rate limit (§5.8.4). @default `{ mode: "observe" }` — nunca dorme sozinho. */
    readonly rateLimit?: RateLimitOptions;
    /** Observa o orçamento de rate limit em toda resposta com os headers presentes — além de `zdk.rateLimit`, que é sempre atualizado. */
    readonly onRateLimit?: (snapshot: RateLimitSnapshot) => void;
}
```

```ts
interface VerifyResult {
    readonly connections: readonly Connection[];
    readonly rateLimit: RateLimitSnapshot | null;
}
```

```ts
declare class Zdk {
    private lastRateLimit;
    readonly connections: Connections;
    readonly contacts: Contacts;
    readonly tags: Tags;
    readonly queues: Queues;
    readonly users: Users;
    readonly messages: Messages;
    readonly tickets: Tickets;
    readonly templates: Templates;
    readonly storage: Storage;
    readonly webhooks: Webhooks;
    readonly dashboard: Dashboard;
    readonly metrics: Metrics;
    /** Síncrono, zero I/O — valida só `baseUrl`/`token` (§5.6). Prova de credencial é `verify()`/`connect()`. */
    constructor(options?: ZdkOptions);
    /** Orçamento de rate limit da última resposta com os headers presentes (§5.8.4). `null` até a primeira. */
    get rateLimit(): RateLimitSnapshot | null;
    /** Gate proativo (§5.2): garante o swagger da instância carregado (1x, cacheado). */
    capabilities(): Promise<ReadonlySet<string> | null>;
    /** `true` se a operação existe no swagger desta instância. Antes de `capabilities()` carregar: assume suportado. */
    supports(operation: string): boolean;
    /**
     * Prova as credenciais contra `GET /api/connections` — reusa
     * `connections.list()`, então é a chamada de bootstrap que qualquer envio
     * ia precisar de qualquer forma, não health check desperdiçado.
     * @throws {ZdkAuthError} 401 — `code` distingue `ERR_INVALID_API_KEY`
     *   (token errado) de `ERR_NO_AUTH_HEADER_PRESENT` (bug do SDK).
     * @throws {ZdkConfigError} `2xx` sem `connections` — host não parece ser a API Zappy.
     * @throws {ZdkNetworkError} host inalcançável.
     */
    verify(): Promise<VerifyResult>;
    /** `new Zdk(options)` seguido de `verify()` — só a instância já provada. */
    static connect(options?: ZdkOptions): Promise<Zdk>;
}
```

## Retry

```ts
/**
 * Executor de retry: classifica a falha, decide por operação (§5.8.3) e
 * aplica backoff. A tabela completa vive aqui, não espalhada — segurança de
 * retry não se decide por método HTTP, e sim por *o que já pode ter
 * acontecido no servidor*.
 */

interface RetryConfig {
    readonly attempts: number;
    readonly baseDelayMs: number;
    readonly maxDelayMs: number;
    /** `Retry-After`/`x-ratelimit-reset` acima disso: falha rápido em vez de dormir. */
    readonly maxRetryAfterMs: number;
    /** Master switch: por padrão, NENHUMA classe repete em timeout — ambíguo por natureza (§5.8.2). */
    readonly retryOnTimeout: boolean;
    /** Rege `safe`/`guarded` em 429. RFC 9110: rejeitado antes do processamento. */
    readonly retryOnRateLimit: boolean;
    /** Rege `unsafe` em 429 — desligado até o código do limitador ser identificado (§5.8.4). */
    readonly retryUnsafeOnRateLimit: boolean;
    /** Teto de wall clock do total de tentativas. `null` = sem teto (default; pior caso documentado no README). */
    readonly deadlineMs: number | null;
    /** @default Math.random */
    readonly random?: () => number;
    /** @default setTimeout-based sleep */
    readonly sleep?: (ms: number) => Promise<void>;
    readonly onRetry?: (info: RetryAttemptInfo) => void;
    /** `undefined` delega ao default da tabela — não é obrigado a decidir tudo. */
    readonly shouldRetry?: (context: RetryDecisionContext) => boolean | undefined;
}
```

```ts
/**
 * Classificação de retry e timeout default por operação (§5.8.1/§5.8.3). O
 * tipo `Record<OperationKey, OperationMetadata>` obriga as 48 chaves da união
 * a estarem presentes — se `sync:api` trouxer uma operação nova, o
 * `npm run typecheck` falha até ela ganhar uma entrada aqui.
 *
 * Classes de retry (a tabela de §5.8.3):
 *  - `safe`: idempotente por semântica — os 24 GETs, os 6 PUTs, DELETE de webhook.
 *  - `guarded`: repetir converge ao mesmo estado (ou gera artefato órfão) — transfer, upload-temp.
 *  - `unsafe`: efeito externo ou criação duplicada — os 9 "send", resolve
 *    (pode disparar mensagem de encerramento), e as 5 criações (contacts,
 *    tags, queues, many-queues, webhooks).
 */

type RetryClass = "safe" | "guarded" | "unsafe";
```

```ts
type FailureKind = "preauth-network" | "ambiguous-network" | "timeout" | "rate-limit" | "service-unavailable" | "server-error" | "client-error" | "abort" | "unknown";
```

```ts
interface RetryAttemptInfo {
    readonly attempt: number;
    readonly delayMs: number;
    readonly error: unknown;
    readonly operation: string;
}
```

```ts
interface RetryDecisionContext {
    readonly error: unknown;
    readonly kind: FailureKind;
    readonly attempt: number;
    readonly retryClass: RetryClass;
    readonly operation: string;
}
```

```ts
declare const DEFAULT_RETRY_CONFIG: RetryConfig;
```

```ts
/** Classifica o erro capturado numa das categorias da tabela — pura, sem I/O. */
declare function classifyFailure(error: unknown): FailureKind;
```

```ts
/** A tabela de §5.8.3, como função. */
declare function isRetryableByDefault(kind: FailureKind, retryClass: RetryClass, config: Pick<RetryConfig, "retryOnTimeout" | "retryOnRateLimit" | "retryUnsafeOnRateLimit">): boolean;
```

## Rate limit e concorrência

```ts
interface RateLimitOptions {
    /**
     * `"observe"` (default): nunca dorme sozinho — só expõe o snapshot via
     * `onRateLimit`. Latência escondida em SDK é pior que erro visível.
     * `"throttle"`: pausa PROATIVAMENTE, antes da próxima chamada, quando o
     * orçamento observado da chamada anterior já está no ou abaixo de
     * `reserve` — para job em lote, onde esperar é melhor que tomar `429`.
     */
    readonly mode?: "observe" | "throttle";
    /** Em modo `throttle`: pausa quando `remaining <= reserve`. @default 0 */
    readonly reserve?: number;
}
```

```ts
/**
 * Leitura do orçamento de rate limit a partir dos headers de resposta (§5.8.4,
 * Q8/Q14). A Zappy expõe `x-ratelimit-*` (legacy, confirmado por observação
 * real) — este módulo também lê `ratelimit-*` (draft IETF) para sobreviver a
 * uma troca do limitador no servidor.
 *
 * Toda conta de tempo aqui é contra o relógio do SERVIDOR (`observedAt`, o
 * header `date` da resposta) — nunca `Date.now()`. Provado na prática:
 * `x-ratelimit-reset` é epoch absoluto (uma amostra deu `reset - date = 2s`
 * com a janela fechando; outra deu 31s com `remaining` no máximo — a duração
 * da janela não é derivável e não faz falta, só o instante final importa).
 */
interface RateLimitSnapshot {
    readonly limit: number;
    readonly remaining: number;
    readonly resetAt: Date;
    readonly observedAt: Date;
}
```

```ts
/**
 * Limite de concorrência opcional (§5.8.5 — substituto de custo quase nulo ao
 * circuit breaker). Sem estado entre chamadas além do contador de ativos;
 * default é ilimitado, para não mudar throughput de quem já usa a lib em
 * lote em upgrade da v0.7.
 */
interface Semaphore {
    /** Resolve quando há vaga; devolve a função de liberar (chamar sempre, inclusive em erro). */
    acquire(): Promise<() => void>;
}
```

```ts
declare class ConcurrencyLimiter implements Semaphore {
    private readonly maxConcurrent;
    private active;
    private readonly waiting;
    constructor(maxConcurrent: number);
    acquire(): Promise<() => void>;
    private release;
}
```

```ts
/** `acquire()` resolve na hora, sempre — é o default (`maxConcurrent` ilimitado). */
declare const UNLIMITED_CONCURRENCY: Semaphore;
```

## Capabilities e operações

```ts
declare class Capabilities {
    private readonly options;
    private cache;
    private inFlight;
    constructor(options: CapabilitiesOptions);
    /**
     * Garante que o swagger da instância foi buscado (uma vez; cacheado depois
     * disso). Nunca lança: falha de rede, timeout ou JSON inválido viram
     * `null` — `supports()` passa a assumir tudo suportado.
     */
    load(): Promise<ReadonlySet<string> | null>;
    /**
     * `true` se a operação existe no swagger desta instância. Antes de
     * `load()` completar, ou se a busca falhou: assume suportado — um falso
     * positivo aqui vira, na pior das hipóteses, um `404` explicado por
     * `ZdkUnsupportedOperationError`; um falso negativo bloquearia operação
     * válida por indisponibilidade do próprio endpoint de swagger.
     */
    supports(operation: string): boolean;
    private fetchOperations;
}
```

```ts
/** Toda operação que existe de fato no contrato. Ex: `"POST /api/send/{to}"`. */
type OperationKey = {
    [P in keyof paths]: `${Uppercase<VerbsOf<P>>} ${P & string}`;
}[keyof paths];
```

```ts
interface OperationMetadata {
    readonly retryClass: RetryClass;
    readonly timeoutMs: number;
}
```

```ts
/**
 * Registry auditável dos defeitos reais do contrato (§5.3 da spec — Q1 a
 * Q24). Cada entrada aponta pro ponto exato do swagger e explica o motivo;
 * `tests/contract/quirks.test.ts` valida os que são estruturalmente
 * verificáveis contra os dois snapshots reais. Se a Zappy corrigir um
 * defeito, o teste falha — o registry não apodrece em silêncio.
 *
 * Q19 (confirmação), Q21 (correção), Q22 e Q23 vieram de chamadas REAIS e autenticadas contra
 * `api-admin1.zapcontabil.chat` (T24), não de inferência — `GET
 * /api/connections`, `GET /api/connections/{id}/templates` (leitura, sem
 * efeito colateral) e um único `POST /api/send/{to}` de teste, autorizado
 * explicitamente com número e conexão fornecidos para esse fim.
 */
interface ApiQuirk {
    readonly id: string;
    /** Caminho no documento OpenAPI onde o defeito vive. */
    readonly at: string;
    readonly reason: string;
}
```

## Conexões

```ts
/**
 * Status de conexão real (Q1): o enum do contrato não inclui `WHATSAPP_AUTH`
 * (conexão com a API Oficial/Meta Cloud API autenticada) nem `qrcode`
 * (conexão aguardando pareamento por QR code) — os dois observados em
 * produção contra `api-admin1.zapcontabil.chat` (T24): de 11 conexões
 * reais, 7 estavam `WHATSAPP_AUTH` e 2 estavam `qrcode`.
 */
declare const CONNECTION_STATUS: Readonly<{
    readonly connected: "CONNECTED";
    readonly disconnected: "DISCONNECTED";
    readonly timeout: "TIMEOUT";
    readonly whatsappAuth: "WHATSAPP_AUTH";
    readonly qrcode: "qrcode";
}>;
```

```ts
type ConnectionStatus = (typeof CONNECTION_STATUS)[keyof typeof CONNECTION_STATUS];
```

```ts
/**
 * `true` para as duas conexões utilizáveis para envio — `CONNECTED` ou
 * `WHATSAPP_AUTH` (v0.7 já tratava as duas como válidas). `qrcode` não conta:
 * é conexão ainda não pareada, não há canal ativo para enviar nada.
 */
declare function isUsableConnectionStatus(status: ConnectionStatus): boolean;
```

```ts
/** Q1: `status` aceita `WHATSAPP_AUTH`, ausente do enum do contrato. */
type Connection = RequiredBy<Omit<RawConnection, "status">, Exclude<keyof RawConnection, "status">> & {
    readonly status: ConnectionStatus;
};
```

```ts
/**
 * Q18: `GET /api/connections` declara `Connection` (objeto único) na resposta
 * 200, mas o corpo real é uma lista — não existe `ConnectionList` no
 * contrato, ao contrário de todos os outros recursos.
 */
interface ConnectionList {
    readonly connections: readonly Connection[];
}
```

## Tipos de entrada e saída corrigidos pelo ZDK

```ts
/**
 * Q19 — CONFIRMADO com uma chamada real: `POST /api/send/{to}` embrulha a
 * resposta em `{ message: Message }` (a v0.7 estava certa; o contrato, que
 * declara `Message` puro, está errado).
 */
interface SendMessageResult {
    readonly message: Message;
}
```

```ts
/** `media` (`format: binary`) vira `string` puro no codegen — `Blob`/`Uint8Array` de verdade também são aceitos. */
type SendMediaMessageData = BinaryField<RawSendMediaMessage, "media">;
```

```ts
/** Q3: `connectionFrom` tem `required: true` inline no schema — ignorado pelo codegen (Q2). */
type SendTemplateData = RequiredBy<RawSendTemplate, "connectionFrom">;
```

```ts
/**
 * Q3: `media` tem `required: true` inline — ignorado pelo codegen (único
 * campo do schema, `Required<>` builtin resolve isso). `format: binary`
 * também vira `string` puro no codegen — `BinaryField` aceita `Blob`/
 * `Uint8Array` de verdade, não só uma string já pronta.
 */
type UploadTempData = BinaryField<Required<RawUploadTemp>, "media">;
```

```ts
/** Q3: `url`/`filename`/`success` têm `required: true` inline — ignorado pelo codegen. Únicos campos do schema. */
type UploadTempResponse = Required<RawUploadTempResponse>;
```

```ts
/**
 * Q22 — CONFIRMADO com uma chamada real: `GET /api/connections/{id}/templates`
 * declara `MessageTemplate` (objeto único) na resposta 200, mas o corpo real
 * é `{ templates: MessageTemplate[] }` — mesmo padrão de Q18.
 */
interface TemplateList {
    readonly templates: readonly MessageTemplate[];
}
```

```ts
/**
 * Q3: `name`/`number` têm `required: true` inline — ignorado pelo codegen.
 * Q24: `isGroup`/`blocked`/`noCheckNumber` têm `default: false` — o codegen
 * os marca obrigatórios (defaultNonNullable), mas o servidor aceita omissão.
 */
type ContactPostData = RequiredBy<OptionalBy<RawContactPostData, "isGroup" | "blocked" | "noCheckNumber">, "name" | "number">;
```

```ts
/** Q24: `replaceTags`/`createTagIfNotExists` têm `default` — servidor aceita omissão. */
type ContactTagsPostData = OptionalBy<RawContactTagsPostData, "replaceTags" | "createTagIfNotExists">;
```

```ts
/** Q24: `feedbackOption` tem `default: "none"` — servidor aceita omissão. */
type TicketResolveFormData = OptionalBy<RawTicketResolveForm, "feedbackOption">;
```

```ts
/** Q24: `active` tem `default: true` — servidor aceita omissão. */
type WebhookPostData = OptionalBy<RawWebhookPostData, "active">;
```

## Erros

```ts
/**
 * Hierarquia de erros do ZDK (§5.4 da spec). Toda falha de rede, HTTP ou de
 * configuração chega ao consumidor como `throw` de uma destas classes — nunca
 * como `T | IError` (v0.7).
 *
 * `attempts` e `retryable` existem em todo erro para o consumidor distinguir
 * "falhou de primeira" de "falhou após esgotar as tentativas". Diferente de
 * `code`/`status`/`payload`/`cause` — fatos fixos no instante do evento —,
 * estes dois são NÃO-readonly de propósito: descrevem o resultado do
 * PROCESSO de retry ao redor do erro, que só se conclui depois que o erro já
 * existe. Quem os popula é o executor de retry (T16), estampando na própria
 * instância antes do `throw` final — não há reconstrução genérica de uma
 * subclasse desconhecida, e a identidade do erro (`instanceof`) para quem
 * captura rio abaixo continua intacta. Erro lançado fora do loop de retry
 * (ex.: `ZdkConfigError`, que nunca chega a fazer requisição) fica só com o
 * default seguro: 1 tentativa, não retryable.
 */
interface ZdkErrorOptions {
    readonly cause?: unknown;
    readonly attempts?: number;
    readonly retryable?: boolean;
}
```

```ts
declare abstract class ZdkError extends Error {
    abstract readonly code: string;
    readonly cause?: unknown;
    /** Mutável — ver comentário do módulo. */
    attempts: number;
    /** Mutável — ver comentário do módulo. */
    retryable: boolean;
    protected constructor(message: string, options?: ZdkErrorOptions);
}
```

```ts
/** `baseUrl` ou `token` ausente ou inválido (§5.6). Nunca chega a fazer requisição. */
declare class ZdkConfigError extends ZdkError {
    readonly code = "ZDK_CONFIG_ERROR";
    constructor(message: string, options?: ZdkErrorOptions);
}
```

```ts
/** Falha de transporte (DNS, conexão recusada, socket derrubado, …). */
declare class ZdkNetworkError extends ZdkError {
    readonly code = "ZDK_NETWORK_ERROR";
    readonly transportCode?: string;
    constructor(message: string, options?: ZdkNetworkErrorOptions);
}
```

```ts
/** Estourou o timeout de uma tentativa (§5.8.1). Nunca sofre retry automático por default. */
declare class ZdkTimeoutError extends ZdkError {
    readonly code = "ZDK_TIMEOUT_ERROR";
    readonly timeoutMs: number;
    constructor(message: string, timeoutMs: number, options?: ZdkErrorOptions);
}
```

```ts
/** `AbortSignal` do próprio consumidor foi acionado. Nunca sofre retry — é vontade de quem chamou. */
declare class ZdkAbortError extends ZdkError {
    readonly code = "ZDK_ABORT_ERROR";
    constructor(message: string, options?: ZdkErrorOptions);
}
```

```ts
/**
 * Operação existe na união de tipos, mas não no swagger *desta* instância (§5.2, Q15).
 * `operation` é a `OperationKey` (ex.: `"GET /api/webhooks"`) — tipada como `string`
 * aqui para não acoplar `core/errors.ts` a `core/operation.ts` (T08) antes da hora.
 */
declare class ZdkUnsupportedOperationError extends ZdkError {
    readonly code = "ZDK_UNSUPPORTED_OPERATION";
    readonly operation: string;
    constructor(message: string, operation: string, options?: ZdkErrorOptions);
}
```

```ts
interface ZdkHttpErrorOptions extends ZdkErrorOptions {
    readonly status: number;
    /** Corpo de resposta completo, preservando `errorData` não documentado (Q17). */
    readonly payload: unknown;
    readonly requestId?: string;
}
```

```ts
/**
 * Erro HTTP (2xx tratado como erro pelo contrato, ou 4xx/5xx). `code` não é fixo
 * por classe — vem do campo `error` do corpo (`ERR_*` da Zappy), o discriminante
 * real (§5.4). Quem decide a subclasse é `error-mapper.ts` (T09), a partir do
 * `status`.
 */
declare abstract class ZdkHttpError extends ZdkError {
    readonly code: string;
    readonly status: number;
    readonly payload: unknown;
    readonly requestId?: string;
    protected constructor(message: string, code: string, options: ZdkHttpErrorOptions);
}
```

```ts
/** 400 genérico. */
declare class ZdkValidationError extends ZdkHttpError {
    constructor(message: string, code: string, options: ZdkHttpErrorOptions);
}
```

```ts
/**
 * 400 com `code === "ERR_OFFICIAL_API_WINDOW_CLOSED"` (Q6): a janela de 24h da
 * API Oficial fechou e a mensagem exige template em vez de texto livre.
 */
declare class ZdkOfficialApiWindowError extends ZdkHttpError {
    constructor(message: string, code: string, options: ZdkHttpErrorOptions);
}
```

```ts
/**
 * 401 ou 403. `code` distingue a causa real — `ERR_INVALID_API_KEY` (token
 * errado, problema do consumidor) de `ERR_NO_AUTH_HEADER_PRESENT` (header não
 * foi enviado, bug do SDK) — observado em produção (Q13, Q17).
 */
declare class ZdkAuthError extends ZdkHttpError {
    constructor(message: string, code: string, options: ZdkHttpErrorOptions);
}
```

```ts
/** 404. */
declare class ZdkNotFoundError extends ZdkHttpError {
    constructor(message: string, code: string, options: ZdkHttpErrorOptions);
}
```

```ts
interface ZdkRateLimitErrorOptions extends ZdkHttpErrorOptions {
    /** Espera recomendada antes de repetir, derivada de `Retry-After` ou de `x-ratelimit-reset` (§5.8.4). */
    readonly retryAfterMs?: number;
}
```

```ts
/** 429 (Q8/Q14). O rate limit da Zappy roda antes da autenticação — observado, não documentado. */
declare class ZdkRateLimitError extends ZdkHttpError {
    readonly retryAfterMs?: number;
    constructor(message: string, code: string, options: ZdkRateLimitErrorOptions);
}
```

```ts
/** 5xx. */
declare class ZdkServerError extends ZdkHttpError {
    constructor(message: string, code: string, options: ZdkHttpErrorOptions);
}
```

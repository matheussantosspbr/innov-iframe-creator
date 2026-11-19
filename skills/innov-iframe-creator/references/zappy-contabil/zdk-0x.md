# ZDK 0.x (0.4 a 0.7): API antiga

> Para projetos que ainda usam a versão 0.x (`onvio`, `pipedrive`, `crm-simples`, `jusbrasil`, `nibo`, `SCI`, `drive`, `ausent`, `innovchat`, `omie`, `conta-azul`). **App novo usa a 1.0** (`zdk.md`). Fonte: README e `dist/index.d.ts` de `zdk@0.7.3` (instalada em `onvio/server`); os projetos declaram versões até `^0.7.17`, que não está instalada localmente, então métodos acrescentados depois da 0.7.3 podem faltar aqui. Versões anteriores (0.4 a 0.6) têm menos recursos.

## Diferenças para a 1.0

| | 0.x | 1.0 |
|---|---|---|
| Construtor | `new Zdk(url, token)` (posicional) ou sem argumentos (lê `ZAPPY_URL` e `ZAPPY_TOKEN`) | `new Zdk({ baseUrl, token })` |
| Erro | **não lança**: devolve `T \| IError`. Confira com `"error" in result` | sempre lança uma subclasse de `ZdkError` |
| Tipos | prefixo `I` (`ITicket`, `IContact`) | sem prefixo (`Ticket`, `Contact`) |
| Recursos | `connections`, `contacts`, `messages`, `queues`, `tags`, `tickets`, `users` | 12 recursos (`templates`, `storage`, `webhooks`, `dashboard`, `metrics` são novos) |
| Retry, timeout, rate limit | não tem | automáticos e configuráveis |
| Dependências | `axios`, `form-data` | nenhuma |
| Validação de credencial | nenhuma no construtor | `new Zdk()` valida o formato; `verify()` e `connect()` provam |

Padrão de checagem de erro na 0.x (como o `onvio` faz):

```ts
const zdk = new Zdk(url, token)
const result = await zdk.connections.list()
if ('error' in result) {
  // credencial inválida ou erro da API
}
```

## Resumo do README

- `ZappyApi` é a classe base de baixo nível; `makeRequest(método, endpoint, corpo?, tipoDeConteúdo?)` envia uma requisição qualquer.
- `Zdk` estende `ZappyApi` e expõe uma propriedade por recurso:

| Propriedade | Para que serve |
|---|---|
| `connections` | Conexões da instância |
| `contacts` | Buscar e criar contatos |
| `messages` | Mensagens |
| `queues` | Filas (setores) |
| `tags` | Tags |
| `tickets` | Atendimentos |
| `users` | Usuários do sistema |

## Declarações de tipos (literal, `zdk@0.7.3`)

```ts
interface IError {
    error: Record<string, unknown> | string;
}
type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
type ConnectionStatus = "CONNECTED" | "DISCONNECTED" | "TIMEOUT" | "WHATSAPP_AUTH";
type TicketStrategy = "create" | "nocreate" | "close" | "reuseOrClose";
type TicketStatus = "pending" | "open" | "closed";
type FeedbackOption = "none" | "feedback" | "send-end-message";
type MediaType = "text" | "image" | "video" | "audio" | "voice" | "document";
interface IPagination {
    count: number;
    page: number;
    pageSize: number;
    pageCount: number;
}
interface IParamsList extends Pick<IPagination, "page" | "pageSize"> {
}
interface IParamsMessageList extends IParamsList {
    ticketId?: string;
    contactId?: string;
    dateFrom?: string;
    dateTo?: string;
}
interface IConnection {
    id: number;
    status: ConnectionStatus;
    createdAt: string;
    updatedAt: string;
    isDefault: boolean;
    name: string;
    platform: string;
    number: string;
    greetingMessage: string;
    endMessage: string;
    feedbackMessage: string;
}
interface IZdkOptions {
    rootUrl: string;
    token: string;
}
interface ISendMessage {
    body: string;
    connectionFrom: number;
    ticketStrategy: TicketStrategy;
}
interface ISendMediaMessage {
    media: unknown;
    caption?: string;
    connectionFrom: number;
}
interface SendMediaMessageJson {
    url: string;
    caption?: string;
    connectionFrom: string;
}
interface IMessage {
    id: number;
    body: string;
    type: string;
    subtype: string;
    isMedia: string;
    myContact: string;
    from: string;
    contactId: number;
    ticketId: number;
}
interface IContact {
    id: number;
    name: string;
    number: string;
    email: string;
    profilePicUrl: string;
    isGroup: boolean;
    createdAt: string;
    updatedAt: string;
    blocked: boolean;
    userId: number;
    queueId: number;
    tags: ITag[];
    extraInfo: IContactExtraInfo[];
}
interface IContactExtraInfo {
    name: string;
    value: string;
}
interface IContactPostData {
    name: string;
    number: string;
    email: string;
    profilePicUrl: string;
    isGroup: boolean;
    blocked: boolean;
    userId: number;
    queueId: number;
    createdAt: string;
    updatedAt: string;
    tagsIds: number[];
    extraInfo: IContactExtraInfo[];
    noCheckNumber: boolean;
}
interface ITag {
    id: string;
    name: string;
    color: string;
}
interface ITicket {
    id: string;
    status: string;
    userId: string;
    contactId: string;
    whatsappId: string;
    queueId: string;
    unreadMessages: number;
    lastMessage: string;
    isGroup: boolean;
    createdAt: string;
    updatedAt: string;
}
interface IUser {
    id: string;
    name: string;
    email: string;
    status: string;
    profile: string;
    enabled: boolean;
    createdAt: string;
    updatedAt: string;
}
interface IQueue {
    id: string;
    name: string;
    color: string;
}
interface IMessageObject {
    id: string;
    createdAt: string;
    updatedAt: string;
    body: string;
    mediaUrl: string;
    mediaType: string;
    isDeleted: boolean;
    quotedMsgId: string;
    ticketId: string;
    contactId: string;
    fromMe: boolean;
    ack: string;
    read: boolean;
    locationLatitude: string;
    locationLongitude: string;
    editedFromId: string;
    editedToId: string;
    error: string;
}
interface IContactList extends IPagination {
    contacts: IContact[];
}
interface IQueueList extends IPagination {
    queues: IQueue[];
}
interface ITicketList extends IPagination {
    tickets: ITicket[];
}
interface ITagList extends IPagination {
    tags: ITag[];
}
interface IMessageList extends IPagination {
    messages: IMessageObject[];
}
interface IUserList extends IPagination {
    users: IUser[];
}
interface IConnectionList {
    connections: IConnection[];
}
interface ITicketUpdateForm {
    status?: TicketStatus;
    userId?: number;
    queueId?: number;
}
interface ITicketTransferForm {
    queueId?: number;
    userId?: number;
    connectionId?: number;
}
interface ITicketResolveForm {
    feedbackOption: FeedbackOption;
}

declare class ZappyApi {
    private _rootUrl;
    private _token;
    constructor(rootUrl?: string, token?: string);
    makeRequest(method: HttpMethod, endpoint: string, data?: unknown, customHeaders?: Record<string, string>): Promise<any>;
}

declare class Connection {
    protected api: ZappyApi;
    constructor(api: ZappyApi);
    list(): Promise<IConnectionList | IError>;
    get(id?: number): Promise<IConnection | IError>;
}

declare class Contact {
    protected api: ZappyApi;
    constructor(api: ZappyApi);
    list(params?: IParamsList): Promise<IContactList | IError>;
    get(id: number): Promise<IContact | IError>;
    update(id: number, data: IContactPostData): Promise<IContact | IError>;
}

declare class Message {
    protected api: ZappyApi;
    constructor(api: ZappyApi);
    list(params?: IParamsMessageList): Promise<IMessageList | IError>;
    get(id: string): Promise<IMessage | IError>;
    send(to: string, data: ISendMessage): Promise<Message | IError>;
    send(to: string, data: ISendMediaMessage, type: Exclude<MediaType, "text">): Promise<Message | IError>;
}

declare class Queue {
    protected api: ZappyApi;
    constructor(api: ZappyApi);
    list(params?: IParamsList): Promise<IQueueList | IError>;
    get(id: number): Promise<IQueue | IError>;
}

declare class Tag {
    protected api: ZappyApi;
    constructor(api: ZappyApi);
    list(params?: IParamsList): Promise<ITagList | IError>;
    get(id: number): Promise<ITag | IError>;
}

declare class Ticket {
    protected api: ZappyApi;
    constructor(api: ZappyApi);
    list(params?: IParamsList): Promise<ITicketList | IError>;
    get(id: number): Promise<ITicket | IError>;
    transfer(id: number, data: ITicketTransferForm): Promise<ITicket | IError>;
    resolve(id: number, data: ITicketResolveForm): Promise<ITicket | IError>;
    update(id: number, data: ITicketUpdateForm): Promise<ITicket | IError>;
}

declare class User {
    protected api: ZappyApi;
    constructor(api: ZappyApi);
    list(params?: IParamsList): Promise<IUserList | IError>;
    get(id: number): Promise<IUser | IError>;
}

declare class Zdk extends ZappyApi {
    readonly tickets: Ticket;
    readonly connections: Connection;
    readonly contacts: Contact;
    readonly messages: Message;
    readonly queues: Queue;
    readonly tags: Tag;
    readonly users: User;
}

export { type ConnectionStatus, type FeedbackOption, type HttpMethod, type IConnection, type IConnectionList, type IContact, type IContactExtraInfo, type IContactList, type IContactPostData, type IError, type IMessage, type IMessageList, type IMessageObject, type IPagination, type IParamsList, type IParamsMessageList, type IQueue, type IQueueList, type ISendMediaMessage, type ISendMessage, type ITag, type ITagList, type ITicket, type ITicketList, type ITicketResolveForm, type ITicketTransferForm, type ITicketUpdateForm, type IUser, type IUserList, type IZdkOptions, type MediaType, type SendMediaMessageJson, type TicketStatus, type TicketStrategy, ZappyApi, Zdk };
```

Observações sobre o que se vê nos tipos:
- `ConnectionStatus` já inclui `WHATSAPP_AUTH` (API Oficial) na 0.x.
- `ticketStrategy` (`create`, `nocreate`, `close` ou `reuseOrClose`) é um campo **obrigatório** de `ISendMessage` (`messages.send` de texto). O que cada valor faz não está documentado no pacote; confira o comportamento antes de usar.
- `feedbackOption` (`none`, `feedback` ou `send-end-message`) é o campo obrigatório de `ITicketResolveForm` (`tickets.resolve`).
- `ISendMediaMessage.connectionFrom` é `number`, mas `SendMediaMessageJson.connectionFrom` (envio de mídia por URL) é `string`.
- `makeRequest`: o README fala em `tipoDeConteúdo`, mas a assinatura nos tipos é `makeRequest(method, endpoint, data?, customHeaders?)`. Vale a assinatura dos tipos.
- Listagens devolvem `IContactList`, `ITicketList` e semelhantes, que estendem `IPagination` (`page`, `pageSize`, `count`).
- A migração para a 1.0 está descrita em `docs/MIGRATION.md` do repositório do ZDK (fora do pacote npm; não lido).

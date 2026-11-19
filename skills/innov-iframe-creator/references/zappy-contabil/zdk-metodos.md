# ZDK 1.0: métodos e operações da API

> Gerado a partir de `dist/index.d.ts` do pacote `zdk@1.0.0` (o contrato OpenAPI da Zappy + as declarações do SDK). Os tipos dos campos são os **gerados do contrato**; as correções do ZDK (quirks) estão em `zdk-quirks.md` e os modelos em `zdk-modelos.md`. Veja o guia em `zdk.md`.

Convenção: `Modelo` entre crases é um schema de `zdk-modelos.md`. "Opcional: não" significa que o tipo gerado o marca como obrigatório (o contrato quase nunca declara `required`; ver Q2, Q3 e Q24).

## `zdk.connections` (Connections)

Conexões (`Conexões` no swagger). `list()` é a única operação real do contrato (`GET /api/connections`); `get`/`findUsable` são helpers resolvidos no cliente — não existe `GET /api/connections/{id}` (§5.5).

### `zdk.connections.list`

```ts
list(): Promise<readonly Connection[]>
```

`GET /api/connections`. Q18: o contrato declara um `Connection` único na resposta; o corpo real é `{ connections: Connection[] }` — corrigido aqui (não existe `ConnectionList` gerado para desembrulhar sozinho).

**`GET /api/connections`** — Lista de Conexões

Lista todas as conexões.<br> Esse endpoint pode ser utilizado para selecionar conexões para enviar mensagens.

_Respostas:_
- `200` Lista de conexões. → `Connection` (`application/json`)

### `zdk.connections.get`

```ts
get(id: number): Promise<Connection>
```

Busca **estrita** por `id` — nunca devolve outra conexão, seja qual for o `status` dela. @throws nenhuma conexão com esse `id`.

_Helper resolvido no cliente; não corresponde a uma operação própria do contrato._

### `zdk.connections.findUsable`

```ts
findUsable(preferredId?: number): Promise<Connection>
```

Devolve `preferredId` se ela estiver utilizável (`CONNECTED` ou `WHATSAPP_AUTH`); senão a primeira conexão utilizável da lista. Sem `preferredId`, vai direto para a primeira utilizável. @throws nenhuma conexão utilizável.

_Helper resolvido no cliente; não corresponde a uma operação própria do contrato._

## `zdk.contacts` (Contacts)

Contatos (`Contatos`). CRUD simples — sem quirk de resposta a corrigir aqui: `ContactList`/`Contact` já existem como schemas próprios (ao contrário de Q18, que é exclusivo de `Connection`).

### `zdk.contacts.list`

```ts
list(params?: ApiParams<"GET /api/contacts">["query"]): Promise<ApiResponse<"GET /api/contacts">>
```

**`GET /api/contacts`**

Lista todas os contatos baseado no critério de pesquisa. Esse endpoint é paginado, ou seja, só pode trazer até no máximo 100 registros por página.

_Query_

| Campo | Tipo | Opcional | Descrição |
|---|---|---|---|
| `page` | `number` | sim | A página requisitada, o padrão é 1. |
| `pageSize` | `number` | sim | O número de registros por página, o padrão é 20. Não há limite para esse valor, por isso pode ser feito uma chamada para trazer todos os contatos com um valor alto para esse campo. No entanto isso pode afetar a performance da aplicação. |

_Respostas:_
- `200` Lista de contatos. → `ContactList` (`application/json`)

### `zdk.contacts.get`

```ts
get(id: number): Promise<ApiResponse<"GET /api/contacts/{id}">>
```

**`GET /api/contacts/{id}`**

Retorna o Contato com o ID informado

_Parâmetros de path_

| Campo | Tipo | Opcional | Descrição |
|---|---|---|---|
| `id` | `number` | não | O ID do contato. |

_Respostas:_
- `200` Contato específico. → `Contact` (`application/json`)
- `404` Contato não encontrado.

### `zdk.contacts.create`

```ts
create(data: ContactPostData): Promise<ApiResponse<"POST /api/contacts/">>
```

`POST /api/contacts/` — barra final, como o contrato declara. Q3: `name`/`number` são obrigatórios; Q24: `isGroup`/`blocked`/ `noCheckNumber` ficam opcionais de novo — têm `default`, servidor aplica.

**`POST /api/contacts/`**

Cria um Contato com os dados fornecidos. Esse endpoint não faz uma validação direta do número com ou sem 9, portanto podem acontecer duplicadas em caso de adição ou remoção do 9 no número. <br><br>Antes de verificar se o número existe, o sistema valida se é um número válido e compatível com o Whatsapp. <br>Dessa forma, o número informado pode mudar (sendo adicionado ou removido o 9), pois será pego a identificação desse número pelo próprio WhatsApp. <br><br>Caso deseje que essa validação no Whatsapp seja ignorada, informe o campo 'noCheckNumber' como 'true'.

_Corpo `application/json`:_ `ContactPostData` — Objeto com os dados para criar o Contato. <br>Informe o número **sem caracteres especiais** e com **código de país** e **área**. Ex: 5511999999999. <br>Para desabilitar a verificação de número, informe o campo 'noCheckNumber' como 'true'.

_Respostas:_
- `200` Retorna os dados do Contato criado. → `Contact` (`application/json`)
- `400` Erro de validação. ERR_NAME_REQUIRED se o campo nome for informado vazio. ERR_NUMBER_REQUIRED se o campo 'number' for informado vazio. → `Error` (`application/json`)

### `zdk.contacts.update`

```ts
update(id: number, data: ContactPostData): Promise<ApiResponse<"PUT /api/contacts/{id}">>
```

**`PUT /api/contacts/{id}`**

Edita um Contato

_Corpo `application/json`:_ `ContactPostData` — Objeto com os dados para editar o Contato. O campo 'name' é obrigatório.

_Respostas:_
- `200` Retorna os dados do Contato editado. → `Contact` (`application/json`)
- `400` Erro de validação → `Error` (`application/json`)
- `404` Contato não encontrado.

### `zdk.contacts.setTags`

```ts
setTags(id: number, data: ContactTagsPostData): Promise<ApiResponse<"PUT /api/contacts/{id}/tags">>
```

`PUT /api/contacts/{id}/tags`. Aceita `tagIds` e/ou `tags` (nome+cor de tag nova), `replaceTags` (default: adiciona, não substitui) e `createTagIfNotExists` — o schema real (`ContactTagsPostData`) é mais rico do que só uma lista de ids. Q24: os dois defaults ficam opcionais.

**`PUT /api/contacts/{id}/tags`**

Adiciona ou substitui as tags de um contato específico. O padrão é apenas adicionar as tags informadas, para substituir defina o campo 'replaceTags' como true. Você pode informar IDs de tags ou nomes de tags, se houver o nome informado, a tag apenas será adicionada. Se não houver o nome informado, nova tag será criada com a cor informada.

_Corpo `application/json`:_ `ContactTagsPostData` — Adiciona ou substitui as tags de um contato específico. O padrão é apenas adicionar as tags informadas, para substituir defina o campo 'replaceTags' como true. Você pode informar IDs de tags ou nomes de tags, se houver o nome informado, a tag apenas será adicionada. Se não houver o nome informado, nova tag será criada com a cor informada.

_Respostas:_
- `200` Retorna os dados do Contato editado. → `Contact` (`application/json`)
- `400` Erro de validação → `Error` (`application/json`)
- `404` Contato não encontrado.

## `zdk.tags` (Tags)

Tags (`Tags`). CRUD simples.

### `zdk.tags.list`

```ts
list(params?: ApiParams<"GET /api/tags">["query"]): Promise<ApiResponse<"GET /api/tags">>
```

**`GET /api/tags`**

Lista todas as tags baseado no critério de pesquisa. Esse endpoint é paginado, ou seja, só pode trazer até no máximo 100 registros por página.

_Query_

| Campo | Tipo | Opcional | Descrição |
|---|---|---|---|
| `page` | `number` | sim | A página requisitada, o padrão é 1. |
| `pageSize` | `number` | sim | O número de registros por página, o padrão é 20. Não há limite para esse valor, por isso pode ser feito uma chamada para trazer todas as tags com um valor alto para esse campo. No entanto isso pode afetar a performance da aplicação. |

_Respostas:_
- `200` Lista de tags. → `TagList` (`application/json`)

### `zdk.tags.get`

```ts
get(id: string): Promise<ApiResponse<"GET /api/tags/{id}">>
```

**`GET /api/tags/{id}`**

Retorna a Tag com o ID informado

_Parâmetros de path_

| Campo | Tipo | Opcional | Descrição |
|---|---|---|---|
| `id` | `string` | não | O ID da tag. |

_Respostas:_
- `200` Tag específica. → `Tag` (`application/json`)
- `404` Tag não encontrada.

### `zdk.tags.create`

```ts
create(data: ApiBody<"POST /api/tags/">): Promise<ApiResponse<"POST /api/tags/">>
```

`POST /api/tags/` — barra final, como o contrato declara.

**`POST /api/tags/`**

Cria uma Tag

_Corpo `application/json`:_ `TagPostData` — Objeto com os dados para criar a Tag. O campo 'name' é obrigatório.

_Respostas:_
- `200` Retorna os dados da Tag criada. → `Tag` (`application/json`)
- `400` Erro de validação. ERR_INVALID_COLOR para cor inválida ou ERR_NAME_REQUIRED se o campo nome for informado vazio. → `Error` (`application/json`)
- `404` Tag não encontrada.

### `zdk.tags.update`

```ts
update(id: string, data: ApiBody<"PUT /api/tags/{id}">): Promise<ApiResponse<"PUT /api/tags/{id}">>
```

**`PUT /api/tags/{id}`**

Edita uma Tag

_Corpo `application/json`:_ `TagPostData` — Objeto com os dados para editar a Tag. O campo 'name' é obrigatório.

_Respostas:_
- `200` Retorna os dados da Tag editada. → `Tag` (`application/json`)
- `400` Erro de validação. ERR_INVALID_COLOR para cor inválida ou ERR_NAME_REQUIRED se o campo nome for informado vazio. → `Error` (`application/json`)
- `404` Tag não encontrada.

## `zdk.queues` (Queues)

Setores (`Setores`). `QueuePostData` já declara `required` corretamente no contrato — sem quirk aqui.

### `zdk.queues.list`

```ts
list(params?: ApiParams<"GET /api/queues">["query"]): Promise<ApiResponse<"GET /api/queues">>
```

**`GET /api/queues`**

Lista todos os setores baseado no critério de pesquisa. Esse endpoint é paginado, ou seja, só pode trazer até no máximo 100 registros por página.

_Query_

| Campo | Tipo | Opcional | Descrição |
|---|---|---|---|
| `page` | `number` | sim | A página requisitada, o padrão é 1. |
| `pageSize` | `number` | sim | O número de registros por página, o padrão é 20. Não há limite para esse valor, por isso pode ser feito uma chamada para trazer todos os setores com um valor alto para esse campo. No entanto isso pode afetar a performance da aplicação. |

_Respostas:_
- `200` Lista de setores. → `QueueList` (`application/json`)

### `zdk.queues.get`

```ts
get(id: string): Promise<ApiResponse<"GET /api/queues/{id}">>
```

**`GET /api/queues/{id}`**

Retorna o setor com o ID informado

_Parâmetros de path_

| Campo | Tipo | Opcional | Descrição |
|---|---|---|---|
| `id` | `string` | não | O ID do setor. |

_Respostas:_
- `200` Setor específico. → `Queue` (`application/json`)
- `404` Setor não encontrado.

### `zdk.queues.create`

```ts
create(data: ApiBody<"POST /api/queues">): Promise<ApiResponse<"POST /api/queues">>
```

**`POST /api/queues`**

Cria um novo Setor

_Corpo `application/json`:_ `QueuePostData` — Objeto com os dados para criar o Setor. Os campos name e color sao obrigatorios. A cor deve ser hexadecimal no formato #RGB ou #RRGGBB (ex.: #0F0 ou #00FF00).

_Respostas:_
- `200` Retorna os dados do Setor criado. → `Queue` (`application/json`)
- `400` Erro de validacao. ERR_NAME_REQUIRED se o nome nao for informado, ERR_INVALID_COLOR se a cor nao for hexadecimal valida (#RGB ou #RRGGBB), ERR_QUEUE_NAME_ALREADY_EXISTS ou ERR_QUEUE_COLOR_ALREADY_EXISTS se nome/cor ja existirem. → `Error` (`application/json`)

### `zdk.queues.update`

```ts
update(id: string, data: ApiBody<"PUT /api/queues/{id}">): Promise<ApiResponse<"PUT /api/queues/{id}">>
```

**`PUT /api/queues/{id}`**

Atualiza um Setor

_Corpo `application/json`:_ `QueuePostData` — Objeto com os dados para editar o Setor. O campo 'name' é obrigatório.

_Respostas:_
- `200` Retorna os dados do Setor editado. → `Queue` (`application/json`)
- `400` Erro de validação. → `Error` (`application/json`)
- `404` Setor não encontrado.

### `zdk.queues.createMany`

```ts
createMany(data: ApiBody<"POST /api/many-queues">): Promise<ApiResponse<"POST /api/many-queues">>
```

`POST /api/many-queues` — cria vários setores de uma vez; corpo e resposta são arrays crus.

**`POST /api/many-queues`**

Cria multiplos Setores em uma unica requisicao

_Corpo `application/json`:_ `QueuePostData`[] — Lista de setores a criar. Cada item exige name e color. A cor deve ser hexadecimal no formato #RGB ou #RRGGBB (ex.: #0F0 ou #00FF00). Nome e cor devem ser unicos entre si e em relacao aos setores ja existentes.

_Respostas:_
- `200` Retorna a lista dos Setores criados. → `Queue`[] (`application/json`)
- `400` Erro de validacao. ERR_INVALID_BODY se o body nao for um array, ERR_NAME_REQUIRED, ERR_INVALID_COLOR, ERR_QUEUE_NAME_ALREADY_EXISTS ou ERR_QUEUE_COLOR_ALREADY_EXISTS. → `Error` (`application/json`)

### `zdk.queues.listWithUsers`

```ts
listWithUsers(params?: ApiParams<"GET /api/queue-users">["query"]): Promise<ApiResponse<"GET /api/queue-users">>
```

`GET /api/queue-users` — setores com os usuários vinculados.

**`GET /api/queue-users`**

Lista setores com os usuarios vinculados. Aceita o parametro opcional search para filtrar pelo nome ou e-mail do usuario.

_Query_

| Campo | Tipo | Opcional | Descrição |
|---|---|---|---|
| `search` | `string` | sim | Filtra pelo nome ou e-mail do usuario vinculado (busca parcial). |

_Respostas:_
- `200` Lista de setores com usuarios vinculados. → `QueueUsersList` (`application/json`)

## `zdk.users` (Users)

Usuários (`Usuários`). Só leitura no contrato.

### `zdk.users.list`

```ts
list(params?: ApiParams<"GET /api/users">["query"]): Promise<ApiResponse<"GET /api/users">>
```

**`GET /api/users`**

Lista todos os usuários baseado no critério de pesquisa. Esse endpoint é paginado, ou seja, só pode trazer até no máximo 100 registros por página.

_Query_

| Campo | Tipo | Opcional | Descrição |
|---|---|---|---|
| `page` | `number` | sim | A página requisitada, o padrão é 1. |
| `pageSize` | `number` | sim | O número de registros por página, o padrão é 20. Não há limite para esse valor. |
| `search` | `string` | sim | Pesquisa por nome ou e-mail |

_Respostas:_
- `200` Lista de usuários. → `UserList` (`application/json`)

### `zdk.users.get`

```ts
get(id: string): Promise<ApiResponse<"GET /api/users/{id}">>
```

**`GET /api/users/{id}`**

Retorna o Usuário com o ID informado

_Parâmetros de path_

| Campo | Tipo | Opcional | Descrição |
|---|---|---|---|
| `id` | `string` | não | O ID do usuário. |

_Respostas:_
- `200` Usuário específico. → `User` (`application/json`)
- `404` Usuário não encontrada.

## `zdk.messages` (Messages)

### `zdk.messages.list`

```ts
list(params?: ApiParams<"GET /api/messages">["query"]): Promise<ApiResponse<"GET /api/messages">>
```

**`GET /api/messages`**

Lista todas as mensagens baseado no critério de pesquisa. Esse endpoint é paginado.

_Query_

| Campo | Tipo | Opcional | Descrição |
|---|---|---|---|
| `page` | `number` | sim | A página requisitada, o padrão é 1. |
| `pageSize` | `number` | sim | O número de registros por página, o padrão é 20. Não há limite para esse valor, por isso pode ser feito uma chamada para trazer todas as mensagens com um valor alto para esse campo. No entanto isso pode afetar a performance da aplicação. |
| `ticketId` | `string` | sim | O id do atendimento (opcional) |
| `contactId` | `string` | sim | O id do contato (opcional) |
| `dateFrom` | `string` | sim | Data inicial (incluindo) (opcional). Ex: 2021-01-01 |
| `dateTo` | `string` | sim | Data final (incluindo) (opcional). Ex: 2021-01-31 |

_Respostas:_
- `200` Lista de mensagens. → `MessageList` (`application/json`)

### `zdk.messages.get`

```ts
get(id: string): Promise<ApiResponse<"GET /api/messages/{id}">>
```

**`GET /api/messages/{id}`**

Retorna a mensagem com o ID informado

_Parâmetros de path_

| Campo | Tipo | Opcional | Descrição |
|---|---|---|---|
| `id` | `string` | não | O ID da mensagem. |

_Respostas:_
- `200` Mensagem específica. → `MessageObject` (`application/json`)
- `404` Mensagem não encontrada.

### `zdk.messages.sendText`

```ts
sendText(to: string, data: ApiBody<"POST /api/send/{to}">): Promise<Message>
```

`POST /api/send/{to}`. Q19 — CONFIRMADO com uma chamada real e autenticada: o contrato declara `Message` puro, mas a resposta real vem embrulhada em `{message: Message}` (a v0.7 estava certa). Desembrulhado aqui.

**`POST /api/send/{to}`**

Envia uma mensagem para o número informado. Pode ou não receber o ID da conexão para enviar com conexão específica. Caso não seja informado, será usado a conexão padrão ou a primeira da lista. Caso a conexão especificada esteja desconectada, o endpoint trará um erro. Há ainda nesse endpoint a possibilidade de continuar uma conversa com o mesmo número, pela mesma conexão informando no parâmetro connectionFrom o valor 'current'

_Parâmetros de path_

| Campo | Tipo | Opcional | Descrição |
|---|---|---|---|
| `to` | `string` | não | Número do Whatsapp para enviar a mensagem. |

_Corpo `application/json` (opcional):_ `SendMessage` — Payload

_Respostas:_
- `200` Mensagem enviada. → `Message` (`application/json`)
- `400` Erro ao enviar a mensagem ou janela de 24 horas da API Oficial fechada. → `Error` \| `OfficialApiWindowError` (`application/json`)

### `zdk.messages.sendMedia`

```ts
sendMedia(to: string, type: MediaType$1, data: SendMediaMessageData): Promise<ApiResponse<"POST /api/send/{type}/{to}">>
```

`POST /api/send/{type}/{to}`, multipart — arquivo binário (Q20).

**`POST /api/send/{type}/{to}`**

Envia um arquivo para o número informado. Pode ou não receber o ID da conexão para enviar com conexão específica. Caso não seja informado, será usado a conexão padrão ou a primeira da lista. Caso a conexão especificada esteja desconectada, o endpoint trará um erro. Você pode enviar o arquivo com multipart/form-data diretamente no corpo da requisição ou enviar uma URL para arquivo externo, e nesse caso utilizar o Content-Type application/json e o campo "url"

_Parâmetros de path_

| Campo | Tipo | Opcional | Descrição |
|---|---|---|---|
| `type` | `"image"` \| `"video"` \| `"audio"` \| `"voice"` \| `"document"` | não | Tipo de arquivo |
| `to` | `string` | não | Número do Whatsapp para enviar a mensagem. |

_Corpo `multipart/form-data` (opcional):_ `SendMediaMessage` — Payload

_Corpo `application/json` (opcional):_ `SendMediaMessageJson` — Payload

_Respostas:_
- `200` Arquivo enviado. → `Message` (`application/json`)
- `400` Erro ao enviar a mensagem ou janela de 24 horas da API Oficial fechada. → `Error` \| `OfficialApiWindowError` (`application/json`)

### `zdk.messages.sendMediaByUrl`

```ts
sendMediaByUrl(to: string, type: MediaType$1, data: ApiBody<"POST /api/send/{type}/{to}", "application/json">): Promise<ApiResponse<"POST /api/send/{type}/{to}">>
```

`POST /api/send/{type}/{to}`, json — mídia por URL, sem subir bytes pelo SDK (Q20; capacidade que a v0.7 nunca implementou).

**`POST /api/send/{type}/{to}`**

Envia um arquivo para o número informado. Pode ou não receber o ID da conexão para enviar com conexão específica. Caso não seja informado, será usado a conexão padrão ou a primeira da lista. Caso a conexão especificada esteja desconectada, o endpoint trará um erro. Você pode enviar o arquivo com multipart/form-data diretamente no corpo da requisição ou enviar uma URL para arquivo externo, e nesse caso utilizar o Content-Type application/json e o campo "url"

_Parâmetros de path_

| Campo | Tipo | Opcional | Descrição |
|---|---|---|---|
| `type` | `"image"` \| `"video"` \| `"audio"` \| `"voice"` \| `"document"` | não | Tipo de arquivo |
| `to` | `string` | não | Número do Whatsapp para enviar a mensagem. |

_Corpo `multipart/form-data` (opcional):_ `SendMediaMessage` — Payload

_Corpo `application/json` (opcional):_ `SendMediaMessageJson` — Payload

_Respostas:_
- `200` Arquivo enviado. → `Message` (`application/json`)
- `400` Erro ao enviar a mensagem ou janela de 24 horas da API Oficial fechada. → `Error` \| `OfficialApiWindowError` (`application/json`)

### `zdk.messages.sendMany`

```ts
sendMany(to: string, messages: ApiBody<"POST /api/messages/multiple/{to}", "application/json">["messages"], files?: readonly (Blob | Uint8Array)[]): Promise<ApiResponse<"POST /api/messages/multiple/{to}">>
```

`POST /api/messages/multiple/{to}`. Com `files`, vai multipart — e `messages` é serializado como JSON string só nessa variante (Q7; a variante json aceita o array direto, sem serialização). Sem `files`, vai json puro.

**`POST /api/messages/multiple/{to}`**

Envia múltiplas mensagens para o número informado. Pode anexar arquivos de mídia.

_Parâmetros de path_

| Campo | Tipo | Opcional | Descrição |
|---|---|---|---|
| `to` | `string` | não | Número do Whatsapp para enviar as mensagens. |

_Corpo `multipart/form-data`:_ { messages?: `string`; files?: `string`[] } — Envie um array de mensagens no campo 'messages'. Cada mensagem deve seguir o schema MessageData. Para anexar arquivos, utilize o campo 'files' (multipart/form-data).

| Campo | Tipo | Opcional | Descrição |
|---|---|---|---|
| `messages` | `string` | sim | JSON stringificado de um array de MessageData |
| `files` | `string`[] | sim | Arquivos de mídia anexados |

_Corpo `application/json`:_ { messages?: `MessageData`[] } — Envie um array de mensagens no campo 'messages'. Cada mensagem deve seguir o schema MessageData. Para anexar arquivos, utilize o campo 'files' (multipart/form-data).

| Campo | Tipo | Opcional | Descrição |
|---|---|---|---|
| `messages` | `MessageData`[] | sim |  |

_Respostas:_
- `200` Mensagens enviadas com sucesso. → `MessageObject` (`application/json`)
- `400` Erro ao enviar as mensagens. → `Error` (`application/json`)
- `401` Unauthorized (token inválido ou ausente) → `Error` (`application/json`)
- `500` Erro ao enviar mensagens. → `Error` (`application/json`)

## `zdk.tickets` (Tickets)

### `zdk.tickets.list`

```ts
list(params?: ApiParams<"GET /api/tickets">["query"]): Promise<ApiResponse<"GET /api/tickets">>
```

**`GET /api/tickets`**

Lista todos os atendimentos baseado no critério de pesquisa. Pode ser filtrado por data de abertura (dateFrom/dateTo). Esse endpoint é paginado, ou seja, só pode trazer até no máximo 100 registros por página.

_Query_

| Campo | Tipo | Opcional | Descrição |
|---|---|---|---|
| `page` | `number` | sim | A página requisitada, o padrão é 1. |
| `pageSize` | `number` | sim | O número de registros por página, o padrão é 20. Não há limite para esse valor, por isso pode ser feito uma chamada para trazer todos os atendimentos com um valor alto para esse campo. No entanto isso pode afetar a performance da aplicação. |
| `dateFrom` | `string` | sim | Filtra os atendimentos abertos a partir desta data (inclusive), pela data de abertura. Formato AAAA-MM-DD. |
| `dateTo` | `string` | sim | Filtra os atendimentos abertos até esta data (inclusive), pela data de abertura. Formato AAAA-MM-DD. |

_Respostas:_
- `200` Lista de atendimentos. → `TicketList` (`application/json`)
- `400` Data inválida (formato esperado AAAA-MM-DD).

### `zdk.tickets.searchByContact`

```ts
searchByContact(contactNumber: string, params?: { readonly page?: number; readonly pageSize?: number; }): Promise<ApiResponse<"GET /api/tickets/search-by-contact">>
```

**`GET /api/tickets/search-by-contact`**

Busca todos os atendimentos de um contato específico pelo número do telefone. Esse endpoint é paginado, ou seja, só pode trazer até no máximo 100 registros por página.

_Query_

| Campo | Tipo | Opcional | Descrição |
|---|---|---|---|
| `contactNumber` | `string` | não | O número do contato para buscar os tickets. |
| `page` | `number` | sim | A página requisitada, o padrão é 1. |
| `pageSize` | `number` | sim | O número de registros por página, o padrão é 20. Não há limite para esse valor, por isso pode ser feito uma chamada para trazer todos os atendimentos com um valor alto para esse campo. No entanto isso pode afetar a performance da aplicação. |

_Respostas:_
- `200` Lista de atendimentos do contato. → `TicketList` (`application/json`)
- `404` Contato não encontrado.

### `zdk.tickets.get`

```ts
get(id: number): Promise<ApiResponse<"GET /api/tickets/{id}">>
```

**`GET /api/tickets/{id}`**

Retorna o Atendimento com o ID informado

_Parâmetros de path_

| Campo | Tipo | Opcional | Descrição |
|---|---|---|---|
| `id` | `number` | não | O ID do atendimento. |

_Respostas:_
- `200` Atendimento específico. → `Ticket` (`application/json`)
- `404` Atendimento não encontrado.

### `zdk.tickets.update`

```ts
update(id: number, data: ApiBody<"PUT /api/tickets/{id}">): Promise<ApiResponse<"PUT /api/tickets/{id}">>
```

**`PUT /api/tickets/{id}`**

Atualiza o atendimento. ATENÇÃO! Esse endpoint permite que o atendimento seja atualizado livremente, então as regras de validação não serão contadas para transferência e mudança de status. Para transferências prefira utilizar o endpoint de transferência de atendimento.

_Parâmetros de path_

| Campo | Tipo | Opcional | Descrição |
|---|---|---|---|
| `id` | `number` | não | O id do atendimento a ser atualizado. |

_Corpo `application/json` (opcional):_ `TicketUpdateForm`

_Respostas:_
- `200` Retorna o atendimento alterado. → `Ticket` (`application/json`)
- `400` Status, atendente ou setor inválido
- `404` Atendimento não encontrado

### `zdk.tickets.transfer`

```ts
transfer(id: number, data: ApiBody<"POST /api/tickets/{id}/transfer">): Promise<ApiResponse<"POST /api/tickets/{id}/transfer">>
```

**`POST /api/tickets/{id}/transfer`**

Transfere um atendimento de um usuário, setor, conexão para outro(s).

_Parâmetros de path_

| Campo | Tipo | Opcional | Descrição |
|---|---|---|---|
| `id` | `number` | não | O id do atendimento a ser transferido. |

_Corpo `application/json` (opcional):_ `TicketTransferForm`

_Respostas:_
- `200` Retorna o atendimento transferido. → `Ticket` (`application/json`)
- `400` Usuário, setor ou conexão inválidos
- `404` Atendimento não encontrado

### `zdk.tickets.resolve`

```ts
resolve(id: number, data: TicketResolveFormData): Promise<ApiResponse<"POST /api/tickets/{id}/resolve">>
```

`feedbackOption: "send-end-message"` dispara mensagem de encerramento ao contato — é por isso que esta operação é `unsafe` em `operation-metadata.ts`. Q24: `feedbackOption` fica opcional — tem `default: "none"`, servidor aplica se omitido.

**`POST /api/tickets/{id}/resolve`**

Finaliza um atendimento com as opções informadas. Em feedbackOption informe "feedback" ou "send-end-message" para ativar a requisição de feedback ao usuário ou apenas enviar mensagem de finalização. O padrão para esse campo é "none", que vai apenas finalizar o atendimento sem enviar nenhuma mensagem

_Parâmetros de path_

| Campo | Tipo | Opcional | Descrição |
|---|---|---|---|
| `id` | `number` | não | O id do atendimento a ser finalizado. |

_Corpo `application/json` (opcional):_ `TicketResolveForm`

_Respostas:_
- `200` Retorna o atendimento finalizado. → `Ticket` (`application/json`)
- `400` Opção de feedback inválida
- `404` Atendimento não encontrado

### `zdk.tickets.sendText`

```ts
sendText(id: number, data: ApiBody<"POST /api/tickets/{id}/send">): Promise<ApiResponse<"POST /api/tickets/{id}/send">>
```

Devolve o `Ticket` atualizado, não a `Message` enviada — conforme o contrato.

**`POST /api/tickets/{id}/send`**

Envia uma mensagem para o atendimento especificado. A mensagem será enviada mesmo que o atendimento esteja fechado.

_Parâmetros de path_

| Campo | Tipo | Opcional | Descrição |
|---|---|---|---|
| `id` | `number` | não | O id do atendimento para o qual a mensagem será enviada. |

_Corpo `application/json` (opcional):_ `SendMessage` — Payload

_Respostas:_
- `200` Retorna a mensagem enviada. → `Ticket` (`application/json`)
- `400` Opção de feedback inválida ou janela de 24 horas da API Oficial fechada. → `OfficialApiWindowError` (`application/json`)
- `404` Atendimento não encontrado

### `zdk.tickets.sendMedia`

```ts
sendMedia(id: number, type: MediaType, data: SendMediaMessageData): Promise<ApiResponse<"POST /api/tickets/{id}/send/{type}">>
```

Multipart — arquivo binário (Q20).

**`POST /api/tickets/{id}/send/{type}`**

Envia um arquivo para o número informado. Pode ou não receber o ID da conexão para enviar com conexão específica. Caso não seja informado, será usado a conexão padrão ou a primeira da lista. Caso a conexão especificada esteja desconectada, o endpoint trará um erro. Você pode enviar o arquivo com multipart/form-data diretamente no corpo da requisição ou enviar uma URL para arquivo externo, e nesse caso utilizar o Content-Type application/json e o campo "url"

_Parâmetros de path_

| Campo | Tipo | Opcional | Descrição |
|---|---|---|---|
| `type` | `"image"` \| `"video"` \| `"audio"` \| `"voice"` \| `"document"` | não | Tipo de arquivo |
| `id` | `number` | não | O id do atendimento para o qual a mensagem será enviada. |

_Corpo `multipart/form-data` (opcional):_ `SendMediaMessage` — Payload

_Corpo `application/json` (opcional):_ `SendMediaMessageJson` — Payload

_Respostas:_
- `200` Arquivo enviado. → `Message` (`application/json`)
- `400` Erro ao enviar a mensagem ou janela de 24 horas da API Oficial fechada. → `Error` \| `OfficialApiWindowError` (`application/json`)

### `zdk.tickets.sendMediaByUrl`

```ts
sendMediaByUrl(id: number, type: MediaType, data: ApiBody<"POST /api/tickets/{id}/send/{type}", "application/json">): Promise<ApiResponse<"POST /api/tickets/{id}/send/{type}">>
```

Json — mídia por URL (Q20).

**`POST /api/tickets/{id}/send/{type}`**

Envia um arquivo para o número informado. Pode ou não receber o ID da conexão para enviar com conexão específica. Caso não seja informado, será usado a conexão padrão ou a primeira da lista. Caso a conexão especificada esteja desconectada, o endpoint trará um erro. Você pode enviar o arquivo com multipart/form-data diretamente no corpo da requisição ou enviar uma URL para arquivo externo, e nesse caso utilizar o Content-Type application/json e o campo "url"

_Parâmetros de path_

| Campo | Tipo | Opcional | Descrição |
|---|---|---|---|
| `type` | `"image"` \| `"video"` \| `"audio"` \| `"voice"` \| `"document"` | não | Tipo de arquivo |
| `id` | `number` | não | O id do atendimento para o qual a mensagem será enviada. |

_Corpo `multipart/form-data` (opcional):_ `SendMediaMessage` — Payload

_Corpo `application/json` (opcional):_ `SendMediaMessageJson` — Payload

_Respostas:_
- `200` Arquivo enviado. → `Message` (`application/json`)
- `400` Erro ao enviar a mensagem ou janela de 24 horas da API Oficial fechada. → `Error` \| `OfficialApiWindowError` (`application/json`)

### `zdk.tickets.sendAndClose`

```ts
sendAndClose(id: number, data: SendAndCloseData): Promise<ApiResponse<"POST /api/tickets/{id}/send-and-close">>
```

Só multipart no contrato — sem variante json. Resposta vem embrulhada: `{ message, ticket }`.

**`POST /api/tickets/{id}/send-and-close`**

Envia uma mensagem (com ou sem mídias) e encerra o atendimento em seguida.

_Parâmetros de path_

| Campo | Tipo | Opcional | Descrição |
|---|---|---|---|
| `id` | `number` | não | O id do atendimento para o qual a mensagem será enviada e encerrada. |

_Corpo `multipart/form-data` (opcional):_ { body?: `string`; files?: `string`[] }

| Campo | Tipo | Opcional | Descrição |
|---|---|---|---|
| `body` | `string` | sim | O conteúdo da mensagem a ser enviada. |
| `files` | `string`[] | sim | Os arquivos de mídia a serem enviados. |

_Respostas:_
- `200` Mensagem enviada e atendimento encerrado. → { message?: `Message`; ticket?: `Ticket` } (`application/json`)
- `400` Erro ao enviar a mensagem, encerrar o atendimento ou janela de 24 horas da API Oficial fechada. → `OfficialApiWindowError` (`application/json`)
- `404` Atendimento não encontrado.

_Campos da resposta `200`:_

| Campo | Tipo | Opcional | Descrição |
|---|---|---|---|
| `message` | `Message` | sim |  |
| `ticket` | `Ticket` | sim |  |

### `zdk.tickets.info`

```ts
info(id: number): Promise<ApiResponse<"GET /api/tickets/{id}/info">>
```

Janela de 24h da API Oficial: `canSendMessageWithOficialApi`.

**`GET /api/tickets/{id}/info`**

Retorna as informações do atendimento com o ID informado.

_Parâmetros de path_

| Campo | Tipo | Opcional | Descrição |
|---|---|---|---|
| `id` | `string` | não | O ID do atendimento. |

_Respostas:_
- `200` Informações do atendimento. → `TicketInfo` (`application/json`)
- `404` Atendimento nao encontrado.

### `zdk.tickets.sendTemplate`

```ts
sendTemplate(id: number, data: ApiBody<"POST /api/tickets/{id}/send-template">): Promise<ApiResponse<"POST /api/tickets/{id}/send-template">>
```

Q4: `id` é obrigatório aqui apesar do contrato marcá-lo como parâmetro opcional.

**`POST /api/tickets/{id}/send-template`**

Envia um template para o contato informado. Devem ser informados o ID do template, os parâmetros de cabeçalho e botões, e os parâmetros do corpo do template, caso existam.

_Parâmetros de path_

| Campo | Tipo | Opcional | Descrição |
|---|---|---|---|
| `id` | `string` | não | ID do atendimento em que o template será enviado |

_Corpo `application/json`:_ `SendTemplate` — Objeto com os dados para enviar o template.

_Respostas:_
- `200` Retorna o ID da mensagem enviada. → `Message` (`application/json`)
- `400` Erro de validação. → `ValidationError` (`application/json`)
- `500` Erro interno. → `ServerError` (`application/json`)

## `zdk.templates` (Templates)

Templates de mensagem da API Oficial (tag `API Oficial` no swagger, além de `Conexões` para `list`). `send`/`sendBulk` exigem uma conexão do tipo `whatsapp-oficial` (obtida em `connections.list()`).

### `zdk.templates.list`

```ts
list(connectionId: number): Promise<TemplateList["templates"]>
```

`GET /api/connections/{id}/templates`. Q22 — CONFIRMADO com chamada real: o contrato declara `MessageTemplate` (objeto único), mas a resposta é `{ templates: MessageTemplate[] }`. Divergência entre instâncias (Q15-style): zapplataforma já corrigiu isso no próprio swagger, zapcontabil não — a união herda a forma antiga, daí o override.

**`GET /api/connections/{id}/templates`**

Lista todas as templates de mensagem da API Oficial dessa conexão.

_Parâmetros de path_

| Campo | Tipo | Opcional | Descrição |
|---|---|---|---|
| `id` | `number` | não | O ID da conexão. |

_Respostas:_
- `200` Lista de templates. → `MessageTemplate` (`application/json`)

### `zdk.templates.send`

```ts
send(to: string, data: SendTemplateData): Promise<ApiResponse<"POST /api/send-template/{to}">>
```

Q3: `connectionFrom` é obrigatório apesar do codegen marcar opcional.

**`POST /api/send-template/{to}`**

Envia um template para o contato informado. Devem ser informados o ID do template, os parâmetros de cabeçalho e botões, e os parâmetros do corpo do template, caso existam. **O campo `connectionFrom` é obrigatório** e deve conter o ID de uma conexão do tipo API Oficial (whatsapp-oficial), obtido em /api/connections. Caso a conexão informada não seja do tipo API Oficial, o endpoint retornará erro 400.

_Parâmetros de path_

| Campo | Tipo | Opcional | Descrição |
|---|---|---|---|
| `to` | `string` | não | O telefone do contato a ser enviado o template. |

_Corpo `application/json`:_ `SendTemplate` — Objeto com os dados para enviar o template.

_Respostas:_
- `200` Retorna o ID da mensagem enviada. → `Message` (`application/json`)
- `400` Erro de validação. → `ValidationError` (`application/json`)
- `500` Erro interno. → `ServerError` (`application/json`)

### `zdk.templates.sendBulk`

```ts
sendBulk(data: ApiBody<"POST /api/send-template-bulk">): Promise<ApiResponse<"POST /api/send-template-bulk">>
```

Resposta 200 com falha parcial por número — ver `results[].status` (Q10).

**`POST /api/send-template-bulk`**

Envia um template para múltiplos contatos informados no campo `to`. O campo `connectionFrom` é obrigatório e deve conter o ID de uma conexão do tipo API Oficial (whatsapp-oficial). Retorna um array de resultados por número, permitindo falhas parciais.

_Corpo `application/json`:_ `SendTemplateBulk` — Objeto com os dados para enviar o template para múltiplos números.

_Respostas:_
- `200` Resultados do envio por número. → `SendTemplateBulkResult` (`application/json`)
- `400` Erro de validação. → `ValidationError` (`application/json`)

## `zdk.storage` (Storage)

Armazenamento (`Storage`). `uploadTemp` tem tag `API Oficial` no swagger, mas é operação de armazenamento — a `url` que devolve serve a qualquer `headerParams` de template, não só ao fluxo oficial (§5.5).

### `zdk.storage.signedUrl`

```ts
signedUrl(fileKey: string, params?: ApiParams<"GET /api/storage/signed-url/{filekey}">["query"]): Promise<ApiResponse<"GET /api/storage/signed-url/{filekey}">>
```

**`GET /api/storage/signed-url/{filekey}`**

Gera uma URL assinada para acessar um arquivo armazenado de forma segura.

_Parâmetros de path_

| Campo | Tipo | Opcional | Descrição |
|---|---|---|---|
| `filekey` | `string` | não | Chave do arquivo para o qual a URL assinada será gerada. |

_Query_

| Campo | Tipo | Opcional | Descrição |
|---|---|---|---|
| `expiresInSeconds` | `number` | sim | Tempo em segundos para o qual a URL assinada será válida. O padrão é 300 segundos (5 minutos). O valor máximo permitido é 3600 segundos (1 hora). |

_Respostas:_
- `200` URL assinada gerada com sucesso. → `getSignedUrlResponse` (`application/json`)

### `zdk.storage.uploadTemp`

```ts
uploadTemp(data: UploadTempData): Promise<UploadTempResponse>
```

Q3: `media` é obrigatório; `url`/`filename`/`success` da resposta são sempre presentes — ambos apesar do codegen marcar opcional.

**`POST /api/upload-temp`**

Envia um arquivo e retorna uma url pública para ser utilizada com o sendTemplate

_Corpo `multipart/form-data`:_ `UploadTemp` — Objeto com os dados para enviar o template.

_Respostas:_
- `200` Retorna a URL pública para acesso do arquivo enviado. Essa URL tem validade indeterminada, portanto não deve ser armazenada. → `UploadTempResponse` (`application/json`)
- `400` Erro de validação. → `ValidationError` (`application/json`)
- `500` Erro interno. → `ServerError` (`application/json`)

## `zdk.webhooks` (Webhooks)

Webhooks. `universal: false` na prática (§5.2/Q15) — ausente do swagger da zapplataforma amostrada; `404` numa instância sem essa feature vira `ZdkUnsupportedOperationError`, não erro genérico (T18).

### `zdk.webhooks.list`

```ts
list(params?: ApiParams<"GET /api/webhooks">["query"]): Promise<ApiResponse<"GET /api/webhooks">>
```

**`GET /api/webhooks`**

Lista todos os webhooks. Paginado em 20 registros por página.

_Query_

| Campo | Tipo | Opcional | Descrição |
|---|---|---|---|
| `page` | `number` | sim | A página requisitada, o padrão é 1. Cada página retorna 20 registros. |
| `search` | `string` | sim | Pesquisa por nome ou URL do webhook |

_Respostas:_
- `200` Lista de webhooks. → `WebhookList` (`application/json`)

### `zdk.webhooks.get`

```ts
get(id: number): Promise<ApiResponse<"GET /api/webhooks/{id}">>
```

**`GET /api/webhooks/{id}`**

Retorna o webhook com o ID informado. O campo `secret` não é retornado nesse endpoint.

_Parâmetros de path_

| Campo | Tipo | Opcional | Descrição |
|---|---|---|---|
| `id` | `number` | não | O ID do webhook. |

_Respostas:_
- `200` Webhook encontrado. → `Webhook` (`application/json`)
- `404` Webhook não encontrado.

### `zdk.webhooks.create`

```ts
create(data: WebhookPostData): Promise<ApiResponse<"POST /api/webhooks">>
```

Q24: `active` fica opcional de novo — tem `default: true`, o servidor aplica sozinho se omitido.

**`POST /api/webhooks`**

Cria um novo webhook. O campo `secret` é retornado **somente** nessa resposta — guarde-o para validar as assinaturas HMAC das requisições recebidas.

_Corpo `application/json`:_ `WebhookPostData` — Dados do webhook a ser criado. Os campos `name`, `url`, `urlType` e `type` são obrigatórios.

_Respostas:_
- `200` Webhook criado com sucesso. → `WebhookWithSecret` (`application/json`)
- `400` Dados inválidos (URL bloqueada, JSON de headers inválido, campos obrigatórios ausentes, etc). → `Error` (`application/json`)

### `zdk.webhooks.update`

```ts
update(id: number, data: WebhookPostData): Promise<ApiResponse<"PUT /api/webhooks/{id}">>
```

**`PUT /api/webhooks/{id}`**

Atualiza um webhook existente. O campo `secret` é incluído na resposta.

_Parâmetros de path_

| Campo | Tipo | Opcional | Descrição |
|---|---|---|---|
| `id` | `number` | não | O ID do webhook a ser atualizado. |

_Corpo `application/json`:_ `WebhookPostData` — Dados para atualização do webhook.

_Respostas:_
- `200` Webhook atualizado com sucesso. → `WebhookWithSecret` (`application/json`)
- `400` Dados inválidos. → `Error` (`application/json`)
- `404` Webhook não encontrado.

### `zdk.webhooks.delete`

```ts
delete(id: number): Promise<ApiResponse<"DELETE /api/webhooks/{id}">>
```

**`DELETE /api/webhooks/{id}`**

Remove um webhook. Retorna os dados do webhook excluído, incluindo o `secret`.

_Parâmetros de path_

| Campo | Tipo | Opcional | Descrição |
|---|---|---|---|
| `id` | `number` | não | O ID do webhook a ser removido. |

_Respostas:_
- `200` Webhook removido com sucesso. → `WebhookWithSecret` (`application/json`)
- `404` Webhook não encontrado.

## `zdk.dashboard` (Dashboard)

Dashboard. Os três relatórios aceitam `userIds[]`/`queueIds[]`/`tagIds[]` como filtro — arrays de verdade, serializados como entradas repetidas da mesma chave por `request-builder.ts` (extensão feita em T25).

### `zdk.dashboard.ticketsByAgent`

```ts
ticketsByAgent(params: NonNullable<ApiParams<"GET /api/dashboard/tickets-por-atendente">["query"]>): Promise<ApiResponse<"GET /api/dashboard/tickets-por-atendente">>
```

**`GET /api/dashboard/tickets-por-atendente`** — Tickets e TMA por atendente

Retorna a contagem de tickets e o TMA humano agrupados por atendente no periodo informado. O TMA e calculado a partir da primeira aceitacao do atendente humano (evento `acceptTicket`) ate o fechamento, considerando apenas tickets com status `closed`. Retomadas (`acceptFromPaused`, `acceptFromClosed`) nao redefinem o marco inicial.

_Query_

| Campo | Tipo | Opcional | Descrição |
|---|---|---|---|
| `startDate` | `string` | não | Data inicial no formato YYYY-MM-DD. |
| `endDate` | `string` | não | Data final no formato YYYY-MM-DD. |
| `userIds[]` | `number`[] | sim | IDs dos atendentes para filtro. |
| `queueIds[]` | `number`[] | sim | IDs dos setores para filtro. |
| `tagIds[]` | `number`[] | sim | IDs das tags de contato para filtro. |

_Respostas:_
- `200` Lista de tickets e TMA por atendente. → { userId?: `number` \| `null`; userName?: `string`; totalTickets?: `number`; tmaSegundos?: `number`; tmaFormatado?: `string` }[] (`application/json`)
- `400` Parametros invalidos.

### `zdk.dashboard.ticketsByQualification`

```ts
ticketsByQualification(params: NonNullable<ApiParams<"GET /api/dashboard/tickets-por-qualificacao">["query"]>): Promise<ApiResponse<"GET /api/dashboard/tickets-por-qualificacao">>
```

**`GET /api/dashboard/tickets-por-qualificacao`** — Tickets e TMA por qualificacao

Retorna a contagem de tickets e o TMA humano agrupados pela qualificacao do atendimento. O TMA e calculado a partir da primeira aceitacao do atendente humano (evento `acceptTicket`) ate o fechamento, considerando apenas tickets com status `closed`. Retomadas (`acceptFromPaused`, `acceptFromClosed`) nao redefinem o marco inicial.

_Query_

| Campo | Tipo | Opcional | Descrição |
|---|---|---|---|
| `startDate` | `string` | não | Data inicial no formato YYYY-MM-DD. |
| `endDate` | `string` | não | Data final no formato YYYY-MM-DD. |
| `userIds[]` | `number`[] | sim | IDs dos atendentes para filtro. |
| `queueIds[]` | `number`[] | sim | IDs dos setores para filtro. |
| `tagIds[]` | `number`[] | sim | IDs das tags de contato para filtro. |

_Respostas:_
- `200` Lista de tickets e TMA por qualificacao. → { qualificacao?: `string`; totalTickets?: `number`; tmaSegundos?: `number`; tmaFormatado?: `string` }[] (`application/json`)
- `400` Parametros invalidos.

### `zdk.dashboard.ticketsGrouped`

```ts
ticketsGrouped(params: NonNullable<ApiParams<"GET /api/dashboard/tickets-agrupados">["query"]>): Promise<ApiResponse<"GET /api/dashboard/tickets-agrupados">>
```

**`GET /api/dashboard/tickets-agrupados`** — Tickets agrupados por dimensao

Retorna a contagem de tickets agrupada por tag, setor, mes ou dia.

_Query_

| Campo | Tipo | Opcional | Descrição |
|---|---|---|---|
| `dimensao` | `"tag"` \| `"setor"` \| `"mes"` \| `"dia"` | não | Dimensao de agrupamento. |
| `startDate` | `string` | não | Data inicial no formato YYYY-MM-DD. |
| `endDate` | `string` | não | Data final no formato YYYY-MM-DD. |
| `userIds[]` | `number`[] | sim | IDs dos atendentes para filtro. |
| `queueIds[]` | `number`[] | sim | IDs dos setores para filtro. Ignorado quando dimensao=setor. |
| `tagIds[]` | `number`[] | sim | IDs das tags de contato para filtro. Ignorado quando dimensao=tag. |

_Respostas:_
- `200` Lista de tickets agrupados. → { id?: `number` \| `null`; label?: `string`; totalTickets?: `number` }[] (`application/json`)
- `400` Parametros invalidos.

## `zdk.metrics` (Metrics)

Métricas de mensagens.

### `zdk.metrics.messages`

```ts
messages(params?: ApiParams<"GET /api/metrics/messages">["query"]): Promise<ApiResponse<"GET /api/metrics/messages">>
```

**`GET /api/metrics/messages`**

Traz métricas de atendimento e mensagens como. indicadores de qualidade do atendimento via mensagens ( incluindo rapidez na primeira resposta e agilidade na interação entre agentes e clientes ) e quantidade de mensagens separado por ambiente ( jupiter e outras conexões )

_Query_

| Campo | Tipo | Opcional | Descrição |
|---|---|---|---|
| `dateFrom` | `string` | sim | Data inicial (incluindo) (opcional). Ex: 2021-01-01 |
| `dateTo` | `string` | sim | Data final (incluindo) (opcional). Ex: 2021-01-31 |

_Respostas:_
- `200` Métricas de atendimento e mensagens. → `DashboardMetrics` (`application/json`)

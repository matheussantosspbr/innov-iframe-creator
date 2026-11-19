# ZDK 1.0: modelos (schemas do contrato)

> Gerado a partir de `components.schemas` de `dist/index.d.ts` (`zdk@1.0.0`). São os tipos **brutos do contrato**; o ZDK corrige vários em runtime e nos tipos exportados (`zdk-quirks.md`). Os enums listam os valores do contrato, que nem sempre cobrem os reais (por exemplo `Connection.status`, Q1).

"Opcional: não" = o tipo gerado o trata como obrigatório (por causa de `default` no schema, Q24, ou `required`).

## Connection

| Campo | Tipo | Opcional | Descrição |
|---|---|---|---|
| `id` | `number` | sim | Identificador único de cada conexão |
| `status` | `"CONNECTED"` \| `"DISCONNECTED"` \| `"TIMEOUT"` | sim |  |
| `createdAt` | `string` (date-time) | sim | Data de criação da conexão |
| `updatedAt` | `string` (date-time) | sim | Data de atualização da conexão |
| `isDefault` | `boolean` | sim | Indica se a conexão é padrão |
| `name` | `string` | sim | Nome da conexão |
| `platform` | `string` | sim | Plataforma de onde foi feita a conexão com o Whatsapp. Exemplo: android, ios |
| `number` | `string` | sim | Número do Whatsapp conectado. Atenção, esse número pode não ser o atual caso a conexão não esteja ativa |
| `greetingMessage` | `string` | sim | Mensagem de boas-vindas |
| `endMessage` | `string` | sim | Mensagem de encerramento |
| `feedbackMessage` | `string` | sim | Mensagem de feedback |

Valores de enum:
- `status`: `CONNECTED`, `DISCONNECTED`, `TIMEOUT`

## MessageTemplate

| Campo | Tipo | Opcional | Descrição |
|---|---|---|---|
| `id` | `number` | sim | Identificador único de cada template no sistema |
| `externalId` | `string` | sim | Identificador único de cada template na Meta |
| `type` | `"PHONE"` \| `"URL"` \| `"QUICK_REPLY"` \| `"COPY_CODE"` | sim | Tipo de template |
| `name` | `string` | sim | Nome do template |
| `language` | `string` | sim | Idioma do template |
| `variableType` | `"NAMED"` \| `"POSITIONAL"` | sim | Tipo de variáveis do template |
| `headType` | `"text"` \| `"image"` \| `"video"` \| `"document"` \| `"location"` | sim | Formato do cabeçalho |
| `header` | { format?: `"text"` \| `"image"` \| `"video"` \| `"document"` \| `"location"`; text?: `string`; example?: `string`[] } | sim |  |
| `headerVariables` | `string`[] | sim | Variáveis do cabeçalho |
| `footer` | `string` | sim | Rodapé do template |
| `buttons` | { type?: `"PHONE_NUMBER"` \| `"URL"` \| `"QUICK_REPLY"` \| `"COPY_CODE"`; text?: `string`; countryCode?: `string`; phoneNumber?: `string`; url?: `string`; urlType?: `"static"` \| `"dynamic"` }[] | sim |  |
| `body` | `string` | sim | Corpo do template |
| `status` | `"no-sent"` \| `"wait-approval"` \| `"approved"` \| `"rejected"` \| `"blocked"` | sim | Status do template |
| `stats` | { sentMessages?: `number`; openedMessages?: `number`; blockReason?: `string` } | sim |  |
| `variables` | `string`[] | sim | Variáveis do corpo do template |

Valores de enum:
- `type`: `PHONE`, `URL`, `QUICK_REPLY`, `COPY_CODE`
- `variableType`: `NAMED`, `POSITIONAL`
- `headType`: `text`, `image`, `video`, `document`, `location`
- `status`: `no-sent`, `wait-approval`, `approved`, `rejected`, `blocked`

## SendMessage

| Campo | Tipo | Opcional | Descrição |
|---|---|---|---|
| `body` | `string` | sim | Mensagem a ser enviada |
| `connectionFrom` | `number` | sim | Identificador único de cada conexão (obtido em /api/connections). Pode também ser informado a string 'current' que indica que a mensagem será enviada pela mesma conexão que já está em aberto o atendimento |
| `queueId` | `number` | sim | ID opcional do setor. Na criação do atendimento setoriza; se o atendimento já existir, atualiza apenas o setor (mantém responsável e status se não enviar userId). Valores inválidos/inexistentes retornam erro 400. Também se aplica a tickets de grupo existentes. Este roteamento é processado apenas nos endpoints /api/send... |
| `userId` | `number` | sim | ID opcional do usuário. Na criação direciona e deixa em aberto; se o atendimento já existir, atualiza apenas o responsável e força status em aberto (mantém setor se não enviar queueId). Valores inválidos/inexistentes retornam erro 400. Também se aplica a tickets de grupo existentes. Este roteamento é processado apenas nos endpoints /api/send... |
| `ticketStrategy` | `"create"` \| `"nocreate"` \| `"close"` \| `"reuseOrClose"` | sim | Define a estratégia de como será tratado o ticket para essa mensagem. São 3 opções possíveis: 1. Criar atendimento (padrão), 2. Não criar atendimento, 3. Criar a fechar atendimento |

Valores de enum:
- `ticketStrategy`: `create`, `nocreate`, `close`, `reuseOrClose`

## SendTemplate

| Campo | Tipo | Opcional | Descrição |
|---|---|---|---|
| `connectionFrom` | `number` | sim | Identificador único da conexão do tipo API Oficial (obtido em /api/connections). Este campo é obrigatório para que o template seja enviado. A conexão informada deve ser do tipo 'whatsapp-oficial' |
| `templateId` | `string` | sim | ID do template a ser enviado. Obtido em /api/connections/{id}/templates |
| `queueId` | `number` | sim | ID opcional do setor. Na criação do atendimento setoriza; se o atendimento já existir, atualiza apenas o setor (mantém responsável e status se não enviar userId). Valores inválidos/inexistentes retornam erro 400. Também se aplica a tickets de grupo existentes. Este roteamento é processado apenas nos endpoints /api/send... |
| `userId` | `number` | sim | ID opcional do usuário. Na criação direciona e deixa em aberto; se o atendimento já existir, atualiza apenas o responsável e força status em aberto (mantém setor se não enviar queueId). Valores inválidos/inexistentes retornam erro 400. Também se aplica a tickets de grupo existentes. Este roteamento é processado apenas nos endpoints /api/send... |
| `bodyParams` | { : `string` } | sim | Variáveis do corpo do template. Pode ser no formato NAMED ou POSITIONAL. Em qualquer um dos casos, envie um objeto com as variáveis no formato {variavel: valor}. Ex: {1: 'valor1', 2: 'valor2'} ou {'variavel1': 'valor1', 'variavel2': 'valor2'} |
| `headerParams` | { image?: `string`; video?: `string`; document?: `string`; location?: { latitude: `number`; longitude: `number` } } | sim | URL ou string base64. O tipo vai depender do template escolhido |
| `buttonParams` | { : `string` } | sim | Variáveis dos botões do template. Aqui o índice inicia em 0, sendo 0 o primeiro botão, 1 o segundo, etc. Enviar como objeto, com os índices como string ao invés de array |
| `ticketStrategy` | `"create"` \| `"nocreate"` \| `"close"` \| `"reuseOrClose"` | sim | Define a estratégia de como será tratado o ticket para essa mensagem. São 3 opções possíveis: 1. Criar atendimento (padrão), 2. Não criar atendimento, 3. Criar a fechar atendimento |

Valores de enum:
- `ticketStrategy`: `create`, `nocreate`, `close`, `reuseOrClose`

## SendTemplateBulk

| Campo | Tipo | Opcional | Descrição |
|---|---|---|---|
| `to` | `string`[] | não | Array de números de telefone no formato internacional (ex: 5511999999999) |
| `connectionFrom` | `number` | não | ID de uma conexão do tipo API Oficial (whatsapp-oficial), obtido em /api/connections |
| `templateId` | `string` | não | ID do template a ser enviado. Obtido em /api/connections/{id}/templates |
| `bodyParams` | { : `string` } | sim | Variáveis do corpo do template. Formato NAMED ou POSITIONAL. Ex: {"1": "valor1"} ou {"nome": "João"} |
| `headerParams` | { image?: `string`; video?: `string`; document?: `string`; location?: { latitude: `number`; longitude: `number` } } | sim | URL ou string base64 do cabeçalho do template (imagem, vídeo, documento ou localização) |
| `buttonParams` | { : `string` } | sim | Variáveis dos botões. Índice inicia em 0. Ex: {"0": "https://exemplo.com"} |
| `ticketStrategy` | `"create"` \| `"nocreate"` \| `"close"` \| `"reuseOrClose"` | sim | Estratégia de ticket: create (padrão), nocreate, close, reuseOrClose |

Valores de enum:
- `ticketStrategy`: `create`, `nocreate`, `close`, `reuseOrClose`

## SendTemplateBulkResult

| Campo | Tipo | Opcional | Descrição |
|---|---|---|---|
| `results` | { to?: `string`; status?: `"success"` \| `"error"`; message?: { id?: `string`; body?: `string`; type?: `string`; isMedia?: `boolean`; from?: `string`; contactId?: `number`; ticketId?: `number` }; error?: `string` }[] | sim |  |

## UploadTemp

| Campo | Tipo | Opcional | Descrição |
|---|---|---|---|
| `media` | `string` (binary) | sim |  |

## UploadTempResponse

| Campo | Tipo | Opcional | Descrição |
|---|---|---|---|
| `url` | `string` | sim |  |
| `filename` | `string` | sim |  |
| `success` | `boolean` | sim |  |

## SendMediaMessage

| Campo | Tipo | Opcional | Descrição |
|---|---|---|---|
| `media` | `string` (binary) | sim |  |
| `caption` | `string` | sim | Legenda para imagens, não aplica para outro tipo de arquivo enviado |
| `connectionFrom` | `number` | sim | Identificador único de cada conexão (obtido em /api/connections) |
| `queueId` | `number` | sim | ID opcional do setor. Na criação do atendimento setoriza; se o atendimento já existir, atualiza apenas o setor (mantém responsável e status se não enviar userId). Valores inválidos/inexistentes retornam erro 400. Também se aplica a tickets de grupo existentes. Este roteamento é processado apenas nos endpoints /api/send... |
| `userId` | `number` | sim | ID opcional do usuário. Na criação direciona e deixa em aberto; se o atendimento já existir, atualiza apenas o responsável e força status em aberto (mantém setor se não enviar queueId). Valores inválidos/inexistentes retornam erro 400. Também se aplica a tickets de grupo existentes. Este roteamento é processado apenas nos endpoints /api/send... |
| `ticketStrategy` | `"create"` \| `"nocreate"` \| `"close"` \| `"reuseOrClose"` | sim | Define a estratégia de como será tratado o ticket para essa mensagem. São 3 opções possíveis: 1. Criar atendimento (padrão), 2. Não criar atendimento, 3. Criar a fechar atendimento |

Valores de enum:
- `ticketStrategy`: `create`, `nocreate`, `close`, `reuseOrClose`

## SendMediaMessageJson

| Campo | Tipo | Opcional | Descrição |
|---|---|---|---|
| `url` | `string` | sim |  |
| `caption` | `string` | sim |  |
| `connectionFrom` | `number` | sim | Identificador único de cada conexão (obtido em /api/connections) |
| `queueId` | `number` | sim | ID opcional do setor. Na criação do atendimento setoriza; se o atendimento já existir, atualiza apenas o setor (mantém responsável e status se não enviar userId). Valores inválidos/inexistentes retornam erro 400. Também se aplica a tickets de grupo existentes. Este roteamento é processado apenas nos endpoints /api/send... |
| `userId` | `number` | sim | ID opcional do usuário. Na criação direciona e deixa em aberto; se o atendimento já existir, atualiza apenas o responsável e força status em aberto (mantém setor se não enviar queueId). Valores inválidos/inexistentes retornam erro 400. Também se aplica a tickets de grupo existentes. Este roteamento é processado apenas nos endpoints /api/send... |
| `ticketStrategy` | `"create"` \| `"nocreate"` \| `"close"` \| `"reuseOrClose"` | sim | Define a estratégia de como será tratado o ticket para essa mensagem. São 3 opções possíveis: 1. Criar atendimento (padrão), 2. Não criar atendimento, 3. Criar a fechar atendimento |

Valores de enum:
- `ticketStrategy`: `create`, `nocreate`, `close`, `reuseOrClose`

## Message

| Campo | Tipo | Opcional | Descrição |
|---|---|---|---|
| `id` | `number` | sim | Identificador único de cada mensagem |
| `body` | `string` | sim | Mensagem |
| `type` | `string` | sim | Tipo de mensagem no Whatsapp |
| `subtype` | `number` | sim | Subtipo da mensagem no Whatsapp |
| `isMedia` | `string` | sim | Se a mensagem foi uma mídia, como arquivo, imagem, vídeo, etc |
| `myContact` | `string` | sim | Se o número para o qual está sendo enviado é contato do número selecionado |
| `from` | `string` | sim | O número do qual foi enviado a mensagem. Esse é o número interno usado pelo Whatsapp então ele tem um sufixo no final além do número |
| `contactId` | `number` | sim | Identificador único do contato para o qual foi enviado a mensagem |
| `ticketId` | `number` | sim | Identificador único do ticket para o qual foi enviado a mensagem |

## Contact

| Campo | Tipo | Opcional | Descrição |
|---|---|---|---|
| `id` | `number` | sim | Identificador único de cada contato |
| `name` | `string` | sim | Nome do contato |
| `number` | `string` | sim | Número do contato incluindo DDI e DDD. Também pode ser o número interno que o Whatsapp utiliza para grupos, caso seja um grupo |
| `email` | `string` | sim | E-mail do contato |
| `profilePicUrl` | `string` | sim | Url da foto do perfil desse contato |
| `isGroup` | `boolean` | sim | Identifica se o contato é um grupo |
| `createdAt` | `string` (date-time) | sim | Data de criação do contato |
| `updatedAt` | `string` (date-time) | sim | Data de atualização do contato |
| `blocked` | `boolean` | sim | Identifica se o contato está bloqueado |
| `userId` | `number` | sim | ID do usuário selecionado para carteira de clientes |
| `queueId` | `number` | sim | ID do setor selecionado para carteira de clientes |
| `tags` | `Tag`[] | sim | Tags associadas ao contato |

## ContactPostData

| Campo | Tipo | Opcional | Descrição |
|---|---|---|---|
| `name` | `string` | sim | Nome do contato |
| `number` | `string` | sim | Número do contato incluindo DDI e DDD. Também pode ser o número interno que o Whatsapp utiliza para grupos, caso seja um grupo |
| `email` | `string` | sim | E-mail do contato |
| `profilePicUrl` | `string` | sim | Url da foto do perfil desse contato |
| `isGroup` | `boolean` | não | Identifica se o contato é um grupo. padrão: false |
| `blocked` | `boolean` | não | Identifica se o contato está bloqueado. padrão: false |
| `userId` | `number` | sim | ID do usuário selecionado para carteira de clientes |
| `queueId` | `number` | sim | ID do setor selecionado para carteira de clientes |
| `tagIds` | `number`[] | sim | IDs de tags para adicionar ao contato |
| `extraInfo` | `ContactExtraInfo`[] | sim | Informações adicionais do contato |
| `noCheckNumber` | `boolean` | não | Por padrão o sistema verifica se o número é válido para o Whatsapp. Informando essa propriedade, o número não será validado. padrão: false |

## ContactTagsPostData

| Campo | Tipo | Opcional | Descrição |
|---|---|---|---|
| `tags` | `Record<string, never>`[] | sim | Objetos de tags para serem adicionadas ao contato |
| `tagIds` | `number`[] | sim | IDs de tags para adicionar ao contato |
| `replaceTags` | `boolean` | não | Informa se as tags substituirão as existentes, caso seja false, as novas tags serão ADICIONADAS ao contato. padrão: false |
| `createTagIfNotExists` | `boolean` | não | Informa se a tag deve ser criada caso não exista. padrão: true |

## ContactExtraInfo

| Campo | Tipo | Opcional | Descrição |
|---|---|---|---|
| `name` | `string` | sim | Nome da informação adicional |
| `value` | `string` | sim | Valor da informação adicional |

## Tag

| Campo | Tipo | Opcional | Descrição |
|---|---|---|---|
| `id` | `string` | sim | Identificador único da Tag |
| `name` | `string` | sim | Nome da Tag |
| `color` | `string` | sim | Cor em código RGB da tag |
| `createdAt` | `string` (date-time) | sim | Data de criação da tag |
| `updatedAt` | `string` (date-time) | sim | Data de atualização da tag |

## TagPostData

| Campo | Tipo | Opcional | Descrição |
|---|---|---|---|
| `name` | `string` | sim | Nome da Tag |
| `color` | `string` | sim | Cor em código RGB da tag |

## Ticket

| Campo | Tipo | Opcional | Descrição |
|---|---|---|---|
| `id` | `string` | sim | Identificador do Atendimento |
| `status` | `string` | sim | Status do Atendimento |
| `userId` | `string` | sim | ID do usuário (pode ser nulo) |
| `contactId` | `string` | sim | ID do contato |
| `whatsappId` | `string` | sim | ID do Whatsapp associado |
| `queueId` | `string` | sim | ID do setor |
| `unreadMessages` | `number` | sim | Número de mensagens não lidas |
| `lastMessage` | `string` | sim | Última mensagem |
| `isGroup` | `boolean` | sim | Se o atendimento é um grupo |
| `createdAt` | `string` | sim | Data de criação do atendimento |
| `updatedAt` | `string` | sim | Data da última atualização do atendimento (geralmente a última mensagem recebida) |

## TicketInfo

| Campo | Tipo | Opcional | Descrição |
|---|---|---|---|
| `lastReceivedMessageDate` | `string` (date-time) | sim | Data da última mensagem recebida |
| `currentDate` | `string` (date-time) | sim | Data atual |
| `canSendMessageWithOficialApi` | `boolean` | sim | Se pode enviar mensagem com a API oficial. Ou seja, se o cliente enviou mensagem nas últimas 24 horas |

## User

| Campo | Tipo | Opcional | Descrição |
|---|---|---|---|
| `id` | `string` | sim | Identificador único da Tag |
| `name` | `string` | sim | Nome da Tag |
| `email` | `string` | sim |  |
| `createdAt` | `string` | sim | Data de criação do usuário |
| `updatedAt` | `string` | sim | Data da última atualização do usuário |
| `status` | `string` | sim | Se o usuário está online ou offline |
| `profile` | `string` | sim | Perfil do usuário (admin ou usuário comum) |
| `enabled` | `boolean` | sim | Se o usuário está habilitado ou não |

## Queue

| Campo | Tipo | Opcional | Descrição |
|---|---|---|---|
| `id` | `string` | sim | Identificador único do setor |
| `name` | `string` | sim | Nome do Setor |
| `color` | `string` | sim | Cor hexadecimal do setor no formato #RGB ou #RRGGBB (ex.: #0F0 ou #00FF00) |

## MessageObject

| Campo | Tipo | Opcional | Descrição |
|---|---|---|---|
| `id` | `string` | sim | Identificador da mensagem |
| `createdAt` | `string` | sim | Data de criação da mensagem |
| `updatedAt` | `string` | sim | Data de atualizacao da mensagem |
| `body` | `string` | sim | Conteúdo da mensagem |
| `mediaUrl` | `string` | sim | URL da imagem |
| `mediaType` | `string` | sim | Tipo da imagem |
| `fileKey` | `string` | sim | Chave do arquivo armazenado |
| `isDeleted` | `boolean` | sim | Se a mensagem foi excluída |
| `quotedMsgId` | `string` | sim | ID da mensagem citada |
| `ticketId` | `string` | sim | ID do atendimento |
| `contactId` | `string` | sim | ID do contato |
| `fromMe` | `boolean` | sim | Se a mensagem foi enviada pelo usuário |
| `ack` | `string` | sim | Informação do status de entrega da mensagem. Possíveis os seguintes valores: 0 (não entregue), 1 (enviada), 2 (entregue no dispositivo), 3 (lida) |
| `read` | `boolean` | sim | Se a mensagem foi lida |
| `locationLatitude` | `string` | sim | Latitude da localização da mensagem |
| `locationLongitude` | `string` | sim | Longitude da localização da mensagem |
| `editedFromId` | `string` | sim | Caso haja esse ID, ele aponta para a mensagem original que foi editada por essa |
| `editedToId` | `string` | sim | Em caso de mensagem editada, aponta para a mensagem que foi editada sobre essa. |
| `error` | `string` | sim | Mensagem de erro caso tenha havido ao processar a mensagem |

## Error

| Campo | Tipo | Opcional | Descrição |
|---|---|---|---|
| `error` | `string` | sim | Mensagem de erro |

## ValidationError

| Campo | Tipo | Opcional | Descrição |
|---|---|---|---|
| `error` | `string` | sim | Mensagem de erro |

## ServerError

| Campo | Tipo | Opcional | Descrição |
|---|---|---|---|
| `error` | `string` | sim | Mensagem de erro |

## OfficialApiWindowError

| Campo | Tipo | Opcional | Descrição |
|---|---|---|---|
| `error` | `string` | sim | Código de erro indicando que a janela de 24 horas da API Oficial está fechada |
| `message` | `string` | sim | Mensagem descritiva do erro |

## ContactList

| Campo | Tipo | Opcional | Descrição |
|---|---|---|---|
| `contacts` | `Contact`[] | sim |  |
| `count` | `number` | sim | O total de registros no banco de dados |
| `page` | `number` | sim | A página requisitada |
| `pageSize` | `number` | sim | Número de registros por página |
| `pageCount` | `number` | sim | Quantos registros foram trazidos nessa página |

## QueueList

| Campo | Tipo | Opcional | Descrição |
|---|---|---|---|
| `queues` | `Queue`[] | sim |  |
| `count` | `number` | sim | O total de registros no banco de dados |
| `page` | `number` | sim | A página requisitada |
| `pageSize` | `number` | sim | Número de registros por página |
| `pageCount` | `number` | sim | Quantos registros foram trazidos nessa página |

## QueuePostData

| Campo | Tipo | Opcional | Descrição |
|---|---|---|---|
| `name` | `string` | não | Nome do setor |
| `color` | `string` | não | Cor hexadecimal do setor no formato #RGB ou #RRGGBB (ex.: #0F0 ou #00FF00). Deve ser única. |

## QueuePostDataList

```ts
components["schemas"]["QueuePostData"][]
```

## QueueWithUsers

| Campo | Tipo | Opcional | Descrição |
|---|---|---|---|
| `id` | `number` | sim | Identificador do setor |
| `name` | `string` | sim | Nome do setor |
| `color` | `string` | sim | Cor hexadecimal do setor no formato #RGB ou #RRGGBB (ex.: #0F0 ou #00FF00) |
| `users` | { id?: `number`; name?: `string`; email?: `string` }[] | sim | Usuarios vinculados ao setor |

## QueueUsersList

```ts
components["schemas"]["QueueWithUsers"][]
```

## TicketList

| Campo | Tipo | Opcional | Descrição |
|---|---|---|---|
| `tickets` | `Ticket`[] | sim |  |
| `count` | `number` | sim | O total de registros no banco de dados |
| `page` | `number` | sim | A página requisitada |
| `pageSize` | `number` | sim | Número de registros por página |
| `pageCount` | `number` | sim | Quantos registros foram trazidos nessa página |

## TagList

| Campo | Tipo | Opcional | Descrição |
|---|---|---|---|
| `tags` | `Tag`[] | sim |  |
| `count` | `number` | sim | O total de registros no banco de dados |
| `page` | `number` | sim | A página requisitada |
| `pageSize` | `number` | sim | Número de registros por página |
| `pageCount` | `number` | sim | Quantos registros foram trazidos nessa página |

## MessageList

| Campo | Tipo | Opcional | Descrição |
|---|---|---|---|
| `messages` | `MessageObject`[] | sim |  |
| `count` | `number` | sim | O total de registros no banco de dados |
| `page` | `number` | sim | A página requisitada |
| `pageSize` | `number` | sim | Número de registros por página |
| `pageCount` | `number` | sim | Quantos registros foram trazidos nessa página |

## UserList

| Campo | Tipo | Opcional | Descrição |
|---|---|---|---|
| `users` | `User`[] | sim |  |
| `count` | `number` | sim | O total de registros no banco de dados |
| `page` | `number` | sim | A página requisitada |
| `pageSize` | `number` | sim | Número de registros por página |
| `pageCount` | `number` | sim | Quantos registros foram trazidos nessa página |

## TicketUpdateForm

| Campo | Tipo | Opcional | Descrição |
|---|---|---|---|
| `status` | `"pending"` \| `"open"` \| `"closed"` | sim | Novo status do atendimento: 'pending' (Aguardando), 'open' (Em Atendimento) ou 'closed' (Finalizado) |
| `userId` | `number` | sim | ID do novo atendente |
| `queueId` | `number` | sim | ID da nova fila |

Valores de enum:
- `status`: `pending`, `open`, `closed`

## TicketTransferForm

| Campo | Tipo | Opcional | Descrição |
|---|---|---|---|
| `queueId` | `number` | sim | ID da nova fila |
| `userId` | `number` | sim | ID do novo atendente |
| `connectionId` | `number` | sim | ID da nova conexão |

## TicketResolveForm

| Campo | Tipo | Opcional | Descrição |
|---|---|---|---|
| `feedbackOption` | `"none"` \| `"feedback"` \| `"send-end-message"` | não | Há 3 opções para essa propriedade. Por padrão (none) o sistema fecha esse chamado sem enviar nenhuma mensagem para o usuário. Você pode enviar nesse campo o valor 'feedback' para enviar mensagem de feedback caso esteja configurada, ou enviar 'send-end-message' para apenas enviar a mensagem de finalização do atendimento.. padrão: none |

Valores de enum:
- `feedbackOption`: `none`, `feedback`, `send-end-message`

## DashboardMetrics

| Campo | Tipo | Opcional | Descrição |
|---|---|---|---|
| `messages` | { total?: `number`; jupyterMessages?: { total?: `number`; sent?: `number`; received?: `number` }; otherConnections?: { omnichatsMessages?: { total?: `number`; sent?: `number`; received?: `number` } }; avgResponseTime?: { firstResponseTime?: `number`; responseTimeToClient?: `number`; responseTimeToUser?: `number` } } | sim |  |

## MessageData

| Campo | Tipo | Opcional | Descrição |
|---|---|---|---|
| `body` | `string` | sim | Conteúdo da mensagem |
| `fromMe` | `boolean` | sim | Se a mensagem foi enviada pelo usuário |
| `read` | `boolean` | sim | Se a mensagem foi lida |
| `quotedMsg` | `string` | sim | Mensagem citada |
| `isAudio` | `boolean` | sim | Se a mensagem é um áudio |
| `quotedMsgId` | `string` | sim | ID da mensagem citada |
| `asAudio` | `boolean` | sim | Se a mensagem deve ser tratada como áudio |
| `files` | `string`[] | sim | Arquivos anexados à mensagem |

## SendMultipleMessagesRequest

| Campo | Tipo | Opcional | Descrição |
|---|---|---|---|
| `messages` | `MessageData`[] | sim |  |

## getSignedUrlResponse

| Campo | Tipo | Opcional | Descrição |
|---|---|---|---|
| `url` | `string` | sim | URL assinada para acesso ao arquivo |

## Webhook

| Campo | Tipo | Opcional | Descrição |
|---|---|---|---|
| `id` | `number` | sim | Identificador único do webhook |
| `name` | `string` | sim | Nome do webhook |
| `url` | `string` | sim | URL de destino do webhook (apenas HTTPS; IPs privados são bloqueados) |
| `urlType` | `string` | sim | Tipo de URL (ex: static, dynamic) |
| `type` | `string` | sim | Tipo de evento que dispara o webhook |
| `headerString` | `string` | sim | Headers adicionais em formato JSON string |
| `active` | `boolean` | sim | Se o webhook está ativo |
| `requestType` | `string` | sim | Método HTTP utilizado (ex: POST, GET) |
| `sendEveryMinutes` | `number` | sim | Intervalo em minutos para envio periódico (apenas para tipos report_*) |
| `sendIntervalType` | `string` | sim | Tipo de intervalo de envio |
| `createdAt` | `string` (date-time) | sim | Data de criação |
| `updatedAt` | `string` (date-time) | sim | Data de atualização |

## WebhookWithSecret

Webhook com o campo secret incluso. Retornado apenas nas operações de create, update e delete.

```ts
components["schemas"]["Webhook"] & {
            /** @description Chave secreta HMAC-SHA256. Enviada no header X-Jupiter-Signature como sha256=<hash>. Guarde-a; não será retornada em GET. */
            secret?: string;
        }
```

## WebhookPostData

| Campo | Tipo | Opcional | Descrição |
|---|---|---|---|
| `name` | `string` | não | Nome do webhook |
| `url` | `string` | não | URL de destino do webhook (apenas HTTPS; IPs privados são bloqueados) |
| `urlType` | `string` | não | Tipo de URL |
| `type` | `string` | não | Tipo de evento que dispara o webhook |
| `requestType` | `string` | sim | Método HTTP (ex: POST, GET) |
| `headerString` | `string` | sim | Headers adicionais em formato JSON string |
| `active` | `boolean` | não | Se o webhook está ativo. padrão: true |
| `sendEveryMinutes` | `number` | sim | Intervalo em minutos (obrigatório para tipos report_*) |
| `sendIntervalType` | `string` | sim | Tipo de intervalo de envio |

## WebhookList

| Campo | Tipo | Opcional | Descrição |
|---|---|---|---|
| `webhooks` | `Webhook`[] | sim |  |
| `count` | `number` | sim | Total de registros no banco de dados |
| `hasMore` | `boolean` | sim | Se há mais registros além dos retornados |

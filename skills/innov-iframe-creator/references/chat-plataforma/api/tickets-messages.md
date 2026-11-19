# Tickets, mensagens, notas, dispatch e arquivos

Fonte: `chat-contabil-server/src/{ticket,message,message-notes,dispatch,file}` + `shared/middlewares`, `shared/authorization`, `api-key`. Tudo abaixo foi lido do código; quando não deu para confirmar, está marcado "não confirmado".

## 0. Convenções gerais

- **Formato de resposta**: `{ message: string, body?: any }`. O `body` passa por `safeJson`, então todo BigInt (ids) vira **string**. Erros: `{ message }` com o status do erro. Erro não tratado: `500 { message: "Houve um erro inesperado" }`.
- **Muitos endpoints de ticket mandam só `{ message }`, sem `body`** (accept/archive/unarchive/freeze/unfreeze/open/close/delete/transfer/priority/signature). O mesmo vale para PATCH/DELETE/react de mensagem.
- **Erros de autenticação usam outra chave**: `401 { error: "Não autorizado" }` (API key inválida), `401 { error: "Token de acesso ou API Key obrigatória" }`. Permissão negada: `403 { message: "Você não tem permissão para executar esta ação" }`. Org bloqueada ou agente bloqueado: `403 { message }`. Rate limit global por organização: **1200 req / 10 s** somando todas as rotas, e acima disso `429 { message: "Muitas requisições. Tente novamente em Ns." }`.
- **Ids**: todos BigInt (snowflake numérico). Na entrada, aceitam string numérica (`/^[0-9]+$/`). Um id não numérico em `:ticketId`/`:messageId`, onde o controller faz `BigInt(...)`, gera **500** em vez de 400.
- Paginação aparece em 3 formatos:
  - **cursor** (tickets, mensagens): `metadata: { total, hasNextPage, nextCursor }`, onde `nextCursor` é o id do último item da página, e esse valor volta no próximo request como `?cursor=`.
  - **cursor + search (full-text)** em mensagens: `metadata: { total, hasNextPage, nextCursor: null, page, perPage, totalPages }`. Usa `?page=`, com perPage limitado a 50.
  - **offset** (`Pagination`): `metadata: { total, count, perPage, currentPage, totalPages }`, com perPage padrão 50 e **máx 50** (`?page=&perPage=`).

## 1. Autenticação via `x-api-key` e o tenant resultante

`AuthenticationMiddleware.handle`: o header `x-api-key` é validado por `ValidateApiKeyActionAdapter` (`apiKey.value = <key>` e `createdByAgent.active=true, deleted=false`). O tenant fica assim:

| campo | origem |
|---|---|
| `organizationId` | org da key |
| `agentId` | **`apiKey.externalAgent.id`**, o "agente externo" vinculado à key, e não quem a criou |
| `agentName` | nome do agente externo |
| `isAdmin` | **true se o agente que CRIOU a key tem role OWNER** |
| `profileId` | perfil RBAC do **criador** da key |
| `isApiKey` | `true` |

Consequências:
- **Permissões (RBAC)**: `requirePermission(key)`. Com `isAdmin=true`, tudo é permitido. Sem isso, as permissões vêm do perfil do criador (`module:*` ou chave exata), e sem `profileId` → 403. O modo de enforcement pode ser `off/shadow/enforcing` por módulo via env `RBAC_ENFORCEMENT` (padrão enforcing).
- **Escopos de visibilidade** (conexão/setor/grupo) são resolvidos com o **agentId do agente externo** + `isAdmin`:
  - `ConnectionScope`: isAdmin → ALL. Caso contrário, RESTRICTED às conexões vinculadas ao agente externo (`agent_connections`), e lista vazia = nada.
  - `SectorScope`: isAdmin → ALL. Caso contrário, só os setores do agente externo. Ticket com `sectorId null` sempre aparece.
  - `GroupScope`: isAdmin → ALL. Se o agente externo tem vínculos em `group_agents` → RESTRICTED a esses grupos. Sem vínculo → ALL.
- **Key de criador não-OWNER**: o agente externo precisa estar vinculado às conexões/setores, senão listagens voltam vazias e várias ações falham.
- Ações "como agente" (aceitar, enviar, dispatch, nota) usam o **agente externo** como autor/responsável.

## 2. Enums (core/types)

- **TicketStatus**: `PENDING=1` (Aguardando), `ATTENDING=2` (Em atendimento), `RESOLVED=4` (Finalizado). Não existe 3. Nos filtros de query usa-se o **nome** (`status=PENDING,ATTENDING`). Nas respostas vem o **número**.
- **TicketPriority**: `LOW=1`, `MEDIUM=2` (default), `HIGH=3`.
- Flags de ticket independentes do status: `archived`, `frozen`, `signed`, `deleted` (soft delete).
- **MessageAck**: `MD_DOWNGRADE=-7, INACTIVE=-6, CONTENT_UNUPLOADABLE=-5, CONTENT_TOO_BIG=-4, CONTENT_GONE=-3, EXPIRED=-2, FAILED=-1, CLOCK=0, SENT=1, RECEIVED=2, READ=3, PLAYED=4`.
- **MessageType** (string): principais `chat`, `image`, `video`, `audio`, `ptt`, `sticker`, `document`, `location`, `vcard`, `multi_vcard`, `revoked`, `template_button_reply`, `list_response`, `buttons_response`, `poll_creation`, `system`, `unknown`, `notification`, `notification_template`, `group_notification`, `call_log`, `protocol`, `reply`, `mention` (e outros: gp2, e2e_notification, hsm, payment, product, order, list, oversized, ciphertext, groups_v4_invite).
- **MessageChannel**: `WHATSAPP=1`. Edição e exclusão só funcionam nesse canal.
- **Webhook events** (WebhookEventType): `message.received`, `message.sent`, `message.edited`, `message.deleted`, `message.reaction`, `dispatch.completed`, `ticket.transferred`, `ticket.closed`, `ticket.frozen`, `ticket.unfrozen`, `ticket.accepted`, `ticket.reopened`, `ticket.deleted`. **Não existe webhook de ticket criado, arquivado, desarquivado, prioridade ou assinatura.**

---

## 3. Tickets

Shape de "Ticket" (`Ticket.toProps()`): `{ id, protocol:number, priority:number, status:number, connection:{id,channel,provider,type,status,phoneNumber,default,welcomeMessage,closingMessage,session,sectors[],organizationId,walletMode}, contact?:{id,name,phoneNumber,userId,parentUserId,username,blocked,email,document,picture,tags[],customFields[]}, group?:{id,name,phone,restrict,announce,noFrequentlyForwarded,description,icon,tags[],customFields[]}, lastMessage, unreadMessagesCount, archived, frozen, signed, archivedAtUTC, frozenAtUTC, signedAtUTC, agent?, sector?, deleted, deletedAtUTC }`.

Todas as ações em lote (`ticketIds`) têm: array não vazio senão `400 "Necessário selecionar pelo menos um ticket"`; **máx 50** senão `400 "A quantidade máxima para <ação> em lote é de 50"`; ids não encontrados na org (ou deletados) → `404 "Um ou mais tickets não foram encontrados"`. Se algum ticket do lote falha numa regra, **o lote inteiro falha** (all-or-nothing antes de gravar).

**Multi-ticket (merge)**: quando a org tem `merge` ligado (preferência "contact"/"group"), aceitar/fechar/arquivar/criar também afeta **tickets irmãos do mesmo contato em outras conexões**. Esses tickets mudam mesmo sem estar em `ticketIds`.

### POST /v1/tickets — permissão `tickets:create`
- Body: `connectionId` (id, obrigatório, senão `422 "Conexão é obrigatória"`; não numérico → `400 "Id da conexão inválido"`); `contact` (string: **id de contato com 15–20 dígitos** OU **telefone** `55` + 10–11 dígitos ou `1` + 10 dígitos; outro formato → `422 Formato de contato inválido: "..."`) **ou** `groupId`. Sem nenhum dos dois → `422 "Obrigatório informar um contato ou grupo"`. Opcionais: `agentId` (default = agente externo da key), `sectorId`.
- Regras:
  - Conexão inexistente → `400 "Conexão informada não existe"`.
  - Conexão não CONNECTED → `422 "A conexão deve estar ativa para criar um ticket"`.
  - agentId/sectorId inexistente → `422 "Agente não encontrado"` / `"Setor não encontrado"`.
  - Telefone sem contato correspondente: **o contato é criado** (nome = telefone), e as variantes do 9º dígito são consideradas.
  - Em conexão WuzAPI, o número é normalizado via checkNumber.
- O ticket nasce com `status=ATTENDING`, `priority=MEDIUM`. Se já existe ticket aberto (PENDING/ATTENDING) para contato/grupo + conexão, retorna o existente.
- Sucesso: **201** `"Ticket criado com sucesso"` ou **200** `"Ticket já existe"`, com body `{ ticketId, contactId|null, groupId|null, isNew }`.
- Efeitos: socket `createdTicket` (só quando novo). Com merge, cria também tickets espelho nas outras conexões CONNECTED. **Sem webhook.** Gera log de auditoria.
- Pegadinhas: a busca de `connectionId`/`agentId`/`sectorId`/contato-por-id usa `findUnique` **sem filtrar organização** (não valida se pertencem à org da key). O resultado é ticket ATTENDING direto, sem passar por PENDING.

### GET /v1/tickets — permissão `tickets:list`
- Query:
  - `perPage` (default 50, **sem máximo**), `cursor` (id de ticket).
  - `status` (CSV de nomes `PENDING,ATTENDING,RESOLVED`; nomes inválidos são ignorados).
  - `contactId`, `groupId`, `sectors`, `agents`, `connections`, `tags` (CSV de ids; id não numérico → 400).
  - `protocol` (número), `createdFrom`/`createdTo` (data), `type` (`contact`|`group`).
  - `archived=true` (só arquivados), `frozen=true`, `active=true` (archived=false & frozen=false), `onlyUnread=true`.
  - `search` (**só funciona com `deepSearch=true`**; busca nome/telefone de contato/grupo e corpo de mensagens).
  - `showAll=true`, `onlyMyConnections`, `orderBy` (nome de campo Prisma; inválido → 500), `orderDirection` (`desc`, senão asc), `excludeInList=true`, `boardOwnerAgentId`.
- **Visibilidade (crítico)**:
  - Sem `showAll=true` + permissão `tickets:view-all` (ou `groups:view-all` se `type=group`) ou isAdmin, **só retorna tickets com `agentId` = agente externo da key**.
  - Exceção: filtro exclusivamente `status=PENDING` mostra todos os pendentes, sem filtro de dono.
  - Grupos vinculados ao agente (`group_agents`) também aparecem.
  - Os filtros de escopo de conexão e setor aplicam-se sempre, exceto para isAdmin. `showAll` não dá bypass de conexão/setor.
- **Agrupamento**: exceto quando `status=RESOLVED` exclusivamente, a lista é **agrupada por conversa** (contato/grupo + conexão; ou só contato/grupo com merge). Vem **1 ticket por conversa** (o mais recente) e `total` = nº de conversas. Com merge, cada item traz `relatedTickets[]` `{id,status,protocol,connection,officialCustomerServiceWindow?}`.
- Agente externo inexistente → `404 "Agente não encontrado"`.
- Sucesso 200 `"Tickets retornados com sucesso"`, body `{ tickets: [ {...ticketProps sem deleted/deletedAtUTC, multiTicket:boolean, createdAt, updatedAt (ISO), contact.callPermissions[], officialCustomerServiceWindow? {isOpen, expiresAt, remainingSeconds, lastInboundMessageAt} (só conexão META_OFFICIAL), relatedTickets?} ], metadata: { total, hasNextPage, nextCursor } }`. Ordenação padrão `updatedAt desc`.
- Pegadinhas:
  - Sem `active=true`, arquivados e congelados vêm junto.
  - `archived=false` **não** filtra nada.
  - `perPage` sem teto.

### GET /v1/tickets/:ticketId — permissão `tickets:view`
- Ticket inexistente/deletado → `404 "Ticket informado não existe"`. Ticket de grupo fora do GroupScope → `404 "Ticket não encontrado"`.
- Sucesso 200 `"Ticket retornado com sucesso"`, body = Ticket.toProps(). Contato e grupo vêm com `customFields[{id,name,value}]`.
- Pegadinhas:
  - Busca por id **sem filtro de organização**.
  - Não aplica escopo de dono/conexão/setor.
  - **`body.agent` inclui `hashPassword`** e `email`, `mobilePhone` do agente (o HTTP não sanitiza; webhooks sim). Não exponha esse payload.

### PATCH /v1/tickets/accept — permissão `tickets:accept`
- Body `{ ticketIds: id[] }` (≤50).
- Todos precisam estar PENDING, senão `422 "Todos os tickets precisam estar em aguardando para serem aceitos"`. Congelado → `422 "Este ticket está congelado e só pode ser visualizado ou descongelado"`. Ticket de grupo fora do GroupScope → 404.
- Efeito: `status=ATTENDING`, **`agentId` = agente externo da key** (com merge, inclui pendentes irmãos). `updatedAt` não muda.
- Sucesso 200 `"N ticket(s) aceito(s) com sucesso"` (sem body). Socket `acceptedTicket`. Webhook `ticket.accepted` por ticket.

### PATCH /v1/tickets/close — permissão `tickets:finalize`
- Body `{ ticketIds }` (≤50).
- Cada ticket precisa ser ATTENDING ou já RESOLVED. PENDING → `422 "Todos os tickets precisam estar em atendimento para serem fechados"`. Arquivado → `422 "Não é possivel fechar um ticket arquivado"`. Todos já RESOLVED → 200 `"Todos os tickets já estavam fechados"`.
- Efeito: `status=RESOLVED`, `updatedAt=now`, `lastMessage` recalculado. Com merge, fecha também os ATTENDING do mesmo contato em outras conexões.
- 200 `"N ticket(s) fechado(s) com sucesso"`. Socket `closedTicket`. Webhook `ticket.closed`.
- Pegadinhas:
  - **Não envia mensagem de encerramento** (`closingMessage`) nesse fluxo HTTP: o job de close message não é chamado aqui (não confirmado se há outro gatilho).
  - Não exige ser o dono do ticket.
  - Não checa frozen.

### PATCH /v1/tickets/open (reabrir) — permissão `tickets:create`
- Body `{ ticketIds, destinationConnectionId? }`.
- Todos precisam estar RESOLVED, senão `422 "Todos os tickets precisam estar finalizados para serem reabertos"`. Congelado → 422.
- Se a conexão atual está deletada/desconectada, exige `destinationConnectionId`, senão `422 "Necessário selecionar uma conexão de destino para reabrir: a conexão atual não está disponível."`. Destino inexistente → 404. Agente externo sem vínculo à conexão destino e não-admin → `422 "Você não tem permissão na conexão de destino"`.
- Já existe ticket aberto (PENDING/ATTENDING, não congelado) para o mesmo contato/grupo numa conexão permitida → `409 "Já existe um atendimento em aberto ..."`.
- Efeito: `status=ATTENDING`, `agentId` = agente externo, `updatedAt=now`.
- 200 `"N ticket(s) reaberto(s) com sucesso"`. Socket `reopenedTicket`. Webhook `ticket.reopened`.

### PATCH /v1/tickets/transfer — permissão `tickets:transfer`
- Body `{ ticketIds (≤50), sectorId?, destinationAgentId?, destinationConnectionId? }`. Pelo menos um destino é obrigatório, senão `422 "Necessário informar setor, agente ou conexão de destino"`. Id inválido → 400. Setor/agente inexistente → 422. Conexão inexistente → 404.
- Regras:
  - `destinationConnectionId` exige permissão `tickets:transfer-connection`, senão `403 "Você não tem permissão para transferir tickets entre conexões"`.
  - **Sem `tickets:view-all` (e não admin): só transfere tickets atribuídos ao próprio agente externo**, senão `403 "Você só pode transferir atendimentos atribuídos a você"`. Ticket fora do escopo de conexão → 404.
  - Congelado → 422.
  - Conexão destino não CONNECTED → 422.
  - Setor não vinculado à conexão → `422 "O setor de destino não está vinculado a esta conexão..."`.
  - Agente destino fora do setor → 422.
  - Agente destino sem permissão na conexão → `422 "O agente de destino não tem permissão na conexão deste atendimento"`.
- Efeito: transferir só para setor mantém o agente atual. O status é preservado.
- 200 `"N ticket(s) transferido(s) com sucesso"` (o body vai como `[]` mas o adapter não envia body). Socket `transferedTicket`. Webhook `ticket.transferred` (`data: { ticket, previousAgent, previousSector, previousConnection, destinationAgent, destinationSector, destinationConnection }`).
- Pegadinha: o `updateMany` usa status/agent/sector **do primeiro ticket** para o lote inteiro, então lotes com status misto ficam com o status do primeiro (não confirmado em runtime, mas é o que o código faz).

### PATCH /v1/tickets/freeze — permissão `tickets:finalize`
- Body `{ ticketIds }` (≤50). Já congelados são ignorados, e se todos já estão → 200 `"Todos os tickets já estavam congelados"`.
- Efeito: `frozen=true`, `frozenAtUTC`. O status não muda.
- 200 `"N ticket(s) congelado(s) com sucesso"`. Socket `frozedTicket`. Webhook `ticket.frozen`.

### PATCH /v1/tickets/unfreeze — permissão `tickets:finalize`
- Body `{ ticketIds }` (≤50). Algum não congelado no lote → `422 "Este ticket não está congelado"` (a menos que nenhum esteja congelado: aí 200 `"Todos os tickets já estavam descongelados"`). Conflito com ticket aberto do mesmo contato → 409.
- Efeito persistido: `frozen=false`, `frozenAtUTC=null` (o status no banco não é alterado pelo adapter).
- 200 `"N ticket(s) descongelado(s) com sucesso"`. Socket `unfrozenTicket`. Webhook `ticket.unfrozen`.

### PATCH /v1/tickets/archive — permissão `tickets:finalize`
- Body `{ ticketIds }` (≤50). Não arquivado e não RESOLVED → `422 "Todos os tickets precisam estar finalizados para serem arquivados"`. Todos já arquivados → 200 `"Todos os tickets já estavam arquivados"`.
- Efeito: `archived=true`, `archivedAtUTC`. Com merge, inclui RESOLVED irmãos.
- 200 `"N ticket(s) arquivado(s) com sucesso"`. Socket `archivedTicket`. **Sem webhook.**

### PATCH /v1/tickets/unarchive — permissão `tickets:finalize`
- Body `{ ticketIds }` (≤50). Sem regra de status.
- 200 `"N ticket(s) desarquivado(s) com sucesso"` ou `"Todos os tickets já estavam desarquivados"`. Socket `unarchivedTicket`. Sem webhook.

### DELETE /v1/tickets — permissão `tickets:delete`
- Body JSON `{ ticketIds }` (≤50 após deduplicar). Ids inválidos → `400 "Um ou mais IDs de ticket são inválidos"`.
- **Todos precisam estar arquivados**, senão `409 "Somente tickets arquivados podem ser excluídos. Ticket(s) não arquivado(s): <ids>"`.
- Efeito: soft delete (`deleted=true`, `deletedAtUTC`). Depois disso o ticket some de todas as leituras.
- 200 `"N ticket(s) excluído(s) com sucesso"`. Socket `deletedTicket`. Webhook `ticket.deleted`.
- Pegadinha: fluxo completo para excluir = close → archive → delete.

### PATCH /v1/tickets/:ticketId/priority — permissão `tickets:finalize`
- Body `{ priority: 1|2|3 }` (**número**: a string `"3"` falha). Ausente → `422 "Id do ticket e prioridade são obrigatórios"`. Inválido → `422 "A prioridade informada é inválida"`. Ticket inexistente → `404 "Ticket informado não existe"`.
- 200 `"Prioridade alterada com sucesso"`. Sem socket, sem webhook.
- Pegadinha: **não filtra por organização** (o ticketId não é verificado contra a org da key).

### PATCH /v1/tickets/:ticketId/signature — permissão `tickets:toggle-signature`
- Body **`{ assigned: boolean }`** (o campo se chama `assigned`, não `signed`).
- 200 `"Ticket assinado com sucesso. Todas as mensagens enviadas a partir de agora estarão assinadas."` / `"Assinatura do ticket removida..."`. Ticket inexistente → 404.
- Efeito: mensagens WuzAPI saem prefixadas `*<nome do agente>:*`. Sem filtro de org.

---

## 4. Mensagens

### POST /v1/messages/text — permissão `messages:send`
- Body JSON:
  - `connectionId` (id) e `destinationId` (**string**, obrigatórios). Ausente → `422 "Conexão e destino são obrigatórios"`. Não-string → `422 "O destino deve ser uma string"`.
  - Pelo menos um de `text` | `template` | `vcard`, senão `422 "Mensagem, arquivo, template ou vCard são obrigatórios"`.
  - Opcionais: `quotedMessageId` (**id interno** da mensagem citada; inexistente → `404 "Mensagem citada não encontrada"`), `mentions: string[]` (números, viram `<num>@s.whatsapp.net`; `@<10–15 dígitos>` no texto também vira menção).
  - `template: { name, language, components?: [{type:"header"|"body"|"footer", text?, parameters?:[{type,text}]}], buttons? }` (só Meta oficial).
  - `vcard: { contactId } | { displayName, vcardText }` (senão `422 "vCard requer displayName e vcardText, ou um contactId"`).
- **destinationId é telefone/JID, não id**:
  - Contato: telefone (com variantes do 9º dígito) ou `userId` do contato.
  - Grupo: JID de grupo (`...@g.us`) ou o phone do grupo.
  - **O contato precisa já existir** na org, senão `422 "Contato não encontrado"` (este endpoint não cria contato). Grupo inexistente → `422 "Grupo não encontrado"`.
- Regras:
  - Conexão inexistente → `422 "Conexão informada não existe"`. DISCONNECTED → `400 "A conexão \"<session>\" está inativa. Ative-a para enviar mensagens."`.
  - **Ticket**: usa o ticket aberto (PENDING/ATTENDING) do contato/grupo **naquela conexão**. Se não houver, **cria um ticket ATTENDING atribuído ao agente externo** (socket `createdTicket`).
  - Envio só com ticket ATTENDING. **Com API key, também é permitido em ticket PENDING** (se não congelado). Senão `403 "Só é possível enviar mensagens quando o ticket estiver em atendimento"`.
  - Grupo fora do GroupScope → 404. Grupo `announce` sem permissão `messages:*` → `403 "Este grupo permite apenas mensagens de administradores"`.
  - **Janela 24h Meta** (provider META_OFFICIAL, sem template): `422 "Este contato ainda não respondeu nenhuma mensagem..."` ou `422 "Este contato não responde há mais de 24 horas..."`.
- Sucesso **201** `"Mensagem enviada e criada com sucesso"`, `body = "<messageId>"` (string, só o id).
- Efeitos: socket `messageProcessing` (antes) e `messageSended`. Webhook `message.sent` (`data: { message:{id,type,fromMe,deleted,body,externalId,contact,ticket}, isGroup }`).
- Pegadinhas:
  - Se o provedor falhar, **a mensagem é gravada mesmo assim com ack 0** e a resposta é erro (status do erro do provedor ou 500). Retentar pode duplicar a mensagem.
  - A conexão é buscada por id **sem filtro de org**.
  - Não verifica se o ticket pertence ao agente externo: envia em ticket de qualquer agente.
  - Ticket ATTENDING congelado não é barrado (o check de frozen só roda para PENDING).

### POST /v1/messages/file — permissão `messages:send` (multipart/form-data)
- Campos:
  - `files` (campo repetido, multer em memória, até 100MB por arquivo; o use-case limita a **10 arquivos** → `422 "Limite de 10 arquivos excedido"`, total → `422 "Tamanho total dos arquivos excede 100MB"`; entidade File: **25MB por arquivo** → `422 "O tamanho do arquivo não pode exceder 25MB"`; MIME fora da lista permitida → `422 "O arquivo <nome> possui um formato não permitido"`).
  - `connectionId`, `destinationId` (**somente telefone ou JID de grupo**: aqui não aceita `userId`), `text`, `captions` (repetido, por índice do arquivo), `voiceNotes` (repetido, `"true"/"false"` por índice; ausente = legado, todo áudio vira nota de voz), `quotedMessageId`.
  - Sem texto e sem arquivo → `422 "Mensagem ou arquivo são obrigatórios"`.
- Regras iguais ao /text: ticket auto-criado, PENDING permitido para API key, janela 24h Meta, escopo de grupo e announce. Agente externo inexistente → `404 "Agente não encontrado"`.
- Sucesso **200** `"Mensagem enviada com sucesso"`, `body = [{ id:<messageId>, url, caption }]`, só para mensagens com arquivo persistidas (duplicadas ou pendentes são puladas).
- Efeitos: socket `messageSended` por mensagem. Webhook `message.sent` por mensagem (com `media` sem `raw`).
- Pegadinha: se nada for construído, responde 200 mesmo assim (log interno avisa).

### PATCH /v1/messages/:messageId — permissão `messages:edit`
- Body `{ connectionId, body }`. Ausente id/conexão → `422 "Id da conexão e da mensagem são obrigatórios"`. Conexão/mensagem inexistente → 422.
- Só **até 15 min** após o envio (canal WhatsApp), senão `403 "Mensagem só pode ser editada até 15 minutos após o envio"`.
- 200 `"Corpo da mensagem editado com sucesso"`. Socket `editedMessage`. Webhook `message.edited`.
- Pegadinhas:
  - Não valida `body` vazio.
  - Não valida `fromMe` (editar mensagem recebida provavelmente falha no provedor: não confirmado).
  - Busca a mensagem sem filtro de org.

### DELETE /v1/message/:messageId — permissão `messages:delete` (**singular** `/message/`)
- Body JSON `{ connectionId }` (obrigatório mesmo sendo DELETE).
- Até **2 dias** após o envio, senão `403 "Mensagem só pode ser deletada até 2 dias após o envio"`. Já deletada → `409 "Essa mensagem ja foi deletada"`. Inexistente → 422.
- Apaga no WhatsApp (revoke) e faz soft delete local.
- 200 `"Mensagem deletada com sucesso"`. Socket `deletedMessage`. Webhook `message.deleted`.

### POST /v1/messages/:messageId/react — permissão `messages:react`
- Body `{ connectionId, emoji }`. `emoji` vazio/ausente **remove** a reação. Mensagem/conexão inexistente → 422.
- Janela 24h Meta aplica-se (META_OFFICIAL).
- 200 `"Reação enviada com sucesso"` / `"Reação removida com sucesso"`. Socket `messageReacted`. Webhook `message.reaction` (`data: { message, emoji }`).

### GET /v1/tickets/:ticketId/messages — permissão `messages:list`
- Query: `perPage` (default 50, **sem máximo** no modo cursor), `cursor` (id de mensagem), `search` (ativa full-text com `page`, perPage máx 50).
- Ticket inexistente → `422 "Ticket informado não existe"`. Grupo fora do escopo → 404.
- Retorna **só as mensagens deste ticket**. Busca as mais recentes primeiro, mas **cada página vem em ordem cronológica crescente** (reversa). Para paginar ao passado, use `nextCursor`.
- Body: `{ messages: [ { id, body, caption, ack, type, fromMe, quotedMessageId, deleted, deletedAtUTC, quotedMessage|null {id,type,externalId,body,fromMe,createdAt,contact,agent}, replies[], contact?{id,name,phoneNumber,profilePicture}, file?{id,name,size,mime} (sem url!), group?{id,name,phoneNumber,profilePicture}, connection, ticket{id,protocol,status,priority,connectionId,connectionProvider}, agent?{id,name}, notes[{id,title,body,color,file}], reactions[{participant,fromMe,emoji,contact}], createdAt, updatedAt, edited, editedAt } ], metadata }`.
- **Efeito colateral: zera `unreadMessagesCount` do ticket** (marca como lido) em toda chamada.
- Pegadinhas:
  - Mensagens deletadas vêm na lista com `deleted=true`.
  - O objeto `file` não traz URL. Para mensagens enviadas com arquivo, o `body` costuma ser a URL (não confirmado para mídias recebidas). Use `/v1/files/entity/:ticketId` para listar URLs.
  - O validador do ticket não filtra por org (no modo sem search).
  - `agent.name` vem como `**Nome**` quando o ticket está assinado.

### GET /v1/tickets/:ticketId/contact-messages — permissão `messages:list`
- Histórico **do contato em todos os tickets/conexões dentro do escopo** (ancorado no ticket), deduplicando cópias "coex" entre conexões. O ticket precisa ser da org (`422 "Ticket informado não existe"`). Ticket de grupo → `422 "Ticket informado é de um grupo. Use a rota de mensagens de grupo."`.
- Query, shape e metadata iguais ao anterior. Também zera unread do ticket. Respeita escopo de conexão e setor do agente externo.

### GET /v1/tickets/:ticketId/group-messages — permissão `messages:list`
- Equivalente para grupo (ticket de contato → `422 "... Use a rota de mensagens do contato."`). Grupo fora do escopo → `404 "Grupo não encontrado"`. Zera unread.

### GET /v1/groups/:groupId/messages — permissão `messages:list`
- Query: `cursor`, `perPage`, `ticketId` (marca como lido e define a conexão âncora), `excludeTicketId`, `search`, `page`.
- Grupo inexistente → 422. Fora do escopo → 404. Validação do grupo **sem filtro de org**.

### GET /v1/messages — permissão `messages:list`
- Query: `perPage`, `cursor`, `createdFrom`, `createdTo`, `tickets` (CSV), `agents` (CSV), `sectors` (CSV).
- Ordenação **`id asc`** (mais antigas primeiro). Respeita só o GroupScope (**não aplica escopo de conexão/setor**).
- Body `{ messages:[ Message.toProps() + createdAt, updatedAt, quotedMessage, replies, reactions ], metadata:{ total, hasNextPage, nextCursor } }`. `Message.toProps` = `{id,type,ack,contact,ticket(props completos),fromMe,deleted,deletedAtUTC,edited,editedAt,body,agent,media,caption,quotedMessageId,location}`. O agente não é incluído no include (vem undefined).
- Pegadinhas:
  - **Sem `perPage` explícito, `hasNextPage` é sempre false e a página traz 51 itens** (compara com `NaN`). Mande sempre `perPage`.
  - Ao usar `sectors`, o filtro `ticket.organizationId/deleted` é **sobrescrito** pelo filtro de setor (o spread da chave `ticket`), então mensagens de tickets deletados podem aparecer.

### GET /v1/message/:messageId — permissão `messages:view` (singular)
- Inexistente → `422 "Mensagem não encontrada. Verifique o ID e tente novamente."`. Grupo fora do escopo → 404.
- 200 `"Mensagem encontrada com sucesso"`, body `{ ...Message.toProps(), reactions[] }`.
- Pegadinhas:
  - **Sem filtro de org.**
  - `ticket.agent` inclui `hashPassword`.
  - `media` não é carregada.

### GET /v1/messages/external/:externalId — permissão `messages:view`
- **Quebrado**: o adapter HTTP não repassa `tenant`, então o controller lê `httpRequest.tenant.organizationId` de undefined → **sempre 500 "Houve um erro inesperado"**. Não use.
- (Se funcionasse: busca por `externalId` filtrando a org, body `{ message, reactions }`, 404 se não achar.)

### POST /v1/messages/export/:ticketId — permissão `messages:export`
- Body `{ destination: "download"|"email" (obrigatório), agentId?, sectorId?, startDate?, endDate? }`.
- Inválido → `422 "destination é obrigatório e deve ser 'download' ou 'email'"`. Data inválida → 400. start>end → 400. Sem mensagens → `422 "Nenhuma mensagem encontrada para o filtro informado"`. Ticket fora da org → 422.
- Exporta **todas as conversas do contato/grupo** do ticket (todos os tickets dentro do escopo).
- `download`: espera até 60 s e responde **200 com CSV binário** (`Content-Type: text/csv`, `Content-Disposition: attachment`), não JSON.
- `email`: 200 `"A exportação de mensagens foi iniciada..."`, `body` ausente. O e-mail vai para o **e-mail do agente externo da key**. Socket `messages:export:completed|failed`.

---

## 5. Notas de mensagem (message-notes)

Shape da nota: `{ id, title, body|null, color, messageId, agent:{id,name}, file|null {id,name,mime,category,url,size}, deleted, deletedAtUTC, createdAt, updatedAt }`.
Validação da entidade:
- `title` obrigatório (`422 "Título é obrigatório"`), máx 120 (`422 "Título não pode exceder 120 caracteres"`).
- `body` máx 2000.
- `color` obrigatório (`422 "Cor é obrigatória"`): hex `#rgb/#rrggbb/#rrggbbaa`, `rgba(...)` ou nomes (red, blue, green, yellow, black, white, gray, purple, orange, pink, brown, cyan, magenta, lime, navy, teal, olive, maroon, silver, gold, transparent). Inválido → `422 "Cor da tag inválida: X"`.

### POST /v1/message-notes — `message-notes:create` (multipart, arquivo opcional no campo `file`; JSON também funciona sem arquivo)
- Campos `title`, `body?`, `color`, `messageId` (obrigatório; ausente → **500**, porque o controller faz `BigInt(undefined)`).
- Mensagem não encontrada na org → `422 "Mensagem não encontrada"`. Deletada → `422 "Mensagem foi removida"`. Agente externo inativo/de outra org → 422.
- 200 `"Nota de mensagem criada com sucesso"`, body `{ id, fileUrl|null }`. Socket `messageNote:created`. Sem webhook. Autor = agente externo.

### GET /v1/message-notes — `message-notes:list`
- Query `page`, `perPage` (máx 50), `messageId`, `ticketId`, `agentId`. Paginação **offset** `{total,count,perPage,currentPage,totalPages}`.
- 200 `"Notas de mensagem retornadas com sucesso"`, body `{ notes[], metadata }`.

### GET /v1/message-notes/:id — `message-notes:view`
- 404 `"Nota de mensagem não encontrada"`. 200 `"Nota de mensagem encontrada com sucesso"`, body = nota.

### PATCH /v1/message-notes/:id — `message-notes:update` (multipart ou JSON)
- Campos opcionais `title`, `body`, `color`, `file`, `removeFile` (`true`/`"true"`). Nota inexistente → `404 "Nota não encontrada"`. MIME não permitido → `422 "Esse tipo de arquivo não é permitido"`.
- 200 `"Nota de mensagem atualizada com sucesso"`, body = `"<id>"`. Socket `messageNote:updated`.
- Pegadinha: `body: null`/vazio não limpa o corpo (usa `??` com o valor antigo).

### DELETE /v1/message-notes/:id — `message-notes:delete`
- Soft delete, remove o arquivo do storage. 404 se não existe. 200 `"Nota de mensagem deletada com sucesso"`. Socket `messageNote:deleted`.

---

## 6. Dispatch (envio "fire" com estratégia de ticket)

### POST /v1/dispatch/temp-files — `messages:send` (multipart, campo `files` repetido)
- 1 a **10** arquivos: nenhum → `422 "Para prosseguir, é necessario enviar ao menos um arquivo"`; mais de 10 → 422. Cada arquivo ≤ **25MB** e com MIME permitido, senão `422 "Arquivo <nome>: <motivo>"`.
- 200 `"Arquivos enviados com sucesso"`, body `{ files: ["<url temporária>", ...] }`.
- **Arquivos temporários são apagados após 24h** (job agendado). Use a URL retornada em `fileUrl` de /dispatch/single ou /dispatch/batch.

### POST /v1/dispatch/single — `messages:send`
- Body JSON:
  - `connectionId` (precisa ser da org e não deletada → senão `422 "Conexão informada não existe"`; DISCONNECTED → 400) e `destinationId` (telefone com variantes do 9º dígito, `userId` do contato ou JID de grupo; o contato precisa existir → `422 "Contato não encontrado"`).
  - `type`: `text` | `file` | `template`. **Valor inválido ou ausente vira `text` silenciosamente.**
  - `text` (obrigatório se text → `422 "O campo 'text' não pode ser vazio..."`).
  - `fileUrl` (obrigatório se file; **precisa ser URL de /dispatch/temp-files**, senão `422 "Arquivo temporário não encontrado: <url>"`).
  - `templateId` (obrigatório se template; **id do template na Meta**; não aprovado → 422; não achado → `422 "Template informado não foi encontrado na Meta"`) e `templateVariables: { body?: { <nome|n>: valor }, buttons?: [{ index, text }] }`. Variáveis faltando → 422 com a lista.
  - `strategy`: `create` (default) | `close` | `reuseOrClose`. Inválido vira `create`.
  - `transfer?: { sectorId?, agentId? }`. O setor precisa estar vinculado à conexão (`422 "Setor inválido para esta conexão"`). O agente precisa ser da org e pertencer ao setor (`422 "Agente não pertence ao setor informado"`).
- Estratégias (`DispatchTicketResolverAdapter`):
  - `create`: reutiliza o ticket aberto (PENDING/ATTENDING) do contato+conexão ou cria ATTENDING. **Se reutiliza, REATRIBUI o ticket ao agente da key (ou ao `transfer.agentId`) e ao setor de transfer** (emite socket `transferedTicket`).
  - `reuseOrClose`: igual ao `create`, mas **fecha o ticket após enviar se ele foi criado agora**. Ticket já existente continua aberto.
  - `close`: **sempre cria um ticket novo** e fecha após enviar. Se já houver ticket aberto para o contato na conexão, o índice único de ticket aberto deve recusar o insert (erro esperado 500/409: não confirmado em runtime).
- Janela 24h Meta para text/file em contato (não para template).
- Sucesso **201** `"Mensagem enviada com sucesso"`, body `{ ticketId, messageId }` (strings).
- Efeitos: socket `newTicket` (ticket novo), `messageProcessing`, `messageSended`. Webhook **`dispatch.completed`** `{ ticketId, success:[{message:{id,type,fromMe,deleted,body,ack,externalId,ticket,media?}}], failures:[] }`. **Não emite `message.sent`.**
- Pegadinhas:
  - Falha no provedor: grava a mensagem com ack 0 e responde erro.
  - O tipo `template` assume credenciais Meta (connection.credentials.token). Com conexão WuzAPI o comportamento não foi confirmado.

### POST /v1/dispatch/batch — `messages:send`
- Body: igual ao single, mas `messages: [{ type, text?, fileUrl?, templateId?, templateVariables? }]` com **1 a 10 itens** (`422 "O campo de messages deve conter entre 1 e 10 mensagens"`). A validação e a resolução do ticket são síncronas. O envio é **assíncrono (BullMQ)**.
- Sucesso **202** `"Batch de mensagens enfileirado com sucesso"`, body ausente/`[]`. **Não retorna ids**: o resultado chega no webhook `dispatch.completed` (`success[]` e `failures[]`; uma falha não interrompe as demais).
- Mesma semântica de strategy, transfer e reatribuição do single.

---

## 7. Arquivos

### GET /v1/files/entity/:id — sem permissão RBAC (apenas autenticação)
- `:id` pode ser **id de grupo, contato ou ticket** (tentado nessa ordem, precisa ser da org). Nenhum → `404 "Contato, grupo ou ticket não foram encontrados"`.
- Query `page`, `perPage` (máx 50), `fileType` (CSV `image,audio,video,document`).
- Retorna arquivos anexados a mensagens dessa entidade, `createdAt desc`. 200 `"Arquivos associados retornados com sucesso"`, body `{ files:[{id,name,mime,category,url,size}], metadata:{total,count,perPage,currentPage,totalPages} }`.
- Pegadinha: não informa a qual mensagem cada arquivo pertence (não há `messageId` no item).

---

## 8. Resumo de eventos

| Endpoint | Socket | Webhook |
|---|---|---|
| POST /v1/tickets | createdTicket | — |
| PATCH accept | acceptedTicket | ticket.accepted |
| PATCH close | closedTicket | ticket.closed |
| PATCH open | reopenedTicket | ticket.reopened |
| PATCH transfer | transferedTicket | ticket.transferred |
| PATCH freeze/unfreeze | frozedTicket / unfrozenTicket | ticket.frozen / ticket.unfrozen |
| PATCH archive/unarchive | archivedTicket / unarchivedTicket | — |
| DELETE /v1/tickets | deletedTicket | ticket.deleted |
| priority / signature | — | — |
| POST messages/text, /file | messageProcessing, messageSended (+createdTicket se criou) | message.sent |
| PATCH message | editedMessage | message.edited |
| DELETE message | deletedMessage | message.deleted |
| react | messageReacted | message.reaction |
| dispatch single/batch | newTicket, messageProcessing, messageSended, transferedTicket (reuso) | dispatch.completed |
| message-notes | messageNote:created/updated/deleted | — |

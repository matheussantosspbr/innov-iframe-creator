# Rotas da API do Chat Plataforma (`/v1`)

Extraídas dos arquivos `*-routes.ts` do `chat-contabil-server` (out/2026, 273 rotas). Formato: `MÉTODO path` seguido da permissão RBAC exigida pela rota.

- `modulo:acao`: a key precisa dessa permissão no perfil do criador (ou ser admin). Sem ela → 403.
- `—`: a rota não tem `requirePermission`; só exige autenticação, e o use case pode ter regra própria (ex.: só super agente do Backstage, só admin).
- `publicRoute`: marcador que isenta a rota do guard "deny-by-default". **Não** significa sem autenticação. Em módulos do Backstage (applications, plans, broadcasts), o use case restringe ao super agente Comhub.
- `(sem x-api-key)`: rota de login ou receptor de webhook de provedor; não é para apps.

Rotas internas, fora do escopo de apps: `auth`, `comhub-id`, login/senha em `agent`, `address`, `application`, `application-category`, `plan`, `broadcast`, `announcement`, `dashboard`, `organization`, os receptores `meta/webhook` e `wuzapi/webhook`, e `organization-application` (gerenciada pela tela de apps do painel). Módulos marcados com * não foram documentados em detalhe nesta pasta: leia o código antes de usar.

## Tickets e mensagens (`tickets-messages.md`)

### ticket
- `GET /v1/tickets` `tickets:list`
- `POST /v1/tickets` `tickets:create`
- `DELETE /v1/tickets` `tickets:delete`
- `GET /v1/tickets/:ticketId` `tickets:view`
- `PATCH /v1/tickets/:ticketId/priority` `tickets:finalize`
- `PATCH /v1/tickets/:ticketId/signature` `tickets:toggle-signature`
- `PATCH /v1/tickets/accept` `tickets:accept`
- `PATCH /v1/tickets/archive` `tickets:finalize`
- `PATCH /v1/tickets/unarchive` `tickets:finalize`
- `PATCH /v1/tickets/close` `tickets:finalize`
- `PATCH /v1/tickets/freeze` `tickets:finalize`
- `PATCH /v1/tickets/unfreeze` `tickets:finalize`
- `PATCH /v1/tickets/open` `tickets:create`
- `PATCH /v1/tickets/transfer` `tickets:transfer`

### message
- `POST /v1/messages/text` `messages:send`
- `POST /v1/messages/file` `messages:send` (multipart)
- `GET /v1/messages` `messages:list`
- `GET /v1/tickets/:ticketId/messages` `messages:list`
- `GET /v1/tickets/:ticketId/contact-messages` `messages:list`
- `GET /v1/tickets/:ticketId/group-messages` `messages:list`
- `GET /v1/groups/:groupId/messages` `messages:list`
- `GET /v1/message/:messageId` `messages:view`
- `GET /v1/messages/external/:externalId` `messages:view`
- `PATCH /v1/messages/:messageId` `messages:edit`
- `DELETE /v1/message/:messageId` `messages:delete`
- `POST /v1/messages/:messageId/react` `messages:react`
- `POST /v1/messages/export/:ticketId` `messages:export`

### message-notes
- `GET /v1/message-notes` `message-notes:list`
- `POST /v1/message-notes` `message-notes:create`
- `GET /v1/message-notes/:id` `message-notes:view`
- `PATCH /v1/message-notes/:id` `message-notes:update`
- `DELETE /v1/message-notes/:id` `message-notes:delete`

### dispatch
- `POST /v1/dispatch/single` `messages:send`
- `POST /v1/dispatch/batch` `messages:send`
- `POST /v1/dispatch/temp-files` `messages:send`

### file
- `GET /v1/files/entity/:id` —

## Contatos, tags, campos, grupos, carteiras, setores (`contacts-tags-groups.md`)

### contact
- `GET /v1/contacts` `contacts:list`
- `POST /v1/contacts` `contacts:create`
- `GET /v1/contact/:contactId` `contacts:view` (singular)
- `PUT /v1/contact/:contactId` `contacts:update` (singular)
- `DELETE /v1/contacts/:contactId` `contacts:delete`
- `PUT /v1/contacts/:contactId/tags` `contacts:update` (substitui a lista; IDs)
- `GET /v1/contacts/:contactId/custom-fields` `contacts:view`
- `PUT /v1/contacts/:contactId/custom-fields/:customFieldId` `contacts:update`
- `DELETE /v1/contacts/:contactId/custom-fields/:customFieldId` `contacts:update`
- `POST /v1/contacts/import` `contacts:import`
- `POST /v1/contacts/sync/:connectionId` `contacts:import`
- `POST /v1/contacts/export/:format` `contacts:export`

### tag
- `GET /v1/tags` `tags:list`
- `POST /v1/tags` `tags:create`
- `GET /v1/tags/:tagId` `tags:view`
- `PUT /v1/tag/:id` `tags:update` (singular)
- `DELETE /v1/tags/:tagId` `tags:delete`
- `GET /v1/tags/:tagId/contacts` `tags:view`
- `POST /v1/tags/:tagId/contacts` `tags:update`
- `DELETE /v1/tags/:tagId/contacts` `tags:update`
- `GET /v1/tags/:tagId/groups` `tags:view`
- `POST /v1/tags/:tagId/groups` `tags:update`
- `DELETE /v1/tags/:tagId/groups` `tags:update`
- `GET /v1/contacts/:contactId/tags` `tags:list`
- `GET /v1/groups/:groupId/tags` `tags:list`

### custom-field
- `GET /v1/custom-fields` `custom-fields:list`
- `POST /v1/custom-fields` `custom-fields:create`
- `GET /v1/custom-fields/:customFieldId` `custom-fields:view`
- `PUT /v1/custom-fields/:customFieldId` `custom-fields:update`
- `DELETE /v1/custom-fields/:customFieldId` `custom-fields:delete`

### group
- `GET /v1/groups` —
- `POST /v1/groups` `groups:create`
- `GET /v1/group/:groupId` `groups:view` (singular)
- `PATCH /v1/groups/:groupId/name` `groups:update`
- `PATCH /v1/groups/:groupId/participants` `groups:update`
- `GET /v1/groups/:groupId/members` `groups:view-participants`
- `GET /v1/groups/:groupId/contacts/:contactId` `groups:view-participants`
- `GET /v1/groups/:groupId/agents` — (admin)
- `PATCH /v1/groups/:groupId/agents` — (admin)
- `PUT /v1/groups/:groupId/tags` `groups:update`
- `GET /v1/groups/:groupId/custom-fields` `groups:view`
- `PUT /v1/groups/:groupId/custom-fields/:customFieldId` `groups:update`
- `DELETE /v1/groups/:groupId/custom-fields/:customFieldId` `groups:update`

### customer-portfolio
- `GET /v1/customer-portfolios` `customer-portfolio:list`
- `POST /v1/customer-portfolios` `customer-portfolio:create`
- `GET /v1/customer-portfolio/:portfolioId` `customer-portfolio:view`
- `PUT /v1/customer-portfolio/:portfolioId` `customer-portfolio:update`
- `DELETE /v1/customer-portfolio/:portfolioId` `customer-portfolio:delete`
- `GET /v1/customer-portfolio/:portfolioId/contacts` `customer-portfolio:view`
- `POST /v1/customer-portfolio/:portfolioId/contacts` `customer-portfolio:link-contact`
- `DELETE /v1/customer-portfolio/:portfolioId/contacts` `customer-portfolio:link-contact`
- `PATCH /v1/customer-portfolio/:portfolioId/status` `customer-portfolio:toggle-status`

### sector
- `GET /v1/sectors` `sectors:list`
- `POST /v1/sectors` `sectors:create`
- `GET /v1/sector/:sectorId` `sectors:view` (singular)
- `PUT /v1/sector/:sectorId` `sectors:update`
- `DELETE /v1/sector/:sectorId` `sectors:delete`

## Auth, agentes, times e automações (`auth-agents-webhooks.md`)

### profile (permissões)
- `GET /v1/me/permissions` —
- `GET /v1/permissions/catalog` —
- `GET /v1/profiles` `settings:*`
- `POST /v1/profiles` `settings:*`
- `GET /v1/profiles/:id` `settings:*`
- `PUT /v1/profiles/:id` `settings:*`
- `DELETE /v1/profiles/:id` `settings:*`
- `PUT /v1/profiles/:id/permissions` `settings:*`

### agent
- `GET /v1/agents` `agents:list`
- `POST /v1/agents` `agents:create`
- `GET /v1/agents/:agentId` `agents:view`
- `PUT /v1/agents/:agentId/update` `agents:update`
- `DELETE /v1/agents/:agentId` `agents:delete`
- `PATCH /v1/agents/:agentId/password` `agents:update`
- `POST /v1/agents/:agentId/password/reset` `agents:password-reset`
- `PUT /v1/agents/:id/profile` `settings:*`

### team
- `GET /v1/teams` `teams:list`
- `POST /v1/teams` `teams:create` (use case exige `teams:*`)
- `PUT /v1/teams/:teamId` `teams:update` (use case exige `teams:*`)
- `DELETE /v1/teams/:teamId` `teams:delete` (use case exige `teams:*`)
- `GET /v1/teams/:teamId/members` `teams:view`
- `POST /v1/teams/:teamId/leave` `teams:view`

### quick-message
- `GET /v1/quick-messages` `quick-messages:list`
- `POST /v1/quick-messages` `quick-messages:create`
- `PUT /v1/quick-messages/:quickMessageId` `quick-messages:update`
- `DELETE /v1/quick-messages/:quickMessageId` `quick-messages:delete`

### scheduled-message
- `GET /v1/scheduled-messages` `scheduled-messages:list`
- `POST /v1/scheduled-messages` `scheduled-messages:create`
- `PUT /v1/scheduled-messages/:id` `scheduled-messages:update`
- `DELETE /v1/scheduled-messages/:id` `scheduled-messages:delete`
- `PATCH /v1/scheduled-messages/:id/active` `scheduled-messages:toggle`
- `GET /v1/scheduled-messages/:id/dispatches` `scheduled-messages:view`
- `GET /v1/scheduled-messages/:id/recipients` `scheduled-messages:view`
- `GET /v1/dispatches/:id/recipients` `scheduled-messages:view`

### api-key
- `GET /v1/api-keys` `api-keys:list`
- `POST /v1/api-keys` `api-keys:create`
- `POST /v1/api-keys/:apiKeyId/rotate` `api-keys:rotate`

### webhook
- `GET /v1/webhooks` `webhooks:list`
- `POST /v1/webhooks` `webhooks:create`
- `PUT /v1/webhook/:webhookId` `webhooks:update` (singular)
- `DELETE /v1/webhook/:webhookId` `webhooks:delete` (singular)

## Conexões e organização (`apps-connections-organization.md`)

### connection
- `GET /v1/channels` `connections:list`
- `POST /v1/channels` `connections:create`
- `GET /v1/channel/:connectionId` `connections:view` (singular)
- `DELETE /v1/channel/:connectionId` `connections:delete`
- `PATCH /v1/channel/:connectionId/connect` `connections:connect`
- `PATCH /v1/channel/:connectionId/desconnect` `connections:disconnect` (grafia do path)
- `PATCH /v1/channel/:connectionId/reconnect` `connections:connect`
- `PATCH /v1/channel/:connectionId/session/logout` `connections:disconnect`
- `PATCH /v1/channel/:connectionId/session/reconnect` `connections:connect`
- `PATCH /v1/channel/:connectionId/update` `connections:update`
- `PATCH /v1/connections/:connectionId/wallet-mode` `connections:update`
- `GET /v1/connections/:connectionId/meta-templates` `connections:view`
- `POST /v1/connections/:connectionId/meta-templates` `connections:update`
- `DELETE /v1/connections/:connectionId/meta-templates` `connections:update`

### organization-setting
- `GET /v1/organizations/settings` — (só admin)
- `PATCH /v1/organizations/settings` `settings:*`

## Outros módulos*

### absence-message*
- `GET /v1/absence-messages` `absence-messages:list`
- `POST /v1/absence-messages` `absence-messages:create`
- `GET /v1/absence-messages/:absenceMessageId` `absence-messages:view`
- `PUT /v1/absence-messages/:id` `absence-messages:update`
- `DELETE /v1/absence-messages/:absenceMessageId` `absence-messages:delete`
- `PATCH /v1/absence-messages/:absenceMessageId/status` `absence-messages:toggle-status`

### operation-message*
- `GET /v1/operation-messages` `operation-messages:list`
- `POST /v1/operation-messages` `operation-messages:create`
- `GET /v1/operation-messages/:operationMessageId` `operation-messages:view`
- `PUT /v1/operation-messages/:operationMessageId` `operation-messages:update`
- `DELETE /v1/operation-messages/:operationMessageId` `operation-messages:delete`
- `PATCH /v1/operation-messages/:operationMessageId/status` `operation-messages:toggle-status`

### bot*
- `GET /v1/bots` `bots:list`
- `POST /v1/bots` `bots:create`
- `GET /v1/bot/:botId` `bots:view`
- `PUT /v1/bot/:id` `bots:update`
- `DELETE /v1/bot/:botId` `bots:delete`
- `PATCH /v1/bot/:botId/status` `bots:toggle-status`

### call*
- `POST /v1/calls` `calls:create`
- `POST /v1/tickets/:ticketId/call` `calls:create`
- `GET /v1/tickets/:ticketId/call-permission` `calls:list`
- `GET /v1/connections/:connectionId/calls` `calls:list`
- `PATCH /v1/connections/:connectionId/calling/settings` `calls:update`
- `POST /v1/call/:callId/accept` `calls:accept`
- `POST /v1/call/:callId/reject` `calls:reject`
- `POST /v1/call/:callId/terminate` `calls:terminate`

### chat-room* e room-message* (chat interno entre agentes)
- `GET /v1/chat-rooms` `chat-rooms:list`
- `POST /v1/chat-rooms` `chat-rooms:create`
- `DELETE /v1/chat-rooms/:chatRoomId` `chat-rooms:delete`
- `GET /v1/chat-rooms/agents/:agentId` `chat-rooms:list`
- `GET /v1/chat-rooms/monitored` —
- `GET /v1/chat-rooms/unread-count` —
- `GET /v1/room-messages/:chatRoomId` `room-messages:list`
- `GET /v1/room-messages/:chatRoomId/files` `room-messages:list`
- `PATCH /v1/room-messages/:chatRoomId/read` `room-messages:list`
- `POST /v1/room-messages/:chatRoomId/text` `room-messages:send`
- `POST /v1/room-messages/:chatRoomId/file` `room-messages:send`
- `DELETE /v1/room-messages/:chatRoomId/:messageId` `room-messages:delete`

### ticket-list* (quadros/kanban)
- `GET /v1/boards` `publicRoute`
- `POST /v1/boards` `publicRoute`
- `PATCH /v1/boards/:id` `publicRoute`
- `GET /v1/board-columns` `publicRoute`
- `PATCH /v1/board-columns` `publicRoute`
- `PUT /v1/board-columns/reorder` `publicRoute`
- `POST /v1/board-shares` `publicRoute`
- `GET /v1/board-shares/shared-with-me` `publicRoute`
- `GET /v1/ticket-lists` `publicRoute`
- `POST /v1/ticket-lists` `publicRoute`
- `PATCH /v1/ticket-lists/:id` `publicRoute`
- `GET /v1/ticket-lists/:id/tickets` `publicRoute`
- `POST /v1/ticket-lists/:id/tickets` `publicRoute`
- `DELETE /v1/ticket-lists/:id/tickets` `publicRoute`
- `PATCH /v1/ticket-lists/:id/tickets/:ticketId/position` `publicRoute`

### ticket-import* (migração de histórico)
- `POST /v1/ticket-imports` `publicRoute`
- `POST /v1/ticket-imports/:ticketId/messages` `publicRoute`
- `POST /v1/ticket-imports/:ticketId/participants` `publicRoute`
- `GET /v1/ticket-imports/lots` `publicRoute`
- `POST /v1/ticket-imports/lots` `publicRoute`
- `POST /v1/ticket-imports/undo` `publicRoute`
- `POST /v1/contact-imports` `publicRoute`

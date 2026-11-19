# Autenticação, permissões, agentes, times, respostas rápidas, agendamentos, API keys e webhooks

Fonte: código em `chat-contabil-server/src` (lido em 2026-10-21). Ignorado `src/archive/`.
Convenção: "não confirmado" = não verificado no código.

---

## 1. Autenticação e formato de resposta

### 1.1 Headers aceitos (`src/shared/middlewares/authentication-middleware.ts`)
Ordem de avaliação em `AuthenticationMiddleware.handle`:
1. `x-access-token` (JWT de agente humano). Se presente, **só ele** é avaliado.
2. `x-api-key` (chave de integração).
3. `x-backstage-key` — tratado **exatamente como uma API key** (mesma validação), mas marca `tenant.isBackstage = true`.
4. Nenhum → `401 { "error": "Token de acesso ou API Key obrigatória" }`.

Respostas de erro do middleware usam `{ error }` (não `{ message }`):
| Situação | Status | Body |
|---|---|---|
| sem header | 401 | `{ "error": "Token de acesso ou API Key obrigatória" }` |
| API key não encontrada / qualquer exceção na validação | 401 | `{ "error": "Não autorizado" }` |
| JWT inválido/revogado | 401 | `{ "error": "Token de acesso inválido" }` |
| rate limit global | 429 | `{ "message": "Muitas requisições. Tente novamente em Ns." }` |
| organização bloqueada (status 2/3/4) | 403 | `{ "message": "Sua organização está inativa/suspensa por pendências financeiras/foi cancelada. ..." }` |
| agente (externalAgent da key) inativo/removido | 403 | `{ "message": "Acesso não autorizado. Seu agente está inativo/foi removido. ..." }` |

Checagens de blocklist (org/agente) e rate limit são **fail-open**: se o Redis falhar, a requisição passa.

### 1.2 Formatos de body de resposta (resumo)
- Sucesso de controller: `{ "message": string, "body": <safeJson(body)> }` — BigInt vira **string**; `Date` vira ISO string; `body` some do JSON se for `null/undefined` (safeJson retorna `undefined`).
- Erro de controller (AplicationError): `{ "message": string }` com status do erro; erro inesperado: `500 { "message": "Houve um erro inesperado" }`.
- Erro dos middlewares de auth: `{ "error": string }` (401) — ver tabela acima.
- Guards RBAC (`requirePermission`, `requireAdmin`, `requireBackstage`, deny-by-default): `{ "message": string }` com 401/403.
- Rate limit: `{ "message": ... }` 429.
- Erros não tratados que chegam ao `setErrorHandler` do Fastify (`src/web/fastify.ts`) — ex.: JSON inválido, Content-Type não suportado, validação Fastify: `{ "error": err.message, "requestId": "<uuid>" }` com `err.statusCode ?? 500`.
  - Content-Type desconhecido → 415 `{ error: "Content-Type não suportado: <ct>", requestId }`. Sem Content-Type e corpo vazio é aceito.
- Exceções `TypeError` dentro dos controllers (ex.: `BigInt("abc")`, `title.trim()` em undefined) caem no catch do controller → **500 `{ message: "Houve um erro inesperado" }`** (não 400/422). Alguns adapters deixam a exceção Prisma escapar para o catch → 500 também.
- Header `x-request-id`: o servidor aceita o enviado pelo cliente (`requestIdHeader: "x-request-id"`) e sempre devolve `x-request-id` na resposta. Use para correlação.
- Respostas têm `Cache-Control: no-store`, HSTS, CSP restritiva etc.

### 1.3 API key: formato, armazenamento, tenant
Código: `src/api-key/**`.
- Valor: `crypto.randomBytes(32).toString("hex")` → **64 caracteres hex**. Sem prefixo.
- Armazenado como HMAC-SHA256 com `process.env.API_KEY_SECRET` (`HmacSha256Adapter`). O valor em claro só aparece na resposta de criação/rotação.
- Validade: `expiresAt = agora + 90 dias` (criação e rotação).
- Criação cria também um **agente de sistema** (`externalAgent`): `isSystem: true`, `role: OWNER (3)`, `name = nome da key`, `email = "<nome em minúsculas com espaços→.>@chatplataforma.com.br"`.
- Tenant montado na validação (`ValidateApiKeyActionAdapter`):
  - `organizationId`, `organizationName` — da organização da key.
  - `agentId`, `agentName`, `role` — do **externalAgent** (agente de sistema; role sempre `"Owner"`).
  - `isAdmin` — `createdByAgent.role === OWNER` (do **humano que criou a key**).
  - `profileId` — `createdByAgent.profileId` (perfil do humano criador).
  - `isSuper` — `createdByAgent.super`.
  - `isApiKey: true` (false se veio via `x-backstage-key`).
- Busca exige `createdByAgent.active = true AND deleted = false`. Se o criador for desativado/removido → todas as keys dele param (401 `{error:"Não autorizado"}`).
- Key antiga sem `externalAgent` (coluna nullable) → `externalAgent!.id` lança → 401.
- Consequência prática:
  - Key criada por **Owner** → `isAdmin=true` → bypass total de RBAC.
  - Key criada por Operator → permissões = perfil atual do criador (cache Redis 24h, invalidado em escrita). Operator sem perfil → `profileId=null` → toda rota com `requirePermission` dá 403 (modo enforcing).
  - Ações aparecem como feitas pelo agente de sistema (nome da key). `agentId` usado em use-cases (ex.: autor de mensagem, membro de time, `requestingAgentId`) é o do externalAgent.
  - Blocklist de agente checa o **externalAgent**, não o criador.

### 1.4 Expiração / revogação — comportamento REAL
`ValidateApikeyUseCase.perform`:
- Expirada (`now > expiresAt`): marca `active=false` no banco e retorna `{ code:200, message:"Autorizado (mas chave expirada)", body: context }`.
- Inativa (`active=false`): faz update no banco e retorna `{ code:200, message:"Autorizado (mas chave revogada)", body: context }`.
- O middleware só verifica `result?.body` truthy → **a requisição é PERMITIDA** em ambos os casos. Confirmado: chaves expiradas ou inativas continuam funcionando normalmente. Não há header/aviso na resposta.
- Não existe endpoint de revogar/deletar API key (só criar, listar, rotacionar). A única forma de "matar" uma key via API é rotacioná-la (o valor antigo deixa de existir) ou desativar o agente criador.
- Efeito colateral: cada request com key expirada/inativa faz um `UPDATE api_keys` extra.

### 1.5 Rate limits (`src/shared/middlewares`)
- **Global por organização** (todas as rotas autenticadas somadas, JWT e API key): `organizationRule("global-api", 1200, 10)` → **1200 requisições por janela fixa de 10 s por organização** (Redis INCR + EXPIRE; janela começa no primeiro hit). Excedeu → `429 { message: "Muitas requisições. Tente novamente em {ttl}s." }`. Sem headers `Retry-After`/`X-RateLimit-*` (só a mensagem). Fail-open se Redis falhar.
- Específicos (não relevantes para integração por API key, exceto se usar):
  - `POST /v1/login`: 5/5min por email + 3/2min por IP+email.
  - `POST /v1/forgot-password`: 3/15min por email. `POST /v1/reset-password`: 5/10min por IP.
  - refresh token: 10/5min por IP. Comhub ID login 10/5min por IP; backchannel logout 120/min.
  - address create: 30/5min por IP.
  - Webhooks de entrada WuzAPI/Meta: token bucket GCRA (burst 100, 50/s por conexão; WuzAPI também 200 burst/100/s por IP).
  - Mensagem dos rate limits por regra (`rateLimitMiddleware`): `"Muitas tentativas. Tente novamente em N minuto(s)."`.

---

## 2. Autorização (RBAC) — `src/shared/authorization/*`

### 2.1 Fluxo por rota
`preHandler: [AuthenticationMiddleware.handle, loadPermissions, requirePermission("<modulo>:<acao>")]`
- `loadPermissions`: se `tenant.isAdmin` ou sem `profileId` → não carrega. Senão `tenant.permissions = Set` de grants do perfil (Redis `perms:profile:<id>` TTL 24h; fallback DB; micro-cache em memória 5s se Redis cair). Falha Redis+DB → set vazio (nega).
- `requirePermission(key)`:
  1. sem tenant → 401 `{message:"Não autenticado"}`.
  2. `tenant.isBackstage` → passa sempre.
  3. modo de enforcement do módulo (prefixo antes de `:`) — `off` → passa.
  4. `PermissionResolver.can`: `isAdmin` → true; sem `profileId` → false; grant `<modulo>:*` → true; grant exato → true.
  5. negado em `shadow` → loga `[RBAC:SHADOW]` e passa; em `enforcing` → **403 `{ "message": "Você não tem permissão para executar esta ação" }`**.
- `requireAdmin()` → 403 `{message:"Acesso negado"}` se não admin. `requireBackstage()` → 403 `{message:"Acesso restrito ao backstage"}`.
- Wildcard: só `modulo:*` (não existe `*:*` nem wildcard parcial). Ex.: `messages:*` cobre `messages:send`, `messages:export` etc.
- Alguns use-cases checam permissão de novo internamente com chave diferente (ex.: times exigem `teams:*`; ver §4).

### 2.2 Modos de enforcement (`enforcement-config.ts`)
- Env `RBAC_ENFORCEMENT="tickets:shadow,messages:off,all:enforcing"`. Modos: `off | shadow | enforcing`.
- Resolução: modo do módulo → senão `all` → senão **default `enforcing`**.
- Valor em produção: **não confirmado** (assuma enforcing).
- `denyUnguardedPlugin` (registrado em `build-app.ts`): toda rota POST/PUT/PATCH/DELETE sem `requirePermission`/`publicRoute` recebe um guard extra que dá 403 `{message:"Acesso negado"}` quando o modo `all` é `enforcing`. Rotas com `publicRoute()` (ex.: ticket-import) são isentas.

### 2.3 Catálogo de permissões (`permission-catalog.ts`) — completo
`granular=false` significa só `*`.
| key | label | ações |
|---|---|---|
| tickets | Atendimento | view-section, list, view, create, accept, finalize, transfer, transfer-connection, view-all, toggle-signature, delete, * |
| contacts | Contatos | view-section, list, view, create, update, delete, import, export, * |
| groups | Grupos | view-section, view, create, update, delete, accept, transfer, view-participants, view-all, interact-all, * |
| scheduled-messages | Agendamentos | view-section, list, view, create, update, delete, toggle, dispatch-any-group, * |
| audit | Auditoria | * (não granular) |
| bots | Bots | view-section, list, view, create, update, delete, toggle-status, * |
| connections | Conexões | view-section, list, view, create, update, delete, connect, disconnect, * |
| settings | Configurações | * (não granular) |
| messages | Mensagens | view-section, list, view, send, edit, delete, react, export, * |
| quick-messages | Respostas Rápidas | view-section, list, create, update, delete, * |
| sectors | Setores | view-section, list, view, create, update, delete, * |
| custom-fields | Campos Personalizados | view-section, list, view, create, update, delete, * |
| tags | Tags | view-section, list, view, create, update, delete, * |
| agents | Agentes | view-section, list, view, create, update, delete, password-reset, * |
| absence-messages | Mensagens de Ausência | view-section, list, view, create, update, delete, toggle-status, * |
| operation-messages | Mensagens de Operação | view-section, list, view, create, update, delete, toggle-status, * |
| api-keys | Chaves de API | view-section, list, create, rotate, * |
| calls | Chamadas | view-section, list, create, update, accept, reject, terminate, * |
| room-messages | Mensagens de Sala | list, send, delete, * |
| chat-rooms | Salas de Chat | view-section, list, create, delete, * |
| teams | Times | view-section, list, view, create, update, delete, * |
| webhooks | Webhooks | view-section, list, create, update, delete, * |
| organizations | Organizações | view-section, list, view, create, update, delete, * |
| message-notes | Notas de Mensagem | list, view, create, update, delete, * |
| customer-portfolio | Carteiras de Clientes | view-section, list, view, create, update, delete, link-contact, toggle-status, * |
| applications | Aplicativos | list, view, create, update, delete, * |

Validação de chave (`PermissionKeyValidator`): só aceita `modulo:acao` presente no catálogo (usado ao gravar permissões de perfil).

### 2.4 Endpoints de permissões e perfis (`src/profile`)
| Método/rota | Guard | Resposta |
|---|---|---|
| GET `/v1/permissions/catalog` | só autenticação | 200 `{message:"Catálogo de permissões retornado com sucesso", body:[{key,label,granular,actions[]}]}` |
| GET `/v1/me/permissions` | autenticação + loadPermissions | 200 `{message:"Permissões retornadas com sucesso", body:{isAdmin:true, permissions:[]}}` se admin; senão `{isAdmin:false, permissions:["tickets:list",...]}` |
| POST `/v1/profiles` | `settings:*` | body `{name, description?}` → 201 `body:{id}`; name ausente 422 "Nome do perfil é obrigatório"; description >255 → 400 |
| GET `/v1/profiles` | `settings:*` | query page, perPage(≤50), name → `body:{profiles:[{id,name,description,resourcesCount,permissionsCount,canCreateProfile}], metadata}` |
| GET `/v1/profiles/:id` | `settings:*` | `body:{...profile, permissions:[{id,profileId,permissionKey}], resourcesCount, permissionsCount, canCreateProfile}`; 404 "Perfil não encontrado" |
| PUT `/v1/profiles/:id` | `settings:*` | `{name?, description?}` → 200 / 404 |
| DELETE `/v1/profiles/:id` | `settings:*` | 200 `body` omitido / 404 |
| PUT `/v1/profiles/:id/permissions` | `settings:*` | `{permissions:string[]}` substitui tudo; chave inválida → 400 `Chave de permissão inválida: "x"`; 404 perfil |
| PUT `/v1/agents/:id/profile` | `settings:*` | vincula perfil a agente (não detalhado) |

Pitfall (bug): `PUT /v1/profiles/:id/permissions` compara `tenant.agentRole` (campo que não existe no Tenant) com OWNER ao conceder `agents:password-reset` ou `messages:export` → **sempre 403 "Você não tem permissão para conceder essa permissão"**, inclusive para Owner (provável bug; não testado em runtime).
`:id` não numérico → `BigInt()` lança → 500.

### 2.5 `x-backstage-key` (risco de segurança)
`isBackstage = !!headers["x-backstage-key"]` e a chave validada é `x-api-key ?? x-backstage-key`. Ou seja: **qualquer API key válida enviada em `x-backstage-key` (ou junto com qualquer valor nesse header) vira backstage**: ignora RBAC (`requirePermission` retorna cedo), ignora blocklist de org/agente, passa `requireBackstage`, e em alguns controllers permite escolher `organizationId` arbitrário (ex.: GET /v1/agents com `?organizationId=`). Integradores não devem usar esse header; reportar ao time.

---

## 3. Paginação comum
- Offset (`Pagination`): query `page` (default 1), `perPage` (default 50, **máx 50**). `metadata: { total, count, perPage, currentPage, totalPages }`.
- Cursor (times, quick-messages): `cursor` (id), `perPage` (default 50, **sem máximo**), `metadata: { total, hasNextPage, nextCursor }`.
- Valores de query não numéricos viram `NaN` → tratados como default.

---

## 4. Endpoints por módulo

### 4.1 API keys (`src/api-key`)
**POST `/v1/api-keys`** — `api-keys:create`
- Body JSON `{ name: string }` (trim, 1..80).
- Erros: 422 "Nome da chave é obrigatório"; 422 "Nome da chave não pode ultrapassar 80 caracteres"; 409 "Já existe uma chave cadastrada com este nome" (compara nome exato/trim na org, inclui keys expiradas); 422 "Agente não identificado"; 404 "Agente não encontrado"; 422 "API key de origem não encontrada para o agente sistema".
- Sucesso **201** `{ message:"Chave de api gerada com sucesso", body:{ id:"<string>", apiKey:"<64 hex>", createdAt, expiresAt } }`. `apiKey` só aparece aqui.
- Se chamada com API key, o `createdByAgent` da nova key é o humano criador da key original (herda o mesmo perfil/admin).

**GET `/v1/api-keys`** — `api-keys:list`
- Query `page`, `perPage`. Ordenado por `updatedAt desc`.
- 200 `{ message:"api keys retornadas com sucesso", body:{ apiKeys:[{ id, value, name, createdAt, expiresAt, insecure, active, createdBy:{id,name}|null, lastUpdatedAt, organizationId }], metadata } }`.
- Pitfall: `value` é o **hash HMAC** armazenado, não a chave. `insecure=true` = expirada. `active=false` = marcada expirada/revogada (mas ainda funciona, §1.4).

**POST `/v1/api-keys/:apiKeyId/rotate`** — `api-keys:rotate`
- Sem body. Gera novo valor, `active=true`, `expiresAt = agora+90d` (o `createdAt` retornado é novo mas **não** é gravado).
- Erros: 422 "Identificação da chave é obrigatória"; 422 "Chave de api não encontrada"; id não numérico → 500.
- 200 `{ message:"Chave de api rotacionada com sucesso", body:{ id, apiKey, createdAt, expiresAt } }`. A chave antiga para de funcionar imediatamente.
- Pitfall/segurança: busca por `id` **sem filtro de organização** → é possível rotacionar key de outra org conhecendo o id (IDOR). Rotacionar a própria key em uso invalida a sessão do integrador.

### 4.2 Agentes (`src/agent`)
**GET `/v1/agents`** — `agents:list`
- Query: `page`, `perPage` (≤50), `search` (heurística: email → filtro por email; só dígitos → telefone com variações/documento/nome; texto → nome etc.).
- Filtro fixo: `organizationId` do tenant, `isSystem=false` (agentes de sistema/API keys não aparecem), `deleted=false`. Sem `orderBy` (ordem indefinida).
- 200 `{ message:"Agentes retornados com sucesso", body:{ agents:[...], metadata } }`.
- Item: `{ id, name, email, document, signature, mobilePhone, picture:{id,name,mime,category,url,size,raw}|null, role (2=Operator,3=Owner), active, online, super, sign, deleted, deletedAtUTC, sectors:[{id,name,color,welcomeMessage}], connections:[{id,channel,provider,type,status,phoneNumber,default,welcomeMessage,closingMessage,session,sectors,organizationId,walletMode}], profile:{id,name,description}|null }`.
- Pitfall: `hashPassword` **pode aparecer** no item (o adapter usa `omit: {hashPassword:true}` no Prisma, então vem `undefined` e some; confirmado que não vaza). Campos `last*` só para backstage.

**GET `/v1/agents/:agentId`** — `agents:view`
- 200 `{ message:"Agente encontrado com sucesso", body:{ ...mesmos campos (sem hashPassword, sem profile) } }`.
- Erros: 422 "Id do agente é obrigatório"; 404 "Agente não encontrado"; id não numérico → 500.
- Pitfalls: busca **sem filtro de organização nem de deleted/isSystem** → retorna agente de outra org (IDOR), agentes deletados e o agente de sistema de API keys. Não retorna `profile`.

Outros (só referência): POST `/v1/agents` (`agents:create`, multipart), PUT `/v1/agents/:agentId/update` (`agents:update`), DELETE `/v1/agents/:agentId` (`agents:delete`), PATCH `/v1/agents/:agentId/password` (`agents:update`), POST `/v1/agents/:agentId/password/reset` (`agents:password-reset`), PATCH `/v1/agents/:agentId/reset-password` (backstage).

### 4.3 Times (`src/team`)
Rotas usam `fastify-multer upload.single("file")` (create/update) — multipart aceito com campo `file` (ícone, só imagem). JSON também deve funcionar (multer ignora não-multipart; não confirmado em runtime). Em multipart, `members` repetido vira array; em JSON envie array.

**POST `/v1/teams`** — `teams:create` + use-case exige **`teams:*`** (ou admin) → senão 403 "Você não tem permissão para criar equipes".
- Body: `name` (obrig., ≤80), `description?` (≤255), `members` (array de agentIds ou valor único), `includeCreator` ("true"/true inclui o agente autenticado — via API key é o agente de sistema), `file?`.
- Erros: 422 "Necessário informar o nome da equipe"; 422 "É necessário informar ao menos um membro"; 422 "Não é permitido informar membros duplicados"; 409 "Já existe uma equipe com o mesmo nome"; 422 "Um ou mais membros informados não foram encontrados"; 422 ícone inválido/"O ícone do time deve ser uma imagem"; memberId não numérico → 500.
- Sucesso **201** `{ message:"Equipe criada com sucesso", body:"<id>" }`. Membros Owner viram admin do time.

**GET `/v1/teams`** — `teams:list`
- Query `search` (nome contains, case-insens.), `cursor`, `perPage`. Ordem `createdAt asc`.
- Não-admin vê só times dos quais é membro; admin vê todos. Via API key o "agente" é o de sistema (role Owner) → `isAdmin()` true → vê todos (não confirmado se `Agent.isAdmin()` = role OWNER, provável).
- 200 `{ message:"Equipes retornadas com sucesso", body:{ teams:[{id,name,description,pictureUrl,memberCount,createdAt,updatedAt}], metadata:{total,hasNextPage,nextCursor} } }` (ids já string).

**GET `/v1/teams/:teamId/members`** — `teams:view`
- Query `cursor`, `perPage`. 404 "Equipe informada não foi encontrada"; 403 (BusinessRule) "Você não tem permissão para visualizar os membros desta equipe" se não admin e não membro.
- 200 `body:{ members:[{id (membership), agentId, name, email, pictureUrl, isAdmin, joinedAt, sectors:[{id,name,color,welcomeMessage}]}], metadata }`.

**PUT `/v1/teams/:teamId`** — `teams:update` + use-case exige `teams:*`.
- Body: `name?`, `description?`, `members` (**obrigatório, lista completa**: substitui membros — quem não estiver é removido), `removeIcon?`, `file?`.
- Erros: 404 "Equipe informada não foi encontrada"; 409 nome duplicado; 422 "É necessário informar ao menos um membro para a equipe"; 422 duplicados/não encontrados.
- 200 `{ message:"Equipe atualizada com sucesso" }` (body null → omitido).

**DELETE `/v1/teams/:teamId`** — `teams:delete` + use-case exige `teams:*`.
- **201** `{ message:"Equipe excluída com sucesso" }` (sem body). 404 "Equipe informada não foi encontrada ou já foi excluída". Soft delete + log.

**POST `/v1/teams/:teamId/leave`** — `teams:view`. 200 "Você saiu da equipe com sucesso"; 422 "Você não é membro desta equipe" (API key: agente de sistema normalmente não é membro).

### 4.4 Respostas rápidas (`src/quick-message`)
**POST `/v1/quick-messages`** — `quick-messages:create`
- Body `{ shortcut: string (≤100), body: string }`.
- Erros: 422 "O atalho e obrigatório"; 422 "A mensagem é obrigatória"; 409 "Já existe uma mensagem com este mesmo atalho" (match exato, case-sensitive); 422 "Atalho não pode passar de 100 caracteres".
- **201** `{ message:"Mensagen rápida criada com sucesso", body:"<id>" }`.

**GET `/v1/quick-messages`** — `quick-messages:list`
- Query `name` (filtra `shortcut` contains, case-insens.), `cursor`, `perPage` (default 50, sem teto). Sem `orderBy` explícito.
- 200 `{ message:"Mensagens rápidas retornadas com sucesso", body:{ quickMessages:[{id,shortcut,body}], metadata:{total,hasNextPage,nextCursor} } }`.

**PUT `/v1/quick-messages/:quickMessageId`** — `quick-messages:update`
- Body `{ shortcut, body }` — **ambos obrigatórios** (entity recria; faltando → 422 "O atalho é obrigatório"/"O conteúdo é obrigatório").
- Erros: 400 "Mensagem rápida não encontrada" (note: 400, não 404); 409 "Já existe uma mensagem rápida com este atalho".
- 200 `{ message:"Mensagem rápida editada com sucesso" }` (sem body).

**DELETE `/v1/quick-messages/:quickMessageId`** — `quick-messages:delete`
- 200 `{ message:"Mensagem rápida deletada com sucesso", body:[] }`; 422 "Mensagem rápida não encontrada".
- Hard delete. **Sem filtro de organização** (IDOR: apaga quick message de outra org pelo id).

### 4.5 Mensagens agendadas (`src/scheduled-message`)
Create/update aceitam multipart (`file`) ou JSON. Em multipart, arrays podem ser JSON string (`"[1,2]"`) ou CSV (`"1,2"`); booleanos aceitam `true`/`"true"`.

Enums:
- `recurrenceType`: 1=DAILY, 2=WEEKLY, 3=MONTHLY, 4=YEARLY, 5=ONE_TIME.
- `recurrenceWeekdays`: 0=dom … 6=sáb.
- `ticketStrategy`: 1=CREATE_TICKET, 2=CREATE_AND_CLOSE.
- `timezone`: lista fechada (IANA): America/Sao_Paulo, America/New_York, America/Chicago, America/Denver, America/Los_Angeles, America/Mexico_City, America/Argentina/Buenos_Aires, America/Bogota, America/Caracas, America/Lima, America/Santiago, America/Montevideo, America/Fortaleza, America/Manaus, America/Recife, America/Bahia, Europe/{London,Paris,Berlin,Madrid,Rome,Amsterdam,Brussels,Vienna,Warsaw,Moscow,Istanbul,Athens,Zurich,Lisbon}, Asia/{Tokyo,Shanghai,Hong_Kong,Singapore,Seoul,Bangkok,Jakarta,Dubai,Kolkata,Karachi,Tehran,Jerusalem}, Pacific/{Auckland,Fiji,Honolulu,Sydney}, Africa/{Cairo,Johannesburg,Lagos,Nairobi}, Atlantic/{Azores,Cape_Verde}, UTC.
- Dispatch `status`: 1=SUCCESS, 2=PARTIAL, 3=FAILED.

**POST `/v1/scheduled-messages`** — `scheduled-messages:create`
- Body: `title` (obrig., ≤100, único por org entre não deletados), `connectionId` (obrig.), `scheduledTime` ("HH:mm" 2 dígitos), `timezone`, `skipHolidays`, `textVariationEnabled` (só WuzAPI; gera 10 variações via LLM), `ticketStrategy`, `recurrenceType`, `recurrenceInterval` (inteiro ≥1, obrigatório sempre), `recurrenceWeekdays` (WEEKLY), `recurrenceDayOfMonth` (MONTHLY/YEARLY), `recurrenceMonth` (YEARLY), `scheduledDate` (ONE_TIME; data, combinada com scheduledTime no timezone), `sectorId?`, `agentId?`, `contactIds?`, `tagIds?`, `groupIds?`, `includeGroupsInTagExpansion?`, `active`, `body?`, `file?`.
- Regras/erros: 409 "Já existe uma mensagem agendada com o mesmo titulo"; 422 "Conexão não encontrada"; 422 "É necessário fornecer texto ou arquivo para a mensagem"; Meta Oficial: `body` deve ser JSON de template com `template.name` e `template.language` (400 "Body deve ser um JSON de template válido"/…), sem grupos (422); 422 contatos/tags/grupos não encontrados (grupos fora do escopo do agente também → 422 "Grupo(s) não encontrado(s)", salvo `scheduled-messages:dispatch-any-group`); 422 setor/agente não encontrado; 400 "A data de agendamento não pode estar no passado"; 422 tipo de arquivo não permitido; 422 "É necessário fornecer pelo menos um contato, tag ou grupo"; 422 intervalo inválido; WEEKLY sem dias/duplicados → 422; fim de semana com `skipHolidays` → 422; MONTHLY dia 1-31; YEARLY mês 1-12 + dia; timezone inválido 422; horário inválido 422.
- `title` ausente ou `connectionId` ausente/não numérico → **500** (TypeError/BigInt).
- Sucesso **200** (não 201) `{ message:"Mensagem agendada criada com sucesso", body:"<id>" }`.
- Pitfall: `active` vira `false` se **não enviado** (controller faz `body.active === "true" || === true`; o default `?? true` nunca se aplica). Envie `active: true`.

**PUT `/v1/scheduled-messages/:id`** — `scheduled-messages:update`
- Parcial: campos omitidos mantêm valor atual (controller passa `undefined`). `contactIds/tagIds/groupIds` enviados substituem. `file` novo substitui o anterior.
- Mesmos erros do create + 404 "Mensagem agendada não encontrada". 200 `{ message:"Mensagem agendada atualizada com sucesso", body:"<id>" }`.

**DELETE `/v1/scheduled-messages/:id`** — `scheduled-messages:delete` (checado de novo no use-case). Soft delete, remove job BullMQ e destinatários pendentes. 200 "Mensagem agendada deletada com sucesso"; 404.

**PATCH `/v1/scheduled-messages/:id/active`** — `scheduled-messages:toggle`
- Body `{ active: true|"true" }` — qualquer outro valor (inclusive ausente) **desativa**. 200 "Mensagem agendada ativada/desativada com sucesso", `body:"<id>"`; 404.

**GET `/v1/scheduled-messages`** — `scheduled-messages:list`. Query `page`, `perPage`(≤50). Ordem `createdAt desc`.
- `body:{ scheduledMessages:[{ id, title, active, skipHolidays, textVariationEnabled, includeGroupsInTagExpansion, scheduledTime, timezone, recurrenceType, recurrenceInterval, connectionId, createdAt, body, file:{url}|null, tags:[{id,name}] }], metadata }`.

**GET `/v1/scheduled-messages/:id/dispatches`** — `scheduled-messages:view`. Ordem `scheduledFor desc`.
- `body:{ dispatches:[{id,status,scheduledFor,dispatchedAt,recipientCount,successCount,failedCount,failureReason,createdAt}], metadata }`; 404.

**GET `/v1/dispatches/:id/recipients`** — `scheduled-messages:view`.
- `body:{ recipients:[{contactId,contactName,contactPhone,recipientType:"contact"|"group",recipientId,recipientName,recipientPhone,success,body,failureReason,sentAt}], metadata }`; 404 "Disparo não encontrado".

**GET `/v1/scheduled-messages/:id/recipients`** — `scheduled-messages:view`. Lista contatos+grupos configurados (não expande tags).
- `body:{ recipients:[{recipientType,recipientId,recipientName,recipientPhone}], metadata }`; 404.

---

## 5. Webhooks de saída (`src/webhook`)

### 5.1 CRUD
**POST `/v1/webhooks`** — `webhooks:create`
- Body `{ name: string (≤100), url: string, events: string[], active?: boolean }`.
- Validação/erros: 422 "Url é obrigatória para cadastrar um webhook"; 422 "Evento é obrigatório…"/"Pelo menos um evento é necessário…"; 409 "Já existe um webhook com este nome ou URL"; 422 "Nome do webhook não pode ultrapassar 100 caracteres"; 422 "Url informada é inválida" (só `new URL()`: aceita qualquer esquema, http sem TLS, IP interno); 422 "Evento <x> inválido". Eventos duplicados são deduplicados.
- `active` omitido → true.
- Sucesso **201** `{ message:"Webhook criado com sucesso", body:{ id:"<id>", secret:"<uuid>" } }`.
- Pitfall: `name` é obrigatório na prática — sem `name`, a checagem de conflito `OR:[{url},{name: undefined}]` casa com **qualquer** webhook existente da org → 409; se não houver nenhum, o insert falha (coluna NOT NULL) → 500.

**GET `/v1/webhooks`** — `webhooks:list`. Query `page`, `perPage` (≤50). Sem `orderBy`.
- `body:{ webhooks:[{ id, name, active, url, events:[...] }], metadata }`. Secret nunca é retornado.

**PUT `/v1/webhook/:webhookId`** (singular!) — `webhooks:update`
- Body **completo**: `{ name, url, events, active }` — `name`, `url`, `events` obrigatórios (422 "O nome do webhook é obrigatório"/"A URL do webhook é obrigatória"/"O webhook deve conter ao menos um evento"); 404 "Webhook não encontrado"; 409 "Já existe outro webhook com este nome ou URL".
- `events` substitui a lista. `active` omitido → **vira true** (reativa). Secret não muda.
- 200 `{ message:"Webhook atualizado com sucesso", body:"<id>" }`.
- Segurança: busca por id sem filtro de org (IDOR).

**DELETE `/v1/webhook/:webhookId`** (singular) — `webhooks:delete`. Hard delete (cascata eventos). 200 `{ message:"Webhook deletado com sucesso" }`; não encontrado → **400** "Webhook informado não existe ou já foi excluido". Sem filtro de org (IDOR).

### 5.2 Eventos (`webhook-events.ts`)
`message.received`, `message.sent`, `message.edited`, `message.reaction`, `message.deleted`, `dispatch.completed`, `ticket.transferred`, `ticket.closed`, `ticket.frozen`, `ticket.unfrozen`, `ticket.accepted`, `ticket.reopened`, `ticket.deleted`.

### 5.3 Envelope e entrega
Fluxo: produtor → `WebhookEventEnqueuerAdapter.enqueue` → job BullMQ `dispatch-webhooks` na fila `org-<orgId>-jobs` → `WebhookDispatchJobHandler`.
- Envelope (POST JSON):
```json
{
  "id": "1234567890123456789",
  "organizationId": "987654321",
  "event": "message.received",
  "timestamp": "2026-10-21T12:34:56.789Z",
  "data": { ... }
}
```
  - `id`: id numérico único por evento (string); o **mesmo id** vai para todos os webhooks e todas as tentativas → usar como chave de idempotência.
  - `organizationId`: string. `timestamp`: hora do enfileiramento (não do fato).
  - Todos BigInt do `data` chegam como string (safeJson no enqueue). Datas como ISO string.
  - Sanitização: em objetos que parecem Agent (têm `hashPassword`), remove `hashPassword`, `connections`, `sectors`.
- Headers enviados: `Content-Type: application/json`, `X-Webhook-Signature: <hex>`; demais são os default do axios (`User-Agent: axios/<versão>`, `Accept`). Sem header de evento, timestamp ou id.
- Seleção: webhooks `active=true` da org com o evento, paginados 50 por vez em ordem de id; enviados em chunks de **5 em paralelo**.
- Timeout: **10 s** por tentativa (axios). Sucesso = status 2xx (axios segue até 5 redirects).
- Retry (`RetryHttpClient` + `Retry` em `shared/queue/bootstrap/bootstrap.ts`): `retries: 4` → até **5 tentativas**, backoff exponencial 1s, 2s, 4s, 8s (teto 15s) com jitter ±15%. Retenta **qualquer** erro, incluindo 4xx. Pior caso ≈ 5×10s + ~15s ≈ 65 s por webhook.
- Após esgotar, a falha é só logada; o job termina com sucesso → **evento perdido** para aquele receptor (sem DLQ, sem reenvio manual, sem painel de entregas).
- Retentativa de job: a fila usa `attempts: 3` (backoff exp. 5s), mas só dispara se o handler lançar (ex.: erro de DB ao buscar webhooks) — nesse caso o lote inteiro pode ser reenviado → **duplicatas possíveis** para quem já recebeu. Deduplicar por `id`.
- Ordenação: **sem garantia**. Fila por org com concorrência 6 jobs simultâneos (+ possíveis múltiplas instâncias), retries com atraso por receptor e chunks paralelos. Ex.: `message.sent` pode chegar antes de `ticket.accepted`, um `message.edited` antes do `message.sent` em retry. Use `timestamp`/estado do recurso via API.
- Falhas no produtor (ex.: ticket não encontrado ao montar payload) são engolidas → evento não emitido.

### 5.4 Assinatura — o que o receptor consegue verificar
Algoritmo (`CryptoWebhookSigner.sign`): `hex(HMAC-SHA256(key = secretHash + salt, msg = JSON.stringify(envelope)))`, onde `secretHash = hex(PBKDF2-SHA512(secretId, salt, 10000 iter, 64 bytes))` (128 hex) e `salt` = 16 bytes em hex (32 chars).

Problemas confirmados:
1. **A assinatura é gerada com um segredo aleatório novo a cada envio.** `WebhookRepositoryAdapter.mapToDomain` faz `Webhook.create({...hook})` com a linha do Prisma, que tem `secretId/secretHash/salt` mas **não** a prop `secret`; `Webhook.create` então chama `WebhookSecret.generate()` (UUID + salt aleatórios). O `X-Webhook-Signature` é, portanto, um HMAC com chave descartável — **não verificável por ninguém**, nem com acesso ao banco.
2. Mesmo que (1) fosse corrigido, a API só devolve `secret = secretId` (UUID) na criação. Para recomputar a chave o receptor precisaria do `salt`, que **nunca é retornado** (nem no GET). Com só o UUID não é possível derivar `secretHash + salt`.
3. Não há timestamp assinado nem header de evento → sem proteção contra replay.

Conclusão para integradores: **não dependa de `X-Webhook-Signature`** (rejeitar por assinatura inválida descartaria 100% dos eventos). Alternativas: URL com token secreto longo na query/path (`https://app/hooks/zappy?token=<aleatório>`), HTTPS obrigatório, allowlist de IP se o egress for fixo (não confirmado), e tratar o webhook como notificação — revalidar dados críticos via GET na API. Guardar o `secret` (UUID) mesmo assim, para o caso de o bug ser corrigido (o esquema pretendido seria HMAC-SHA256 com chave `secretHash+salt`; não há como o receptor obter isso hoje).

Custo: `generate()` faz PBKDF2 síncrono de 10k iterações por webhook por evento no worker.

### 5.5 Payload `data` por evento
Shapes de entidades usadas (após safeJson):
- **Ticket** (`Ticket.toProps`): `{ id, protocol, priority (1 LOW,2 MEDIUM,3 HIGH), status (1 PENDING, 2 ATTENDING, 4 RESOLVED), connection, contact, lastMessage, group, unreadMessagesCount, archived, frozen, signed, archivedAtUTC, frozenAtUTC, signedAtUTC, agent, sector, deleted, deletedAtUTC }` (campos undefined somem).
- **Connection**: `{ id, channel, provider, type, status, phoneNumber, default, welcomeMessage, closingMessage, session, sectors, organizationId, walletMode }` (sem credentials).
- **Contact**: `{ id, name, phoneNumber, userId, parentUserId, username, blocked, email, document, picture, tags:[...], customFields:[...] }`.
- **Group**: `{ id, name, phone, restrict, announce, noFrequentlyForwarded, description, icon, tags, customFields }`.
- **Agent** (sanitizado): `{ id, name, email, document, signature, mobilePhone, picture, role, active, online, super, sign, deleted, deletedAtUTC }`.
- **Sector**: `{ id, name, color, welcomeMessage }`.
- **File/media**: `{ id, name, mime, category, url, size, raw? }`.
- **Message** (`Message.toProps`): `{ id, type, ack, contact, ticket, fromMe, deleted, deletedAtUTC, edited, editedAt, body, agent, media, caption, quotedMessageId, location }`. `type` ∈ chat, image, video, audio, ptt, sticker, document, location, vcard, multi_vcard, revoked, reply, mention, list, buttons_response, template_button_reply, notification, system, unknown, … (ver `MessageType`).

Regra de dedupe de contato (todos os eventos de mensagem): `message.contact = null` quando é o mesmo contato de `message.ticket.contact` → ler contato em `data.message.ticket.contact` como fallback.

| Evento | Origem | `data` |
|---|---|---|
| `message.received` | mensagem recebida (WuzAPI/Meta) com contato com telefone (`connection/.../webhook-message-handler.ts`) | `{ message: { ...Message.toProps(), contact: Contact|null, ticket: Ticket (com lastMessage) }, isGroup: boolean }`. Em coexistência Meta+WuzAPI no mesmo número só a cópia META_OFFICIAL dispara. Não dispara se o contato não tiver `phoneNumber`. `media.raw` pode vir (não confirmado se preenchido). |
| `message.sent` (texto) | `send-message-use-case` (envio via API/painel) | `{ message: { id, type, fromMe:true, deleted:false, body, externalId, contact, ticket (sem lastMessage) }, isGroup }` — sem `ack`, `agent`, `media`. |
| `message.sent` (arquivo) | `send-file-message-use-case`, um evento por arquivo | `{ message: { ...Message.toProps() exceto agent, id, ack, externalId, contact, ticket (sem lastMessage), media (sem raw) }, isGroup }` |
| `message.edited` | edição feita **pelo agente** via API | `{ message: { ...Message.toProps(), contact, ticket } }` |
| `message.reaction` | reação feita **pelo agente** via API | `{ message: {...}, emoji: string }` (emoji vazio = remoção) |
| `message.deleted` | exclusão feita **pelo agente** via API | `{ message: {...} }` |
| `ticket.accepted` / `ticket.closed` / `ticket.frozen` / `ticket.unfrozen` / `ticket.reopened` / `ticket.deleted` | use-cases correspondentes em `src/ticket` | `{ ticket: Ticket.toProps() }` (estado após a ação) |
| `ticket.transferred` | `transfer-tickets-use-case` | `{ ticket, previousAgent?, previousSector?, previousConnection, destinationAgent?, destinationSector?, destinationConnection? }` |
| `dispatch.completed` | módulo `dispatch` (disparo único/lote) | `{ ticketId: string, success: [{ message:{id,type,fromMe,deleted,body,ack,externalId,ticket,media?} }], failures: [{ message:{...}, error? }] }` |

Pitfalls de cobertura:
- Edições/reações/revogações feitas **pelo contato** no WhatsApp **não** geram webhook (os job handlers de edit/reaction/revoke em `connection/` não enfileiram eventos — verificado por grep).
- Mudanças de ticket feitas por automações fora desses use-cases (ex.: fechamento por job) não emitem evento (não confirmado em todos os caminhos; grep mostra emissão só nos use-cases listados).
- Não há eventos de contato, tag, agente ou conexão.

---

## 6. Pitfalls gerais (resumo)
1. API keys **expiradas ou "revogadas" continuam autenticando** (§1.4); não existe revogação via API; `GET /v1/api-keys` mostra o hash, não a chave.
2. `X-Webhook-Signature` é inverificável (chave aleatória por envio + salt nunca exposto) (§5.4).
3. IDOR (sem filtro de org): `GET /v1/agents/:agentId`, `POST /v1/api-keys/:id/rotate`, `PUT/DELETE /v1/webhook/:id`, `DELETE /v1/quick-messages/:id`. `x-backstage-key` com API key comum vira backstage (§2.5).
4. Defaults traiçoeiros: scheduled message sem `active` nasce **inativa**; PATCH `/active` sem body desativa; PUT webhook sem `active` reativa; POST webhook sem `name` → 409/500; PUT quick message exige `shortcut` e `body`; PUT team exige lista completa de `members`.
5. Permissão efetiva da API key = do humano criador (Owner → admin total); times exigem `teams:*` no use-case além da permissão da rota.
6. Paths singulares `/v1/webhook/:id` para PUT/DELETE vs `/v1/webhooks` para POST/GET.
7. Status inconsistentes: create de scheduled message = 200; delete de team = 201; not-found às vezes 400/422 em vez de 404; ids inválidos → 500.
8. Erros têm 3 formatos: `{message}`, `{error}` (auth 401), `{error, requestId}` (erros Fastify).
9. Rate limit 1200 req/10s por organização somando todos os clientes (painel + integrações).
10. Webhooks: sem ordem, possíveis duplicatas (dedupe por `id`), até 5 tentativas em ~65s e depois descartado.

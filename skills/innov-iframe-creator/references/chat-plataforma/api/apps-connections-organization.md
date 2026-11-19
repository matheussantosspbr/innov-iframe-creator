# Apps no Backstage, conexões e organização

Fonte: `chat-contabil-server` (leitura do código em 2026-10-21). Caminhos relativos a `src/`.
Formato HTTP da plataforma: sucesso `{ message, body }` (BigInt → string via `safeJson`); erro `{ message }`.
Autenticação de todas as rotas: `AuthenticationMiddleware.handle` (JWT ou header `x-api-key`).
"Super agente Comhub" = `tenant.isSuper === true` E `tenant.organizationId === process.env.ADMIN_ORGANIZATION_ID` (Backstage).

---

## 1. Módulo `application` (registro de apps — Backstage)

### Rotas (`application/presentation/routes/application-routes.ts`)
| Método | Rota | Quem |
|---|---|---|
| POST | `/v1/applications` (multipart, arquivo no campo `file`) | só super agente Comhub (use case) |
| GET | `/v1/applications` | só super agente Comhub |
| GET | `/v1/applications/featured` | qualquer autenticado (apps `featured && active && !deleted`) |
| GET | `/v1/applications/store` | permissão `applications:list` |
| GET | `/v1/applications/:id` | autenticado; não-super só vê `active=true` |
| PUT | `/v1/applications/:id` (multipart) | só super agente Comhub |
| DELETE | `/v1/applications/:id` | só super; 409 se houver instalações (`organizationApplication` não deletadas) |
| POST | `/v1/applications/:id/rotate-secret` | só super agente Comhub |

### Campos (create) — `application/presentation/controllers/create-application-controller.ts`, `core/entity/application.ts`, `core/value-objects/*`
- `name`: obrigatório, trim, ≤ 80 chars.
- `description`: opcional, ≤ 500.
- `rootUrl`: obrigatório, trim, ≤ 100 chars (coluna `VarChar(100)`), `new URL()` válido com protocolo `http:` ou `https:`. **Não** normaliza barra final, não exige https, aceita path. (`application-root-url.ts`)
- `categoryId`: obrigatório, categoria existente não deletada.
- `pricingType`: `1=FREE`, `2=PAID` (`core/types/pricing-type.ts`). PAID exige `price > 0`; FREE força `price = null`.
- `price`: número finito, ≥ 0, ≤ 99 999 999.99, máx. 2 casas decimais.
- `active`, `featured`: strings `"true"`/`"false"` (multipart). Create: default `false`. Máx. 10 apps `featured && active`.
- Ícone: campo multipart `file`; mime deve mapear para categoria `image`; upload em storage com rollback.
- `credentialsSchema`: **string JSON** no multipart, parseada com `JSON.parse` (JSON inválido → `SyntaxError` → 500 "Houve um erro inesperado"). Formato proprietário — **não é JSON Schema**:
  ```json
  { "fields": [ { "id": "opcional", "label": "API Key", "type": "string|number|boolean", "required": true, "secret": true } ] }
  ```
  Validação (`core/value-objects/credentials-schema.ts`, `infrastructure/adapters/create-application-validator.ts`):
  - obrigatório no create, `fields` array com ≥ 1 item;
  - `label` string, trim, não vazia, ≤ 80;
  - `type` trim + lowercase, ∈ {string, number, boolean};
  - `required`/`secret`: `String(v).toLowerCase() === "true"` (qualquer outra coisa → false);
  - `id`: se ausente, gerado (`UniqueNumericId().asString`). Em PUT, campos sem `id` ganham id novo.
  - Não há checagem de labels duplicados (não confirmado em outro ponto — não encontrado).
- Resposta create: **200** (não 201) `{ message: "Aplicativo criado com sucesso", body: { id, clientSecret } }`.
- PUT: todos campos opcionais; aceita inclusive `clientSecret` arbitrário no body (sem validação de formato); `removeIcon`; resposta `body: id`.

### clientSecret
- Gerado em `Application.create`: `randomBytes(32).toString("hex")` → **64 caracteres hex** (`core/entity/application.ts`).
- Armazenado cifrado AES (`AesCryptoAdapter(MASTER_KEY)`) como `iv:content:tag` (`infrastructure/adapters/create-application-adapter.ts`, `rotate-application-client-secret-adapter.ts`, `update-application-adapter.ts`).
- Exibido em claro **somente** na resposta do create e do rotate (`body.clientSecret`) — visto apenas pelo super agente Comhub no Backstage. GETs não retornam o secret.
- Rotação (`POST /v1/applications/:id/rotate-secret`): gera novo secret de 64 hex, substitui imediatamente; **sem período de convivência** — todas as instalações passam a assinar com o novo secret na próxima chamada. App não é notificado.
- Ao decifrar (validators de organization-application), se falhar decifragem usa o valor armazenado em claro (fallback `catch { return stored }`).
- O secret é usado como chave HMAC/JWT **como string UTF-8 do hex** (não decodificado para bytes).

### Store / featured
- `GET /v1/applications/store?search&categoryId&cursor&perPage` (`infrastructure/adapters/get-app-store-adapter.ts`): só `active && !deleted`. Sem `categoryId` → agrupado por categoria (perPage default 4 por categoria); com `categoryId` → paginação por cursor (id). Ordena por nº de instalações desc, nome, id. Item: `id, name, description, iconUrl, pricingType, price, featured, organizationApplication: {id, status} | null` (status **cru** do banco).
- `GET /v1/applications/featured`: retorna inclusive `rootUrl` e `credentialsSchema`.

### `application-category`
- Rotas `/v1/application-categories` (POST/PUT/DELETE/GET list com `publicRoute()`; GET :id autenticado). `name` ≤ 80; `color` hex (#rgb/#rrggbb/#rrggbbaa) ou `rgba(...)`.

---

## 2. Instalação na organização, provisionamento e iframe

O ciclo de vida da instalação, as chamadas da plataforma ao app e os parâmetros do iframe estão em `references/chat-plataforma/integration-contract.md`, que é a fonte normativa.

---

## 4. `connection` (essencial para integradores)
Rotas (`connection/presentation/routes/connection-routes.ts`):
- `GET /v1/channels?page&perPage&name&provider` (`connections:list`). `name` filtra `session` (nome da conexão) contains/insensitive; `provider` numérico.
- `GET /v1/channel/:connectionId` (`connections:view`). Obs.: o adapter busca `findUnique({ id })` **sem filtrar organizationId** (`get-connection-by-id-adapter.ts`) — não confirmado se há outro bloqueio de tenant; mensagem de sucesso "Mensagem localizada com sucesso".
- Campos retornados (`Connection.toProps`): `id, channel, provider, type, status, phoneNumber, default, welcomeMessage, closingMessage, session, sectors[], organizationId, walletMode`. **Não** retorna credentials.
- Enums (`connection/core/types/`): channel `WHATSAPP=1`; provider `WUZAPI=1, META_OFFICIAL=2`; type `CREDENTIALS=1, OAUTH=2`; status `DISCONNECTED=1, CONNECTED=2, TIMEOUT=3, INVALID_CREDENTIALS=4`; walletMode `NONE=1, PER_CONNECTION=2, GLOBAL=3`.
- Outras: POST `/v1/channels`, DELETE `/v1/channel/:id`, PATCH `/v1/channel/:id/{desconnect,connect,reconnect,update,session/logout,session/reconnect}`, PATCH `/v1/connections/:id/wallet-mode`.
- Templates Meta: `GET|POST|DELETE /v1/connections/:connectionId/meta-templates`. Só provider META_OFFICIAL (senão 422). GET query: `perPage` (default 20), `after`, `before`, `name` (→ `name_or_content`), `category`, `status`, `language`; proxy para Graph `/{wabaId}/message_templates`. POST body: `name, category, language, parameterFormat, components`. DELETE body: `metaTemplateId, metaTemplateName`.
- Janela 24h (`message/infrastructure/adapters/meta-window-validator-adapter.ts`): só META_OFFICIAL e só mensagens não-template. Exige última mensagem **recebida** do contato naquela conexão ≤ 24h; sem inbound ou > 24h → 422 com orientação para enviar template. Aplicado em send-message, send-file-message, react-message e dispatch.

## 5. `organization` / `organization-setting`
- `GET /v1/organization/:organizationId` e `GET /v1/organizations`: **só super agente Comhub** (`get-organization-by-id-use-case.ts` → `assertSuperAdminAccess`). Inútil para apps/orgs comuns.
- `GET /v1/organizations/settings`: autenticado, mas use case exige `isAdmin` (403 caso contrário). Retorna `{ settings: [{ key, type, value }] }` com keys `multiTicketContact, multiTicketGroup, overwriteContactsOnImport, maxBoards`.
- **Não existe timezone de organização** no backend (timezone só em `scheduled-message`). Nome da organização: não há endpoint de leitura para não-super nesses módulos (não confirmado em outros módulos, ex. login/me).

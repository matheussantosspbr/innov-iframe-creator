# Contatos, tags, campos personalizados, grupos, carteiras e setores

Fonte: leitura do código em `chat-contabil-server/src/{contact,tag,custom-field,group,customer-portfolio,sector}` (rotas, controllers, use-cases, adapters Prisma). Nada aqui foi testado em runtime; onde o comportamento depende de detalhe não lido, está marcado "não confirmado".

## Convenções gerais (valem para todos os endpoints abaixo)

- Auth: header `x-api-key` (ou `x-access-token` JWT). Sem credencial válida → 401. Token inválido → 401 `{ "error": "Token de acesso inválido" }` (campo `error`, não `message`). Rate limit global por organização: 1200 req / 10 s → 429 `{ message: "Muitas requisições. Tente novamente em Ns." }`. Org inativa/suspensa/cancelada → 403.
- Permissão: `requirePermission("x:y")`. Admin (`isAdmin`) passa sempre; senão o perfil da chave precisa da permissão. Negado → 403 `{ "message": "Você não tem permissão para executar esta ação" }`. (Há modo "shadow"/"off" por módulo configurável no servidor; em shadow a negação só é logada.)
- Envelope de sucesso: `{ "message": string, "body": <...> }`. BigInt viram **string** (via `safeJson`) — exceto onde anotado "sem safeJson".
- `safeJson(null|undefined)` devolve `undefined` → a chave `body` some do JSON.
- Envelope de erro: `{ "message": string }` com o status do erro. Erro não tratado (ex.: `BigInt("abc")`, erro Prisma) → 500 `{ "message": "Houve um erro inesperado" }`.
- Paginação (classe `Pagination`, igual em todos os módulos): `page` default 1; `perPage` default 50, **máximo 50** (acima é truncado sem erro; <1 ou ausente vira 50). Metadata: `{ total, count, perPage, currentPage, totalPages }` (`totalPages` = 1 quando `total` = 0).
- IDs são snowflake BigInt: **envie e guarde como string**. Ids não numéricos em params geralmente geram 500 (não 400), salvo no módulo custom-field.
- Soft delete: `deleted: true` + `deletedAtUTC` em contato, tag, setor. Carteira (customer-portfolio) e campo personalizado são **hard delete**.
- Nenhum endpoint destes módulos dispara webhook. Sockets: só onde anotado.

## Enums (core/types)

| Enum | Valores | Onde |
|---|---|---|
| `ContactSource` | `DIRECT=1`, `GROUP_PARTICIPANT=2` (pode ser `null` em contatos antigos) | contact/core/types/contact-source.ts. Não é exposto no JSON do contato. |
| `CONTACT_NAME_MAX_LENGTH` | 200 | contact/core/types/contact-limits.ts |
| `CustomFieldScope` | `CONTACT=1`, `GROUP=2`, `BOTH=3` | custom-field/core/types |
| `CustomFieldOwner` | `"CONTACT"`, `"GROUP"` (interno) | custom-field/core/types |
| `GroupScopeMode` | `ALL=1`, `RESTRICTED=2` (interno, visibilidade de grupos por agente) | group/core/types |
| `GROUP_INTERACT_ALL_PERMISSION` | `"groups:interact-all"` | group/core/types |
| `WalletScope` (carteira) | `GLOBAL=1`, `CONNECTION=2` | customer-portfolio/core/types |
| `RotationAlgorithm` | `ROUND_ROBIN=1`, `LEAST_LOAD=2` | customer-portfolio/core/types |
| `SectorScopeMode` | `ALL=1`, `RESTRICTED=2` (interno) | sector/core/types |
| Ações de participantes de grupo | `"add" \| "remove" \| "promote" \| "demote"` | group update-participants validator |

Cores (tag e setor, value-object `Color`): aceita `#RGB`, `#RRGGBB`, `#RRGGBBAA`, `rgba(r,g,b,a)` ou nomes: red, blue, green, yellow, black, white, gray, purple, orange, pink, brown, cyan, magenta, lime, navy, teal, olive, maroon, silver, gold, transparent. Inválida → 422 `Cor da tag inválida: <valor>` (mesma mensagem para setor). **Cor ausente → 500** (chama `.toLowerCase()` em undefined).

## Normalização de telefone (contato) — `ContactPhoneNumber`

- Aceita: número puro (`5511999998888`, `+55 (11) 99999-8888` — não-dígitos removidos), JID `...@c.us` / `...@s.whatsapp.net`, LID `...@lid`.
- DDI 55 duplicado é removido. 14+ dígitos sem DDD reconhecível → tratado como LID (guardado como está).
- EUA/Canadá: 11 dígitos começando com 1.
- Demais: regex `^(\d{1,2})?(\d{2})(\d{8,9})$` → `ddi? ddd numero`. Falha → 422 `Número de telefone inválido`; formato irreconhecível → 422 `Número de telefone inválido ou formato não suportado`.
- Persistido como `cleanNumber` = só dígitos com DDI (ex.: `5511999998888`). Sem DDI informado, fica sem DDI (ex.: `11999998888`) — não é adicionado 55 automaticamente.
- Na criação, duplicidade é checada considerando as variantes do nono dígito (`buildBrazilianPhoneVariants`).

## Formato do objeto Contato (usado em list/get/members)

`Contact.toProps()`:
```
{ id: string, name: string, phoneNumber: string|null, userId: string|null, parentUserId: string|null,
  username: string|null, blocked: boolean, email: string|null, document: string|null,
  picture: { id, name, mime, category, url, size, raw? } | null,
  tags: [{ id, name, color, description }], customFields: [{ id, name, value }] }
```
Não inclui `createdAt`, `updatedAt`, `source`, `organizationId`.

---

# CONTATOS (`src/contact`)

### POST /v1/contacts — permissão `contacts:create`
- Entrada: body JSON **ou** multipart (campo arquivo `file` = foto do contato, `upload.single("file")`, limite 100 MB).
  - `name`: string, obrigatório, ≤200.
  - `phoneNumber`: string, obrigatório na prática (ver pegadinhas). Normalizado conforme acima.
  - `email`: string, opcional (sem validação de formato).
  - `document`: string, opcional. CPF precisa estar formatado `000.000.000-00`, CNPJ `00.000.000/0000-00` (≤12 dígitos = CPF, senão CNPJ); senão 422 `"<doc>" é um valor inválido`.
  - `portfolioId`: string (id de carteira), opcional — vincula o contato à carteira após criar.
- Regras:
  - 409 `Já existe um contato cadastrado com este nome, número ou documento` se existir contato ativo (não deletado) na org com **mesmo nome exato** OU mesmo telefone (qualquer variante 9º dígito) OU mesmo documento.
  - 409 `Já existe um contato ativo com este número nesta organização` (race, índice único parcial org+telefone).
  - 422 `O nome do contato é obrigatório`; 422 `O nome do contato deve ter no máximo 200 caracteres`; 422 `O contato deve ter pelo menos um identificador: telefone ou BSUID (userId)`.
  - Com `portfolioId`: aplica as regras de `POST /v1/customer-portfolio/:id/contacts` (404 carteira não encontrada, 422 contato já em outra carteira com mesmo escopo/conexão etc.).
  - `source` gravado = `DIRECT (1)`.
- Sucesso: **200** (não 201), `message: "Contato criado com sucesso"`, `body: "<id do contato>"` (string pura, não objeto).
- Efeitos colaterais: nenhum webhook/socket.
- Pegadinhas:
  - Nome duplicado bloqueia criação (409) — dois clientes com mesmo nome não podem coexistir.
  - Se `name` não for enviado, o filtro de duplicidade vira `{ name: undefined }` (Prisma ignora) → provavelmente casa com qualquer contato da org e devolve 409 em vez de 422 (não confirmado em runtime).
  - Sem `phoneNumber` (só userId) o adapter acessa `contact.phoneNumber.cleanNumber` → 500. Além disso o controller não repassa `userId`, então pela API é impossível criar contato sem telefone.
  - Com `portfolioId`, o contato é criado **antes** do vínculo; se o vínculo falhar, a resposta é erro mas o contato fica persistido (não atômico).
  - Foto: arquivo é registrado com `url: "https://www.google.com.br"` (placeholder) — upload real da imagem não ocorre neste fluxo.

### GET /v1/contacts — permissão `contacts:list`
- Entrada (query): `page`, `perPage` (máx 50), `search` (string), `includeGroupContacts` (`true|1|false|0`), `tags` (ids separados por vírgula, ou repetido `tags=1&tags=2`).
- Regras:
  - Filtra `organizationId` + `deleted: false`.
  - `search`: se e-mail → `email contains`; se só dígitos → telefone (variações com/sem 55, com/sem 9) OR documento contains OR nome OR email; senão nome OR email (case-insensitive). Texto não busca em documento formatado.
  - Sem `search` e sem `includeGroupContacts=true`: mostra só contatos `source=DIRECT` ou (`source=null` com ticket/mensagem fora de grupo). Com `search`, esse filtro de visibilidade é **desligado** (participantes de grupo aparecem).
  - `tags`: contatos com **qualquer** das tags (OR). Id não numérico → 500.
  - Ordenação: `updatedAt desc`.
  - Não há restrição por agente/carteira para chave não-admin (todos os contatos da org).
- Sucesso: 200, `"Contatos retornados com sucesso"`, `body: { contacts: Contato[] + callPermissions, metadata }`. Cada contato tem também `callPermissions: [{ connectionId, status, isPermanent, expiresAt }]`. Tags vêm ordenadas por `order`, só tags não deletadas; customFields ordenados por nome.
- Pegadinhas: um contato com telefone inválido no banco faz `Contact.create` lançar e derruba a página inteira (500) — não confirmado se ocorre na prática.

### GET /v1/contact/:contactId — permissão `contacts:view`  (path SINGULAR)
- Entrada: `contactId` (string numérica).
- Regras: busca por id **sem filtro de organização e sem filtro de deleted**. 404 `Contato não localizado`.
- Sucesso: 200, `"Contato localizado com sucesso"`, `body: Contato` com `customFields` preenchidos, mas **`tags: []` e `picture: null` sempre** (não faz include).
- Pegadinhas: contato soft-deleted continua retornando 200; para tags use `GET /v1/contacts/:contactId/tags`. Ausência de filtro por org = id de outra organização também é retornado (falha de isolamento).

### PUT /v1/contact/:contactId — permissão `contacts:update`  (path SINGULAR)
- Entrada: body JSON ou multipart (`file` = foto). Campos todos opcionais (merge parcial): `name`, `phoneNumber`, `email`, `document`, `portfolioId`.
- Regras:
  - 422 `Id do contato é obrigatório`; 404 `Contato não encontrado` (busca sem filtro de org).
  - Conflito na org (ativos, outro id): 409 `Já existe outro contato com esse telefone` / `...documento` / `...email`. A checagem de telefone compara a **string crua enviada** com o valor salvo — enviar formatado (`+55 (11)...`) não detecta conflito.
  - Valida nome/telefone/documento pelo entity (mesmas mensagens do create).
  - `portfolioId`: vincula à carteira (mesmas regras de add).
- Sucesso: 200, `"Contato atualizado com sucesso"`, `body: []` (sem safeJson, irrelevante).
- Pegadinhas: impossível **limpar** email/documento (string vazia é ignorada no update). Contato sem telefone (só BSUID) → 500 no update. Não atualiza tags nem custom fields.

### PUT /v1/contacts/:contactId/tags — permissão `contacts:update`
- Entrada: body `{ "tags": string[] }` — **ids de tag**, não nomes. `[]` ou ausente = remove todas.
- Regras:
  - **Substitui a lista inteira** (deleteMany + createMany em transação). A ordem do array vira o campo `order` (0..n).
  - 422 `Id do contato é obrigatório`; 422 `Contato não encontrado` (status 422, não 404; sem filtro de org).
  - 422 `Algumas tags não foram encontradas` se algum id não existe. Não verifica org nem se a tag está deletada (tag deletada é aceita, mas some das listagens).
  - Id não numérico → 500. Ids duplicados no array → createMany viola PK (contactId,tagId) → provável 500.
- Sucesso: 200, `{ "message": "Tags atualizadas com sucesso" }` — **sem `body`**.

### DELETE /v1/contacts/:contactId — permissão `contacts:delete`
- Regras: checa `can(..., "contacts:delete")` de novo (403 `Você não tem permissão para excluir esse contato.`). Soft delete (`deleted=true`). Sem filtro de org.
  - Id inexistente → `Contact.create({})` → 422 `O nome do contato é obrigatório` (não 404).
  - Já deletado → 200 de novo (idempotente).
- Sucesso: 200, `"Contato deletado com sucesso"`, `body: []`.
- Pegadinha: não remove tags/vínculos de carteira/custom fields.

### POST /v1/contacts/sync/:connectionId — permissão `contacts:import`
- Entrada: `connectionId` (param). Sem body.
- Regras: só enfileira job BullMQ `sync-contacts` (puxa contatos do WhatsApp da conexão e cria os que não existem, comparando variantes 9º dígito). Conexão não é validada na requisição; falha só no job (`Cliente WhatsApp não encontrado`). Resultado vai por e-mail ao agente dono da credencial.
- Sucesso: 200, `"Solicitação de sincronização de contatos enviada com sucesso. Verifique seu e-mail nos próximos minutos."`, `body: []`.

### POST /v1/contacts/export/:format — permissão `contacts:export`
- Entrada: `format` = `csv` ou `vcf` (qualquer valor ≠ `csv` gera VCF; não há validação). Body opcional `{ "tagIds": string[] }`.
- Regras: tagIds validados na org → 422 `Algumas tags não foram encontradas`. Enfileira `export-contacts`; arquivo é enviado por e-mail ao `agentId` do tenant.
- Sucesso: 200, `message` e `body` = `"A exportação de contatos foi iniciada. Verifique seu e-mail nos próximos minutos."` (body é a própria string).
- Socket: `contact:export:completed` / `contact:export:failed` emitidos ao agente.
- Pegadinha: com API key, o e-mail vai para o agente associado à chave.

### POST /v1/contacts/import — permissão `contacts:import`
- Entrada: multipart, campo `file` = `.xlsx` (mime `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`), ≤10 MB.
- Planilha: linha 1 = cabeçalho (case-insensitive). Obrigatórias: `name`, `phone`. Opcionais: `email` (inválido é descartado), `document`, `tag1_name`/`tag1_color` … `tag20_name`/`tag20_color` (cor `#RRGGBB`; par incompleto ignorado). Tags são resolvidas **por nome** (criadas se não existirem).
- Erros síncronos: 422 `Arquivo é obrigatório`; 400 `O arquivo deve ser uma planilha .xlsx`; 400 `Arquivo excede o tamanho máximo permitido (10MB)`. Erros de conteúdo só aparecem no job (e-mail/socket).
- Sucesso: 200, `"A importação de contatos foi iniciada. Verifique seu e-mail nos próximos minutos."`, `body: []`.
- Socket: `contact:import:completed` / `contact:import:failed`.

### GET /v1/contacts/:contactId/custom-fields — permissão `contacts:view`
### PUT /v1/contacts/:contactId/custom-fields/:customFieldId — permissão `contacts:update`
### DELETE /v1/contacts/:contactId/custom-fields/:customFieldId — permissão `contacts:update`
Ver seção Campos Personalizados (valores).

---

# TAGS (`src/tag`)

Objeto Tag (via `Tag.toProps()`): `{ id, name, color, description }`. Em alguns endpoints volta a **linha crua do Prisma**: `{ id, name, color, description, deleted, deletedAtUTC, createdAt, updatedAt, organizationId }`.

### POST /v1/tags — permissão `tags:create`
- Entrada body: `name` (string, obrigatório; coluna VarChar(50)), `color` (obrigatório, ver Cores), `description` (opcional, VarChar(400)), `contacts` (opcional, string[] de ids de contatos para já vincular).
- Regras:
  - 409 `Já existe uma tag com este nome` — a busca é `findFirst({ name })` **sem filtro de organização e sem filtro de deleted**, comparação exata (case-sensitive).
  - 422 `Nome da tag é obrigatório`; 422 `Cor da tag inválida: X`; cor ausente → 500; nome >50 ou descrição >400 → 500 (erro do banco).
  - `contacts`: devem existir, não deletados, na org → senão **404** `Um ou mais contatos não foram encontrados`. Ids duplicados no array também disparam esse 404 (compara contagem).
- Sucesso: 200, `"Tag criada com sucesso"`, `body: "<id>"` (string).
- Pegadinha: nome usado por **qualquer org** (ou tag já deletada) bloqueia criação → 409. Integradores multi-cliente vão bater nisso com nomes comuns ("VIP", "Cliente").

### GET /v1/tags — permissão `tags:list`
- Query: `page`, `perPage` (máx 50), `name` (contains, case-insensitive).
- Regras: org + `deleted:false`. Sem ordenação explícita (ordem do banco).
- Sucesso: 200, `"Tags retornadas com sucesso"`, `body: { tags: Tag[], metadata }`.

### GET /v1/tags/:tagId — permissão `tags:view`
- Regras: `findUnique` por id **sem filtro de org e sem filtro de deleted**. 400 `Tag não encontrada` (status 400, não 404).
- Sucesso: 200, `"Tag localizada com sucesso"`, `body: { tag: Tag }` (envolvido em `tag`).

### PUT /v1/tag/:id — permissão `tags:update`  (path SINGULAR e param `:id`)
- Entrada body: `name` (obrigatório na prática), `color` (obrigatório), `description`.
- Regras:
  - `name` ausente → `input.name.trim()` → 500.
  - 409 `Já existe uma tag com o mesmo nome` — busca case-insensitive **em todas as orgs** (sem filtro de org/deleted), excluindo o próprio id.
  - Não verifica existência nem org: id inexistente → erro Prisma P2025 → 500.
  - Sobrescreve name, color, description (description ausente → mantém? `Tag.create({...input})` monta tudo do input; `updateTag` faz `?? atual`, mas o "atual" já é o input → description ausente vira `undefined` e Prisma ignora = mantém valor). Não confirmado.
- Sucesso: 200, `{ "message": "Tag Atualizado", "body": [] }` (sem safeJson).

### DELETE /v1/tags/:tagId — permissão `tags:delete`
- Regras: soft delete. 422 `Id da tag é obrigatório`; 400 `Tag não encontrada`. Sem filtro de org. Vínculos `contacts_tags`/`groups_tags` **não são removidos** (as listagens filtram tag deletada em alguns lugares, não em todos).
- Sucesso: 200, `"Tag deletada com sucesso"`, `body: []`.

### POST /v1/tags/:tagId/contacts — permissão `tags:update`
- Entrada body: `{ "contacts": string[] }` (ids). Adiciona (não substitui).
- Regras: 422 `Id da tag e contatos são obrigatórios para associação`; 422 `Tag não encontrada`; **409** `Todos os contatos já estão associados a esta tag` (se nada novo); 422 `Alguns contatos não foram encontrados`. Sem filtro de org/deleted em tag e contato.
- Sucesso: 200, `{ "message": "Contactos associados a tag com sucesso" }` — **sem body**.

### DELETE /v1/tags/:tagId/contacts — permissão `tags:update`
- Entrada: **body JSON em DELETE** `{ "contacts": string[] }`.
- Regras: 422 obrigatórios; 422 `Tag não encontrada`; 422 `Alguns contatos não foram encontrados`; 409 `Nenhum dos contatos informados está associado a esta tag`. Remove só os que estavam associados.
- Sucesso: 200, `{ "message": "Contatos removidos da tag com sucesso" }` — sem body.

### GET /v1/tags/:tagId/contacts — permissão `tags:view`
- Query: `page`, `perPage`.
- Regras: tag precisa ser da org (404 `Tag não encontrada`; tag deletada ainda é aceita). Lista contatos da org com a tag — **inclui contatos soft-deleted**.
- Sucesso: 200, `"Contatos associados a tag retornados com sucesso"`, `body: { contacts: <linha crua Prisma do contato + picture>, metadata }` (inclui `deleted`, `organizationId`, `source`, `createdAt` etc.).

### POST /v1/tags/:tagId/groups — permissão `tags:update`
- Body `{ "groups": string[] }`. 422 obrigatórios; 422 `Tag não encontrada`; 400 `Id de grupo inválido`; 409 `Todos os grupos já estão associados a esta tag`; 422 `Alguns grupos não foram encontrados`.
- Sucesso: 200, `{ "message": "Grupos associados a tag com sucesso" }` — sem body.

### DELETE /v1/tags/:tagId/groups — permissão `tags:update`
- Body (em DELETE) `{ "groups": string[] }`. 422/400 como acima; 409 `Nenhum dos grupos informados está associado a esta tag`.
- Sucesso: 200, `{ "message": "Grupos removidos da tag com sucesso" }` — sem body.

### GET /v1/tags/:tagId/groups — permissão `tags:view`
- Query `page`, `perPage`. Tag da org e não deletada (404 `Tag não encontrada`).
- Sucesso: 200, `"Grupos associados a tag retornados com sucesso"`, `body: { groups: <linha crua do grupo + icon>, metadata }`.

### GET /v1/contacts/:contactId/tags — permissão `tags:list`
- Query `page`, `perPage`. Contato precisa ser da org (404 `Contato não encontrado`; aceita deletado).
- Sucesso: 200, `"Tags associadas ao contato retornadas com sucesso"`, `body: { tags: <linha crua da tag>, metadata }`, ordenado por `order`, `createdAt`.
- Pegadinhas: **inclui tags soft-deleted**; `metadata.total` está errado (conta *contatos* com a tag, normalmente 1) → não use `total/totalPages` para paginar aqui.

### GET /v1/groups/:groupId/tags — permissão `tags:list`
- Query `page`, `perPage`. Grupo da org (404 `Grupo não encontrado`). Só tags não deletadas da org; metadata correto.
- Sucesso: 200, `"Tags associadas ao grupo retornadas com sucesso"`, `body: { tags: <linha crua>, metadata }`.

---

# CAMPOS PERSONALIZADOS (`src/custom-field`) — confere com `docs/custom-fields-api.md`, com diferenças anotadas

Validação de ids neste módulo: `:customFieldId`, `:contactId`, `:groupId` não numéricos → 400 `Id do campo personalizado inválido` / `Id do contato inválido` / `Id do grupo inválido`. Erros incluem `body` quando existir (ex.: `existingId`).

### POST /v1/custom-fields — permissão `custom-fields:create`
- Body: `name` (string, trim, 1–50, obrigatório), `scope` (**number** 1|2|3, obrigatório — string `"1"` dá 400 `Escopo inválido`), `global` (boolean, default `false`).
- Erros: 422 `O nome do campo é obrigatório`; 400 `O nome do campo deve ter no máximo 50 caracteres`; 422 `O escopo do campo é obrigatório`; 400 `Escopo inválido`; 409 `Já existe um campo personalizado com este nome` (case-insensitive, na org) com `body: { existingId }`.
- Sucesso: **201**, `"Campo personalizado criado com sucesso"`, `body: { id, name, scope, global }`.

### GET /v1/custom-fields — permissão `custom-fields:list`
- Query: `scope` (1|2|3, filtro exato), `global` (`"true"` = true; qualquer outro valor presente = false), `search` (contains, case-insensitive), `page`, **`limit`** (não `perPage`; máx 50).
- Sucesso: 200, `"Campos personalizados listados com sucesso"`, `body: { data: [{ id, name, scope, global, usageCount }], metadata }`, ordenado por nome.

### GET /v1/custom-fields/:customFieldId — permissão `custom-fields:view`
- 404 `Campo personalizado não encontrado` (inexistente ou outra org).
- Sucesso: 200, `"Campo personalizado localizado com sucesso"`, `body: { id, name, scope, global }`.

### PUT /v1/custom-fields/:customFieldId — permissão `custom-fields:update`
- Body: `name`, `scope`, `global` — **os três obrigatórios** (422 `Nome, escopo e global são obrigatórios`).
- Erros: 404; 409 nome duplicado; 409 `Não é possível remover o escopo Contatos: N contatos possuem valor neste campo` / `...Grupos: N grupos...`; 409 `Não é possível tornar este campo exclusivo: ele já está associado a N contatos/grupos` (mudar `global` true→false com >1 dono — **não está no doc do repo**).
- Sucesso: 200, `"Campo personalizado atualizado com sucesso"`, `body: { id, name, scope, global }`.

### DELETE /v1/custom-fields/:customFieldId — permissão `custom-fields:delete`
- Hard delete; cascata apaga todos os valores (contatos e grupos). 404 se não existir/outra org.
- Sucesso: 200, `{ "message": "Campo personalizado excluído com sucesso" }` (body null → omitido).

### GET /v1/contacts/:contactId/custom-fields — permissão `contacts:view`
### GET /v1/groups/:groupId/custom-fields — permissão `groups:view`
- Não valida dono: contato/grupo inexistente ou de outra org → 200 `body: []`.
- Sucesso: 200, `"Valores localizados com sucesso"`, `body: [{ id (do campo), name, value }]` ordenado por nome. Só campos com valor.

### PUT /v1/contacts/:contactId/custom-fields/:customFieldId — permissão `contacts:update`
### PUT /v1/groups/:groupId/custom-fields/:customFieldId — permissão `groups:update`
- Body: `{ "value": string }` (trim, 1–1000). Valor é sempre texto — não há tipos (número/data/select).
- Erros (ordem): 422 `O valor é obrigatório. Use DELETE para limpar o campo`; 400 `O valor deve ter no máximo 1000 caracteres`; 404 `Contato não encontrado`/`Grupo não encontrado` (filtra org e `deleted:false`); 404 `Campo personalizado não encontrado`; 422 `Este campo personalizado não pode ser usado em contatos` / `...em grupos` (scope incompatível); **409 `Este campo personalizado não é global e já está associado a outro contato ou grupo`** quando o campo tem `global:false` e já possui valor em outro dono.
- Sucesso: **201** `"Valor definido com sucesso"` `{ created: true }` ao criar; **200** `"Valor atualizado com sucesso"` `{ created: false }` ao sobrescrever (o doc do repo diz a mesma mensagem nos dois — o código difere).
- Pegadinha central: `global:false` (o **default**) significa campo **exclusivo de um único contato/grupo**. Para um campo usado em vários contatos (ex.: "Regime tributário"), crie com `global: true`.

### DELETE /v1/contacts/:contactId/custom-fields/:customFieldId — permissão `contacts:update`
### DELETE /v1/groups/:groupId/custom-fields/:customFieldId — permissão `groups:update`
- 404 se dono não existe/outra org. Idempotente (sem valor → 204 mesmo assim).
- Sucesso: **204** sem corpo.

---

# GRUPOS (`src/group`) — grupos de WhatsApp

Objeto Grupo (`Group.toProps()`): `{ id, name, phone, restrict, announce, noFrequentlyForwarded, description, icon: File|null, tags: Tag[], customFields: [{id,name,value}] }`. `phone` = JID do grupo **sem** `@g.us`.

Visibilidade (scope) para não-admin: se o agente da credencial tem vínculos em `group_agents` → só esses grupos (RESTRICTED); senão vê todos. Admin vê todos.

### POST /v1/groups — permissão `groups:create`
- Entrada: JSON ou multipart (`file` = ícone). `connectionId` (obrigatório), `name` (obrigatório), `participants` (ids de **contatos**; array, JSON string `"[...]"` ou CSV `"1,2"`).
- Regras: 422 `Obrigatório informar a conexão`; 422 `Conexão informada não existe` (org, não deletada); 409 `Já existe um grupo com esse nome` (case-insensitive na org); 422 `Mime type inválido para o ícone`; 422 `Nome do grupo não pode ser vázio`. Cria o grupo **no WhatsApp** via conexão e depois no banco. Ids de participantes inexistentes são silenciosamente ignorados.
- Sucesso: 200, `"Grupo criado com sucesso"`, `body: { id }`.
- Socket: `createdGroup` (org, escopado por grupo).

### GET /v1/groups — **sem requirePermission** (só autenticação)
- Query: `page`, `perPage`, `name` (contains insensitive), `phone` (contains), `tags` (ids CSV ou array; OR).
- Regras: org + scope do agente. Sem filtro de deleted (grupo não tem soft delete).
- Sucesso: 200, `"Grupos retornados com sucesso"`, `body: { groups: Grupo[], metadata }`.

### GET /v1/group/:groupId — permissão `groups:view`  (path SINGULAR)
- Regras: scope RESTRICTED sem acesso → 404 `Grupo não encontrado`. Busca sem filtro de org; inexistente → **422** `Grupo não encontrado`. Id não numérico → 500.
- Sucesso: 200, `"Grupo localizado com sucesso"`, `body: Grupo` com icon e customFields, **`tags: []`** (não inclui tags).

### PATCH /v1/groups/:groupId/name — permissão `groups:update`
- Body: `connectionId` (obrigatório), `name`. Aceita multipart mas o arquivo é ignorado.
- Regras: 422 `Grupo é obrigatório` / `Conexão é obrigatória`; 404 `Grupo não encontrado`; 422 `Conexão informada não existe`; 403 `Apenas administradores podem editar esse grupo (modo restrito)` se grupo `restrict` e sem `groups:update`; 422 `Nome do grupo não pode ser vazio`. Renomeia no WhatsApp e no banco.
- Sucesso: 200, `{ "message": "Grupo atualizado com sucesso" }` — sem body.

### PATCH /v1/groups/:groupId/participants — permissão `groups:update`
- Body: `connectionId`, `participantIds` (ids de contatos), `action` (`add|remove|promote|demote`).
- Regras: 422 `Grupo, conexão, participantes e ação são obrigatórios`; 422 `É necessário informar ao menos um participante`; 422 `Ação inválida para participantes do grupo`; 422 `Conexão informada não existe`; 422 `Grupo informado não existe`; 422 `Nenhum participante válido encontrado`; 403 `Apenas administradores têm permissão para realizar esta ação`. Executa no WhatsApp; no banco só `add`/`remove` alteram a tabela de participantes.
- Sucesso: 200, `"Participantes atualizados com sucesso"`, `body: []`.

### GET /v1/groups/:groupId/members — permissão `groups:view-participants`
- Query `page`, `perPage`. Scope → 404. 404 `Grupo informado não existe`.
- Sucesso: 200, `"Membros retornados com sucesso"`, `body: { members: Contato[], metadata }`.

### GET /v1/groups/:groupId/contacts/:contactId — permissão `groups:view-participants`
- Scope → 404; 422 `Grupo informado não existe`; 422 `Contato não encontrado no grupo informado`.
- Sucesso: 200, `"Detalhes do membro retornados com sucesso"`, `body: Contato`.

### PATCH /v1/groups/:groupId/agents — **requireAdmin** (chave precisa ser admin; senão 403 `Acesso negado`)
- Body: `{ "agentIds": string[] }` — **substitui** a lista de agentes vinculados (vazio = remove todos → grupo volta a ser visível por todos).
- Regras: 404 `Grupo não encontrado` (org); 404 `Um ou mais agentes não encontrados`. `agentIds` ausente → 500.
- Sucesso: 200, `"Agentes do grupo atualizados com sucesso"`, `body: { groupId, agentIds, addedAgentIds, removedAgentIds }`.
- Socket: inscreve/desinscreve agentes na sala do grupo e emite `groupScopeUpdated` para cada agente afetado.

### GET /v1/groups/:groupId/agents — **requireAdmin**
- Sucesso: 200, `"Agentes do grupo listados com sucesso"`, `body: { agents: [{ id, name }] }` (exclui agentes deletados).

### PUT /v1/groups/:groupId/tags — permissão `groups:update`
- Body `{ "tags": string[] }` (ids). **Substitui** a lista (deduplica; ordem = order).
- Regras: 422 `Id do grupo é obrigatório`; 422 `Grupo não encontrado`; 400 `Id de tag inválido`; 422 `Algumas tags não foram encontradas` (sem filtro de org/deleted).
- Sucesso: 200, `{ "message": "Tags atualizadas com sucesso" }` — sem body.

### GET/PUT/DELETE /v1/groups/:groupId/custom-fields[/:customFieldId]
Ver Campos Personalizados.

---

# CARTEIRAS DE CLIENTES (`src/customer-portfolio`)

Atenção: lista/criação em `/v1/customer-portfolios` (plural); item em `/v1/customer-portfolio/:portfolioId` (singular).

Objeto Carteira (`toProps()`): `{ id, name, scope (1 GLOBAL|2 CONNECTION), connectionId|null, sectorId, queueEnabled, agentId|null, agentIds: [{ portfolioId, agentId, position, active }], rotationAlgorithm|null (1|2), responseTimeoutMinutes|null, escalationEnabled, active, escalateToWalletId|null, lastRotatedAgentId|null, organizationId, createdAt, updatedAt }`.

### POST /v1/customer-portfolios — permissão `customer-portfolio:create`
- Body: `name` (obrig., trim, ≤120), `scope` (1|2), `connectionId` (obrig. se scope=2; proibido se scope=1), `sectorId` (obrig.), `queueEnabled` (bool), `agentId` (obrig. se `queueEnabled` falso = atendimento direto), `agentIds` (string[], obrig. se fila; posição = ordem), `rotationAlgorithm` (obrig. se fila), `responseTimeoutMinutes` (obrig. ≥1 se fila; opcional ≥1 se direto), `escalationEnabled` (bool), `escalateToWalletId`, `contactIds` (string[]).
- Erros: 422 `Setor é obrigatório`; 409 `Já existe uma carteira com este nome` (exato, na org); 422 `Setor não encontrado ou não pertence à organização`; 422 conexão/agente/agentes/carteira de escalação não encontrados; 422 `Carteira não pode fazer parte de um ciclo de escalação`; 422 `Um ou mais contactIds são inválidos`; 422 `Um ou mais contatos não foram encontrados ou não pertencem à organização`; 422 `Um ou mais contatos já estão associados a outra carteira com o mesmo escopo e conexão`; entity: 422 `Nome da carteira é obrigatório`, 400 `...no máximo 120 caracteres`, 422 `Conexão é obrigatória para carteiras do tipo CONNECTION`, 400 `Carteiras globais não podem ter uma conexão associada`, 422 `Agente é obrigatório para atendimento direto`, 422 `Lista de agentes é obrigatória para fila`, 422 `Algoritmo de rotação é obrigatório para fila`, 422 `Tempo de resposta é obrigatório para fila`, 400 `Tempo de resposta deve ser maior que zero`. `scope` com valor fora de 1/2 não é rejeitado (não confirmado efeito).
- Sucesso: **201**, `"Carteira criada com sucesso"`, `body: "<id>"`.
- Regra de negócio: um contato só pode estar em **uma** carteira por par (scope, connectionId).

### GET /v1/customer-portfolios — permissão `customer-portfolio:list`
- Query: `page`, `perPage`, `scope` (número), `connectionId`, `active` (`"true"|"false"`; outro valor → 400 `Filtro 'active' deve ser 'true' ou 'false'.`).
- Sucesso: 200, `"Carteiras retornadas com sucesso"`, `body: { portfolios: Carteira[], metadata }`.

### GET /v1/customer-portfolio/:portfolioId — permissão `customer-portfolio:view`
- 404 `Carteira não encontrada` (org). Sucesso: 200, `"Carteira localizada com sucesso"`, `body: Carteira`.

### PUT /v1/customer-portfolio/:portfolioId — permissão `customer-portfolio:update`
- Body parcial: `name`, `sectorId`, `queueEnabled`, `agentId`, `agentIds`, `rotationAlgorithm`, `responseTimeoutMinutes`, `escalationEnabled`, `escalateToWalletId`, `contactIds`. **Não altera** `scope` nem `connectionId`.
- Regras: mesmas validações do create (404 carteira). `agentIds` enviado **substitui** a fila. `contactIds` enviado **substitui** os contatos (os ausentes são soft-desvinculados; `[]` remove todos); omitido = não mexe.
- Sucesso: 200, `{ "message": "Carteira atualizada com sucesso" }` — sem body.

### DELETE /v1/customer-portfolio/:portfolioId — permissão `customer-portfolio:delete`
- Regras: 404; 409 `Carteira possui atendimento com prazo de resposta em andamento; aguarde o prazo expirar para excluir`; 409 `Carteira é alvo de escalação de outra carteira; ajuste antes de excluir`. **Hard delete** (vínculos de contato e agentes apagados).
- Sucesso: 200, `"Carteira deletada com sucesso"`, `body: []`.

### POST /v1/customer-portfolio/:portfolioId/contacts — permissão `customer-portfolio:link-contact`
- Body `{ "contactIds": string[] }` (adiciona).
- Erros: 404 `Carteira não encontrada`; 422 `Lista de contatos é obrigatória`; 422 contatos não encontrados (org, não deletados); 422 `Um ou mais contatos já estão vinculados a esta carteira`; 422 `...já estão associados a outra carteira com o mesmo escopo e conexão`; 409 `Um ou mais contatos já pertencem a outra carteira com o mesmo escopo` (race). Id não numérico → 500.
- Sucesso: 200, `"Contatos vinculados com sucesso"`, `body: []`.

### DELETE /v1/customer-portfolio/:portfolioId/contacts — permissão `customer-portfolio:link-contact`
- Body (em DELETE) `{ "contactIds": string[] }`. 404; 422 `Lista de contatos é obrigatória`; 422 `Um ou mais contatos não estão vinculados a esta carteira`. Soft-desvincula.
- Sucesso: 200, `"Contatos removidos da carteira com sucesso"`, `body: []`.

### GET /v1/customer-portfolio/:portfolioId/contacts — permissão `customer-portfolio:view`
- Query `page`, `perPage`. 404 carteira.
- Sucesso: 200, `"Contatos da carteira retornados com sucesso"`, `body: { contacts: [{ id, name, phoneNumber }], metadata }` (ordenado por nome; só vínculos e contatos não deletados).

### PATCH /v1/customer-portfolio/:portfolioId/status — permissão `customer-portfolio:toggle-status`
- Body `{ "active": boolean }` (tipo boolean estrito). 422 `Necessário informar o status da carteira.`; 400 `Status da carteira deve ser um booleano.`; 404.
- Desativar cancela timers de reclaim pendentes da carteira. Idempotente.
- Sucesso: 200, `{ "message": "Carteira ativada com sucesso" | "Carteira desativada com sucesso" }` — sem body.

---

# SETORES (`src/sector`)

Objeto Setor: `{ id, name, color, welcomeMessage }`.

### POST /v1/sectors — permissão `sectors:create`
- Body: `name` (trim, obrig., ≤30), `color` (obrig.), `welcomeMessage` (opcional).
- Erros: 409 `Já existe um setor com o mesmo nome` (exato, na org, **inclui setores deletados**); 422 `Nome do setor é obrigatório`; 422 `Nome da equipe não pode exceder 30 caracteres`; 422 `Cor da tag inválida: X`; cor ausente → 500.
- Sucesso: 200, `"Setor criado com sucesso"`, `body: "<id>"`.

### GET /v1/sectors — permissão `sectors:list`
- Query `page`, `perPage`, `name` (contains insensitive). Org + não deletados.
- Sucesso: 200, `"Setores retornados com sucesso"`, `body: { sectors: Setor[], metadata }`.

### GET /v1/sector/:sectorId — permissão `sectors:view`
- Sem filtro de org nem deleted. 404 `Setor informado não existe`.
- Sucesso: 200, `"Sector localizado com sucesso"` (sic), `body: Setor`.

### PUT /v1/sector/:sectorId — permissão `sectors:update`
- Body parcial: `name`, `color`, `welcomeMessage` (ausente = mantém).
- 404 `Setor informado não existe`. **Sem checagem de nome duplicado** e sem filtro de org.
- Sucesso: 200, `{ "message": "Setor atualizado com sucesso" }` — sem body.

### DELETE /v1/sector/:sectorId — permissão `sectors:delete`
- Soft delete. 404 `Setor informado não existe`. Não verifica dependências (carteiras/tickets/agentes usando o setor).
- Sucesso: 200, `"Setor deletado com sucesso"`, `body: []`.

---

# Pegadinhas consolidadas para integradores

1. **Singular vs plural nos paths**: `/v1/contact/:id` (GET/PUT) vs `/v1/contacts/:id` (DELETE, tags, custom-fields); `/v1/tag/:id` (PUT) vs `/v1/tags/:tagId`; `/v1/group/:id` (GET) vs `/v1/groups/...`; `/v1/sector/:id` vs `/v1/sectors`; `/v1/customer-portfolio/:id` vs `/v1/customer-portfolios`.
2. **Campo personalizado `global:false` (default) = exclusivo de um único dono** → 409 ao setar em um segundo contato. Crie com `global:true` para campos compartilhados. `scope` deve ser número.
3. **Tag: nome único global entre todas as organizações** (create: exato, inclui deletadas; update: case-insensitive). 409 inesperado é comum.
4. `PUT /v1/contacts/:id/tags` e `PUT /v1/groups/:id/tags` **substituem** a lista e recebem **ids**, não nomes. Para adicionar sem apagar use `POST /v1/tags/:tagId/contacts` (que dá 409 se todos já estiverem associados).
5. Criação de contato bloqueia **nome repetido** (409), além de telefone/documento; documento precisa vir formatado (pontos/traço/barra).
6. Vários endpoints de leitura/escrita por id **não filtram organização** (GET/PUT/DELETE contato, GET/PUT/DELETE tag, GET/PUT/DELETE setor, GET grupo, tags de contato/grupo) e alguns não filtram soft delete (GET contato, GET tag, contatos por tag, tags por contato). Não use "200" como prova de existência ativa; verifique `deleted` onde a linha crua vier.
7. Status de "não encontrado" inconsistentes: 404, 422 ou 400 (tag por id → 400; contato em PUT tags → 422; grupo por id → 422; DELETE contato inexistente → 422 "O nome do contato é obrigatório").
8. Ids malformados nos params/body geram 500 (exceto módulo custom-field, que responde 400).
9. Respostas sem `body`: PUT contact tags, POST/DELETE tag-contacts/groups, PATCH group name, PUT group tags, PUT portfolio, PATCH portfolio status, PUT sector, DELETE custom-field. Create devolve só o id como **string pura** em `body` (contato, tag, setor, carteira); grupo devolve `{ id }`; custom-field devolve objeto.
10. Códigos de sucesso: maioria 200; 201 em POST custom-field, POST carteira e PUT valor de campo (quando cria); 204 em DELETE valor de campo.
11. `GET /v1/contacts` com `search` desliga o filtro que esconde participantes de grupo — resultados mudam de universo.
12. `GET /v1/contacts/:id/tags`: `metadata.total` incorreto.
13. Paginação: `perPage` máx 50 em todos; custom-fields usa `limit` em vez de `perPage`.
14. Export/import/sync são assíncronos (BullMQ) e entregam resultado por **e-mail** ao agente da credencial + socket; a API só confirma o enfileiramento.
15. Criar grupo e alterar nome/participantes executa ações reais no WhatsApp via `connectionId`.
16. `GET /v1/groups` não exige permissão; agentes vinculados via `/agents` restringem a visibilidade de grupos (404 em grupo fora do escopo).

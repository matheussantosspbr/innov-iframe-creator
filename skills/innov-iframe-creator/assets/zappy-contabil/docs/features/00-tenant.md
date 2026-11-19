# Tenants

Ponto de partida da aplicação: cada empresa (cliente da Zappy) é um tenant, com a URL da instância da Zappy e o token de API dela.

## Acesso

As rotas `/api/tenants` exigem o header `x-comhub-key` (valor de `APPLICATION_X_COMHUB_KEY`). Chave ausente ou errada responde 401, antes de validar o corpo. A chave não abre as rotas do iframe (`/api/app`), e o contexto do iframe não abre as de operação.

## Rotas

| Rota | Corpo | Resposta de sucesso |
|---|---|---|
| `POST /api/tenants` | `{ name, zappyUrl, zappyToken }` | 201 `{ body: { id, name, zappyUrl, active, createdAt, updatedAt } }` |
| `GET /api/tenants` | | 200 `{ body: [ ...mesmo formato ] }`, por ordem de cadastro |
| `PATCH /api/tenants/:tenantId` | `{ active: boolean }` | 200 `{ body: { id, active } }` |
| `DELETE /api/tenants/:tenantId` | | 200 `{ body: { id } }` |

Erros: `{ error: { message } }`. O token nunca aparece em resposta nem em log.

## Cadastro

Campos do corpo:

- `name`: rótulo legível do cliente, 1 a 120 caracteres (espaços nas pontas são removidos).
- `zappyUrl`: até 255 caracteres. Formato `https://api-<subdominio>.zapcontabil.chat`.
- `zappyToken`: token de API da instância, até 256 caracteres.

Validações, nesta ordem:

1. Corpo no formato acima. Senão, 422.
2. A URL é normalizada (sem espaços, sem `/` no fim, minúscula). O ZDK exige `https://`, host `api-<subdominio>.zapcontabil.chat` e URL sem caminho. Formato inválido: 422.
3. A credencial é provada na Zappy com `verify()` (1 requisição). Token recusado: 422. Instância fora do ar: 502. Só depois de provada o tenant é gravado.
4. `zappyUrl` é única: URL já cadastrada responde 409.

O `id` devolvido (UUID) é o `tenantId` que o iframe envia no header `x-tenant-id`.

## Ativar e remover

`PATCH` com `active: false` bloqueia o tenant: as rotas do iframe respondem 403 até reativar. `PATCH` e `DELETE` em `tenantId` inexistente respondem 404. `DELETE` apaga também o token cifrado.

## Tabela `tenants` (Prisma)

| Coluna | Tipo | Observação |
|---|---|---|
| `id` | `CHAR(36)` | chave primária, UUID |
| `name` | `VARCHAR(120)` | rótulo do cliente |
| `zappy_url` | `VARCHAR(255)` | único |
| `zappy_token` | `VARCHAR(512)` | cifrado (AES-256-GCM, `APPLICATION_ENCRYPTION_KEY`) |
| `active` | `BOOLEAN` | padrão `true` |
| `created_at`, `updated_at` | `DATETIME(3)` | |

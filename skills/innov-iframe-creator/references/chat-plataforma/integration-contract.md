# Contrato de integração de apps (plataforma ↔ app)

Fonte: código do backend (`chat-contabil-server`, módulos `application` e `organization-application`, out/2026), principalmente `external-provisioning-adapter.ts` e os use cases de instalação. **O guia público (`backstage.chatplataforma.com.br/docs`) está desatualizado em pontos que quebram o app:** corpo do install, formato do `credentialsSchema`, status aceitos e o ciclo do `externalId`. As divergências estão marcadas com ⚠.

## Sumário
1. Cadastro do app no Backstage
2. Iframe e parâmetros
3. Ciclo de vida da instalação
4. Chamadas da plataforma ao app
5. Autenticação: HMAC e JWT
6. Erros: quem lê a mensagem
7. Casos de borda e órfãos

## 1. Cadastro do app no Backstage

Feito por um super agente Comhub em Backstage → Aplicativos.

| Campo | Regra |
|---|---|
| `name` | obrigatório, até 80 |
| `description` | até 500 |
| `rootUrl` | obrigatório, até **100** caracteres, `http(s)://`. Não normaliza barra final: `https://app.com/` vira `https://app.com//api/...`. Cadastre a raiz do domínio **sem barra final**. |
| `pricingType` | `1=FREE` (instalação direta) ou `2=PAID` (fica aguardando aprovação do Backstage) |
| `active` | app inativo some da loja e bloqueia salvar credenciais ("temporariamente suspenso"). O app **não** é avisado. |
| `credentialsSchema` | ver abaixo |

**`clientSecret`:** 64 caracteres hex gerados pelo Backstage, exibidos **uma vez** (no create e no rotate). É a chave do HMAC e do JWT, usada como string (não decodificar o hex). Vai na env `CHATPLATAFORMA_CLIENT_SECRET` do app. Rotação não tem período de convivência: a próxima chamada já vem assinada com o novo valor, então troque a env no mesmo momento.

### `credentialsSchema` ⚠ não é JSON Schema

String JSON no formato próprio do Backstage:

```json
{ "fields": [ { "label": "API Key do Chat Plataforma", "type": "string", "required": true, "secret": true } ] }
```

- `label`: até 80 caracteres. **É a chave do objeto que o app recebe.** Renomear um label no Backstage muda a chave sem avisar o app.
- `type`: `string` | `number` | `boolean`. A plataforma confere com `typeof`: `"443"` não passa num campo `number`.
- `required`: só é exigido no **install** (ver §3). `secret`: o valor aparece mascarado (`••••••••`) para o admin.
- `id`: opcional, gerado pelo Backstage. O app não usa.
- Campos fora do schema também são aceitos e repassados.

No template, `CREDENTIAL_FIELDS` (`apps/api/src/core/utils/credentials.ts`) é a fonte única: mapeia a chave interna (`chatPlataformaApiKey`) para o label. `pnpm --filter api credentials:schema` imprime o JSON para colar no Backstage.

## 2. Iframe e parâmetros

O painel monta a URL a partir do `rootUrl` e carrega num `<iframe>` de **384px de largura**. O backend da plataforma não participa disso: não gera, não assina e não valida os parâmetros.

| Parâmetro | Sempre? | O que é |
|---|---|---|
| `accountId` | sim | `externalId` da instalação, o valor que o app devolveu no install |
| `agentId` | sim | atendente com o app aberto |
| `ticketId` | sim | ticket aberto |
| `ticketConnectionId` | sim | conexão (canal WhatsApp) do ticket. É o `connectionId` para enviar mensagens. |
| `contactId` | opcional | contato do ticket (ausente em ticket de grupo) |
| `ticketAgentId` | opcional | responsável pelo ticket (pode diferir de `agentId`) |
| `ticketSectorId` | opcional | setor do ticket |
| `ticketGroupId` | opcional | grupo de WhatsApp do ticket |

Opcionais sem valor são omitidos (nunca string vazia). IDs são snowflakes em string.

**Confiança:** a URL não é assinada. O `accountId` é um UUID difícil de adivinhar e funciona como credencial de acesso do iframe ao backend do app. `agentId` e `ticketId` podem ser trocados por quem tem a URL. Por isso o backend do app:
- localiza a instalação pelo `accountId` (`x-account-id`) e usa **as credentials dela**, nunca dados vindos do front;
- busca o ticket na API do Chat Plataforma antes de agir sobre ele;
- não executa ação sensível só porque o front mandou um ID.

## 3. Ciclo de vida da instalação

Status da instalação na plataforma: `ACTIVE=1`, `INACTIVE=2`, `ERROR=3`, `AWAITING_PAYMENT=4`, `PENDING_SETUP=5`, `SUSPENDED=6` (calculado quando o app está inativo; nunca gravado).

| Ação do admin da organização | Pré-condição | Chamada ao app | Resultado |
|---|---|---|---|
| Instalar app grátis | — | nenhuma | `PENDING_SETUP` |
| Instalar app pago | — | nenhuma | `AWAITING_PAYMENT` → Backstage aprova → `PENDING_SETUP` |
| Salvar credenciais, **sem** `externalId` | não está aguardando pagamento | `install` | sucesso → `ACTIVE` com o `externalId` devolvido; falha → `ERROR` |
| Salvar credenciais, **com** `externalId` | idem | `configure` | sucesso → `ACTIVE`; falha → `ERROR` (mantém o `externalId`) |
| Desinstalar | só de `ACTIVE` | `uninstall` | sucesso → `INACTIVE` e **`externalId := null`**; falha → continua `ACTIVE` e o erro aparece para o admin |
| Excluir | qualquer status exceto `ACTIVE` | **nenhuma** | soft delete na plataforma |
| Ver diagnóstico | `ACTIVE` com `externalId` | `diagnostics` | mostra o resultado |

Consequências para o app:
- ⚠ **Depois de desinstalar, salvar credenciais chama `install` de novo** e o app gera **outro** `externalId`. Não existe "reativar" a instância antiga. O app pode apagar os dados da instância no `uninstall`.
- Excluir e instalar de novo cria outra instalação na plataforma e também chama `install`.
- Credenciais salvas na plataforma sobrevivem ao uninstall, mas o `install` seguinte recebe **só os campos enviados naquele save** (com `required` exigido de novo).

## 4. Chamadas da plataforma ao app

Todas: `POST {rootUrl}{path}`, `Content-Type: application/json`, corpo = `JSON.stringify(body)`, headers `x-timestamp` e `x-signature` (§5). **Timeout de 10 s**; sem resposta → a plataforma registra 502 "Serviço externo indisponível" e status `ERROR`. A plataforma lê **`response.body.body`**: responda sempre no envelope `{ "body": ... }`.

| Rota no app | Corpo recebido | Status aceitos ⚠ | Resposta exigida |
|---|---|---|---|
| `POST /api/provision/install` | ⚠ **objeto plano** de credenciais, chave = label: `{ "API Key do Chat Plataforma": "abc" }`. Sem wrapper `credentials`. | **200 ou 201** (204 = erro) | `{ "body": { "externalId": "..." } }` |
| `POST /api/provision/configure` | `{ "externalId": "...", "credentials": { ... } }` | **200 ou 204** (201 = erro) | `{ "body": { "externalId": "..." } }` (o corpo não é lido) |
| `POST /api/provision/uninstall` | `{ "externalId": "..." }` | **200 ou 204** (201 = erro) | `{ "body": { "success": true } }` (o corpo não é lido) |
| `GET /api/instances/:externalId/diagnostics` | — (Bearer JWT) | **200** | `{ "body": { "externalId", "status", "components": [...], "checkedAt" } }` |

### install
- Recebe só os campos que o admin preencheu. A plataforma já garantiu `required` e `typeof`.
- ⚠ Se o app responder `{ "externalId": "..." }` sem o envelope `body`, a plataforma grava `ACTIVE` **com externalId nulo** sem erro algum: o iframe abre sem `accountId` e o próximo save chama `install` de novo.
- O template: lê pelos labels, valida com zod (422 citando o label), **testa a API key em `GET /v1/me/permissions`** (key recusada → 422 explicando o que fazer; sem as `REQUIRED_PERMISSIONS` → 422 listando-as), gera um UUID, cifra e grava. Responde 201.

### configure ⚠ atualização parcial
- `credentials` traz **só os campos enviados no save**, não o conjunto salvo. Campo ausente = não mudou.
- Campos `secret` podem chegar com o placeholder `••••••••` (a plataforma não o filtra). Tratar como "não mudou"; gravar o placeholder destruiria o segredo.
- `null` ou `""` = o admin apagou o campo. `required` **não** é reaplicado pela plataforma aqui: o app valida o conjunto final.
- O template: `applyPlatformCredentials(salvas, recebidas)` → valida o resultado completo → testa a API key → grava. Erro → 422 e as credentials antigas ficam intactas.

### uninstall
- Seja **idempotente**: se o `externalId` não existe mais, responda 200. Um 404 aqui deixa a instalação presa em `ACTIVE` (a plataforma não conclui o uninstall e o admin não consegue excluir).
- O template apaga a linha da instalação (as credentials somem junto).

### diagnostics
- A plataforma valida só a forma: `body.externalId` string, `body.status` string, `body.components` array. Forma errada → admin vê "Serviço externo indisponível".
- Use `status` ∈ `operational | degraded | outage` e `components: [{ name, status, detail? }]`. O template checa o banco e a API key (`GET /v1/me/permissions`).
- 404 quando a instalação não existe.

## 5. Autenticação

### HMAC (install, configure, uninstall)
- `x-timestamp`: ms desde epoch (string).
- `x-signature`: `hex(HMAC-SHA256(clientSecret, "<x-timestamp>:<corpo cru>"))`.
- A assinatura cobre os **bytes exatos** enviados: valide sobre o raw body (o template guarda `req.rawBody` no parser de JSON), nunca sobre um objeto re-serializado.
- A plataforma não impõe janela anti-replay. O template recusa timestamps fora de ±5 min e compara com `timingSafeEqual`. Falha → 401.

### JWT (diagnostics)
- `Authorization: Bearer <jwt>`, HS256 com o `clientSecret`, **expira em 2 min**.
- Claims: `{ externalId, scope: "diagnostics:read", iat, exp }`, sem `iss`, `aud` ou `sub`. Valide assinatura, `exp`, `scope` e `externalId` igual ao da URL. Falha → 401.

## 6. Erros: quem lê a mensagem

⚠ A plataforma repassa ao **admin da organização** o `error.message` que o app devolver, **com o mesmo status HTTP** do app (`{ "message": "<seu error.message>" }`). Se o corpo não tiver `error.message`, o admin vê "Falha na comunicação com o serviço externo".

Por isso as mensagens das rotas de provisionamento e diagnóstico são escritas para um **administrador leigo**, em português, dizendo o que fazer: `ADMIN_MESSAGES` em `apps/api/src/core/utils/messages.ts`. Nada de "Assinatura inválida", detalhe do zod ou stack: o detalhe técnico vai para o log com `requestId`. As rotas do iframe usam `USER_MESSAGES` (atendente). Ver `observability-and-integrations.md`.

| Situação | Status | Mensagem do template |
|---|---|---|
| HMAC/JWT inválido | 401 | `ADMIN_MESSAGES.untrustedCall` (normalmente `CHATPLATAFORMA_CLIENT_SECRET` divergente do Backstage) |
| Campo de credencial inválido | 422 | "Revise o preenchimento de: \"<label>\"." |
| API key recusada (401) | 422 | `ADMIN_MESSAGES.invalidApiKey` |
| Conta ou criador da key bloqueado (403) | 422 | `ADMIN_MESSAGES.apiKeyBlocked` |
| Key sem permissões necessárias | 422 | `missingPermissionsMessage([...])` |
| Chat Plataforma fora do ar na validação | 502 | `ADMIN_MESSAGES.chatPlataformaUnavailable` |
| Instalação não existe (configure/diagnostics) | 404 | `ADMIN_MESSAGES.installationNotFound` |
| Payload fora do contrato | 422 | `ADMIN_MESSAGES.invalidRequest` |

## 7. Casos de borda e órfãos

O app não tem como saber de alguns eventos. Projete para eles:

- **Exclusão não avisa o app.** Uma instalação que falhou no `configure` (status `ERROR`, ainda com `externalId`) pode ser excluída sem `uninstall`: a instância fica órfã no app. Instâncias órfãs são inofensivas (ninguém mais tem o `accountId`); se o app guardar volume relevante por instância, registre `updated_at` e faça limpeza manual ou periódica.
- **Install que deu certo no app e falhou ao gravar na plataforma** também deixa órfão.
- **Suspensão** (app inativo) e **rotação de API key** pela organização não chegam ao app: aparecem como 401 nas chamadas e como `degraded` no diagnóstico.
- **API key "expirada" continua funcionando** no backend atual. Não confie na expiração para revogar acesso.
- O `clientSecret` é único por app (não por instalação): vazou, rotacione no Backstage e atualize a env.

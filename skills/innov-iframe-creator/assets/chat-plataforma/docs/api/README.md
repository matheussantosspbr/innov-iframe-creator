# Guia da API para o Apidog

Documentação OpenAPI 3.0 de toda a API do app (`apps/api`), pronta para importar no Apidog (ou em qualquer cliente que leia OpenAPI).

- Arquivo: `docs/api/openapi.json` (gerado do código, conferido por teste)
- Com a API rodando: `{baseUrl}/api/docs/json` (JSON) e `{baseUrl}/api/docs` (Swagger UI)

## Importar

1. Apidog → **Importar dados** → **OpenAPI/Swagger**.
2. Escolha o arquivo `docs/api/openapi.json` ou informe a URL `{baseUrl}/api/docs/json` da API rodando.
3. Confirme a importação das 7 rotas.

Esses passos são genéricos: **não verificado no Apidog** (o fluxo exato e como ele trata os `securitySchemes` não foram testados aqui).

## Variáveis de ambiente sugeridas

| Variável | Exemplo | Uso |
|---|---|---|
| `baseUrl` | `http://localhost:3333` | Prefixo de todas as rotas (em produção, o domínio da API) |
| `clientSecret` | 64 hex do Backstage | Chave do HMAC e do JWT (`CHATPLATAFORMA_CLIENT_SECRET`) |
| `externalId` / `accountId` | UUID devolvido pelo install | `externalId` na URL do diagnóstico; `accountId` no header `x-account-id` (são o mesmo valor) |
| `agentId` | `182736454928173647` | Header opcional `x-agent-id` |
| `ticketId` | `182736454928173645` | Header opcional `x-ticket-id` e parâmetro de `/api/app/tickets/{ticketId}` |
| `timestamp` / `signature` | calculados (ver abaixo) | Headers `x-timestamp` / `x-signature` |

## Envelope de resposta

- Sucesso: `{ "body": ... }`
- Erro: `{ "error": { "message": "..." } }` (a mensagem é em português; nas rotas do Backstage é escrita para o administrador, nas do iframe para o atendente)
- Todas as respostas trazem `x-request-id`. Enviar `x-request-id` (16 a 64 caracteres `A-Za-z0-9-`) faz a API reaproveitá-lo nos logs.
- Os corpos `POST` precisam de `Content-Type: application/json`; com outro tipo a API hoje responde 500 (comportamento atual, não um contrato).

## Autenticação por grupo de rotas

| Grupo | Rotas | Como autenticar |
|---|---|---|
| Health | `GET /api/health` | Nenhuma |
| Provisionamento (`provision`) | `POST /api/provision/install`, `configure`, `uninstall` | HMAC: headers `x-timestamp` e `x-signature` |
| Diagnóstico (`diagnostics`) | `GET /api/instances/{externalId}/diagnostics` | `Authorization: Bearer <jwt>` |
| Iframe (`app`) | `GET /api/app/tickets/{ticketId}`, `POST /api/app/client-logs` | Header `x-account-id`; `x-agent-id` e `x-ticket-id` são opcionais (só contexto de log) |

No OpenAPI, o HMAC aparece como dois `apiKey` de header (`hmacSignature` = `x-signature` e `hmacTimestamp` = `x-timestamp`, exigidos juntos), o JWT como `http bearer` (`diagnosticsJwt`) e o iframe como `apiKey` de header (`iframeAccountId` = `x-account-id`). A assinatura depende do corpo, então precisa ser calculada fora do formulário do Apidog.

### Assinar o HMAC (install, configure, uninstall)

`x-signature = hex(HMAC-SHA256(clientSecret, "<x-timestamp>:<corpo cru>"))`, com `x-timestamp` em milissegundos desde a epoch (a API aceita ±5 min). A assinatura cobre os **bytes exatos** enviados: assine e envie a mesma string.

```bash
BASE=http://localhost:3399
CLIENT_SECRET=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef  # exemplo local

post_signed() { # $1=caminho  $2=corpo JSON
  TS=$(date +%s%3N)
  SIG=$(printf '%s:%s' "$TS" "$2" | openssl dgst -sha256 -hmac "$CLIENT_SECRET" -hex | sed 's/^.* //')
  curl -sS -w '\nHTTP %{http_code}\n' -X POST "$BASE$1" \
    -H 'content-type: application/json' -H "x-timestamp: $TS" -H "x-signature: $SIG" -d "$2"
}

post_signed /api/provision/install '{"API Key do Chat Plataforma":"cp-chave-de-exemplo"}'
```

Resposta real (executada contra a API com repositório em memória):

```
{"body":{"externalId":"251f43cd-c087-4de6-ac1b-3bea9c848968"}}
HTTP 201
```

### Gerar o JWT do diagnóstico

HS256 com o `clientSecret` (usado como string, sem decodificar o hex), claims `scope: "diagnostics:read"` e `externalId` igual ao da URL, `exp` curto (o Backstage usa 2 min):

```bash
b64url() { openssl base64 -A | tr '+/' '-_' | tr -d '='; }
make_jwt() { # $1=externalId
  H=$(printf '{"alg":"HS256","typ":"JWT"}' | b64url)
  P=$(printf '{"scope":"diagnostics:read","externalId":"%s","exp":%s}' "$1" "$(( $(date +%s) + 120 ))" | b64url)
  S=$(printf '%s.%s' "$H" "$P" | openssl dgst -sha256 -hmac "$CLIENT_SECRET" -binary | b64url)
  printf '%s.%s.%s' "$H" "$P" "$S"
}
```

## Rotas e exemplos verificados

Os exemplos abaixo foram executados de verdade contra a API rodando com repositório em memória e um cliente do Chat Plataforma fake (a API key `chave-recusada` simula recusa; qualquer outra é aceita). Contra um ambiente real, o `install`/`configure` valida a API key no Chat Plataforma, então use uma chave válida. Os IDs mudam a cada execução. `EXT` é o `externalId` devolvido pelo install.

### `GET /api/health`

```bash
curl -sS $BASE/api/health
```
```
{"body":{"status":"ok"}}        # HTTP 200
```

### `POST /api/provision/install`

Corpo: objeto plano, chave = label do campo do `credentialsSchema` (aqui `API Key do Chat Plataforma`). Exemplo na seção do HMAC (201).

### `POST /api/provision/configure`

Atualização parcial: só os campos enviados mudam; `••••••••` = não mudou; `null` ou `""` = apagado.

```bash
post_signed /api/provision/configure "{\"externalId\":\"$EXT\",\"credentials\":{\"API Key do Chat Plataforma\":\"cp-chave-nova\"}}"
```
```
{"body":{"externalId":"e12b311d-cbab-4d17-9565-6df7b36efb4a"}}
HTTP 200
```

### `POST /api/provision/uninstall`

Idempotente: repetir a chamada também devolve 200.

```bash
post_signed /api/provision/uninstall "{\"externalId\":\"$EXT\"}"
```
```
{"body":{"success":true}}
HTTP 200
```

### `GET /api/instances/{externalId}/diagnostics`

```bash
curl -sS $BASE/api/instances/$EXT/diagnostics -H "authorization: Bearer $(make_jwt $EXT)"
```
```
{"body":{"externalId":"e12b311d-cbab-4d17-9565-6df7b36efb4a","status":"operational","components":[{"name":"database","status":"operational"},{"name":"chatplataforma-api","status":"operational"}],"checkedAt":"2026-11-19T08:47:07.280Z"}}
```

HTTP 200. `status` é `operational`, `degraded` ou `outage`; componente com falha traz `detail`. O HTTP continua 200 mesmo `degraded`.

### `GET /api/app/tickets/{ticketId}`

`ticketId` só com dígitos (até 20).

```bash
curl -sS $BASE/api/app/tickets/182736454928173645 \
  -H "x-account-id: $EXT" -H 'x-agent-id: 182736454928173647' -H 'x-ticket-id: 182736454928173645'
```
```
{"body":{"id":"182736454928173645","protocol":4821,"status":2,"priority":2,"frozen":false,"archived":false,"contact":{"id":"1","name":"Maria","phoneNumber":"5511999998888"},"agent":{"id":"2","name":"Ana"},"connection":{"id":"3","provider":1}}}
```

HTTP 200 (dados do ticket vêm do cliente fake neste teste).

### `POST /api/app/client-logs`

`level`: `error`, `warn` ou `info`; `message` até 2000 caracteres; `context` opcional (objeto livre).

```bash
curl -sS -X POST $BASE/api/app/client-logs -H "x-account-id: $EXT" -H 'content-type: application/json' \
  -d '{"level":"error","message":"falha ao carregar o ticket","context":{"screen":"TicketScreen"}}'
```
```
{"body":{"received":true}}      # HTTP 200
```

## Códigos de erro por rota

Todos no formato `{ "error": { "message": "..." } }`. Respostas reais conferidas: 401 e 422 do install, 404 do configure e do diagnóstico, 401 e 422 do ticket, 422 do client-logs, 404 de rota inexistente.

| Rota | Status | Quando | Mensagem (resumo) |
|---|---|---|---|
| install, configure, uninstall | 401 | HMAC ausente, fora de ±5 min ou inválido (`clientSecret` divergente) | "Não foi possível confirmar que a chamada veio do Chat Plataforma..." |
| install, configure | 422 | Campo de credencial inválido | `Revise o preenchimento de: "API Key do Chat Plataforma".` |
| install, configure | 422 | API key recusada pelo Chat Plataforma (401 ou 403 de lá) ou sem permissão `tickets:view` | "A API Key do Chat Plataforma não foi aceita..." / "...recusou a API Key..." / "A API Key não tem as permissões necessárias..." |
| install, configure, uninstall | 422 | Corpo fora do contrato ou JSON inválido | "O aplicativo recebeu dados que não reconhece..." |
| install, configure | 502 | Chat Plataforma não respondeu na validação da API key | "Não foi possível validar a API Key agora..." |
| configure | 404 | `externalId` inexistente | "Esta instalação não existe mais no aplicativo..." |
| diagnostics | 401 | JWT ausente, expirado, assinatura/escopo errados ou `externalId` diferente da URL | "Não foi possível confirmar que a chamada veio do Chat Plataforma..." |
| diagnostics | 404 | `externalId` inexistente | "Esta instalação não existe mais no aplicativo..." |
| tickets, client-logs | 401 | `x-account-id` ausente ou instalação inexistente/removida | "Este aplicativo não está mais instalado na sua empresa..." |
| tickets, client-logs | 422 | Parâmetro/corpo inválido (ex.: `ticketId` não numérico, `level` desconhecido) | "Não foi possível processar os dados enviados..." |
| tickets | 422 | Chat Plataforma recusou a consulta (400/404/409/422 de lá) | mensagem do Chat Plataforma ou "O Chat Plataforma não aceitou esta ação..." |
| tickets | 502 | Chat Plataforma fora do ar, API key revogada ou sem permissão | "Não conseguimos falar com o Chat Plataforma..." / "A integração precisa ser reconfigurada..." |
| tickets | 503 | Chat Plataforma limitou as chamadas (429) | "O Chat Plataforma está recebendo muitas solicitações..." |
| qualquer | 404 | Rota inexistente | "Recurso não encontrado no aplicativo." |
| qualquer | 500 | Erro inesperado | "Algo deu errado do nosso lado..." |

## Regenerar o `openapi.json`

Depois de mudar rotas ou schemas:

```bash
pnpm --filter api openapi:schema > docs/api/openapi.json
```

O script (`apps/api/src/scripts/print-openapi.ts`) monta o app com repositório em memória e cliente fake, sem banco nem rede. O teste `apps/api/tests/e2e/openapi.test.ts` falha se o arquivo estiver desatualizado e mostra esse comando. Ele ignora só `info.title` (o scaffold troca o título pelo nome do projeto). O `docs/api/biome.json` tira o `openapi.json` do formatador do Biome, que reformataria a saída.

# Guia da API para o Apidog

A API do projeto `iframe-name` é documentada em OpenAPI 3.0.3. O arquivo `docs/api/openapi.json` é gerado do código (rotas e schemas zod) e um teste falha se o conteúdo ficar desatualizado.

Resposta de sucesso: `{ "body": ... }`. Resposta de erro: `{ "error": { "message": "..." } }`. As mensagens são em português e as mesmas que o código devolve.

## Importar

No Apidog (passos genéricos, não verificados neste projeto): Importar dados, escolher OpenAPI/Swagger e informar uma das fontes:

- arquivo `docs/api/openapi.json`;
- URL da API rodando: `http://localhost:3333/api/docs/json` (em produção, `<url da API>/api/docs/json`).

O documento já traz `servers` (`http://localhost:3333`), as tags `tenants` e `app` e os três esquemas de segurança (`comhubKey`, `tenantId`, `userId`), todos `apiKey` em header.

## Variáveis de ambiente sugeridas

| Variável | Valor |
|---|---|
| `baseUrl` | `http://localhost:3333` (ou a URL da API) |
| `comhubKey` | valor de `APPLICATION_X_COMHUB_KEY` da API |
| `tenantId` | `id` devolvido por `POST /api/tenants` |
| `userId` | id do usuário da Zappy (qualquer texto não vazio em testes) |

## Autenticação por grupo de rotas

| Grupo | Headers | Esquema no OpenAPI |
|---|---|---|
| `tenants` (`/api/tenants`) | `x-comhub-key: {{comhubKey}}` | `comhubKey` |
| `app` (`/api/app/*`) | `x-tenant-id: {{tenantId}}` e `x-user-id: {{userId}}` | `tenantId` e `userId` (os dois juntos) |

`/api/health` e `/api/docs` não exigem header (o health fica fora do OpenAPI).

## Erros por rota

| Rota | Códigos |
|---|---|
| `POST /api/tenants` | 401 chave ausente ou errada; 409 URL já cadastrada; 422 corpo inválido (`name` ausente, vazio ou acima de 120, etc.), URL fora do formato ou token recusado; 502 instância da Zappy fora do ar |
| `GET /api/tenants` | 401 |
| `PATCH /api/tenants/:tenantId` | 401; 404 tenant inexistente; 422 corpo inválido |
| `DELETE /api/tenants/:tenantId` | 401; 404 |
| `GET /api/app/connections` | 400 faltou `x-tenant-id` ou `x-user-id`; 403 tenant inativo; 404 tenant inexistente; 502 Zappy indisponível |
| `GET /api/app/tickets/:ticketId` | 400; 403; 404 tenant ou atendimento inexistente; 422 `ticketId` não numérico; 502 |
| `POST /api/app/client-logs` | 400; 403; 404; 422 corpo inválido |

## Exemplos com curl

Valores de exemplo: API em `http://localhost:3333`, chave `$COMHUB_KEY`, tenant `$TENANT_ID`. Os exemplos de sucesso e os erros 401, 400, 403, 404 e 409 foram executados contra a API com repositório em memória e a Zappy simulada. Os erros 422 de URL e token recusado e o 502 de `POST /api/tenants` dependem da Zappy real e estão cobertos pelos testes (`apps/api/tests/e2e/tenants.test.ts`).

Cadastrar (201, devolve `id`, `name`, `zappyUrl`, `active`, `createdAt`, `updatedAt`; nunca o token):

```bash
curl -X POST http://localhost:3333/api/tenants \
  -H "x-comhub-key: $COMHUB_KEY" -H 'content-type: application/json' \
  -d '{"name":"Escritório Exemplo","zappyUrl":"https://api-exemplo.zapcontabil.chat","zappyToken":"<token de API>"}'
```

Listar:

```bash
curl http://localhost:3333/api/tenants -H "x-comhub-key: $COMHUB_KEY"
```

Desativar ou reativar (`{"body":{"id":"...","active":false}}`):

```bash
curl -X PATCH http://localhost:3333/api/tenants/$TENANT_ID \
  -H "x-comhub-key: $COMHUB_KEY" -H 'content-type: application/json' \
  -d '{"active":false}'
```

Remover (`{"body":{"id":"..."}}`):

```bash
curl -X DELETE http://localhost:3333/api/tenants/$TENANT_ID -H "x-comhub-key: $COMHUB_KEY"
```

Conexões da empresa (`{"body":[{"id":1,"name":"Comercial","status":"CONNECTED"}]}`):

```bash
curl http://localhost:3333/api/app/connections \
  -H "x-tenant-id: $TENANT_ID" -H 'x-user-id: 7'
```

Atendimento:

```bash
curl http://localhost:3333/api/app/tickets/9001 \
  -H "x-tenant-id: $TENANT_ID" -H 'x-user-id: 7'
```

Log do frontend (`{"body":{"received":true}}`):

```bash
curl -X POST http://localhost:3333/api/app/client-logs \
  -H "x-tenant-id: $TENANT_ID" -H 'x-user-id: 7' -H 'content-type: application/json' \
  -d '{"level":"error","message":"Falha ao carregar a tela","context":{"screen":"home"}}'
```

Observação: o OpenAPI lista as rotas de tenants com barra final (`/api/tenants/`); a API responde nas duas formas, com e sem a barra.

## Regenerar

Depois de mudar rotas ou schemas:

```bash
pnpm --filter api openapi:schema > docs/api/openapi.json
pnpm exec biome format --write docs/api/openapi.json
```

O segundo comando só aplica a formatação do Biome (o lint do repositório confere o JSON); o conteúdo não muda.

O script (`apps/api/src/scripts/print-openapi.ts`) sobe o app com repositório em memória e uma Zappy falsa, sem banco, rede nem variáveis de ambiente. O teste `apps/api/tests/unit/openapi.test.ts` compara a saída com o arquivo commitado.

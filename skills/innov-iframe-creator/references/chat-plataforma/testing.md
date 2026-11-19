# Testes: o código é a documentação

Leia antes de escrever ou alterar testes. O que um teste garante fica no título do `describe`/`it`, nunca em comentário. Este arquivo explica a infraestrutura do harness: como simular a plataforma, quais fixtures usar e por quê.

## Princípios

1. **O título do teste é a regra de negócio.** `describe` nomeia o contrato ou a invariante (por exemplo `Janela de tolerância de 5 minutos do x-timestamp`) e `it` descreve o comportamento observável (por exemplo `responde 401 e não 422 quando a assinatura é inválida e o payload também`). Se precisar de um comentário para explicar o teste, o título está incompleto.
2. **Zero comentário em teste e em código.** Explicações de arquitetura, guias e o "porquê" ficam em `references/`. Escreva como se o código fosse lido junto com a skill. A única exceção é `// biome-ignore <regra>: <motivo>`, que o linter exige.
3. **O harness valida o contrato.** O envelope `{ body }` / `{ error: { message } }` e o status são verificados pelos matchers `toBeSuccessEnvelope(status)` e `toBeErrorEnvelope(status)`, não reimplementados em cada teste.
4. **Arrange / Act / Assert separados por linha em branco**, sem rótulos.
5. **Fixtures com nome que explica o dado.** `FIXTURE_CHAT_PLATAFORMA_TICKET_ID = '182736454928173645'` já diz que é um snowflake em string, sem precisar de comentário.
6. **Um comportamento por `it`.** Variações da mesma regra usam `it.each` com rótulo legível (por exemplo `responde 401 quando %s`).

## API (`apps/api/tests`)

Três pastas: `support/` (harness), `unit/` (sem HTTP) e `e2e/` (HTTP com supertest).

| Arquivo | Papel |
|---|---|
| `support/setup.ts` | Registra os matchers de contrato `toBeSuccessEnvelope(200 \| 201)` e `toBeErrorEnvelope(status)`. Eles exigem que o corpo tenha **apenas** a chave `body`, ou **apenas** `error.message` como string não vazia. Na falha, mostram o status e o corpo recebidos. |
| `support/vitest.d.ts` | Tipagem dos matchers. |
| `support/fixtures.ts` | Segredos, `externalId`s (conhecido e desconhecido), snowflakes do Chat Plataforma, credentials internas (original e rotacionada), `FIXTURE_INSTALL_BODY` (corpo plano indexado por `API_KEY_LABEL`, como o Backstage envia), `FIXTURE_MASKED_SECRET`, `FIXTURE_ADMIN_PERMISSIONS`, `FIXTURE_TICKET_VIEW` e `FIXTURE_PLATFORM_TICKET_RESPONSE` (resposta crua da plataforma no envelope `{ message, body }`, com `hashPassword` do agente para provar que a projeção descarta), `MINUTE_MS` e a regex `UUID_V4`. |
| `support/helpers.ts` | `makeApp()`, `generateHarnessSignature()` e `generateDiagnosticsToken()`. |
| `unit/infrastructure/use-cases/use-cases.test.ts` | Use cases testados sem HTTP: `createMemoryRepository`, client fake e um `RequestContext` que grava os logs (`recordingContext()`). É onde a regra de negócio é documentada. |
| `unit/core/utils/diagnostics.test.ts` | Código puro do core (agregação do status do diagnóstico). |
| `unit/architecture.test.ts` | Lê os imports de `src/` e falha se uma camada violar a regra de dependência (core importando infrastructure/presentation/server/fastify/Prisma, presentation importando infrastructure, controller importando repository, Prisma fora do repository). Ver `references/chat-plataforma/architecture.md` §3. |
| `unit/infrastructure/infra.test.ts` | Config do MySQL a partir do `DATABASE_URL` (senha com URL-encode, porta padrão, TLS × `allowPublicKeyRetrieval`) e variáveis de ambiente do banco. |
| `e2e/*.test.ts` | Uma suíte por contrato: `provision` (corpo plano por value, configure parcial com máscara, validação da API key, uninstall idempotente, HMAC), `diagnostics` (JWT), `app` (rotas do iframe, cliente do Chat Plataforma: envelope, projeção, mapeamento 401/403/429/4xx/5xx/rede; cifra das credentials), `observability` (`requestId`, mensagens sem detalhe técnico, campos de busca, eventos, ausência de credentials no log) e `health` (`/api/health`). |

### `makeApp(fakes?)`

Sobe o `buildApp` real (`server/bootstrap.ts`) com o repositório em memória e um cliente do Chat Plataforma falso (key de admin por padrão, ticket = `FIXTURE_TICKET_VIEW`). Os métodos do cliente podem ser sobrescritos, por exemplo `makeApp({ getTicket: async (id) => ... })`; para simular a plataforma recusando, lance `new ChatPlataformaError(502, msg, 401)`. Não usa MySQL nem rede. Devolve:
- `install(externalId?, credentials?)`: cria uma instalação direto no repositório. Use como *arrange*.
- `postSigned(path, payload, { timestamp?, secret?, signature? })`: faz o POST assinado como o Backstage faria. No install o payload é o objeto plano (`FIXTURE_INSTALL_BODY`), nunca `{ credentials }`.
- `postSignedRaw(path, rawBody, signedBody)`: envia um corpo diferente do que foi assinado.
- `getDiagnostics(externalId, authorization?)`, `getFromIframe(path, accountId?)` e `postFromIframe(path, payload, accountId)`.
- `logs` (todas as entradas JSON do pino) e `logsFor(requestId)` (só as da requisição): o logger real do app escreve num stream em memória, então dá para afirmar o que vai para o Axiom.
- `clientCalls`: cada `clientFor(credentials, options)` feito pelo app, para afirmar que as credentials certas, o `requestId` e o timeout chegaram ao cliente.
- `http` (supertest), `repo` e `app`, para os casos que fogem dos atalhos.

### Simulando a assinatura HMAC do Backstage

`generateHarnessSignature(rawBody, options)` devolve os headers `x-timestamp` e `x-signature`. A assinatura é `hex(HMAC-SHA256(segredo, "<timestamp>:<rawBody>"))`, com o timestamp em milissegundos.
- **Assine a mesma string que será enviada.** O `postSigned` serializa o payload uma única vez e usa essa string tanto para assinar quanto como corpo. Não monte a assinatura a partir de outra serialização do objeto, porque espaços ou ordem de chaves diferentes mudam os bytes e o HMAC deixa de bater. O teste `responde 401 quando o corpo enviado difere byte a byte do corpo assinado` prova isso.
- **Janela de 5 minutos:** passe `timestamp: Date.now() ± n * MINUTE_MS`. A suíte cobre −4 min (aceita), −6 min e +6 min (recusam). Não use fake timers, porque o servidor compara com o relógio real.
- **Segredo errado e assinatura malformada:** use as opções `secret: FIXTURE_OTHER_SECRET` e `signature: '...'`.
- **401 vence 422:** o HMAC roda no `preValidation`, antes do zod. Há um teste com payload inválido e assinatura inválida que espera 401.

### Gerando o Bearer JWT do diagnóstico

`generateDiagnosticsToken(claims, { secret?, expiresIn? })` assina em HS256 com o segredo da fixture. As claims válidas são `{ scope: 'diagnostics:read', externalId }`. Os casos de 401 ficam numa única tabela `it.each`: header ausente, formato diferente de `Bearer`, scope errado, `externalId` da claim diferente do da URL, outro segredo e token expirado (`expiresIn: '-1m'`).

### IDs snowflake

As fixtures de IDs do Chat Plataforma são **strings** de 18 dígitos. Os testes verificam que o ID chega intacto onde importa: no path do cliente (`/v1/tickets/182736454928173645`) e no fake que recebe o ID. Nunca use `Number(...)` em fixture nem em asserção. Em tabelas próprias, o teste de persistência compara a string devolvida pelo repositório com a fixture (ver `references/chat-plataforma/database.md`).

### O que todo endpoint novo precisa cobrir

- caso de sucesso com `toBeSuccessEnvelope` e o conteúdo de `body`;
- 401 de autenticação: assinatura/token nas rotas da plataforma, `x-account-id` nas rotas do iframe;
- se houver evento de negócio, o log com `event` e os campos de busca (`logsFor(res.headers['x-request-id'])`);
- 422 de validação;
- 404 quando o recurso não existe;
- erro de dependência (Chat Plataforma, sistema externo) refletido como 502 ou no diagnóstico.
- use case novo: um teste por regra em `tests/unit/infrastructure/use-cases/` (`use-cases.test.ts` ou `<acao>.use-case.test.ts` quando crescer), sem HTTP.
- método novo no cliente do Chat Plataforma: teste com `fetcher` falso respondendo o envelope real `{ message, body }`, provando o path exato e que campos fora do schema (dados sensíveis) não passam.
- campo novo de credencial: install com o value, configure parcial (ausente e `••••••••` mantêm o valor) e 422 citando o label.

## Web (`apps/web/test`)

Vitest + Testing Library em jsdom (`vitest.config.ts`, `test/setup.ts` com `@testing-library/jest-dom/vitest`).

| Arquivo | Papel |
|---|---|
| `fixtures.ts` | `FIXTURE_IFRAME_SEARCH`, a query string completa que a plataforma envia, com snowflakes em string. |
| `harness.tsx` | `renderIframeApp(search?)` coloca a query na URL, renderiza o `<App />` e devolve `user` (user-event), `initialHref` e `initialHistoryLength`. `stubBackend(route)` substitui o `fetch` e registra as chamadas (path e headers). |
| `app.test.tsx` | Navegação em memória, contexto, comunicação com o backend e estados de erro/retry. |
| `error-feedback.test.tsx` | Mensagens amigáveis em toast e Alert: sem requestId nem código, erro de rede vira mensagem de conexão, retry funciona. |
| `context.test.ts`, `navigation.test.ts`, `query-client.test.ts` | Regras puras: parâmetros do iframe, pilha de telas e política de retry. |

- **Navegação:** o teste aciona o botão que despacha uma nova `Screen` e verifica a tela nova **e** que `window.location.href` e `history.length` não mudaram. Isso documenta que nenhuma tela usa roteador ou `pushState`.
- **Consultas acessíveis:** `getByRole('button', { name: ... })` e `findByText`, que também validam acessibilidade (o `IconButton` precisa de `aria-label` para ser encontrado).
- **Backend:** `stubBackend` responde no envelope real (`{ body }` ou `{ error: { message } }` com status). Para testar o retry da UI, use 4xx, que a política não repete, e responda sucesso na tentativa seguinte.
- Tela nova = teste de render + navegação de ida e volta. Hook de dados novo = cenário de sucesso e de erro via `stubBackend`.

## Rodando

`pnpm test` (turbo, todos os pacotes) · `pnpm --filter api test` · `pnpm --filter web test` · `pnpm --filter web exec vitest` (watch).

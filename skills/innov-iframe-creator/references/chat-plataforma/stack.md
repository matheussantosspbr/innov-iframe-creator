# Stack e convenções do template

Leia quando for estender o template (nova feature, tela, credencial, tabela, deploy).

## Sumário
1. Stack
2. Princípios (KISS/YAGNI/DRY/SOLID na medida)
2.1 Enumerados e imutabilidade
3. Node 24 com TypeScript nativo
4. Como adicionar uma feature
5. Front: tela única com navegação por componentes
6. Credenciais
7. Banco (Prisma 7 + MySQL)
8. Testes
9. Turbo, Biome, Lefthook
10. Containers, CI e CD (Coolify)
11. Segurança
12. Mapa do código
13. Variáveis de ambiente

## 1. Stack

Node 24 LTS (TS nativo) · pnpm 12 workspaces + Turborepo · Fastify 5 · fastify-type-provider-zod + Zod 4 · @fastify/swagger(+ui) · Prisma 7 (adapter `@prisma/adapter-mariadb`, MySQL 8) · React 19 + Vite 8 · TanStack Query 5 · **InnovUI (`@innovui/react`, design system da Comhub)** + Tailwind v4 (só layout) · Vitest 5 + Supertest · TypeScript 7 · Biome 2 · Lefthook 2 · Docker (1 container por app) · GitHub Actions + webhooks do Coolify · Axiom (logs). Quando necessário: `jose` (JWT), `argon2` (hash de senha própria — raro), Resend (e-mail), Langfuse (IA) → `references/chat-plataforma/observability-and-integrations.md`.

Versões do `pnpm-lock.yaml` (nov/2026) foram verificadas juntas: lint, typecheck, testes (92 da API, 30 do web, 37 do shared), build do web com Vite 8, imagens da API e do web e a API rodando em Node 24 (24.21) atrás do nginx 1.31 contra MySQL 8.4 e Redis 8. São as últimas versões compatíveis com Node 24 e **com mais de 24 h de publicação**: o pnpm 12 recusa (`ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION`) lock com versão publicada há menos de um dia, então ao atualizar use `pnpm update -r --latest` e, se o `pnpm install --frozen-lockfile` acusar a violação, baixe esse pacote para a versão anterior (ela passa depois de 24 h). Exceções de propósito: `@types/node` fica em `^24` (a 26 descreve APIs que o Node 24 não tem) e o `prisma` fica na 7 (a 8 ainda é release candidate).

## 2. Princípios

- **Código sem comentários.** Nomes, tipos, schemas zod e títulos de teste documentam o comportamento; arquitetura, decisões e guias ficam em `references/` (o mapa do código está na seção 12). Exceções: `// biome-ignore <regra>: <motivo>` (exigido pelo linter) e a descrição de cada variável no `.env.example` (documentação de operação). Dockerfiles, nginx, compose de dev e CI também ficam sem comentários — explicados na seção 10.

Apps de iframe costumam ser pequenos: uma tela (com sub-telas), poucas rotas, uma ou duas integrações.
- **Tempo real e dependências:** escada de complexidade em `references/chat-plataforma/realtime.md`; análise obrigatória antes de instalar em `references/chat-plataforma/dependencies.md`.
- **KISS/YAGNI:** Clean Architecture enxuta (core, infrastructure, presentation, server; HTTP → controller → use case → repository/client, `references/chat-plataforma/architecture.md`), sem DDD completo. Peça sem trabalho não existe (o `client-logs` não tem use case). Extraia função só na segunda utilização. Não adicione lib (router, state manager, UI kit) sem necessidade concreta.
- **DRY:** o schema zod é a fonte única: valida a entrada e gera o Swagger. `CREDENTIAL_FIELDS` é a fonte única das credenciais (gera o `{ fields }` do Backstage e mapeia label → chave interna). Tipos front/back em `packages/shared`.
- **SOLID na medida:** dependências entram pelas fábricas (`createXUseCase({ installations, clientFor })`), tipadas por interfaces do `core/`, e são montadas no `server/bootstrap.ts`; os pontos de troca nos testes são o repository (versão em memória) e o `clientFor` (fake da API do Chat Plataforma). Integração externa nova segue o padrão: contrato em `core/repository/<sistema>-client.interface.ts` e `infrastructure/libs/<sistema>/client.ts` com `createXClient({...credentials})`, injetado pelo `bootstrap.ts`.

### Enumerados e imutabilidade

**Enumerados = `Object.freeze({ ... } as const)` + tipo derivado.** Nunca `enum` do TS (o `erasableSyntaxOnly` já proíbe) nem union de strings solta repetida em vários arquivos.

```ts
export const DIAGNOSTIC_STATUS = Object.freeze({
  operational: 'operational',
  degraded: 'degraded',
  outage: 'outage',
} as const)
export type DiagnosticStatus = ValueOf<typeof DIAGNOSTIC_STATUS>

z.enum(DIAGNOSTIC_STATUS)
if (status === DIAGNOSTIC_STATUS.outage)
```

`ValueOf` vem de `@app/shared`. O zod 4 aceita o objeto em `z.enum`, então validação e tipo saem da mesma fonte. O uso é sempre pela constante, nunca pela string.

- `as const` dá os literais exatos (tipagem forte); `Object.freeze` garante em runtime que ninguém altera o objeto.
- Nome em `UPPER_SNAKE_CASE`, chaves em camelCase, valores = o que trafega/persiste (`'chatplataforma-api'`, `'installation.installed'`).
- Onde moram: compartilhados front/back em `packages/shared` (`HEADERS`, `CLIENT_LOG_LEVEL`); da API junto do domínio (`DIAGNOSTIC_STATUS`/`DIAGNOSTIC_COMPONENT` em `core/utils/diagnostics.ts`, `LOG_EVENT` em `core/utils/log-events.ts`, `RUNTIME_ENV`/`LOG_LEVEL` em `config/env.ts`, `USER_MESSAGES`/`ADMIN_MESSAGES` em `core/utils/messages.ts`, `CREDENTIAL_FIELDS`/`CREDENTIAL_TYPE` em `core/utils/credentials.ts`, `REQUIRED_PERMISSIONS` em `infrastructure/libs/chatplataforma/permissions.ts`); compartilhados também `TICKET_STATUS`/`TICKET_PRIORITY`; do front em `lib/` (`SCREEN`, `NAVIGATION_ACTION`, `FRONT_MESSAGES`, `QUERY_KEYS`).
- Testes usam as mesmas constantes (`expect(status).toBe(DIAGNOSTIC_STATUS.degraded)`): renomear um valor não deixa teste desatualizado passando.
- Status no banco: coluna `VARCHAR(n)` + `z.enum(CONSTANTE)` na borda (ver `references/chat-plataforma/database.md`).

**Imutabilidade: o tipo resolve quase tudo; `Object.freeze` só onde o tipo não alcança.**

Com TypeScript estrito, `Readonly<...>`, `readonly T[]` e `as const` já impedem a mutação em tempo de compilação, sem custo. `Object.freeze` só acrescenta proteção em runtime, então ele entra só onde um objeto é **compartilhado por referência** entre muitas partes do código e uma mutação viraria bug silencioso. Regra prática:

| Situação | Use | Exemplo no template |
|---|---|---|
| Constante de módulo (enumerado, catálogo, mensagens) | `Object.freeze({...} as const)` | `DIAGNOSTIC_STATUS`, `LOG_EVENT`, `USER_MESSAGES`, `CREDENTIAL_FIELDS`, `REQUIRED_PERMISSIONS`, `SCREEN`, `QUERY_KEYS` |
| Dado compartilhado entre camadas e requisições | `Object.freeze` no ponto de criação | `freezeInstallation` no repository: a mesma instalação (com as credentials) passa por middleware, controller, use case e client, e o repositório em memória guarda a referência |
| Dado vindo de fora, validado na borda | `.readonly()` do zod (congela de graça no parse) | `iframeContextSchema`, `envSchema` |
| Retorno de factory (use case, controller, client, `createApi`) | só o tipo | não congele: ninguém reatribui método, e o tipo já acusa |
| DTO por requisição, resultado de função, estado de reducer | só o tipo (`Readonly`, `readonly T[]`) | `DiagnosticReport`, `RequestContext`, `ScreenStack` |
| Objeto entregue a biblioteca | nunca congele | schemas de rota (o Fastify escreve neles), config do driver do banco, opções do BullMQ |

- Reducers e atualizações de estado continuam sem mutação, garantida pelo tipo `readonly` e pelo teste (o teste congela a entrada; se o reducer mutasse, lançaria erro). Use spread (`{ ...obj, campo }`) e `toSorted`/`toSpliced`/`with` em vez de `sort`/`splice`/atribuição por índice.
- Exceção de tipo: `credentialsSchema` não leva `.readonly()`; o tipo `Credentials` é `Readonly<...>`.
- `Object.freeze` é raso: num catálogo aninhado, congele cada nível que for compartilhado (como em `CREDENTIAL_FIELDS`).
- Teste de contrato com `Object.isFrozen(...)` só onde o freeze é intencional (a instalação do repository).

## 3. Node 24 com TypeScript nativo

A API roda `node src/server/server.ts` direto (type stripping nativo, estável no Node 24): sem tsx, sem tsup, sem build. Regras para isso funcionar:
- **Imports relativos com extensão `.ts`** (`import { ok } from '../errors/api-error.ts'`; entre camadas, o alias `#src/*`: `import { AppError } from '#src/core/utils/app-error.ts'`). `allowImportingTsExtensions` está ligado.
- **Só sintaxe apagável** (`erasableSyntaxOnly`): nada de `enum` (use union de strings ou objeto `as const`), `namespace`, parameter properties (`constructor(private x)`) ou `import x = require()`. O `tsc` acusa.
- **`import type`** para tipos (`verbatimModuleSyntax`); o Biome corrige.
- O client do Prisma é gerado com `importFileExtension = "ts"` e roda nativo também.
- `node --watch` substitui o tsx em dev; `--env-file-if-exists=.env` carrega o `apps/api/.env`.
- O front continua com Vite (build para estáticos), que aceita os mesmos imports `.ts/.tsx`.

## 4. Como adicionar uma feature

> **Exemplo ilustrativo:** a feature `add-vip-tag` e os arquivos dela citados abaixo **não existem no template**. Crie só quando o app precisar, nas camadas indicadas.

A API segue Clean Architecture (HTTP → controller → use case → repository/client). O passo a passo do backend está em `references/chat-plataforma/architecture.md` §5. Exemplo de ponta a ponta: "botão que adiciona a tag VIP ao contato do ticket".
1. **Endpoint da plataforma:** confira em `references/chat-plataforma/api/routes.md` e no arquivo do domínio (`PUT /v1/contacts/:contactId/tags` substitui a lista inteira e recebe IDs; para só adicionar, `POST /v1/tags/:tagId/contacts`). Inclua a permissão necessária (`tags:update`) em `REQUIRED_PERMISSIONS`.
2. **Integração:** método em `apps/api/src/infrastructure/libs/chatplataforma/client.ts` (e no contrato `apps/api/src/core/repository/chat-plataforma-client.interface.ts`). Leitura → `requestParsed(schema, ...)` com um schema zod só dos campos usados (descarta o resto); escrita sem retorno útil → `request(...)`. O cliente já devolve só o `body` do envelope da plataforma.
3. **Use case e HTTP:** interface em `core/use-cases/add-vip-tag-use-case.interface.ts`, implementação em `infrastructure/use-cases/add-vip-tag.use-case.ts` (busca a tag VIP, aplica, registra `LOG_EVENT`) e, em `presentation/`, `schemas`, `controller` e `routes`; ligue no `server/bootstrap.ts` e registre as rotas no bloco do iframe (`/api/app/...`). Erros: `throw new AppError(status, USER_MESSAGES.x, { cause })`.
4. **Front:** método em `apps/web/src/lib/api.ts`, hook de mutation e tela em `apps/web/src/screens/`, registrada na navegação (seção 5).
5. **Teste:** contrato HTTP com `makeApp({ metodoFake })` e os matchers; regra do use case com fakes em `apps/api/tests/unit/infrastructure/use-cases/`; tela e hooks em `apps/web/test` com Testing Library (ver `references/chat-plataforma/testing.md`).

Dados próprios (histórico, configurações por organização): model Prisma com `installation_id` → FK para `installations.id` com `onDelete: Cascade` (o uninstall limpa tudo), acessado só pelo repository em `infrastructure/repository/` (interface em `core/repository/`). Siga `references/chat-plataforma/database.md`.

## 5. Front: tela única, navegação por componentes

O iframe carrega `rootUrl?accountId=…&ticketId=…`. **A URL não muda durante a sessão**: nada de react-router, `history.pushState`, `<a href>` interno ou `window.location`. Trocar a URL/recarregar arrisca perder os parâmetros do atendimento e o estado.
- `readIframeContext()` lê e valida a query **uma vez** no boot; `AppContextProvider` disponibiliza `{ ctx, api }` via `useAppContext()`.
- `lib/navigation.tsx`: pilha de telas em memória (`useReducer`). `useNavigation()` → `{ screen, push, back, reset, canGoBack }`.
- Nova tela: (1) variante no tipo `Screen` (com os parâmetros dela, ex: `{ name: 'pedido'; pedidoId: string }`), (2) componente em `screens/`, (3) `case` em `CurrentScreen` (`App.tsx`). O `switch` exaustivo faz o TS acusar tela sem case.
- "Voltar" é `back()` (botão `.link`), não o histórico do navegador.
- Layout 384px fixo: coluna única (`Stack`), `overflow-x: hidden`, textos longos com `wrap-anywhere`, botões principais `className="w-full"`, `List`/`Card` em vez de `Table` larga. Os breakpoints do InnovUI/Tailwind (`md:` ≥768px) nunca disparam no iframe — projete só o layout base.
- O front fala só com o próprio backend (`/api/app/*`, mesma origem via nginx), com header `x-account-id`. Nunca chama `api.chatplataforma.com.br` direto.
- Erros: `ErrorBoundary` reporta para `/api/app/client-logs` (→ Axiom); em catch de fetch use `api.log('warn', …)`.
- Dev: `pnpm dev` + `CHATPLATAFORMA_TEST_API_KEY=<key de teste> pnpm --filter api dev:install` imprime a URL com `accountId` válido; devtools em 384px.

### Composição (onde fizer sentido)

Prefira compor peças pequenas a criar componentes "configuráveis" com muitas props. Aplique quando houver ganho real (YAGNI): estrutura repetida em 2+ telas, componente com partes opcionais, ou lista de props crescendo (>~5, ou booleanas do tipo `showX`/`hideY`). Componente simples e usado uma vez continua simples.
- **Compound components** (objeto de partes): `Screen.Root / Screen.Header / Screen.Body / Screen.Footer` em `src/components/Screen.tsx` é o padrão de toda tela. Cada tela monta só as partes que usa; o Header mostra "Voltar" sozinho quando há tela anterior e aceita `actions`; o Footer empilha ações em largura total. Para novas peças compostas, siga o mesmo formato: `export const X = { Root, Item, ... }`. Se as partes precisarem compartilhar estado (ex: lista selecionável), o `Root` cria um Context local e as partes leem dele — não passe props por vários níveis.
- **Children/slots em vez de props de configuração:** `<Screen.Header actions={<IconButton …/>} />` em vez de `showRefresh`/`onRefresh`; conteúdo como `children` em vez de `items={[…]}` quando cada item tem layout próprio.
- **Composição de lógica com hooks:** dados ficam em hooks de feature (`src/hooks/use-<coisa>.ts`, sobre TanStack Query — ver abaixo), visual fica na tela: a tela decide `Skeleton` (`isPending`) / `Alert` com "Tentar de novo" (`isError` + `refetch`) / conteúdo (`isSuccess`). Hooks não renderizam nada.
- **Compor com o InnovUI, não reimplementar:** a biblioteca já é composta (`Accordion` + `AccordionItem`, `Modal` + `ModalClose`, `Menu` + `MenuItem`, `Field` + controle). Componentes do app envolvem/combinam esses, nunca recriam visual.
- Componentes de feature ficam junto da tela (`screens/<feature>/…`) até serem reutilizados; só então sobem para `components/`.

### Dados no front: TanStack Query

Todo dado vindo do backend passa pelo TanStack Query (`@tanstack/react-query` v5) — nada de `useEffect` + `useState` para fetch. Por que vale aqui: a navegação é em memória, então voltar para uma tela reaproveita o cache em vez de refazer a chamada; mutations (aplicar tag, salvar nota) invalidam as queries afetadas sem estado manual; retry, dedup de chamadas iguais e refetch ao voltar o foco para o iframe vêm prontos.
- `lib/query-client.ts`: um `QueryClient` por sessão do iframe com `staleTime: 30s`, retry 1x só para rede/5xx (4xx não repete — `ApiRequestError` carrega o status), mutations sem retry, e erros de query/mutation logados num lugar só (→ `/api/app/client-logs` → Axiom). Não repita log nas telas.
- Hook de feature = `queryOptions` + hook fino (ex: `hooks/use-ticket.ts`): chave começa pelo recurso (`['ticket', id]`, `['contact', id, 'tags']`); o mesmo `queryOptions` serve para `invalidateQueries`/`prefetchQuery`.
- Mutations: `useMutation` no hook da feature; no `onSuccess`, invalide as chaves afetadas e dê feedback com `useToast()` (exemplo supondo `setContactTags` em `lib/api.ts` e a rota correspondente no backend):

```ts
export const useSetContactTags = (contactId: string) => {
  const { api } = useAppContext()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const showError = useErrorToast()
  return useMutation({
    mutationKey: ['contact', contactId, 'tags', 'set'],
    mutationFn: (tags: string[]) => api.setContactTags(contactId, tags),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact', contactId, 'tags'] })
      toast({ status: 'success', description: 'Tags atualizadas' })
    },
    onError: (e) => showError(e, 'Não foi possível atualizar as tags'),
  })
}
```
- **Erro na UI sempre pelos componentes de erro do app**, nunca `error.message` cru: `ErrorAlert` para estado de tela (query) e `useErrorToast()` para ação (mutation). Ambos usam `friendlyMessage()` (mostra a mensagem do backend como está; troca erro de rede por mensagem de conexão). Nenhum código/ID de erro aparece na UI (decisão para público leigo). Mensagens novas para o atendente: linguagem simples + o que fazer, em `USER_MESSAGES` (API) ou `FRONT_MESSAGES` (web). Padrão completo em `references/chat-plataforma/observability-and-integrations.md` ("Erros para usuário leigo"). Toast de sucesso continua com `useToast()` direto.
- Botões de ação usam `loading={mutation.isPending}`; o "Atualizar" do cabeçalho usa `loading={query.isFetching}` + `refetch()`.
- Estado de UI (aba aberta, texto digitado, tela atual) fica em `useState`/navegação — TanStack Query é só para estado do servidor.
- Devtools (`@tanstack/react-query-devtools`) só se precisar depurar; não vem no template.

### Design system: InnovUI (`@innovui/react`)

Toda tela usa a biblioteca de componentes da casa. Se a skill `innovui-react` estiver disponível, carregue-a; o essencial:
- Já instalado no template, com CSS importado **uma vez** em `src/styles.css`, **antes** do Tailwind: `@import "@innovui/react/styles.css"; @import "tailwindcss";`. As classes internas usam prefixo `iu:` (sem colisão).
- Importe tudo de `@innovui/react` (inclusive subcomponentes). Antes de usar um componente, confira as props em `https://innovui.innovtechsolutions.com.br/react/components/<nome>/` (doc inteira: `https://innovui.innovtechsolutions.com.br/_llms-txt/react.txt`) ou nos `.d.ts` do pacote — não adivinhe.
- Mapa típico de um app de iframe: ações → `Button`/`IconButton` (com `aria-label`); formulários → `Field` + `Input`/`Textarea`/`Select`/`Combobox`/`Switch`/`DatePicker`; dados → `Card`, `List`, `Badge`, `Tag`, `Avatar`, `Accordion`; feedback → `Alert` (erros/estados), `Toast` via `useToast()` (o `ToastProvider` já está no `App.tsx`), `Skeleton`/`Spinner` (carregando); sub-navegação → `Tabs`/`SegmentedControl`; sobreposições → `Modal`, `Drawer`, `Popover`, `Menu`, `Tooltip`; layout → `Stack`, `Divider`.
- Estilo extra só via `className` (é mesclado e vence o interno). Cor só por token (`text-(--color-text-secondary)`, `bg-(--color-surface-primary)`), **nunca hex**; para mudar tema, sobrescreva a variável CSS depois do import da lib.
- **Cor da marca (só migração):** a cor principal do sistema de origem entra em `apps/web/src/styles.css`, depois do import do InnovUI, sobrescrevendo os tokens (o InnovUI define claro em `:root` e escuro em `.dark, [data-theme=dark]`; sobrescreva nos dois): `--color-interactive-primary`, `--color-interactive-primary-hover`, `--color-button-primary-bg`, `--color-button-primary-bg-hover`, `--color-button-primary-bg-active`, `--color-button-primary-text`, `--color-border-focus`, `--color-selection-bg-selected`, `--color-selection-border-selected`, `--color-selection-focus-ring`, `--color-selection-toggle-track-on-hover`. Hover e ativo são a cor mais escura (claro) ou mais clara (escuro). No escuro use uma variante mais clara da marca. O hex só aparece nesse bloco; nos componentes, só token. Não verifiquei se a lista cobre todo componente do InnovUI 1.1.5; confira no `styles.css` da lib quando adicionar um componente novo.
- Modo escuro: `class="dark"` ou `data-theme="dark"` no `<html>` (o InnovUI não segue `prefers-color-scheme`). O Chat Plataforma não informa o tema pela URL do iframe, então o padrão é claro.
- **Ícones: Lucide (`lucide-react`)**, já instalado. Importe só o ícone usado (`import { RefreshCw } from 'lucide-react'`; tree-shaking). Tamanho por prop (`size={16}` em botões `sm`/`md`, `18` ao lado de títulos), cor herdada (`currentColor`) ou por token via `className` (`text-(--color-text-brand)`), nunca hex. Em `Button` use `leadingIcon`/`trailingIcon`; botão só com ícone é `IconButton` com `aria-label` (o ícone em si fica decorativo — o Lucide já põe `aria-hidden`). Ícone ao lado de texto que pode quebrar: `className="shrink-0"`. Não misture outra lib de ícones nem SVG solto copiado.
- Precisa de algo que a lista não tem? HTML + Tailwind normais — não invente componente "do InnovUI".
- Acessibilidade vem pronta (teclado, foco, ARIA): não remova.

## 6. Credenciais

Toda credencial **por organização** entra em `CREDENTIAL_FIELDS` + `credentialsSchema` (`apps/api/src/core/utils/credentials.ts`) e chega no install/configure indexada pelo **label**. Normalmente é só a **API key do Chat Plataforma** (header `x-api-key`); some outras só se o app integrar com sistema do cliente (ERP, CRM…). Chaves da nossa infra (Axiom, Resend, Langfuse, Redis) são env vars.
- `pnpm --filter api credentials:schema` → cole o `{ "fields": [...] }` no campo `credentialsSchema` do app no Backstage. Contrato completo em `references/chat-plataforma/integration-contract.md`.
- O install e o configure testam a API key e as `REQUIRED_PERMISSIONS`; key recusada ou sem permissão vira 422 com mensagem para o admin.
- A organização pode **revogar a API key a qualquer momento**: o cliente converte 401 em "reconfigure a integração", o diagnóstico marca `chatplataforma-api` como `outage` e o front mostra a mensagem.
- Credentials ficam cifradas (AES-256-GCM, `APPLICATION_ENCRYPTION_KEY`) e nunca vão ao front nem aos logs.

## 7. Banco (Prisma 7)

Convenções completas (snake_case, tipos/tamanhos, nomes de constraints, FKs em cascata, snowflakes como BIGINT) em `references/chat-plataforma/database.md` — leia antes de criar model.
- Client gerado em `node_modules/@prisma/client` (generator `prisma-client-js`, sem `output`; não há pasta `generated` no projeto), regenerado por `dev`/`test`/`typecheck`/Dockerfile e importado como `@prisma/client`.
- `prisma.config.ts` carrega o `.env` da API (`apps/api/.env`) em dev (Prisma 7 não lê `.env` sozinho).
- `new PrismaClient({ adapter: new PrismaMariaDb(mariaDbConfigFrom(env.DATABASE_URL, …)) })`. O `@prisma/adapter-mariadb` é o adapter oficial do Prisma 7 para MySQL **e** MariaDB (não existe `adapter-mysql`). `infrastructure/libs/database.ts` monta o config a partir da URL para ligar o que o MySQL 8 exige (ver `references/chat-plataforma/database.md`, "Produção"). Não passe a URL crua ao adapter.
- Migrations: `pnpm --filter api db:migrate --name <verbo_objeto>`; revise o SQL e **comite `prisma/migrations`**. O container roda `prisma migrate deploy` antes de subir o servidor; sem a pasta comitada ele não cria nada e a API cai no primeiro acesso ao banco.

## 8. Testes

Harness, matchers de contrato, fixtures e o que cada endpoint/tela precisa cobrir: `references/chat-plataforma/testing.md`. Regra de ouro: o título do `it` é a documentação; nada de comentário em teste.

## 9. Turbo, Biome, Lefthook

- **Turbo vale aqui por 3 motivos concretos:** (1) `turbo prune <app> --docker` gera o contexto mínimo de cada Dockerfile (só o app + `packages/shared` + lockfile podado → imagens menores e cache de layer por app); (2) `turbo run … --affected` diz quais apps mudaram considerando dependências (mudar `packages/shared` redeploya os dois; mudar só o web não toca a API) — base do CD independente; (3) cache de lint/typecheck/test local e no CI. Sem isso teríamos que manter filtros de path manuais.
- Turbo 2 roda tasks em *strict env mode*: variáveis de ambiente não declaradas não chegam às tasks. Os scripts já leem o `.env` por conta própria (`--env-file-if-exists`, `prisma.config.ts`); se uma task precisar de env do shell, declare em `turbo.json` (`env`/`passThroughEnv`).
- `pnpm lint` (`biome check .`), `pnpm lint:fix`. Pre-commit em `lefthook.yml`, em paralelo: Biome com `--write` só nos arquivos staged (`{staged_files}`), re-adicionando ao commit o que corrigiu (`stage_fixed: true`), e `pnpm typecheck`. Erro que o Biome não corrige sozinho ou erro de tipo bloqueia o commit.
- Lefthook instala os hooks via `prepare` (`lefthook install || true`, para não quebrar o install `--prod` no Docker, onde ele não existe); precisa de `git init` antes do `pnpm install`. O `postinstall` do pacote fica desligado (`lefthook: false` em `allowBuilds` no `pnpm-workspace.yaml`): o `prepare` faz o mesmo sem liberar script de terceiro. O binário vem por `optionalDependencies` por plataforma, sem download.
- **CI e Docker (verificado):** no GitHub Actions o `prepare` instala os hooks no checkout, mas nada é commitado lá, então eles nunca rodam; a validação do CI são os passos `lint`, `typecheck`, `test` e `build`. No build do web (install completo, sem `.git` no contexto) o Lefthook imprime "not a git repository" e o `|| true` segue; no da API (`--prod`) ele nem está instalado. As três instalações terminam com código 0.
- Para pular os hooks numa emergência: `LEFTHOOK=0 git commit ...`. Hook novo (ex.: `pre-push` com `pnpm test`) entra no mesmo `lefthook.yml`.

## 10. Containers, CI e CD (Coolify)

Dois recursos no Coolify, a partir do mesmo repo:

| Recurso | Dockerfile | Domínio | Faz |
|---|---|---|---|
| **web** | `apps/web/Dockerfile` | público (= `rootUrl`) | nginx serve o SPA e faz proxy de `/api/*` para a API |
| **api** | `apps/api/Dockerfile` | nenhum (rede interna) ou privado | Fastify em Node 24, `prisma migrate deploy` no start, `HEALTHCHECK` em `/api/health` |

- Build context = raiz do repo nos dois (Base Directory `/`, Dockerfile Location `apps/<app>/Dockerfile`). Ambos usam `turbo prune`.
- **web:** sem `ports:` (nem `expose`): o Coolify não aceita `ports:`. A porta 8080 vem do `EXPOSE 8080` do Dockerfile (o nginx escuta nela); no recurso do Coolify, informe a porta 8080 e o domínio público, e o proxy (Traefik) publica. Env `APPLICATION_API_URL` (URL interna da API, ex: `http://<nome-do-container-api>:3000`; os dois recursos precisam estar na mesma rede do Coolify — "Connect to Predefined Network" — ou use a URL pública da API), `APPLICATION_FRAME_ANCESTORS`, `NGINX_RESOLVER` (padrão `127.0.0.11`, DNS do Docker). O nginx resolve a API a cada 10s, então redeploy da API não exige reiniciar o web.
- **api:** env do `apps/api/.env.example`. Porta 3333. Banco de produção = MySQL de DBaaS (Magalu Cloud): ver `references/chat-plataforma/database.md`, "Produção".
- **Dockerfiles (o que já está otimizado):** multi-stage com `turbo prune` (a imagem só leva o app e as dependências dele); cache do store do pnpm por `--mount=type=cache` (rebuild sem baixar tudo de novo; exige BuildKit, padrão no Coolify); API só com dependências de produção, `NODE_ENV=production`, usuário `node` (não root) e `HEALTHCHECK` em `/api/health` (só diz que o processo responde; não testa o banco, para o container não reiniciar quando o banco oscila: a saúde das dependências fica no diagnóstico); web é um nginx com os estáticos (sem Node na imagem final).
- **Start da API:** `apps/api/docker-entrypoint.sh` (`ENTRYPOINT` do Dockerfile) roda `prisma migrate deploy` e depois `exec node src/server/server.ts`. O `exec` faz o Node virar o PID 1 e receber o SIGTERM do Coolify; sem ele o `sh` engole o sinal, o `app.close()` não roda (logs do Axiom em buffer se perdem) e o container é morto à força depois do timeout.
- **Migrations no start:** simples e suficiente para uma réplica. O Prisma usa lock no banco (`GET_LOCK`), então duas réplicas subindo juntas não aplicam a mesma migration duas vezes. Migration que falha derruba o start e o Coolify mantém a versão anterior no ar: corrija com uma migration nova, nunca editando a aplicada. Migration destrutiva (drop/rename de coluna) se faz em duas versões (expand/contract), porque a versão antiga continua rodando durante o deploy.
- **Tamanho da imagem da API:** a CLI `prisma` (e o schema engine) fica na imagem porque o `migrate deploy` roda no start. Se um dia isso pesar, mova a migration para um job de pré-deploy e tire o `prisma` das dependências de produção.
- Para o Chat Plataforma é um único `rootUrl` (domínio do web): o iframe abre o SPA e a plataforma chama `{rootUrl}/api/...`, que o nginx repassa intacto (corpo cru preservado → HMAC ok).
- **CI/CD** (`.github/workflows/ci-cd.yml`, igual nos dois templates, vem de `assets/common`): roda em push e PR para `main`. O job `changes` (paths-filter) decide o que mudou: `apps/web/**` roda só o job `web`, `apps/api/**` só o `api`, e `packages/**`, `package.json`, lock, `pnpm-workspace.yaml`, `turbo.json`, `biome.json`, `docker-compose.dev.yml` e `.github/**` rodam os dois. Cada job, em ordem: lint (`biome check apps/<app> packages`), typecheck, testes unitários (`test`), e2e (`test:e2e`, só se o app tiver o script; o job da API sobe MySQL 8.4 e Redis 8), build (só se tiver `build`) e **teste da imagem Docker** (`docker build` do Dockerfile do app e `docker run` na rede `app-net` com `--env-file apps/<app>/.env`; a API recebe também `DATABASE_URL` com host `mysql`; espera o `HEALTHCHECK` ficar `healthy`). Typecheck e testes usam `--filter "{./apps/<app>}..."`, que inclui o `@app/shared`. Os jobs `deploy-web` e `deploy-api` só rodam em push na `main`, só do que mudou, e **só se nenhum job falhou**: chamam o webhook do Coolify do recurso. Secrets no GitHub: `COOLIFY_TOKEN`, `COOLIFY_WEBHOOK_API`, `COOLIFY_WEBHOOK_WEB`. A versão do Node do CI é `NODE_VERSION` no topo do arquivo (24, nos dois templates).
- No Coolify (GitHub App), desligue o auto-deploy por push nos dois recursos: o deploy vem só do CI, depois de lint, testes, build e teste da imagem passarem. Produção usa só o Dockerfile de cada app (o Coolify injeta o env). Restart `unless-stopped`, limites de CPU/memória e rotação de logs (`--log-driver json-file --log-opt max-size=10m --log-opt max-file=3`) não cabem no Dockerfile: configure no Coolify (Resources / Advanced / Custom Docker Options).
- **Compose de dev:** o scaffold deixa em `docker-compose.dev.yml` só os serviços escolhidos no `start` (MySQL, Redis de filas, Redis de cache). O `docker/mysql-init/01-grants.sql` dá ao usuário `app` permissão para criar o banco sombra que o `prisma migrate dev` usa, e o healthcheck do MySQL testa por TCP (`-h 127.0.0.1`) para só ficar `healthy` depois do reinício do servidor que o init provoca. A CI não usa esse arquivo: ela sobe o próprio MySQL.
- Local, stack completa: `docker compose -f docker-compose.dev.yml up -d` (cria a rede `app-net`), depois `docker build -f apps/api/Dockerfile -t iframe-name-api .` e `docker build -f apps/web/Dockerfile -t iframe-name-web .`, e `docker run -d --network app-net --name iframe-name-api --env-file apps/api/.env iframe-name-api` e `docker run -d --network app-net --name iframe-name-web --env-file apps/web/.env iframe-name-web` (o web não publica porta no host, porque o Coolify não aceita `ports:`; para ver a tela localmente use `pnpm dev`).

## 11. Segurança

- `accountId` (= `externalId`) viaja na URL do iframe e é a única chave do front → `randomUUID()`, nunca sequencial/derivado.
- `/api/app/*` só aceita `x-account-id` de instalação existente. Para ações sensíveis, confirme `agentId`/`ticketId` via API antes de agir.
- `frame-ancestors` no nginx do web (padrão `https://*.chatplataforma.com.br`) e sem `X-Frame-Options`. Se o iframe não carregar, confira o domínio real do painel.
- HMAC sobre o raw body + `timingSafeEqual`; JWT com `algorithms: ['HS256']`, `scope` e `externalId`.
- Logs com redaction de headers sensíveis; nunca logar credentials.

## 12. Mapa do código (o "porquê" de cada peça)

**packages/shared**
- `ticketViewSchema` + `TICKET_STATUS`/`TICKET_PRIORITY`: projeção segura do ticket usada pela API (parse da resposta da plataforma) e pelo web (tipo).
- `iframeContextSchema`: parâmetros da query do iframe — `accountId` (= `externalId` do install), `agentId` (quem abriu o app), `ticketId`, `ticketConnectionId` sempre; `contactId`, `ticketAgentId` (responsável, pode diferir de `agentId`), `ticketSectorId`, `ticketGroupId` só quando existem. `HEADERS` = nomes dos headers (`x-account-id`, `x-agent-id`, `x-ticket-id`, `x-request-id`). `ApiSuccess`/`ApiError` = envelope obrigatório.

**packages/shared** (`@app/shared`): o mesmo pacote nos dois templates (a base fica em `assets/common/packages/shared/`, o scaffold a copia e o `src/index.ts` do template sobrescreve o genérico)
- `exports`: `.` (`src/index.ts`), `./masks`, `./validators`, `./biome` e `./typescript`.
- `biome.json` (estilo único: 2 espaços, sem ponto e vírgula, aspas simples, linter `recommended`, `organizeImports`) e `tsconfig.json` (ES2024, `module: ESNext`, `moduleResolution: Bundler`, `strict`, `noUncheckedIndexedAccess`, `noEmit`). Os apps estendem `"extends": "@app/shared/typescript"`; o `biome.json` da raiz estende `./packages/shared/biome.json`. O `@app/shared` fica em `dependencies` dos apps (não em `devDependencies`): a imagem da API instala com `--prod` e o `prisma generate` lê o tsconfig.
- `@app/shared/masks`: `maskPhone`/`unmaskPhone`, `maskCurrency`/`unmaskCurrency` (BRL, USD, EUR), `maskCpf`/`maskCnpj`/`maskCei` (+ `unmask*`) e `docMask('mask' | 'unmask', valor)`, que escolhe pelo tamanho: até 11 dígitos CPF, 12 CEI, senão CNPJ (inclusive o alfanumérico). Toda máscara é idempotente e mantém os mesmos caracteres na mesma ordem.
- `@app/shared/cnpj`: `lookupCnpj(cnpj, options?)` consulta o CNPJ em APIs públicas gratuitas, **uma de cada vez, com fallback**: BrasilAPI, depois CNPJá (aberta), depois ReceitaWS (`CNPJ_PROVIDERS`). Se uma falhar (rede, timeout de 8 s, HTTP diferente de 2xx, limite de uso ou resposta sem razão social), tenta a próxima. Devolve `CnpjData` já normalizado (razão social, fantasia, situação, abertura `AAAA-MM-DD`, capital, CNAE principal, endereço, telefone e e-mail só com dígitos, e `provider`, a API que respondeu). Lança `CnpjLookupError` quando o CNPJ é inválido (sem chamar API) ou quando todas falham (o motivo de cada uma em `.attempts`). Aceita CNPJ com máscara e o alfanumérico. `options`: `providers` (trocar a ordem ou a lista, cada um é `{ name, url, parse }`), `timeoutMs` e `fetch` (para testes). Use na API: as três têm limite de taxa e a BrasilAPI já respondeu 403 e 429 em teste, então faça cache da resposta por CNPJ e não consulte a cada requisição.
- `@app/shared/validators`: `validateCpf`, `validateCnpj` (numérico e alfanumérico), `validateCei`, `validateEmail`. Validam dígito verificador e rejeitam sequências repetidas. Use no front (feedback) e na API (zod `refine`): a regra é uma só. Testes ao lado do código (vitest), com `pnpm --filter @app/shared test`.
- O que é só do Chat Plataforma fica no `src/index.ts` do template: `ticketViewSchema` + `TICKET_STATUS`/`TICKET_PRIORITY`, `iframeContextSchema`, `HEADERS`, `ApiSuccess`/`ApiError` (ver acima).
- Mudou algo em `assets/common/packages/shared/`? Vale para as duas plataformas: rode os testes dos dois templates e gere de novo os dois `pnpm-lock.yaml` (monte `common` + template numa pasta e rode `pnpm install --lockfile-only` com o lock antigo, para não subir versões).

**apps/api**
- `server/bootstrap.ts` (`buildApp`): só API JSON (o front é outro container). Composition root (DI manual): cria use cases e controllers com `installations` e `clientFor`, que os testes trocam por fakes, e registra as routes passando `authenticate` por opção. Content-type parser (`server/middlewares/json-body-parser.ts`) guarda o `rawBody` (HMAC é sobre os bytes exatos). Error handler (`server/middlewares/error-handler.ts`) converte tudo para `{ error: { message } }`; erro de validação → 422 com `USER_MESSAGES.invalidRequest` nas rotas do iframe e `ADMIN_MESSAGES.invalidRequest` nas da plataforma (o detalhe do zod vai só para o log); `AppError` carrega o status. Swagger em `server/plugins/swagger.ts`.
- Camadas e regras de import: `references/chat-plataforma/architecture.md`. Resumo das peças:
- `server/middlewares/`: `platform-signature.ts` (`requirePlatformSignature`: HMAC no `preValidation`, depois do parse e antes do zod → 401 vence 422), `diagnostics-token.ts` (`requireDiagnosticsToken`: JWT no `onRequest`), `iframe-installation.ts` (`requireInstallation`: `x-account-id` → `req.installation` e logger com `externalId`/`agentId`/`ticketId`), `request-id.ts` (`requestId` por requisição, reaproveita o do nginx se confiável).
- Provisionamento (`install`, `configure`, `uninstall` em `infrastructure/use-cases/`): o install lê o corpo plano pelos values; o configure aplica a atualização parcial (ignora ausentes e `••••••••`), valida o conjunto final; ambos testam a API key em `/v1/me/permissions` com timeout de 5 s (`assert-api-key-works.ts`; a plataforma desiste em 10 s). `externalId = randomUUID()` porque vira o `accountId` público. Uninstall é idempotente. Mensagens de erro em `ADMIN_MESSAGES`, porque o admin da organização as lê. O `provisioning.controller.ts` responde 201 no install.
- `get-diagnostics.use-case.ts` + `core/utils/diagnostics.ts`: `aggregate` = todos ok → `operational`, todos fora → `outage`, misto → `degraded`; um `check()` por dependência real no use case.
- `get-ticket.use-case.ts` + `presentation/{routes,schemas,controllers}/tickets.*`: exemplo de rota do iframe (`GET /api/app/tickets/:ticketId`, só snowflake numérico). `client-logs.*` em `presentation/`: recebe erros do front para o logger (sem use case: não há regra).
- `core/utils/credentials.ts`: `CREDENTIAL_FIELDS` (chave interna → label/type/required/secret, a fonte do `{ fields }` do Backstage), `credentialsSchema` com limites e `CREDENTIALS_JSON_MAX_BYTES` para caber cifrado em `VARCHAR(4096)`, `applyPlatformCredentials`, `describeInvalidCredentials`. `core/repository/installation.repository.interface.ts` é o contrato; `infrastructure/repository/installation.repository.ts` implementa (Prisma em produção, memória nos testes; delete leva as tabelas filhas por cascata; depois de um uninstall a plataforma esquece o `externalId` e um novo save chama install).
- `infrastructure/libs/chatplataforma/client.ts` (contrato em `core/repository/chat-plataforma-client.interface.ts`): `x-api-key` e `x-request-id`; devolve só o `body` do envelope `{ message, body }`; `requestParsed` valida com zod e descarta campos não declarados (o ticket da plataforma traz `hashPassword` do agente); erros viram `ChatPlataformaError` (`core/utils/chat-plataforma-error.ts`) com `upstreamStatus`: 401 → reconfigurar, 403 → sem permissão, 429 → 503 "muitas solicitações", 400/404/409/422 → 422 com a mensagem da própria plataforma (já escrita para atendente), 5xx/rede/timeout 8 s → 502 indisponível. `getMyPermissions` é o health check. `permissions.ts` (mesma pasta): `REQUIRED_PERMISSIONS` e `missingPermissions` (admin passa; `modulo:*` cobre o módulo).
- `core/utils/request-context.ts`: `RequestContext` (`{ requestId, log }`), a única parte da requisição que chega ao use case.
- `core/utils/log-events.ts`: `LOG_EVENT` (eventos de negócio no log).
- `core/utils/messages.ts`: `USER_MESSAGES` (atendente, rotas do iframe) e `ADMIN_MESSAGES` (admin da organização, que vê a mensagem do provisionamento e do diagnóstico na tela de apps) — ver `references/chat-plataforma/observability-and-integrations.md` §1.
- `infrastructure/libs/database.ts`: `mariaDbConfigFrom` monta o config do adapter a partir do `DATABASE_URL` (pool, timeout, TLS opcional e `allowPublicKeyRetrieval`, exigido pelo MySQL 8 sem TLS).
- `infrastructure/libs/hmac.ts`, `jwt.ts`, `crypto.ts` (AES-256-GCM, formato `iv.tag.ciphertext` base64), `prisma.ts`; `server/logger.ts` (pino → stdout + Axiom se `AXIOM_*`, com redaction).
- `core/utils/app-error.ts` (`AppError`), `presentation/errors/api-error.ts` (`ok`, `fail`) e `presentation/http.ts` (`ZodRequest<typeof schema>` para tipar o `req` do controller a partir do schema da rota, `contextOf`, `installationOf`).
- `config/env.ts`: valida as variáveis de ambiente.
- `server/server.ts`: monta Prisma + repositório + logger; `GET /api/health` (em `bootstrap.ts`) é o liveness do container; `app.close()` no SIGTERM faz flush do Axiom.
- `scripts/dev-install.ts`: simula o install assinado e imprime a URL do iframe; `scripts/print-credentials-schema.ts`: `{ fields: [...] }` para colar no Backstage.
- `prisma.config.ts`: carrega `.env` (de `apps/api`) se existir (Prisma 7 não lê `.env`).

**apps/web**
- `App.tsx`: lê o contexto da URL uma vez; providers `ErrorBoundary` → `QueryClientProvider` → `AppContextProvider` → `ToastProvider` → `NavigationProvider`; `CurrentScreen` faz o `switch` exaustivo das telas.
- `lib/navigation.tsx`: `SCREEN`/`NAVIGATION_ACTION` e pilha `readonly` de `Screen` em memória (push/back/reset), sem tocar na URL.
- `lib/query-keys.ts`: `QUERY_KEYS` — fábrica de chaves do TanStack Query (mesma chave para query e invalidação).
- `lib/api.ts`: chama `/api/app/*` com `x-account-id`, `x-agent-id`, `x-ticket-id`; desembrulha `{ body }`; lança `ApiRequestError(status, message, requestId)`; `log()` nunca lança.
- `lib/query-client.ts`: defaults do TanStack Query (seção 5) e log central de erros.
- `components/Screen.tsx`: compound component de tela; `lib/error-message.ts`: `friendlyMessage` e `FRONT_MESSAGES`; `ErrorAlert.tsx` (estado de erro, retry opcional) e `hooks/use-error-toast.ts` (erro de ação) usam ele; `ErrorBoundary.tsx`: fallback amigável com recarregar + log com `clientErrorId`.
- `hooks/use-<recurso>.ts`: `queryOptions` + hook fino.
- `vite.config.ts`: proxy `/api` → `localhost:3333` em dev; o Vite sobe na 8080.

## 13. Variáveis de ambiente

Um `.env.example` por app: `apps/api/.env.example` e `apps/web/.env.example` (o scaffold copia cada um para `.env` e gera os segredos de dev em `apps/api/.env`). Padrão de nome: `<DONO>_<COISA>` (`APPLICATION_` = o app, depois o serviço: `DATABASE_`, `CHATPLATAFORMA_`, `REDIS_`, `AXIOM_`, `RESEND_`, `LANGFUSE_`). Variável nova entra primeiro no `.env.example`, depois no `env.ts` (zod). Banco e Redis só por URL; a configuração da infra local (usuário, senha, portas) fica fixa no `docker-compose.dev.yml`.

| Variável | Quem lê | Para que serve |
|---|---|---|
| `APPLICATION_PORT` | API | Porta HTTP (padrão 3333, a mesma nos dois templates). |
| `APPLICATION_LOG_LEVEL` | API | Nível mínimo de log: `fatal`, `error`, `warn`, `info` (padrão), `debug`, `trace`. |
| `APPLICATION_ENCRYPTION_KEY` | API | Chave AES-256 (32 bytes em base64, `openssl rand -base64 32`) que cifra as credentials no banco. Trocar com instalações salvas as torna ilegíveis. |
| `DATABASE_URL` | API | MySQL. Em produção, o DBaaS na VPC (senha com caracteres especiais em URL-encode). |
| `DATABASE_POOL_SIZE`, `DATABASE_TLS` | API | Opcionais, fora do `.env.example`: pool por réplica (padrão 5) e TLS (padrão `false`; o DBaaS pode exigir `true`). Ver `references/chat-plataforma/database.md`. |
| `CHATPLATAFORMA_CLIENT_SECRET` | API | `clientSecret` do app, gerado pelo Backstage (64 hex, mostrado uma vez). Valida o HMAC do provisionamento e o JWT do diagnóstico. Em dev, o scaffold gera um aleatório. |
| `CHATPLATAFORMA_API_URL` | API | URL da API do Chat Plataforma (padrão `https://api.chatplataforma.com.br`). |
| `CHATPLATAFORMA_TEST_API_KEY` | só o script `dev:install` | API key de uma conta de teste. Só dev; nunca em produção. |
| `AXIOM_TOKEN`, `AXIOM_DATASET` | API | Logs no Axiom: o `AXIOM_DATASET` é o nome do conjunto onde os logs do app caem no Axiom, e o scaffold o preenche com `<nome>` na Zappy (ex.: `onvio`) e `<nome>-cp` no Chat Plataforma (ex.: `onvio-cp`). Sem token, loga só no stdout. |
| `REDIS_QUEUE_URL`, `REDIS_CACHE_URL` | API | Redis de fila (BullMQ, `noeviction`) e de cache (`allkeys-lru`): duas instâncias, `redis://` ou `rediss://`. Opcionais. Em produção, Redis externo. |
| `RESEND_API_KEY`, `RESEND_EMAIL_FROM` | API | Só se o app enviar e-mail. |
| `LANGFUSE_BASE_URL`, `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY` | API | Só se o app usar IA. |
| `APPLICATION_API_URL` | container web (nginx) | URL interna da API para onde o nginx encaminha `/api/*`. |
| `APPLICATION_FRAME_ANCESTORS` | container web (nginx) | Origens que podem embutir o app em iframe (separadas por espaço). Depende da plataforma: Chat Plataforma `https://*.chatplataforma.com.br`; Zappy `https://*.zapcontabil.chat`. |
| `NODE_ENV` | API | `development`, `test` ou `production`. |
| `APPLICATION_NGINX_RESOLVER` | container web (nginx) | DNS que o nginx usa para achar a API (padrão `127.0.0.11`, o do Docker). Opcional. |
| `APPLICATION_DEV_API_URL`, `APPLICATION_DEV_WEB_URL`, `APPLICATION_DEV_AGENT_ID`, `APPLICATION_DEV_TICKET_ID`, `APPLICATION_DEV_CONNECTION_ID`, `APPLICATION_DEV_CONTACT_ID` | só o script `dev:install` (Chat Plataforma) | Valores de teste do iframe em desenvolvimento. Opcionais. |
| `DATABASE_TEST_URL`, `REDIS_TEST_URL` | só o job da API no CI | Banco e Redis de teste para o e2e. Definidos no workflow, não no `.env`. |

**Regra do prefixo (vale para toda variável que vier do `.env` ou de env):** o nome começa pelo **dono** da variável: `APPLICATION_` para o que é do app (porta, log, chave, URLs do app), e o nome do serviço para o resto (`DATABASE_`, `REDIS_`, `AXIOM_`, `CHATPLATAFORMA_`, `RESEND_`, `LANGFUSE_`, `COOLIFY_`). Variável nova sem prefixo de dono é erro. Exceções, por serem definidas por terceiros: `NODE_ENV` (Node), `MYSQL_*` (imagem do MySQL), `PNPM_HOME` (pnpm), `VITE_*` (Vite, se um dia o front precisar).

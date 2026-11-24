Arquitetura do projeto:
Esse projeto se trata de um monorepo, as aplicações fica na pasta "./apps"

Stacks do projeto:

Frontend
- React + Vite (latest) + Typescript
- Vitest para testes unitarios
- Tailwindcss
- TanStack Query (@tanstack/react-query) para dados do servidor
- InnovUI (@innovui/react) + lucide-react para componentes e ícones
- biome
- nginx para subir um servidor para os arquivos estaticos apos o build
- docker

Escopo do frontend:

- O projeto sera construido na pasta web que ja está criado dentro de apps.
- O projeto se trata de um iframe que vai ter uma largura maxima de 420px .
- Deve conter a pasta src
- O sistema de rotas não será necessariamente rotas, a navegação é em memória (pilha de telas em /src/lib/navigation.tsx, equivalente à variável global de páginas), sem alterar a URL do iframe
- na parte de componentização vai ter a pasta components ( /components ), onde tera cards e etc..., e dentro de components tera a ui ( /components/ui ) que vai ter botões, input text, select ( não é o select padrão do HTML, tem que ser um componente) e etc...
- O CSS fica em /src/styles.css (InnovUI antes do Tailwind v4).
- Cada tela fica em /src/screens e usa o componente Screen (/src/components/Screen.tsx: Root, Header, Body, Footer). A navegação em memória fica em /src/lib/navigation.tsx.
- A comunicação com a API fica em /src/lib/api.ts (fetch com os headers x-tenant-id, x-user-id e x-request-id); dados do servidor vão por TanStack Query (/src/hooks, chaves em /src/lib/query-keys.ts).
- Para testes unitários, use a pasta apps/web/test
- Para acessar o iframe no frontend, é obrigatório que seja passado os seguintes parametros ( tenantId para identificar qual é o tenant, e userId para saber qual usuário está acessando ( os usuarios vai vim do nosso systema zappy )), se não tiver esses 2 parametros, não deve deixar acessar o iframe




Backend:

- Clean Architecture
- Node.js 24 + Typescript ( Rodar em typescript puro na runtime do node, o node ja permite isso )
- Type modules
- helmet ( esse é do express, mas vamos usar um do fastify )
- ZDK ( zdk 1.x ) para a API da Zappy, embrulhado em infrastructure/libs/zappy/client.ts
- Swagger do próprio fastfy
- Zod com a propria integraçṍ do fastify
- Fastify
- Logger pino do fastfy
- Prisma / Mysql
- Vitest para testes unitários
- Supertest para testes e2e
- Redis / BullMQ
- Axiom para observabilidade com integração ao fastify ( pino )
- Clean Code, DRY, KISS, YAGNI, SOLID
- JWT para guardar seção


Escopo do backend:

- O projeto deve ser construido dentro da pasta api
- A aplicação vai ser mult tenant
- Pasta raiz : /src

```py
	/tests
		/unit
		/e2e
		/support
	/prisma
		schema.prisma # model Tenant; o primeiro projeto acrescenta os dele
	/src
		/config
			env.ts # valida as envs com zod
		/core # contratos, sem dependência de fastify, prisma ou das outras camadas
			/repository # interfaces (zappy-client.interface.ts, tenant.repository.interface.ts)
			/use-cases # interfaces (register-tenant, list-tenants, set-tenant-active, remove-tenant, list-connections, get-ticket)
			/utils
		/infrastructure
			/libs # prisma, database, crypto, zappy (ZDK)
			/repository # tenant.repository.ts (Prisma + memória, token cifrado)
			/use-cases # regra de negócio, sem Fastify
		/presentation
			/controllers
			/routes
			/schemas
			/errors
			http.ts
		/server
			/middlewares # request-id, json-body-parser, error-handler, tenant-context (resolve o tenant), comhub-key
			/plugins # swagger
			/workers
			bootstrap.ts # monta o app e faz a injeção de dependência manual (recebe tenants e zappyClientFor)
			logger.ts
			server.ts # arquivo de start (porta 3333)
```

- o monorepo tem 1 docker-compose na raiz do projeto, o de dev ( docker-compose.dev.yml ), usaremos só para o desenvolvimento, ( para nos usar um mysql, redis e etc... ). Não há compose de app nem de staging: o teste de build e de subida dos containers é feito pelo CI (`.github/workflows/ci-cd.yml`) com `docker build` e `docker run` do Dockerfile de cada app

- cada projeto isolado ( web e api ) sobe só pelo seu Dockerfile em produção, sem docker compose ( o mysql nunca fica no container de produção, pois usamos um serviço externo ). Restart, limites de CPU/memória e rotação de logs ficam no Coolify

- As imagens do docker que vai para produção deve ser o mais leve possivel e otimizado, para rodar tudo que precisamos.

- Como esse projeto se trata de um monorepo. tudo que der para reaproveitar nas 2 aplicações ( web e api ), coloque em packeges

- A lib do nosso sistema que voce vai user é o zdk "npm install zdk"

- Cada sistema externo da integração ganha uma lib em infrastructure/libs/<sistema>/client.ts, atrás de uma interface em core/repository (como o ZappyClient).

Env ( backend ):

- Assim que a API sobe, as envs deve ser carregadas.
- dentro de env.ts é validado se todas as envs estao realmente vindo ( usar zod para isso )
- imports internos usam o alias #src/* (campo imports do package.json)
- APPLICATION_ENCRYPTION_KEY (32 bytes em base64, cifra o token dos tenants) e APPLICATION_X_COMHUB_KEY (mín. 16 caracteres, chave das rotas de operação) são obrigatórias

Tenants e rotas:

- `prisma/schema.prisma` tem o model `Tenant` (`tenants`: id UUID, `zappy_url` único, `zappy_token` cifrado, `active`). O primeiro projeto roda `db:migrate --name init` e acrescenta os models dele.
- Operação (`/api/tenants`, header `x-comhub-key`, middleware `comhub-key.ts` com `timingSafeEqual`, hook `onRequest`, recebido pelas rotas na opção `authenticate`): cadastrar (valida a URL e prova o token com o ZDK antes de gravar: 422 credencial ou URL inválida, 502 instância fora do ar, 409 URL repetida), listar (sem token), ativar/desativar e remover.
- Iframe (`/api/app`, `x-tenant-id` e `x-user-id`): `tenant-context` responde 400 sem headers, 404 tenant inexistente e 403 inativo, e anexa ao request só `tenantId`, `userId` e a credencial decifrada (`req.tenant`). Rotas prontas: `GET /connections` e `GET /tickets/:ticketId` (projeção `TicketView` em `@app/shared`).
- `ZappyClientFor(credentials)` cria o cliente do ZDK por tenant; só `infrastructure/libs/zappy` importa o ZDK (`architecture.test.ts` vigia).
- Mensagens: `USER_MESSAGES` (usuário final, sem detalhe técnico) e `ADMIN_MESSAGES` (operador).

Testes
	- criar comandos para poder testar todo o sistema, seja com testes unitários ou até mesmo testes e2e, e coverrange
	- os testes deve ser criado dentro da pasta tests na mesma estrutura que estamos usando aqui no sistema

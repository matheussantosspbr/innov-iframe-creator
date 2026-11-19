# API do Chat Plataforma: guia para apps

Tudo nesta pasta foi lido do código do backend (`chat-contabil-server`, out/2026), não da documentação pública. A doc pública (`docs.chatplataforma.com.br`) diverge em vários pontos: header de auth, formato de resposta, paths e contrato de provisionamento. **Na dúvida, vale o que está aqui.** "Não confirmado" marca o que não deu para verificar no código.

| Arquivo | Conteúdo |
|---|---|
| `routes.md` | Todas as rotas `/v1` com a permissão RBAC exigida. Comece por aqui para saber se um endpoint existe. |
| `tickets-messages.md` | Tickets (listar, ver, aceitar, fechar, transferir...), mensagens (enviar texto/arquivo, listar, editar, reagir), notas, dispatch, arquivos. |
| `contacts-tags-groups.md` | Contatos, telefone, tags, campos personalizados, grupos de WhatsApp, carteiras, setores. |
| `auth-agents-webhooks.md` | `x-api-key` e o tenant, RBAC e catálogo de permissões, paginação, agentes, times, respostas rápidas, agendamentos, API keys, webhooks de saída. |
| `apps-connections-organization.md` | Registro de apps no Backstage, `credentialsSchema`, `clientSecret`, conexões (canais), templates Meta, janela de 24h, configurações da organização. |

O contrato entre a plataforma e o app (install/configure/uninstall/diagnostics e iframe) fica em `../integration-contract.md`.

## 1. Base e autenticação

- Base: `https://api.chatplataforma.com.br` (env `CHATPLATAFORMA_API_URL`). Todos os paths começam com `/v1`.
- **Apps usam `x-api-key`.** `x-access-token` é o JWT de login de agente humano e não serve para integração. A key tem 64 caracteres hex, é criada pela organização em Configurações → API e chega ao app pelas `credentials` da instalação.
- Nunca envie `x-backstage-key`.
- O "usuário" da key é um **agente de sistema** criado junto com ela, com o nome da key. Tudo que o app fizer (enviar mensagem, aceitar ticket, criar nota) aparece como feito por esse agente.
- **Permissões da key = do humano que a criou.** Criada por Owner → admin (passa em todo RBAC e vê todas as conexões, setores e grupos). Criada por Operator → perfil do criador. Nesse caso, listas podem vir vazias porque o agente de sistema não está vinculado a conexões e setores. Se o criador for desativado, a key para de funcionar (401).
- Expiração: a key "expira" em 90 dias, mas **o backend continua aceitando keys expiradas ou inativas**. Não existe endpoint de revogação. A organização "revoga" rotacionando a key (o valor antigo morre na hora) ou desativando o criador. O app só percebe isso como 401 numa chamada.
- `GET /v1/me/permissions` → `{ isAdmin, permissions[] }`. É barato e não tem efeito colateral: use no diagnóstico e para checar permissões antes de mostrar uma ação.

## 2. Formato das respostas

| Caso | Status | Corpo |
|---|---|---|
| Sucesso | 200 ou 201 (às vezes 204) | `{ "message": "...", "body": ... }`. **O dado está em `body`.** `body` some do JSON quando é nulo. Algumas rotas devolvem só `{ message }`. |
| Erro de regra/validação | 400, 404, 409, 422 | `{ "message": "texto em PT" }` |
| Sem credencial / key inválida | 401 | `{ "error": "Não autorizado" }` (chave `error`, não `message`) |
| Sem permissão RBAC | 403 | `{ "message": "Você não tem permissão para executar esta ação" }` |
| Organização ou agente bloqueado | 403 | `{ "message": "Sua organização está inativa..." }` |
| Rate limit | 429 | `{ "message": "Muitas requisições. Tente novamente em Ns." }` |
| Erro do Fastify (JSON inválido, content-type) | 4xx | `{ "error": "...", "requestId": "..." }` |
| Erro inesperado | 500 | `{ "message": "Houve um erro inesperado" }` |

- **IDs são snowflake BigInt e chegam como string.** Envie e guarde como string; nunca `Number()`.
- ID não numérico num path costuma gerar **500**, não 400. Valide `^\d+$` antes de chamar.
- "Não encontrado" varia entre 400, 404 e 422 conforme o endpoint.
- A plataforma aceita e devolve `x-request-id`. O cliente do template repassa o `requestId` da requisição do app, então o mesmo ID aparece nos dois lados.

O cliente do template (`apps/api/src/infrastructure/libs/chatplataforma/client.ts`) já trata isso: devolve só `body`, guarda `message` ou `error` na causa (vai para o log) e converte o erro em `ChatPlataformaError` com `upstreamStatus`: 401 → reconfigurar a integração, 403 → sem permissão, 429 → 503 "muitas solicitações", 400/404/409/422 → 422 com a mensagem da própria plataforma (já escrita para o atendente), 5xx/rede/timeout → 502.

## 3. Limites

- **1200 requisições por 10 s por organização**, somando painel, integrações e todos os apps da organização. Sem `Retry-After`. Não faça polling agressivo nem fan-out por item; prefira endpoints de lista.
- Paginação offset: `page`, `perPage` (padrão e **máximo 50**) → `metadata: { total, count, perPage, currentPage, totalPages }`.
- Paginação por cursor (tickets, mensagens, times, respostas rápidas): `cursor`, `perPage` → `metadata: { total, hasNextPage, nextCursor }`. Repita com `?cursor=<nextCursor>` enquanto `hasNextPage`.

## 4. Enums que aparecem nas respostas

Declare no app com `Object.freeze({...} as const)` (ver `../stack.md` §2.1).

- TicketStatus: `PENDING=1`, `ATTENDING=2`, `RESOLVED=4` (não existe 3). Filtros de query usam o **nome** (`status=PENDING,ATTENDING`).
- TicketPriority: `LOW=1`, `MEDIUM=2`, `HIGH=3`.
- MessageAck: `FAILED=-1`, `CLOCK=0`, `SENT=1`, `RECEIVED=2`, `READ=3`, `PLAYED=4` (e negativos de erro).
- ConnectionProvider: `WUZAPI=1`, `META_OFFICIAL=2`. ConnectionStatus: `DISCONNECTED=1`, `CONNECTED=2`, `TIMEOUT=3`, `INVALID_CREDENTIALS=4`.
- CustomFieldScope: `CONTACT=1`, `GROUP=2`, `BOTH=3`.
- Agent role: `2=Operator`, `3=Owner`.

## 5. Pegadinhas que mais quebram apps

1. **Paths misturam singular e plural:** `GET /v1/contact/:id` mas `PUT /v1/contacts/:id/tags`; `DELETE /v1/message/:id` mas `PATCH /v1/messages/:id`; `PUT /v1/webhook/:id` mas `POST /v1/webhooks`; `GET /v1/channel/:id` mas `GET /v1/channels`. Confira em `routes.md`.
2. **`GET /v1/tickets/:id` devolve o agente com `hashPassword`, e-mail e telefone.** Nunca repasse o objeto cru ao front. Projete só os campos que a tela usa (o template faz isso com `ticketViewSchema`, que descarta o que não declara).
3. **Listar mensagens de um ticket marca o ticket como lido** (`unreadMessagesCount = 0`). Um app que lê o histórico ao abrir muda o que o atendente vê no painel. Busque mensagens sob demanda.
4. **Enviar mensagem:** `POST /v1/messages/text` com `connectionId` (use `ticketConnectionId` do iframe) e `destinationId` = **telefone ou JID**, não o id do contato. O contato precisa existir. Se não há ticket aberto naquela conexão, cria um ticket ATTENDING para o agente de sistema. Resposta: `201` com `body` = id da mensagem. Em conexão Meta oficial vale a janela de 24h (422 fora dela). Se o provedor falhar, a mensagem fica gravada com ack 0: **não reenvie automaticamente** (duplica).
5. **`PUT /v1/contacts/:id/tags` substitui a lista inteira e recebe IDs.** Para adicionar uma tag sem apagar as outras use `POST /v1/tags/:tagId/contacts`.
6. **Nome de tag é único entre todas as organizações.** 409 ao criar é comum; prefira buscar a tag existente pelo nome antes de criar.
7. Campo personalizado com `global: false` (padrão) só pode ter valor em **um** contato. Para um campo por contato, crie com `global: true`.
8. `GET /v1/tickets` sem `showAll=true` só traz tickets do agente de sistema (exceto `status=PENDING`) e agrupa por conversa.
9. Nenhum endpoint de contato, tag, campo ou setor dispara webhook.
10. **O backend não valida a organização em várias rotas por ID.** O app nunca deve aceitar um ID vindo do front para um recurso que não pertença ao contexto da instalação: use o `ticketId`/`contactId` do iframe e IDs que a própria API devolveu.

## 6. Webhooks de saída

Resumo (detalhe em `auth-agents-webhooks.md` §5 e como receber em `../realtime.md`, seção "Recebendo webhooks"):

- Eventos: `message.received|sent|edited|reaction|deleted`, `dispatch.completed`, `ticket.transferred|closed|frozen|unfrozen|accepted|reopened|deleted`. Não há evento de ticket criado nem de contato, tag ou agente.
- Envelope: `{ id, organizationId, event, timestamp, data }`. `id` é estável entre retentativas → chave de idempotência.
- **`X-Webhook-Signature` não é verificável** (bug: chave aleatória por envio). Autentique com token secreto na URL.
- Até 5 tentativas em cerca de 65 s, sem ordem garantida, duplicatas possíveis, sem DLQ.
- Edições, reações e exclusões feitas pelo contato no WhatsApp não geram webhook.

## 7. O que não existe na API

- Ler o nome ou o fuso da organização com key comum (endpoints de organização são só do Backstage).
- Evento ou endpoint de "ticket criado" via webhook.
- Revogar API key.
- Validar os parâmetros do iframe: a plataforma não assina a URL (ver `../integration-contract.md` §2).

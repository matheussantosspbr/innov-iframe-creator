# ZDK 1.0: desvios do contrato (as 24 quirks)

> Texto integral de `API_QUIRKS`, exportada por `zdk@1.0.0`. O ZDK corrige estes defeitos do contrato OpenAPI da Zappy em tipos e em runtime. O guia detalhado de cada um (`docs/API-QUIRKS.md`) está no repositório do ZDK e não vai no pacote npm.

| Id | Onde | O que acontece |
|---|---|---|
| Q1 | `components.schemas.Connection.properties.status.enum` | enum omite WHATSAPP_AUTH (conexão com API Oficial ativa) e `qrcode` (aguardando pareamento) — os dois observados em produção (T24) |
| Q2 | `components.schemas.*` | 42 de 47 schemas sem array `required` no topo — codegen marca tudo opcional |
| Q3 | `components.schemas.*.properties.*.required` | 12 properties com `required: true` inline — inválido em OpenAPI 3, ignorado pelo codegen |
| Q4 | `paths./api/tickets/{id}/send-template.post.parameters[id]` | `id` de path declarado opcional, mas é sempre obrigatório na prática |
| Q5 | `paths./api/messages.get.parameters[ticketId\|contactId\|dateFrom\|dateTo]` | parâmetros de filtro sem `schema.type` |
| Q6 | `runtime: corpo de erro de POST /api/send/{to} e afins` | ERR_OFFICIAL_API_WINDOW_CLOSED chega como 400 genérico — mapeado em error-mapper.ts (T09) |
| Q7 | `paths./api/messages/multiple/{to}.post.requestBody` | `messages` é JSON stringificado dentro do multipart — serializado pelo método (T22) |
| Q8 | `runtime: headers de resposta` | 429/Retry-After/5xx não documentados; rate limit real roda antes da autenticação (observado, não no contrato) |
| Q9 | `paths.*.get.parameters[pageSize]` | sem `maximum`/`maxItems` — resposta de duração ilimitada |
| Q10 | `components.schemas.SendTemplateBulk.properties.to` | array `to` sem `maxItems`; resposta 200 com falha parcial por número |
| Q11 | `runtime: nenhuma operação` | sem `Idempotency-Key` — retry de POST com efeito externo não é seguro (ver §5.8.3, receita de reconciliação) |
| Q12 | `runtime: formato do token` | 250 caracteres, não documentado — validado em `parseToken` (T05) |
| Q13 | `paths.*.responses` | 401 documentado em 1 de 48 operações; ocorre de fato em qualquer rota autenticada |
| Q14 | `runtime: headers de resposta` | x-ratelimit-limit/remaining/reset ausentes do contrato; reset é epoch absoluto do servidor |
| Q15 | `documento inteiro` | contrato varia por versão implantada, não por tenant/domínio; info.version não acompanha — ver docs/API-DIVERGENCE.md |
| Q16 | `runtime: hostname da API` | padrão `api-<tenant>.<apex>` observado em 2 tenants, não documentado — validado em `parseBaseUrl` (T05) |
| Q17 | `components.schemas.Error` | corpo real é `{error, errorData}`; o schema só declara `error: string` — `errorData` não documentado |
| Q18 | `paths./api/connections.get.responses.200.content` | declara `Connection` (objeto único); resposta real é `{connections: Connection[]}` — não existe `ConnectionList` |
| Q19 | `paths./api/send/{to}.post.responses.200.content` | CONFIRMADO com POST real: resposta vem embrulhada em `{message: Message}` — a v0.7 estava certa, o contrato está errado. Só verificado para este endpoint; POST /api/send-template/{to} e POST /api/send/{type}/{to} declaram o mesmo schema Message mas não foram testados — tratados como não-embrulhados até confirmação própria |
| Q20 | `paths./api/send/{type}/{to}.post.requestBody.content` | dois content-types (multipart binário OU json com url) — capacidade que a v0.7 nunca implementou |
| Q21 | `components.schemas.Message.properties.{id,subtype,isMedia,myContact}` | resposta real (Q19) contradiz o contrato em 4 campos: `id` é string (ID da mensagem no WhatsApp, contrato diz integer), `subtype` é string "text" (contrato diz integer — inverte o que se pensava antes de testar), `isMedia` e `myContact` são boolean (contrato diz string para os dois) |
| Q22 | `paths./api/connections/{id}/templates.get.responses.200.content` | CONFIRMADO com GET real: resposta é `{templates: MessageTemplate[]}` — mesmo padrão de Q18. Divergência Q15-style: zapcontabil ainda declara `MessageTemplate` singular (o bug); zapplataforma já corrigiu para a forma certa. A união (primeiro-vence) herda a forma do zapcontabil, então o override segue necessário mesmo com uma instância já certa |
| Q23 | `components.schemas.MessageTemplate.properties.{type,status}` | observado em produção: `type: "marketing-catalog"` fora do enum documentado (PHONE/URL/QUICK_REPLY/COPY_CODE — que parece copiado do enum de botão); `status: "APPROVED"` fora do enum documentado e com casing diferente (no-sent/wait-approval/approved/rejected/blocked). Taxonomia real desconhecida além dessa amostra — os dois campos ficam como `string`, sem forçar um enum que já se provou errado |
| Q24 | `components.schemas.{ContactPostData,ContactTagsPostData,TicketResolveForm,WebhookPostData}.properties.*.default` | o oposto de Q2/Q3: `openapi-typescript` marca como obrigatória toda property com `default` no schema mesmo fora do array `required[]` (defaultNonNullable) — faz sentido para resposta, não para corpo de requisição, onde o servidor aceita omissão e aplica o default sozinho. Afeta isGroup/blocked/noCheckNumber (ContactPostData), replaceTags/createTagIfNotExists (ContactTagsPostData), feedbackOption (TicketResolveForm) e active (WebhookPostData) — `OptionalBy` desfaz isso |

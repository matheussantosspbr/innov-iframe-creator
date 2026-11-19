# Segurança da Aplicação

Origem e iframe
- O frontend é servido pelo nginx (`apps/web`) e só pode ser embutido em iframe por `'self'` e pelas origens de `APPLICATION_FRAME_ANCESTORS` (padrão `https://*.zapcontabil.chat`), via `Content-Security-Policy: frame-ancestors`.
- O browser fala só com o nginx: `/api/*` é proxy para a API, mesma origem, sem CORS configurado na API.
- A API usa `@fastify/helmet` com os headers padrão.

Identificação do tenant (rotas `/api/app/*`)
- O iframe só abre com `?tenantId=...&userId=...`; sem eles o app mostra "Acesso negado".
- Toda chamada a `/api/app/*` leva `x-tenant-id` e `x-user-id`. A API responde 400 se faltar um deles, 404 se o tenant não existe e 403 se está inativo.

Rotas de operação (`/api/tenants`)
- Exigem `x-comhub-key` igual a `APPLICATION_X_COMHUB_KEY` (mínimo 16 caracteres), comparada em tempo constante. Ausente ou errada: 401, antes de validar o corpo.

Dados e logs
- O token da Zappy é cifrado em repouso (AES-256-GCM, `APPLICATION_ENCRYPTION_KEY`) e nunca é devolvido em resposta nem gravado em log.
- O logger redige `authorization`, `x-api-key`, `x-comhub-key`, `x-tenant-id` e `x-user-id`.

Autenticação
- O template não tem login de usuário: quem opera usa a chave de operação e o usuário vem da Zappy pelo iframe. Se o sistema externo exigir login, ele é implementado por projeto.

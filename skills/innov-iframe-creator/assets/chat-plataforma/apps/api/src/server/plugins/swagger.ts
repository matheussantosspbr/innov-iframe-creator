import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import type { FastifyInstance } from 'fastify'
import { jsonSchemaTransform } from 'fastify-type-provider-zod'
import { AUTH_SCHEME } from '#src/presentation/schemas/common.schemas.ts'

export const registerSwagger = async (app: FastifyInstance) => {
  await app.register(swagger, {
    openapi: {
      openapi: '3.0.3',
      info: {
        title: 'Chat Plataforma App',
        version: '1.0.0',
        description:
          'Respostas de sucesso vêm em { "body": ... } e erros em { "error": { "message": "..." } }.',
      },
      tags: [
        { name: 'provision', description: 'Chamadas do Backstage, assinadas com HMAC' },
        { name: 'diagnostics', description: 'Chamada do Backstage, autenticada com JWT' },
        { name: 'app', description: 'Rotas do iframe, identificadas por x-account-id' },
        { name: 'health', description: 'Health check do container' },
      ],
      components: {
        securitySchemes: {
          [AUTH_SCHEME.hmacSignature]: {
            type: 'apiKey',
            in: 'header',
            name: 'x-signature',
            description:
              'hex(HMAC-SHA256(clientSecret, "<x-timestamp>:<corpo cru>")). Usar junto com x-timestamp.',
          },
          [AUTH_SCHEME.hmacTimestamp]: {
            type: 'apiKey',
            in: 'header',
            name: 'x-timestamp',
            description: 'Milissegundos desde a epoch (aceita ±5 min). Usar junto com x-signature.',
          },
          [AUTH_SCHEME.diagnosticsJwt]: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description:
              'HS256 com o clientSecret; claims scope "diagnostics:read" e externalId igual ao da URL.',
          },
          [AUTH_SCHEME.iframeAccountId]: {
            type: 'apiKey',
            in: 'header',
            name: 'x-account-id',
            description: 'accountId do iframe (= externalId da instalação).',
          },
        },
      },
    },
    transform: jsonSchemaTransform,
  })
  await app.register(swaggerUi, { routePrefix: '/api/docs' })
}

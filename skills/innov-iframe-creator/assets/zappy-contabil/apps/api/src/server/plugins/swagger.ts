import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import type { FastifyInstance } from 'fastify'
import { jsonSchemaTransform } from 'fastify-type-provider-zod'

export const registerSwagger = async (app: FastifyInstance) => {
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'iframe-name',
        version: '1.0.0',
        description:
          'Resposta de sucesso { body }, erro { error: { message } }. Rotas /api/tenants usam x-comhub-key; rotas /api/app usam x-tenant-id e x-user-id.',
      },
      servers: [{ url: 'http://localhost:3333', description: 'Desenvolvimento local' }],
      tags: [
        { name: 'tenants', description: 'Operação: cadastro de empresas (x-comhub-key)' },
        { name: 'app', description: 'Iframe: rotas do tenant (x-tenant-id e x-user-id)' },
      ],
      components: {
        securitySchemes: {
          comhubKey: {
            type: 'apiKey',
            in: 'header',
            name: 'x-comhub-key',
            description: 'Chave de operação (APPLICATION_X_COMHUB_KEY)',
          },
          tenantId: {
            type: 'apiKey',
            in: 'header',
            name: 'x-tenant-id',
            description: 'Id do tenant (id devolvido no cadastro)',
          },
          userId: {
            type: 'apiKey',
            in: 'header',
            name: 'x-user-id',
            description: 'Id do usuário da Zappy que abriu o iframe',
          },
        },
      },
    },
    transform: jsonSchemaTransform,
  })
  await app.register(swaggerUi, { routePrefix: '/api/docs' })
}

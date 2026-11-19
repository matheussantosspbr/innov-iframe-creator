import type { FastifySchema } from 'fastify'
import { z } from 'zod'
import { USER_MESSAGES } from '#src/core/utils/messages.ts'
import { errorResponse, TENANT_SECURITY } from './common.schemas.ts'

export const listConnectionsSchema = {
  tags: ['app'],
  security: TENANT_SECURITY,
  summary: 'Lista as conexões de WhatsApp da empresa',
  description: 'Consulta a instância da Zappy da empresa. Exige x-tenant-id e x-user-id.',
  response: {
    200: z.object({
      body: z.array(
        z.object({
          id: z.number().meta({ example: 1 }),
          name: z.string().meta({ example: 'Comercial' }),
          status: z.string().meta({ example: 'CONNECTED' }),
        }),
      ),
    }),
    400: errorResponse(USER_MESSAGES.missingTenantContext),
    403: errorResponse(USER_MESSAGES.tenantInactive),
    404: errorResponse(USER_MESSAGES.tenantNotFound),
    502: errorResponse(USER_MESSAGES.zappyUnavailable),
  },
} satisfies FastifySchema

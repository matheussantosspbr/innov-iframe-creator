import { CLIENT_LOG_LEVEL } from '@app/shared'
import type { FastifySchema } from 'fastify'
import { z } from 'zod'
import { USER_MESSAGES } from '#src/core/utils/messages.ts'
import { errorResponse, TENANT_SECURITY } from './common.schemas.ts'

export const recordSchema = {
  tags: ['app'],
  security: TENANT_SECURITY,
  summary: 'Registra um log do frontend',
  description:
    'Grava no log da API (com o requestId) uma mensagem enviada pelo iframe. Exige x-tenant-id e x-user-id.',
  body: z.object({
    level: z.enum(CLIENT_LOG_LEVEL).meta({ example: 'error' }),
    message: z.string().max(2000).meta({ example: 'Falha ao carregar a tela' }),
    context: z.record(z.string(), z.unknown()).optional(),
  }),
  response: {
    200: z.object({ body: z.object({ received: z.boolean() }) }),
    400: errorResponse(USER_MESSAGES.missingTenantContext),
    403: errorResponse(USER_MESSAGES.tenantInactive),
    404: errorResponse(USER_MESSAGES.tenantNotFound),
    422: errorResponse(USER_MESSAGES.invalidRequest),
  },
} satisfies FastifySchema

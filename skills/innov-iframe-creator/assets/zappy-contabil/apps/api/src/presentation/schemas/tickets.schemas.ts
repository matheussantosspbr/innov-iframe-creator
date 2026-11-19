import type { FastifySchema } from 'fastify'
import { z } from 'zod'
import { USER_MESSAGES } from '#src/core/utils/messages.ts'
import { errorResponse, TENANT_SECURITY } from './common.schemas.ts'

const optionalText = (example: string) => z.string().nullish().meta({ example })

const ticketBodySchema = z.object({
  id: z.string().meta({ example: '9001' }),
  status: optionalText('open'),
  isGroup: z.boolean().nullish(),
  unreadMessages: z.number().nullish().meta({ example: 2 }),
  contactId: optionalText('55'),
  userId: optionalText('7'),
  queueId: optionalText('3'),
  whatsappId: optionalText('1'),
  createdAt: optionalText('2026-01-01T10:00:00.000Z'),
  updatedAt: optionalText('2026-01-01T10:05:00.000Z'),
})

export const getTicketSchema = {
  tags: ['app'],
  security: TENANT_SECURITY,
  summary: 'Consulta um atendimento',
  description:
    'Devolve só os campos usados pelo app. Consulta a instância da Zappy da empresa. Exige x-tenant-id e x-user-id.',
  params: z.object({
    ticketId: z
      .string()
      .regex(/^\d{1,15}$/)
      .meta({ example: '9001' }),
  }),
  response: {
    200: z.object({ body: ticketBodySchema }),
    400: errorResponse(USER_MESSAGES.missingTenantContext),
    403: errorResponse(USER_MESSAGES.tenantInactive),
    404: errorResponse(USER_MESSAGES.ticketNotFound),
    422: errorResponse(USER_MESSAGES.invalidRequest),
    502: errorResponse(USER_MESSAGES.zappyUnavailable),
  },
} satisfies FastifySchema

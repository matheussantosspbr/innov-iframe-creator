import { ticketViewSchema } from '@app/shared'
import type { FastifySchema } from 'fastify'
import { z } from 'zod'
import { envelope, errorEnvelope, IFRAME_SECURITY, iframeHeadersSchema } from './common.schemas.ts'

export const getTicketSchema = {
  tags: ['app'],
  summary: 'Resumo do ticket aberto no atendimento',
  description:
    'Rota do iframe: usa as credenciais da instalação identificada por x-account-id para consultar o ticket no Chat Plataforma.',
  security: IFRAME_SECURITY,
  headers: iframeHeadersSchema,
  params: z.object({
    ticketId: z
      .string()
      .regex(/^\d{1,20}$/)
      .meta({ example: '182736454928173645' }),
  }),
  response: {
    200: envelope(ticketViewSchema, 'Ticket'),
    401: errorEnvelope('x-account-id ausente ou instalação não encontrada'),
    422: errorEnvelope('Ticket inválido ou recusado pelo Chat Plataforma'),
    502: errorEnvelope('Chat Plataforma indisponível ou integração a reconfigurar'),
    503: errorEnvelope('Chat Plataforma limitou as chamadas (429)'),
  },
} satisfies FastifySchema

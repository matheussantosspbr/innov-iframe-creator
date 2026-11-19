import { CLIENT_LOG_LEVEL } from '@app/shared'
import type { FastifySchema } from 'fastify'
import { z } from 'zod'
import { envelope, errorEnvelope, IFRAME_SECURITY, iframeHeadersSchema } from './common.schemas.ts'

export const recordSchema = {
  tags: ['app'],
  summary: 'Registra um log do front no servidor',
  description: 'Rota do iframe: repassa o log do navegador para o logger da API (Axiom).',
  security: IFRAME_SECURITY,
  headers: iframeHeadersSchema,
  body: z.object({
    level: z.enum(CLIENT_LOG_LEVEL),
    message: z.string().max(2000),
    context: z.record(z.string(), z.unknown()).optional(),
  }),
  response: {
    200: envelope(z.object({ received: z.boolean() }), 'Log registrado'),
    401: errorEnvelope('x-account-id ausente ou instalação não encontrada'),
    422: errorEnvelope('Payload fora do contrato'),
  },
} satisfies FastifySchema

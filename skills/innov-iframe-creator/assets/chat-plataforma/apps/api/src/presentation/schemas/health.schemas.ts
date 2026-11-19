import type { FastifySchema } from 'fastify'
import { z } from 'zod'
import { envelope } from './common.schemas.ts'

export const healthSchema = {
  tags: ['health'],
  summary: 'Health check',
  description: 'Sem autenticação; não depende do banco nem do Chat Plataforma.',
  response: {
    200: envelope(z.object({ status: z.string().meta({ example: 'ok' }) }), 'Container de pé'),
  },
} satisfies FastifySchema

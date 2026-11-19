import type { FastifySchema } from 'fastify'
import { z } from 'zod'
import { DIAGNOSTIC_STATUS } from '#src/core/utils/diagnostics.ts'
import {
  DIAGNOSTICS_JWT_SECURITY,
  envelope,
  errorEnvelope,
  externalIdSchema,
} from './common.schemas.ts'

const status = z.enum(DIAGNOSTIC_STATUS)

export const checkSchema = {
  tags: ['diagnostics'],
  summary: 'Diagnóstico da instalação',
  description:
    'Chamado pelo Backstage com JWT HS256 (escopo diagnostics:read, externalId igual ao da URL). Checa o banco e a API key do Chat Plataforma.',
  security: DIAGNOSTICS_JWT_SECURITY,
  params: z.object({ externalId: externalIdSchema }),
  response: {
    200: envelope(
      z.object({
        externalId: externalIdSchema,
        status,
        components: z
          .array(
            z.object({
              name: z.string().meta({ example: 'database' }),
              status,
              detail: z.string().optional().meta({ description: 'Detalhe técnico da falha' }),
            }),
          )
          .readonly(),
        checkedAt: z.iso.datetime().meta({ description: 'ISO 8601' }),
      }),
      'Estado dos componentes (operational, degraded ou outage)',
    ),
    401: errorEnvelope('JWT ausente, expirado ou de outra instalação'),
    404: errorEnvelope('Instalação não existe'),
    500: errorEnvelope('Erro inesperado'),
  },
} satisfies FastifySchema

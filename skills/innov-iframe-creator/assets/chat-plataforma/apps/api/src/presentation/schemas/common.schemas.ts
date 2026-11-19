import { z } from 'zod'

export const AUTH_SCHEME = Object.freeze({
  hmacSignature: 'hmacSignature',
  hmacTimestamp: 'hmacTimestamp',
  diagnosticsJwt: 'diagnosticsJwt',
  iframeAccountId: 'iframeAccountId',
} as const)

export const PLATFORM_SIGNATURE_SECURITY = [
  { [AUTH_SCHEME.hmacSignature]: [], [AUTH_SCHEME.hmacTimestamp]: [] },
]
export const DIAGNOSTICS_JWT_SECURITY = [{ [AUTH_SCHEME.diagnosticsJwt]: [] }]
export const IFRAME_SECURITY = [{ [AUTH_SCHEME.iframeAccountId]: [] }]

export const envelope = <T extends z.ZodType>(body: T, description: string) =>
  z.object({ body }).meta({ description })

export const errorEnvelope = (description: string) =>
  z
    .object({
      error: z.object({
        message: z
          .string()
          .meta({ example: 'Mensagem em português para o administrador ou atendente' }),
      }),
    })
    .meta({ description })

export const externalIdSchema = z.string().min(1).meta({
  description: 'Identificador da instalação devolvido pelo install.',
  example: '6f1c2a9e-1b2c-4d5e-8f90-123456789abc',
})

export const iframeHeadersSchema = z.object({
  'x-agent-id': z.string().optional().meta({ description: 'Id do atendente (contexto do iframe)' }),
  'x-ticket-id': z.string().optional().meta({ description: 'Id do ticket (contexto do iframe)' }),
})

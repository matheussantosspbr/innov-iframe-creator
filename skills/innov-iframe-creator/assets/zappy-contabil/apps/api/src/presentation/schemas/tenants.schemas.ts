import type { FastifySchema } from 'fastify'
import { z } from 'zod'
import { ADMIN_MESSAGES } from '#src/core/utils/messages.ts'
import { COMHUB_SECURITY, errorResponse } from './common.schemas.ts'

const TENANT_ID_MAX = 36
export const TENANT_NAME_MAX = 120
export const ZAPPY_URL_MAX = 255
export const ZAPPY_TOKEN_MAX = 256

const EXAMPLE_ID = '0b9e6d4e-5a35-4d6e-9f35-6b1c1f3c9a10'

const tenantParams = z.object({
  tenantId: z.string().min(1).max(TENANT_ID_MAX).meta({ example: EXAMPLE_ID }),
})

const tenantViewSchema = z.object({
  id: z.string().meta({ example: EXAMPLE_ID }),
  name: z.string().meta({ example: 'Escritório Exemplo' }),
  zappyUrl: z.string().meta({ example: 'https://api-exemplo.zapcontabil.chat' }),
  active: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

const unauthorized = errorResponse(ADMIN_MESSAGES.unauthorizedOperation)
const invalidRequest = errorResponse(ADMIN_MESSAGES.invalidRequest)
const notFound = errorResponse(ADMIN_MESSAGES.tenantNotFound)

const OPERATION = {
  tags: ['tenants'],
  security: COMHUB_SECURITY,
} as const

export const createTenantSchema = {
  ...OPERATION,
  summary: 'Cadastra uma empresa (tenant)',
  description:
    'Valida a URL (https://api-<subdominio>.zapcontabil.chat) e prova o token na instância da Zappy antes de gravar. O token é cifrado em repouso e nunca é devolvido. Exige o header x-comhub-key.',
  body: z.object({
    name: z
      .string()
      .trim()
      .min(1)
      .max(TENANT_NAME_MAX)
      .meta({ description: 'Rótulo legível do cliente', example: 'Escritório Exemplo' }),
    zappyUrl: z
      .string()
      .trim()
      .min(1)
      .max(ZAPPY_URL_MAX)
      .meta({ example: 'https://api-exemplo.zapcontabil.chat' }),
    zappyToken: z
      .string()
      .trim()
      .min(1)
      .max(ZAPPY_TOKEN_MAX)
      .meta({ description: 'Token de API da instância da Zappy', example: '<token de API>' }),
  }),
  response: {
    201: z.object({ body: tenantViewSchema }),
    401: unauthorized,
    409: errorResponse(ADMIN_MESSAGES.tenantUrlTaken),
    422: errorResponse(ADMIN_MESSAGES.tenantInvalidCredentials),
    502: errorResponse(ADMIN_MESSAGES.tenantInstanceDown),
  },
} satisfies FastifySchema

export const listTenantsSchema = {
  ...OPERATION,
  summary: 'Lista as empresas cadastradas',
  description: 'Não inclui o token. Exige o header x-comhub-key.',
  response: { 200: z.object({ body: z.array(tenantViewSchema) }), 401: unauthorized },
} satisfies FastifySchema

export const setTenantActiveSchema = {
  ...OPERATION,
  summary: 'Ativa ou desativa uma empresa',
  description:
    'Empresa inativa perde o acesso às rotas do iframe (403). Exige o header x-comhub-key.',
  params: tenantParams,
  body: z.object({ active: z.boolean().meta({ example: false }) }),
  response: {
    200: z.object({ body: z.object({ id: z.string(), active: z.boolean() }) }),
    401: unauthorized,
    404: notFound,
    422: invalidRequest,
  },
} satisfies FastifySchema

export const removeTenantSchema = {
  ...OPERATION,
  summary: 'Remove uma empresa',
  description: 'Apaga a empresa e o token cifrado. Exige o header x-comhub-key.',
  params: tenantParams,
  response: {
    200: z.object({ body: z.object({ id: z.string() }) }),
    401: unauthorized,
    404: notFound,
  },
} satisfies FastifySchema

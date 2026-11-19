import type { FastifySchema } from 'fastify'
import { z } from 'zod'
import { CREDENTIAL_FIELDS, platformCredentialsSchema } from '#src/core/utils/credentials.ts'
import {
  envelope,
  errorEnvelope,
  externalIdSchema,
  PLATFORM_SIGNATURE_SECURITY,
} from './common.schemas.ts'

const credentialsExample = { [CREDENTIAL_FIELDS.chatPlataformaApiKey.label]: 'cp-chave-de-exemplo' }

const flatCredentials = platformCredentialsSchema.meta({
  description:
    'Objeto plano de credenciais: a chave é o label do campo cadastrado no credentialsSchema do Backstage.',
  example: credentialsExample,
})

const savedCredentials = platformCredentialsSchema.meta({
  description:
    'Só os campos enviados no save. Campo ausente ou com o placeholder de segredo = não mudou; null ou "" = apagado.',
  example: credentialsExample,
})

const signedCallErrors = {
  401: errorEnvelope('Assinatura HMAC ausente, expirada (mais de 5 min) ou inválida'),
  422: errorEnvelope('Credencial inválida, API key recusada ou payload fora do contrato'),
  500: errorEnvelope('Erro inesperado'),
}

export const installSchema = {
  tags: ['provision'],
  summary: 'Instala o app para uma organização',
  description:
    'Chamado pelo Backstage ao salvar as credenciais pela primeira vez. Valida a API key no Chat Plataforma, cria a instalação e devolve o externalId (201).',
  security: PLATFORM_SIGNATURE_SECURITY,
  body: flatCredentials,
  response: {
    201: envelope(z.object({ externalId: externalIdSchema }), 'Instalação criada'),
    ...signedCallErrors,
    502: errorEnvelope('Chat Plataforma indisponível na validação da API key'),
  },
} satisfies FastifySchema

export const configureSchema = {
  tags: ['provision'],
  summary: 'Atualiza as credenciais de uma instalação',
  description:
    'Atualização parcial: aplica os campos recebidos sobre as credenciais salvas, valida o conjunto e testa a API key antes de gravar.',
  security: PLATFORM_SIGNATURE_SECURITY,
  body: z.object({ externalId: externalIdSchema, credentials: savedCredentials }),
  response: {
    200: envelope(z.object({ externalId: externalIdSchema }), 'Credenciais atualizadas'),
    ...signedCallErrors,
    404: errorEnvelope('Instalação não existe'),
    502: errorEnvelope('Chat Plataforma indisponível na validação da API key'),
  },
} satisfies FastifySchema

export const uninstallSchema = {
  tags: ['provision'],
  summary: 'Desinstala o app de uma organização',
  description: 'Idempotente: se o externalId não existe mais, responde 200 do mesmo jeito.',
  security: PLATFORM_SIGNATURE_SECURITY,
  body: z.object({ externalId: externalIdSchema }),
  response: {
    200: envelope(z.object({ success: z.boolean() }), 'Instalação removida (ou já inexistente)'),
    401: signedCallErrors[401],
    422: signedCallErrors[422],
    500: signedCallErrors[500],
  },
} satisfies FastifySchema

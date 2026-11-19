import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify'
import { describe, expect, it } from 'vitest'
import { ADMIN_MESSAGES, USER_MESSAGES } from '#src/core/utils/messages.ts'
import { errorHandler } from '#src/server/middlewares/error-handler.ts'

const handle = (url: string, error: Partial<FastifyError>) => {
  const sent: { status?: number; body?: unknown } = {}
  const reply = {
    status: (code: number) => {
      sent.status = code
      return reply
    },
    send: (body: unknown) => {
      sent.body = body
      return reply
    },
  }
  const req = { url, log: { warn: () => {}, error: () => {} } }

  errorHandler(
    Object.assign(new Error('falha'), error) as FastifyError,
    req as unknown as FastifyRequest,
    reply as unknown as FastifyReply,
  )

  return sent
}

describe('errorHandler com erros 4xx do próprio Fastify', () => {
  it('mantém o status 415 de Content-Type não suportado, no envelope padrão, e não 500', () => {
    const sent = handle('/api/provision/install', {
      statusCode: 415,
      code: 'FST_ERR_CTP_INVALID_MEDIA_TYPE',
    })

    expect(sent).toEqual({
      status: 415,
      body: { error: { message: ADMIN_MESSAGES.invalidRequest } },
    })
  })

  it('usa a mensagem do atendente nas rotas do iframe', () => {
    const sent = handle('/api/app/tickets/1', {
      statusCode: 413,
      code: 'FST_ERR_CTP_BODY_TOO_LARGE',
    })

    expect(sent).toEqual({
      status: 413,
      body: { error: { message: USER_MESSAGES.invalidRequest } },
    })
  })

  it('continua respondendo 500 genérico para erro sem status 4xx', () => {
    const sent = handle('/api/provision/install', {})

    expect(sent).toEqual({ status: 500, body: { error: { message: USER_MESSAGES.unexpected } } })
  })
})

import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify'
import { AppError } from '#src/core/utils/app-error.ts'
import { ADMIN_MESSAGES, USER_MESSAGES } from '#src/core/utils/messages.ts'
import { fail } from '#src/presentation/errors/api-error.ts'
import { IFRAME_ROUTES_PREFIX } from '#src/presentation/http.ts'

export const errorHandler = (err: FastifyError, req: FastifyRequest, reply: FastifyReply) => {
  if (err instanceof AppError && err.statusCode < 500) {
    req.log.warn({ err: { message: err.message }, statusCode: err.statusCode }, err.message)
    return reply.status(err.statusCode).send(fail(err.message))
  }
  if ((err as { validation?: unknown }).validation) {
    const detail = (err as Error).message
    req.log.warn({ validation: detail }, 'payload inválido')
    const audienceIsAttendant = req.url.startsWith(IFRAME_ROUTES_PREFIX)
    return reply
      .status(422)
      .send(
        fail(audienceIsAttendant ? USER_MESSAGES.invalidRequest : ADMIN_MESSAGES.invalidRequest),
      )
  }
  const clientStatus = (err as { statusCode?: number }).statusCode
  if (clientStatus !== undefined && clientStatus >= 400 && clientStatus < 500) {
    req.log.warn({ code: err.code, statusCode: clientStatus }, 'requisição inválida')
    const audienceIsAttendant = req.url.startsWith(IFRAME_ROUTES_PREFIX)
    return reply
      .status(clientStatus)
      .send(
        fail(audienceIsAttendant ? USER_MESSAGES.invalidRequest : ADMIN_MESSAGES.invalidRequest),
      )
  }
  const statusCode = err instanceof AppError ? err.statusCode : 500
  const message = err instanceof AppError ? err.message : USER_MESSAGES.unexpected
  req.log.error({ err, statusCode }, message)
  return reply.status(statusCode).send(fail(message))
}

export const notFoundHandler = (_req: FastifyRequest, reply: FastifyReply) =>
  reply.status(404).send(fail(ADMIN_MESSAGES.routeNotFound))

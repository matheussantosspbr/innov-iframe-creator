import { randomUUID } from 'node:crypto'
import type { IncomingMessage } from 'node:http'
import { HEADERS } from '@app/shared'
import type { onRequestAsyncHookHandler } from 'fastify'

const TRUSTED_REQUEST_ID = /^[A-Za-z0-9-]{16,64}$/

export const resolveRequestId = (req: IncomingMessage) => {
  const incoming = req.headers[HEADERS.requestId]
  return typeof incoming === 'string' && TRUSTED_REQUEST_ID.test(incoming) ? incoming : randomUUID()
}

export const exposeRequestId: onRequestAsyncHookHandler = async (req, reply) => {
  reply.header(HEADERS.requestId, req.id)
}

import type { IncomingMessage } from 'node:http'
import type {
  FastifyRequest,
  FastifySchema,
  RawServerDefault,
  RouteGenericInterface,
} from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import type { Installation } from '#src/core/repository/installation.repository.interface.ts'
import { AppError } from '#src/core/utils/app-error.ts'
import { USER_MESSAGES } from '#src/core/utils/messages.ts'
import type { RequestContext } from '#src/core/utils/request-context.ts'

declare module 'fastify' {
  interface FastifyRequest {
    installation?: Installation
  }
}

export const IFRAME_ROUTES_PREFIX = '/api/app'

export type ZodRequest<S extends FastifySchema> = FastifyRequest<
  RouteGenericInterface,
  RawServerDefault,
  IncomingMessage,
  S,
  ZodTypeProvider
>

export const contextOf = (req: { id: string; log: RequestContext['log'] }): RequestContext => ({
  requestId: req.id,
  log: req.log,
})

export const installationOf = (req: FastifyRequest): Installation => {
  if (!req.installation) throw new AppError(401, USER_MESSAGES.installationNotFound)
  return req.installation
}

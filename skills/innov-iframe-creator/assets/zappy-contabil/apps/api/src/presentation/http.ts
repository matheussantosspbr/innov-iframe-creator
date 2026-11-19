import type { IncomingMessage } from 'node:http'
import type {
  FastifyRequest,
  FastifySchema,
  RawServerDefault,
  RouteGenericInterface,
} from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { AppError } from '#src/core/utils/app-error.ts'
import { USER_MESSAGES } from '#src/core/utils/messages.ts'
import type { RequestContext, TenantContext } from '#src/core/utils/request-context.ts'

declare module 'fastify' {
  interface FastifyRequest {
    tenant?: TenantContext
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

export const tenantOf = (req: FastifyRequest): TenantContext => {
  if (!req.tenant) throw new AppError(400, USER_MESSAGES.missingTenantContext)
  return req.tenant
}

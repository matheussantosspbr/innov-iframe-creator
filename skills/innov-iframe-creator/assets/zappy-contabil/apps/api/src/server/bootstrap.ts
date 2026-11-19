import helmet from '@fastify/helmet'
import Fastify, { type FastifyInstance, type FastifyServerOptions, LogController } from 'fastify'
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod'
import type { TenantRepository } from '#src/core/repository/tenant.repository.interface.ts'
import type { ZappyClientFor } from '#src/core/repository/zappy-client.interface.ts'
import { createZappyClient } from '#src/infrastructure/libs/zappy/client.ts'
import { createGetTicketUseCase } from '#src/infrastructure/use-cases/get-ticket.use-case.ts'
import { createListConnectionsUseCase } from '#src/infrastructure/use-cases/list-connections.use-case.ts'
import { createListTenantsUseCase } from '#src/infrastructure/use-cases/list-tenants.use-case.ts'
import { createRegisterTenantUseCase } from '#src/infrastructure/use-cases/register-tenant.use-case.ts'
import { createRemoveTenantUseCase } from '#src/infrastructure/use-cases/remove-tenant.use-case.ts'
import { createSetTenantActiveUseCase } from '#src/infrastructure/use-cases/set-tenant-active.use-case.ts'
import { createClientLogsController } from '#src/presentation/controllers/client-logs.controller.ts'
import { createConnectionsController } from '#src/presentation/controllers/connections.controller.ts'
import { createTenantsController } from '#src/presentation/controllers/tenants.controller.ts'
import { createTicketsController } from '#src/presentation/controllers/tickets.controller.ts'
import { ok } from '#src/presentation/errors/api-error.ts'
import { IFRAME_ROUTES_PREFIX } from '#src/presentation/http.ts'
import { clientLogsRoutes } from '#src/presentation/routes/client-logs.routes.ts'
import { connectionsRoutes } from '#src/presentation/routes/connections.routes.ts'
import { tenantsRoutes } from '#src/presentation/routes/tenants.routes.ts'
import { ticketsRoutes } from '#src/presentation/routes/tickets.routes.ts'
import { requireComhubKey } from './middlewares/comhub-key.ts'
import { errorHandler, notFoundHandler } from './middlewares/error-handler.ts'
import { registerJsonBodyParser } from './middlewares/json-body-parser.ts'
import { exposeRequestId, resolveRequestId } from './middlewares/request-id.ts'
import { requireTenantContext } from './middlewares/tenant-context.ts'
import { registerSwagger } from './plugins/swagger.ts'

export type AppDeps = {
  tenants: TenantRepository
  comhubKey: string
  zappyClientFor?: ZappyClientFor
  logger?: FastifyServerOptions['logger']
  iframeRoutes?: (iframe: FastifyInstance) => Promise<void> | void
}

export const buildApp = async (deps: AppDeps) => {
  const app = Fastify({
    logger: deps.logger ?? false,
    genReqId: resolveRequestId,
    logController: new LogController({ requestIdLogLabel: 'requestId' }),
  }).withTypeProvider<ZodTypeProvider>()
  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)

  const clientFor: ZappyClientFor =
    deps.zappyClientFor ?? ((credentials) => createZappyClient(credentials))

  registerJsonBodyParser(app)
  app.addHook('onRequest', exposeRequestId)

  await app.register(helmet)
  await registerSwagger(app)

  app.setErrorHandler(errorHandler)
  app.setNotFoundHandler(notFoundHandler)

  app.get('/api/health', { logLevel: 'warn', schema: { hide: true } }, async () =>
    ok({ status: 'ok' }),
  )

  const tenants = deps.tenants
  const useCases = {
    registerTenant: createRegisterTenantUseCase({ tenants, clientFor }),
    listTenants: createListTenantsUseCase({ tenants }),
    setTenantActive: createSetTenantActiveUseCase({ tenants }),
    removeTenant: createRemoveTenantUseCase({ tenants }),
    listConnections: createListConnectionsUseCase({ clientFor }),
    getTicket: createGetTicketUseCase({ clientFor }),
  }
  const controllers = {
    tenants: createTenantsController({
      register: useCases.registerTenant,
      list: useCases.listTenants,
      setActive: useCases.setTenantActive,
      remove: useCases.removeTenant,
    }),
    connections: createConnectionsController(useCases.listConnections),
    tickets: createTicketsController(useCases.getTicket),
    clientLogs: createClientLogsController(),
  }

  await app.register(tenantsRoutes, {
    prefix: '/api/tenants',
    controller: controllers.tenants,
    authenticate: requireComhubKey(deps.comhubKey),
  })
  await app.register(
    async (iframe) => {
      iframe.addHook('onRequest', requireTenantContext(tenants))
      await iframe.register(connectionsRoutes, { controller: controllers.connections })
      await iframe.register(ticketsRoutes, { controller: controllers.tickets })
      await iframe.register(clientLogsRoutes, { controller: controllers.clientLogs })
      await deps.iframeRoutes?.(iframe)
    },
    { prefix: IFRAME_ROUTES_PREFIX },
  )

  return app
}

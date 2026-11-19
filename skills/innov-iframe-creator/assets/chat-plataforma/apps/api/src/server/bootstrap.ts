import helmet from '@fastify/helmet'
import Fastify, { type FastifyServerOptions, LogController } from 'fastify'
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod'
import type { ClientFor } from '#src/core/repository/chat-plataforma-client.interface.ts'
import type { InstallationRepository } from '#src/core/repository/installation.repository.interface.ts'
import { createChatPlataformaClient } from '#src/infrastructure/libs/chatplataforma/client.ts'
import { createConfigureUseCase } from '#src/infrastructure/use-cases/configure.use-case.ts'
import { createGetDiagnosticsUseCase } from '#src/infrastructure/use-cases/get-diagnostics.use-case.ts'
import { createGetTicketUseCase } from '#src/infrastructure/use-cases/get-ticket.use-case.ts'
import { createInstallUseCase } from '#src/infrastructure/use-cases/install.use-case.ts'
import { createUninstallUseCase } from '#src/infrastructure/use-cases/uninstall.use-case.ts'
import { createClientLogsController } from '#src/presentation/controllers/client-logs.controller.ts'
import { createDiagnosticsController } from '#src/presentation/controllers/diagnostics.controller.ts'
import { createProvisioningController } from '#src/presentation/controllers/provisioning.controller.ts'
import { createTicketsController } from '#src/presentation/controllers/tickets.controller.ts'
import { ok } from '#src/presentation/errors/api-error.ts'
import { IFRAME_ROUTES_PREFIX } from '#src/presentation/http.ts'
import { clientLogsRoutes } from '#src/presentation/routes/client-logs.routes.ts'
import { diagnosticsRoutes } from '#src/presentation/routes/diagnostics.routes.ts'
import { provisioningRoutes } from '#src/presentation/routes/provisioning.routes.ts'
import { ticketsRoutes } from '#src/presentation/routes/tickets.routes.ts'
import { healthSchema } from '#src/presentation/schemas/health.schemas.ts'
import { requireDiagnosticsToken } from './middlewares/diagnostics-token.ts'
import { errorHandler, notFoundHandler } from './middlewares/error-handler.ts'
import { requireInstallation } from './middlewares/iframe-installation.ts'
import { registerJsonBodyParser } from './middlewares/json-body-parser.ts'
import { requirePlatformSignature } from './middlewares/platform-signature.ts'
import { exposeRequestId, resolveRequestId } from './middlewares/request-id.ts'
import { registerSwagger } from './plugins/swagger.ts'

export type AppDeps = {
  repo: InstallationRepository
  secret: string
  chatPlataformaUrl: string
  clientFor?: ClientFor
  logger?: FastifyServerOptions['logger']
}

export const buildApp = async (deps: AppDeps) => {
  const app = Fastify({
    logger: deps.logger ?? false,
    genReqId: resolveRequestId,
    logController: new LogController({ requestIdLogLabel: 'requestId' }),
  }).withTypeProvider<ZodTypeProvider>()
  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)

  const clientFor: ClientFor =
    deps.clientFor ??
    ((credentials, options) =>
      createChatPlataformaClient({
        baseUrl: deps.chatPlataformaUrl,
        apiKey: credentials.chatPlataformaApiKey,
        ...options,
      }))

  registerJsonBodyParser(app)
  app.addHook('onRequest', exposeRequestId)

  await app.register(helmet)
  await registerSwagger(app)

  app.setErrorHandler(errorHandler)
  app.setNotFoundHandler(notFoundHandler)

  app.get('/api/health', { logLevel: 'warn', schema: healthSchema }, async () =>
    ok({ status: 'ok' }),
  )

  const installations = deps.repo
  const useCases = {
    install: createInstallUseCase({ installations, clientFor }),
    configure: createConfigureUseCase({ installations, clientFor }),
    uninstall: createUninstallUseCase({ installations }),
    getDiagnostics: createGetDiagnosticsUseCase({ installations, clientFor }),
    getTicket: createGetTicketUseCase({ clientFor }),
  }
  const controllers = {
    provisioning: createProvisioningController(useCases),
    diagnostics: createDiagnosticsController(useCases.getDiagnostics),
    tickets: createTicketsController(useCases.getTicket),
    clientLogs: createClientLogsController(),
  }

  await app.register(provisioningRoutes, {
    prefix: '/api/provision',
    controller: controllers.provisioning,
    authenticate: requirePlatformSignature(deps.secret),
  })
  await app.register(diagnosticsRoutes, {
    prefix: '/api/instances',
    controller: controllers.diagnostics,
    authenticate: requireDiagnosticsToken(deps.secret),
  })
  await app.register(
    async (iframe) => {
      iframe.addHook('onRequest', requireInstallation(installations))
      await iframe.register(ticketsRoutes, { controller: controllers.tickets })
      await iframe.register(clientLogsRoutes, { controller: controllers.clientLogs })
    },
    { prefix: IFRAME_ROUTES_PREFIX },
  )

  return app
}

import type { onRequestAsyncHookHandler } from 'fastify'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import type { DiagnosticsController } from '../controllers/diagnostics.controller.ts'
import { checkSchema } from '../schemas/diagnostics.schemas.ts'

type Opts = { controller: DiagnosticsController; authenticate: onRequestAsyncHookHandler }

export const diagnosticsRoutes: FastifyPluginAsyncZod<Opts> = async (
  app,
  { controller, authenticate },
) => {
  app.get(
    '/:externalId/diagnostics',
    {
      schema: checkSchema,
      onRequest: authenticate,
    },
    controller.check,
  )
}

import type { preValidationAsyncHookHandler } from 'fastify'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import type { ProvisioningController } from '../controllers/provisioning.controller.ts'
import { configureSchema, installSchema, uninstallSchema } from '../schemas/provisioning.schemas.ts'

type Opts = { controller: ProvisioningController; authenticate: preValidationAsyncHookHandler }

export const provisioningRoutes: FastifyPluginAsyncZod<Opts> = async (
  app,
  { controller, authenticate },
) => {
  app.addHook('preValidation', authenticate)

  app.post('/install', { schema: installSchema }, controller.install)
  app.post('/configure', { schema: configureSchema }, controller.configure)
  app.post('/uninstall', { schema: uninstallSchema }, controller.uninstall)
}

import type { onRequestAsyncHookHandler } from 'fastify'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import type { TenantsController } from '../controllers/tenants.controller.ts'
import {
  createTenantSchema,
  listTenantsSchema,
  removeTenantSchema,
  setTenantActiveSchema,
} from '../schemas/tenants.schemas.ts'

type Opts = { controller: TenantsController; authenticate: onRequestAsyncHookHandler }

export const tenantsRoutes: FastifyPluginAsyncZod<Opts> = async (
  app,
  { controller, authenticate },
) => {
  app.addHook('onRequest', authenticate)

  app.post('/', { schema: createTenantSchema }, controller.create)
  app.get('/', { schema: listTenantsSchema }, controller.list)
  app.patch('/:tenantId', { schema: setTenantActiveSchema }, controller.setActive)
  app.delete('/:tenantId', { schema: removeTenantSchema }, controller.remove)
}

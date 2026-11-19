import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import type { ConnectionsController } from '../controllers/connections.controller.ts'
import { listConnectionsSchema } from '../schemas/connections.schemas.ts'

type Opts = { controller: ConnectionsController }

export const connectionsRoutes: FastifyPluginAsyncZod<Opts> = async (app, { controller }) => {
  app.get('/connections', { schema: listConnectionsSchema }, controller.list)
}

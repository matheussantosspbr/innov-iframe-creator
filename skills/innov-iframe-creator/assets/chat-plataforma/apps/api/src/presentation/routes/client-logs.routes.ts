import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import type { ClientLogsController } from '../controllers/client-logs.controller.ts'
import { recordSchema } from '../schemas/client-logs.schemas.ts'

type Opts = { controller: ClientLogsController }

export const clientLogsRoutes: FastifyPluginAsyncZod<Opts> = async (app, { controller }) => {
  app.post('/client-logs', { schema: recordSchema }, controller.record)
}

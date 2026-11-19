import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import type { TicketsController } from '../controllers/tickets.controller.ts'
import { getTicketSchema } from '../schemas/tickets.schemas.ts'

type Opts = { controller: TicketsController }

export const ticketsRoutes: FastifyPluginAsyncZod<Opts> = async (app, { controller }) => {
  app.get('/tickets/:ticketId', { schema: getTicketSchema }, controller.getTicket)
}

import type { GetTicketUseCase } from '#src/core/use-cases/get-ticket-use-case.interface.ts'
import { ok } from '../errors/api-error.ts'
import { contextOf, installationOf, type ZodRequest } from '../http.ts'
import type { getTicketSchema } from '../schemas/tickets.schemas.ts'

export type TicketsController = ReturnType<typeof createTicketsController>

export const createTicketsController = (getTicket: GetTicketUseCase) => ({
  getTicket: async (req: ZodRequest<typeof getTicketSchema>) =>
    ok(await getTicket.execute(installationOf(req), req.params.ticketId, contextOf(req))),
})

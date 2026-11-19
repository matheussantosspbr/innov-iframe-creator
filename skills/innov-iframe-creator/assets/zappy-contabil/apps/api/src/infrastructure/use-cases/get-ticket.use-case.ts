import type { ZappyClientFor } from '#src/core/repository/zappy-client.interface.ts'
import type { GetTicketUseCase } from '#src/core/use-cases/get-ticket-use-case.interface.ts'

export const createGetTicketUseCase = (deps: { clientFor: ZappyClientFor }): GetTicketUseCase => ({
  execute: (tenant, ticketId) => deps.clientFor(tenant.credentials).getTicket(ticketId),
})

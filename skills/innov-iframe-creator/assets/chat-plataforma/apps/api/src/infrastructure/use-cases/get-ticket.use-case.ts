import type { ClientFor } from '#src/core/repository/chat-plataforma-client.interface.ts'
import type { GetTicketUseCase } from '#src/core/use-cases/get-ticket-use-case.interface.ts'

export const createGetTicketUseCase = (deps: { clientFor: ClientFor }): GetTicketUseCase => ({
  execute: (installation, ticketId, ctx) =>
    deps.clientFor(installation.credentials, { requestId: ctx.requestId }).getTicket(ticketId),
})

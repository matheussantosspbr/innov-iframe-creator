import type { TicketView } from '@app/shared'
import type { Installation } from '../repository/installation.repository.interface.ts'
import type { RequestContext } from '../utils/request-context.ts'

export interface GetTicketUseCase {
  execute(installation: Installation, ticketId: string, ctx: RequestContext): Promise<TicketView>
}

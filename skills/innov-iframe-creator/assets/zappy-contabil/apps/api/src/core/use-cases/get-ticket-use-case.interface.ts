import type { TicketView } from '@app/shared'
import type { TenantContext } from '../utils/request-context.ts'

export interface GetTicketUseCase {
  execute(tenant: TenantContext, ticketId: number): Promise<TicketView>
}

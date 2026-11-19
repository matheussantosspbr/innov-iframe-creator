import type { ZappyConnection } from '../repository/zappy-client.interface.ts'
import type { TenantContext } from '../utils/request-context.ts'

export interface ListConnectionsUseCase {
  execute(tenant: TenantContext): Promise<readonly ZappyConnection[]>
}

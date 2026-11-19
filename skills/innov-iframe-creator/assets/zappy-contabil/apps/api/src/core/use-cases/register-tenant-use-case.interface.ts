import type { Tenant } from '../repository/tenant.repository.interface.ts'
import type { RequestContext } from '../utils/request-context.ts'

export type RegisterTenantInput = Readonly<{
  name: string
  zappyUrl: string
  zappyToken: string
}>

export interface RegisterTenantUseCase {
  execute(input: RegisterTenantInput, ctx: RequestContext): Promise<Tenant>
}

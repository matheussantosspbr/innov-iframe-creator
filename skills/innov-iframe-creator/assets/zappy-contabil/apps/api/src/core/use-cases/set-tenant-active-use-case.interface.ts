import type { RequestContext } from '../utils/request-context.ts'

export interface SetTenantActiveUseCase {
  execute(tenantId: string, active: boolean, ctx: RequestContext): Promise<void>
}

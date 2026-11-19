import type { RequestContext } from '../utils/request-context.ts'

export interface RemoveTenantUseCase {
  execute(tenantId: string, ctx: RequestContext): Promise<void>
}

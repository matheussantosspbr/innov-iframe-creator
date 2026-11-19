import type { RequestContext } from '../utils/request-context.ts'

export interface UninstallUseCase {
  execute(externalId: string, ctx: RequestContext): Promise<void>
}

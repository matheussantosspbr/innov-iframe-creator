import type { PlatformCredentials } from '../utils/credentials.ts'
import type { RequestContext } from '../utils/request-context.ts'

export interface ConfigureUseCase {
  execute(externalId: string, received: PlatformCredentials, ctx: RequestContext): Promise<void>
}

import type { PlatformCredentials } from '../utils/credentials.ts'
import type { RequestContext } from '../utils/request-context.ts'

export interface InstallUseCase {
  execute(received: PlatformCredentials, ctx: RequestContext): Promise<string>
}

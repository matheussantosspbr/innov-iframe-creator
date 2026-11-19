import type { DiagnosticReport } from '../utils/diagnostics.ts'
import type { RequestContext } from '../utils/request-context.ts'

export interface GetDiagnosticsUseCase {
  execute(externalId: string, ctx: RequestContext): Promise<DiagnosticReport>
}

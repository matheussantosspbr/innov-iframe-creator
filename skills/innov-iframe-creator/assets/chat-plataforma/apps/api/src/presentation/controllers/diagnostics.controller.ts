import type { GetDiagnosticsUseCase } from '#src/core/use-cases/get-diagnostics-use-case.interface.ts'
import { ok } from '../errors/api-error.ts'
import { contextOf, type ZodRequest } from '../http.ts'
import type { checkSchema } from '../schemas/diagnostics.schemas.ts'

export type DiagnosticsController = ReturnType<typeof createDiagnosticsController>

export const createDiagnosticsController = (getDiagnostics: GetDiagnosticsUseCase) => ({
  check: async (req: ZodRequest<typeof checkSchema>) =>
    ok(await getDiagnostics.execute(req.params.externalId, contextOf(req))),
})

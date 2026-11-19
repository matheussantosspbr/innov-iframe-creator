import type { ClientFor } from '#src/core/repository/chat-plataforma-client.interface.ts'
import type { InstallationRepository } from '#src/core/repository/installation.repository.interface.ts'
import type { GetDiagnosticsUseCase } from '#src/core/use-cases/get-diagnostics-use-case.interface.ts'
import { AppError } from '#src/core/utils/app-error.ts'
import {
  aggregate,
  DIAGNOSTIC_COMPONENT,
  DIAGNOSTIC_STATUS,
  type DiagnosticComponent,
} from '#src/core/utils/diagnostics.ts'
import { LOG_EVENT } from '#src/core/utils/log-events.ts'
import { ADMIN_MESSAGES } from '#src/core/utils/messages.ts'

const technicalDetail = (err: unknown): string => {
  if (!(err instanceof Error)) return String(err)
  return err.cause instanceof Error ? err.cause.message : err.message
}

const check = async (name: string, fn: () => Promise<unknown>): Promise<DiagnosticComponent> => {
  try {
    await fn()
    return { name, status: DIAGNOSTIC_STATUS.operational }
  } catch (err) {
    return { name, status: DIAGNOSTIC_STATUS.outage, detail: technicalDetail(err) }
  }
}

export const createGetDiagnosticsUseCase = (deps: {
  installations: InstallationRepository
  clientFor: ClientFor
}): GetDiagnosticsUseCase => ({
  execute: async (externalId, ctx) => {
    const installation = await deps.installations.find(externalId)
    if (!installation) throw new AppError(404, ADMIN_MESSAGES.installationNotFound)

    const components = await Promise.all([
      check(DIAGNOSTIC_COMPONENT.database, () => deps.installations.ping()),
      check(DIAGNOSTIC_COMPONENT.chatPlataformaApi, () =>
        deps.clientFor(installation.credentials, { requestId: ctx.requestId }).getMyPermissions(),
      ),
    ])

    const status = aggregate(components)
    const log = status === DIAGNOSTIC_STATUS.operational ? ctx.log.info : ctx.log.warn
    log.call(
      ctx.log,
      { externalId, status, components, event: LOG_EVENT.diagnosticsChecked },
      `diagnóstico ${status}`,
    )

    return { externalId, status, components, checkedAt: new Date().toISOString() }
  },
})

import type { InstallationRepository } from '#src/core/repository/installation.repository.interface.ts'
import type { UninstallUseCase } from '#src/core/use-cases/uninstall-use-case.interface.ts'
import { LOG_EVENT } from '#src/core/utils/log-events.ts'

export const createUninstallUseCase = (deps: {
  installations: InstallationRepository
}): UninstallUseCase => ({
  execute: async (externalId, ctx) => {
    const removed = await deps.installations.delete(externalId)
    ctx.log.info(
      { externalId, removed, event: LOG_EVENT.installationUninstalled },
      removed ? 'aplicativo desinstalado' : 'desinstalação de instância já inexistente',
    )
  },
})

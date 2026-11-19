import { randomUUID } from 'node:crypto'
import type { ClientFor } from '#src/core/repository/chat-plataforma-client.interface.ts'
import type { InstallationRepository } from '#src/core/repository/installation.repository.interface.ts'
import type { InstallUseCase } from '#src/core/use-cases/install-use-case.interface.ts'
import { applyPlatformCredentials, toValidCredentials } from '#src/core/utils/credentials.ts'
import { LOG_EVENT } from '#src/core/utils/log-events.ts'
import { assertApiKeyWorks } from './assert-api-key-works.ts'

export const createInstallUseCase = (deps: {
  installations: InstallationRepository
  clientFor: ClientFor
}): InstallUseCase => ({
  execute: async (received, ctx) => {
    const credentials = toValidCredentials(applyPlatformCredentials({}, received))
    await assertApiKeyWorks(deps.clientFor, credentials, ctx)
    const externalId = randomUUID()
    await deps.installations.create({ externalId, credentials })
    ctx.log.info({ externalId, event: LOG_EVENT.installationInstalled }, 'aplicativo instalado')
    return externalId
  },
})

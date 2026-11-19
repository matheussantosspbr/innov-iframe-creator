import type { ClientFor } from '#src/core/repository/chat-plataforma-client.interface.ts'
import type { InstallationRepository } from '#src/core/repository/installation.repository.interface.ts'
import type { ConfigureUseCase } from '#src/core/use-cases/configure-use-case.interface.ts'
import { AppError } from '#src/core/utils/app-error.ts'
import { applyPlatformCredentials, toValidCredentials } from '#src/core/utils/credentials.ts'
import { LOG_EVENT } from '#src/core/utils/log-events.ts'
import { ADMIN_MESSAGES } from '#src/core/utils/messages.ts'
import { assertApiKeyWorks } from './assert-api-key-works.ts'

export const createConfigureUseCase = (deps: {
  installations: InstallationRepository
  clientFor: ClientFor
}): ConfigureUseCase => ({
  execute: async (externalId, received, ctx) => {
    const installation = await deps.installations.find(externalId)
    if (!installation) throw new AppError(404, ADMIN_MESSAGES.installationNotFound)
    const credentials = toValidCredentials(
      applyPlatformCredentials(installation.credentials, received),
    )
    await assertApiKeyWorks(deps.clientFor, credentials, ctx)
    await deps.installations.update({ externalId, credentials })
    ctx.log.info({ externalId, event: LOG_EVENT.installationConfigured }, 'credenciais atualizadas')
  },
})

import type { ClientFor } from '#src/core/repository/chat-plataforma-client.interface.ts'
import { AppError } from '#src/core/utils/app-error.ts'
import { ChatPlataformaError } from '#src/core/utils/chat-plataforma-error.ts'
import type { Credentials } from '#src/core/utils/credentials.ts'
import { ADMIN_MESSAGES, missingPermissionsMessage } from '#src/core/utils/messages.ts'
import type { RequestContext } from '#src/core/utils/request-context.ts'
import { missingPermissions } from '#src/infrastructure/libs/chatplataforma/permissions.ts'

export const PROVISION_TIMEOUT_MS = 5_000

export const assertApiKeyWorks = async (
  clientFor: ClientFor,
  credentials: Credentials,
  ctx: RequestContext,
) => {
  try {
    const granted = await clientFor(credentials, {
      requestId: ctx.requestId,
      timeoutMs: PROVISION_TIMEOUT_MS,
    }).getMyPermissions()
    const missing = missingPermissions(granted)
    if (missing.length > 0) throw new AppError(422, missingPermissionsMessage(missing))
  } catch (err) {
    if (!(err instanceof ChatPlataformaError)) throw err
    ctx.log.warn(
      { err: err.cause, upstreamStatus: err.upstreamStatus },
      'API key recusada na validação',
    )
    if (err.upstreamStatus === 401) {
      throw new AppError(422, ADMIN_MESSAGES.invalidApiKey, { cause: err })
    }
    if (err.upstreamStatus === 403) {
      throw new AppError(422, ADMIN_MESSAGES.apiKeyBlocked, { cause: err })
    }
    throw new AppError(502, ADMIN_MESSAGES.chatPlataformaUnavailable, { cause: err })
  }
}

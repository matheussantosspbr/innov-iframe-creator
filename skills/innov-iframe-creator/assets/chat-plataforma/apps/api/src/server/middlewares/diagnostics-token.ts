import type { onRequestAsyncHookHandler } from 'fastify'
import { AppError } from '#src/core/utils/app-error.ts'
import { ADMIN_MESSAGES } from '#src/core/utils/messages.ts'
import { verifyDiagnosticsToken } from '#src/infrastructure/libs/jwt.ts'

export const requireDiagnosticsToken =
  (secret: string): onRequestAsyncHookHandler =>
  async (req) => {
    const { externalId } = req.params as { externalId: string }
    const valid = await verifyDiagnosticsToken({
      secret,
      authorization: req.headers.authorization,
      externalId,
    })
    if (!valid) throw new AppError(401, ADMIN_MESSAGES.untrustedCall)
  }

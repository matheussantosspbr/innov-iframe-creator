import type { preValidationAsyncHookHandler } from 'fastify'
import { AppError } from '#src/core/utils/app-error.ts'
import { ADMIN_MESSAGES } from '#src/core/utils/messages.ts'
import { verifyHmac } from '#src/infrastructure/libs/hmac.ts'

declare module 'fastify' {
  interface FastifyRequest {
    rawBody?: string
  }
}

export const requirePlatformSignature =
  (secret: string): preValidationAsyncHookHandler =>
  async (req) => {
    const valid = verifyHmac({
      secret,
      timestamp: req.headers['x-timestamp'] as string | undefined,
      signature: req.headers['x-signature'] as string | undefined,
      rawBody: req.rawBody ?? '',
    })
    if (!valid) throw new AppError(401, ADMIN_MESSAGES.untrustedCall)
  }

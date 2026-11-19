import { createHash, timingSafeEqual } from 'node:crypto'
import type { onRequestAsyncHookHandler } from 'fastify'
import { AppError } from '#src/core/utils/app-error.ts'
import { ADMIN_MESSAGES } from '#src/core/utils/messages.ts'

export const COMHUB_KEY_HEADER = 'x-comhub-key'

const digest = (value: string) => createHash('sha256').update(value).digest()

export const requireComhubKey = (expected: string): onRequestAsyncHookHandler => {
  const expectedDigest = digest(expected)
  return async (req) => {
    const received = req.headers[COMHUB_KEY_HEADER]
    if (typeof received !== 'string' || !timingSafeEqual(digest(received), expectedDigest)) {
      throw new AppError(401, ADMIN_MESSAGES.unauthorizedOperation)
    }
  }
}

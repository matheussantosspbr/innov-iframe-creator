import type { FastifyInstance } from 'fastify'
import { AppError } from '#src/core/utils/app-error.ts'
import { ADMIN_MESSAGES, USER_MESSAGES } from '#src/core/utils/messages.ts'
import { IFRAME_ROUTES_PREFIX } from '#src/presentation/http.ts'

export const registerJsonBodyParser = (app: FastifyInstance) =>
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
    try {
      done(null, body ? JSON.parse(body as string) : undefined)
    } catch {
      done(
        new AppError(
          422,
          req.url.startsWith(IFRAME_ROUTES_PREFIX)
            ? USER_MESSAGES.invalidRequest
            : ADMIN_MESSAGES.invalidRequest,
        ),
        undefined,
      )
    }
  })

import { LOG_EVENT } from '#src/core/utils/log-events.ts'
import { ok } from '../errors/api-error.ts'
import type { ZodRequest } from '../http.ts'
import type { recordSchema } from '../schemas/client-logs.schemas.ts'

export type ClientLogsController = ReturnType<typeof createClientLogsController>

export const createClientLogsController = () => ({
  record: async (req: ZodRequest<typeof recordSchema>) => {
    const { level, message, context } = req.body
    req.log[level]({ event: LOG_EVENT.clientLogReceived, source: 'web', ...context }, message)
    return ok({ received: true })
  },
})

import { HEADERS } from '@app/shared'
import type { onRequestAsyncHookHandler } from 'fastify'
import type { InstallationRepository } from '#src/core/repository/installation.repository.interface.ts'
import { AppError } from '#src/core/utils/app-error.ts'
import { USER_MESSAGES } from '#src/core/utils/messages.ts'

const SNOWFLAKE = /^\d{1,20}$/
const snowflakeHeader = (value: unknown) =>
  typeof value === 'string' && SNOWFLAKE.test(value) ? value : undefined

export const requireInstallation =
  (installations: InstallationRepository): onRequestAsyncHookHandler =>
  async (req) => {
    const accountId = req.headers[HEADERS.accountId]
    const installation = typeof accountId === 'string' ? await installations.find(accountId) : null
    if (!installation) throw new AppError(401, USER_MESSAGES.installationNotFound)
    req.installation = installation
    req.log = req.log.child({
      externalId: installation.externalId,
      agentId: snowflakeHeader(req.headers[HEADERS.agentId]),
      ticketId: snowflakeHeader(req.headers[HEADERS.ticketId]),
    })
  }

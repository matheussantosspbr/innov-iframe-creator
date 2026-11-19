import { HEADERS } from '@app/shared'
import type { onRequestAsyncHookHandler } from 'fastify'
import type { TenantRepository } from '#src/core/repository/tenant.repository.interface.ts'
import { AppError } from '#src/core/utils/app-error.ts'
import { USER_MESSAGES } from '#src/core/utils/messages.ts'

const headerValue = (value: unknown) =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined

export const requireTenantContext =
  (tenants: TenantRepository): onRequestAsyncHookHandler =>
  async (req) => {
    const tenantId = headerValue(req.headers[HEADERS.tenantId])
    const userId = headerValue(req.headers[HEADERS.userId])
    if (!tenantId || !userId) throw new AppError(400, USER_MESSAGES.missingTenantContext)
    const tenant = await tenants.findById(tenantId)
    if (!tenant) throw new AppError(404, USER_MESSAGES.tenantNotFound)
    if (!tenant.active) throw new AppError(403, USER_MESSAGES.tenantInactive)
    req.tenant = { tenantId, userId, credentials: tenant.credentials }
    req.log = req.log.child({ tenantId, userId })
  }

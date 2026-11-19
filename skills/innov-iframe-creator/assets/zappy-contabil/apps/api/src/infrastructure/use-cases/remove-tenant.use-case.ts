import type { TenantRepository } from '#src/core/repository/tenant.repository.interface.ts'
import type { RemoveTenantUseCase } from '#src/core/use-cases/remove-tenant-use-case.interface.ts'
import { AppError } from '#src/core/utils/app-error.ts'
import { LOG_EVENT } from '#src/core/utils/log-events.ts'
import { ADMIN_MESSAGES } from '#src/core/utils/messages.ts'

export const createRemoveTenantUseCase = (deps: {
  tenants: TenantRepository
}): RemoveTenantUseCase => ({
  execute: async (tenantId, ctx) => {
    if (!(await deps.tenants.remove(tenantId))) {
      throw new AppError(404, ADMIN_MESSAGES.tenantNotFound)
    }
    ctx.log.info({ tenantId, event: LOG_EVENT.tenantRemoved }, 'empresa removida')
  },
})

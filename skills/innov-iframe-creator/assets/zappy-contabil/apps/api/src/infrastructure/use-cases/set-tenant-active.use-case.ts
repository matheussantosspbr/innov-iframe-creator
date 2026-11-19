import type { TenantRepository } from '#src/core/repository/tenant.repository.interface.ts'
import type { SetTenantActiveUseCase } from '#src/core/use-cases/set-tenant-active-use-case.interface.ts'
import { AppError } from '#src/core/utils/app-error.ts'
import { LOG_EVENT } from '#src/core/utils/log-events.ts'
import { ADMIN_MESSAGES } from '#src/core/utils/messages.ts'

export const createSetTenantActiveUseCase = (deps: {
  tenants: TenantRepository
}): SetTenantActiveUseCase => ({
  execute: async (tenantId, active, ctx) => {
    if (!(await deps.tenants.setActive(tenantId, active))) {
      throw new AppError(404, ADMIN_MESSAGES.tenantNotFound)
    }
    ctx.log.info({ tenantId, active, event: LOG_EVENT.tenantActiveChanged }, 'empresa atualizada')
  },
})

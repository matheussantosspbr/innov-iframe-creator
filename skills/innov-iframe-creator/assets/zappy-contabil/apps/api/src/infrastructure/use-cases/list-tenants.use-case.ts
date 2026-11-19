import type { TenantRepository } from '#src/core/repository/tenant.repository.interface.ts'
import type { ListTenantsUseCase } from '#src/core/use-cases/list-tenants-use-case.interface.ts'

export const createListTenantsUseCase = (deps: {
  tenants: TenantRepository
}): ListTenantsUseCase => ({
  execute: () => deps.tenants.list(),
})

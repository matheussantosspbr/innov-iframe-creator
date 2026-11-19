import type { Tenant } from '../repository/tenant.repository.interface.ts'

export interface ListTenantsUseCase {
  execute(): Promise<readonly Tenant[]>
}

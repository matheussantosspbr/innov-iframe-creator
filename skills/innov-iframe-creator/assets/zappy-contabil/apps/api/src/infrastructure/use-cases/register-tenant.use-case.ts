import { randomUUID } from 'node:crypto'
import type { TenantRepository } from '#src/core/repository/tenant.repository.interface.ts'
import type { ZappyClientFor } from '#src/core/repository/zappy-client.interface.ts'
import type { RegisterTenantUseCase } from '#src/core/use-cases/register-tenant-use-case.interface.ts'
import { LOG_EVENT } from '#src/core/utils/log-events.ts'

const normalizeUrl = (url: string) => url.trim().replace(/\/+$/, '').toLowerCase()

export const createRegisterTenantUseCase = (deps: {
  tenants: TenantRepository
  clientFor: ZappyClientFor
}): RegisterTenantUseCase => ({
  execute: async ({ name, zappyUrl, zappyToken }, ctx) => {
    const baseUrl = normalizeUrl(zappyUrl)
    const token = zappyToken.trim()
    await deps.clientFor({ baseUrl, token }).verify()
    const tenant = await deps.tenants.create({
      id: randomUUID(),
      name: name.trim(),
      zappyUrl: baseUrl,
      zappyToken: token,
    })
    ctx.log.info({ tenantId: tenant.id, event: LOG_EVENT.tenantRegistered }, 'empresa cadastrada')
    return tenant
  },
})

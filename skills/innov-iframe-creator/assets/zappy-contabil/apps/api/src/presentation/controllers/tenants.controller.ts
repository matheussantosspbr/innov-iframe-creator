import type { FastifyReply } from 'fastify'
import type { ListTenantsUseCase } from '#src/core/use-cases/list-tenants-use-case.interface.ts'
import type { RegisterTenantUseCase } from '#src/core/use-cases/register-tenant-use-case.interface.ts'
import type { RemoveTenantUseCase } from '#src/core/use-cases/remove-tenant-use-case.interface.ts'
import type { SetTenantActiveUseCase } from '#src/core/use-cases/set-tenant-active-use-case.interface.ts'
import { ok } from '../errors/api-error.ts'
import { contextOf, type ZodRequest } from '../http.ts'
import type {
  createTenantSchema,
  removeTenantSchema,
  setTenantActiveSchema,
} from '../schemas/tenants.schemas.ts'

export type TenantsController = ReturnType<typeof createTenantsController>

export const createTenantsController = (useCases: {
  register: RegisterTenantUseCase
  list: ListTenantsUseCase
  setActive: SetTenantActiveUseCase
  remove: RemoveTenantUseCase
}) => ({
  create: async (req: ZodRequest<typeof createTenantSchema>, reply: FastifyReply) =>
    reply.status(201).send(ok(await useCases.register.execute(req.body, contextOf(req)))),

  list: async () => ok([...(await useCases.list.execute())]),

  setActive: async (req: ZodRequest<typeof setTenantActiveSchema>) => {
    const { tenantId } = req.params
    const { active } = req.body
    await useCases.setActive.execute(tenantId, active, contextOf(req))
    return ok({ id: tenantId, active })
  },

  remove: async (req: ZodRequest<typeof removeTenantSchema>) => {
    await useCases.remove.execute(req.params.tenantId, contextOf(req))
    return ok({ id: req.params.tenantId })
  },
})

import type { FastifyReply } from 'fastify'
import type { ConfigureUseCase } from '#src/core/use-cases/configure-use-case.interface.ts'
import type { InstallUseCase } from '#src/core/use-cases/install-use-case.interface.ts'
import type { UninstallUseCase } from '#src/core/use-cases/uninstall-use-case.interface.ts'
import { ok } from '../errors/api-error.ts'
import { contextOf, type ZodRequest } from '../http.ts'
import type {
  configureSchema,
  installSchema,
  uninstallSchema,
} from '../schemas/provisioning.schemas.ts'

export type ProvisioningController = ReturnType<typeof createProvisioningController>

export const createProvisioningController = (useCases: {
  install: InstallUseCase
  configure: ConfigureUseCase
  uninstall: UninstallUseCase
}) => ({
  install: async (req: ZodRequest<typeof installSchema>, reply: FastifyReply) => {
    const externalId = await useCases.install.execute(req.body, contextOf(req))
    return reply.status(201).send(ok({ externalId }))
  },

  configure: async (req: ZodRequest<typeof configureSchema>) => {
    const { externalId, credentials } = req.body
    await useCases.configure.execute(externalId, credentials, contextOf(req))
    return ok({ externalId })
  },

  uninstall: async (req: ZodRequest<typeof uninstallSchema>) => {
    await useCases.uninstall.execute(req.body.externalId, contextOf(req))
    return ok({ success: true })
  },
})

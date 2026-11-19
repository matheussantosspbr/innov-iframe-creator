import type { FastifyRequest } from 'fastify'
import type { ListConnectionsUseCase } from '#src/core/use-cases/list-connections-use-case.interface.ts'
import { ok } from '../errors/api-error.ts'
import { tenantOf } from '../http.ts'

export type ConnectionsController = ReturnType<typeof createConnectionsController>

export const createConnectionsController = (listConnections: ListConnectionsUseCase) => ({
  list: async (req: FastifyRequest) => ok([...(await listConnections.execute(tenantOf(req)))]),
})

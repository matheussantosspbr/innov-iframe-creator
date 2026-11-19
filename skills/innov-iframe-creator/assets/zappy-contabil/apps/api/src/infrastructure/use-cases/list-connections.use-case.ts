import type { ZappyClientFor } from '#src/core/repository/zappy-client.interface.ts'
import type { ListConnectionsUseCase } from '#src/core/use-cases/list-connections-use-case.interface.ts'

export const createListConnectionsUseCase = (deps: {
  clientFor: ZappyClientFor
}): ListConnectionsUseCase => ({
  execute: (tenant) => deps.clientFor(tenant.credentials).listConnections(),
})

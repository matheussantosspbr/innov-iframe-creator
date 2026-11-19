import { createMemoryTenantRepository } from '#src/infrastructure/repository/tenant.repository.ts'
import { buildApp } from '#src/server/bootstrap.ts'

export const buildOpenApi = async () => {
  const app = await buildApp({
    tenants: createMemoryTenantRepository(Buffer.alloc(32).toString('base64')),
    comhubKey: 'openapi-only',
    zappyClientFor: () => ({
      listConnections: async () => [],
      isReachable: async () => true,
      getTicket: async () => {
        throw new Error('indisponível')
      },
      verify: async () => {},
    }),
  })
  await app.ready()
  const spec = app.swagger()
  await app.close()
  return `${JSON.stringify(spec, null, 2)}\n`
}

if (import.meta.main) process.stdout.write(await buildOpenApi())

import type { ChatPlataformaClient } from '#src/core/repository/chat-plataforma-client.interface.ts'
import { createMemoryRepository } from '#src/infrastructure/repository/installation.repository.ts'
import { buildApp } from '#src/server/bootstrap.ts'

const offlineClient = {
  getMyPermissions: async () => ({ isAdmin: true, permissions: [] }),
  getTicket: async () => {
    throw new Error('cliente offline')
  },
  setContactTags: async () => undefined,
} satisfies ChatPlataformaClient

const app = await buildApp({
  repo: createMemoryRepository(),
  secret: 'openapi-schema-only-secret',
  chatPlataformaUrl: 'http://localhost',
  clientFor: () => offlineClient,
})
await app.ready()
console.log(JSON.stringify(app.swagger(), null, 2))
await app.close()

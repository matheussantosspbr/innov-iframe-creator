import { Writable } from 'node:stream'
import type { FastifyInstance } from 'fastify'
import request from 'supertest'
import type { ZappyClient, ZappyCredentials } from '#src/core/repository/zappy-client.interface.ts'
import { createMemoryTenantRepository } from '#src/infrastructure/repository/tenant.repository.ts'
import { buildApp } from '#src/server/bootstrap.ts'
import {
  FIXTURE_COMHUB_KEY,
  FIXTURE_CONNECTION_VIEW,
  FIXTURE_ENCRYPTION_KEY,
  FIXTURE_OPERATOR_HEADERS,
  FIXTURE_TENANT_HEADERS,
  FIXTURE_TENANT_ID,
  FIXTURE_TENANT_NAME,
  FIXTURE_TICKET_VIEW,
  FIXTURE_ZAPPY_CREDENTIALS,
} from './fixtures.ts'

export type LogEntry = Record<string, unknown> & { level: number; msg: string }

const captureLogs = () => {
  const entries: LogEntry[] = []
  const stream = new Writable({
    write(chunk, _encoding, done) {
      for (const line of String(chunk).split('\n').filter(Boolean)) entries.push(JSON.parse(line))
      done()
    },
  })
  return { entries, logger: { level: 'info', stream } }
}

export const fakeZappyClient = (overrides: Partial<ZappyClient> = {}): ZappyClient => ({
  listConnections: async () => [FIXTURE_CONNECTION_VIEW],
  isReachable: async () => true,
  getTicket: async (ticketId) => ({ ...FIXTURE_TICKET_VIEW, id: String(ticketId) }),
  verify: async () => {},
  ...overrides,
})

type MakeAppOptions = { zappy?: Partial<ZappyClient>; seedTenant?: boolean }

export const makeApp = async (
  iframeRoutes?: (iframe: FastifyInstance) => void,
  { zappy = {}, seedTenant = true }: MakeAppOptions = {},
) => {
  const tenants = createMemoryTenantRepository(FIXTURE_ENCRYPTION_KEY)
  if (seedTenant) {
    await tenants.create({
      id: FIXTURE_TENANT_ID,
      name: FIXTURE_TENANT_NAME,
      zappyUrl: FIXTURE_ZAPPY_CREDENTIALS.baseUrl,
      zappyToken: FIXTURE_ZAPPY_CREDENTIALS.token,
    })
  }
  const logs = captureLogs()
  const clientCalls: ZappyCredentials[] = []
  const client = fakeZappyClient(zappy)
  const app = await buildApp({
    tenants,
    comhubKey: FIXTURE_COMHUB_KEY,
    zappyClientFor: (credentials) => {
      clientCalls.push(credentials)
      return client
    },
    logger: logs.logger,
    iframeRoutes,
  })
  await app.ready()
  const http = request(app.server)

  return {
    app,
    http,
    tenants,
    clientCalls,
    logs: logs.entries,
    logsFor: (requestId: string | undefined) =>
      logs.entries.filter((entry) => entry.requestId === requestId),
    getFromIframe: (path: string, headers: Record<string, string> = FIXTURE_TENANT_HEADERS) =>
      http.get(`/api/app${path}`).set(headers),
    postFromIframe: (
      path: string,
      payload: unknown,
      headers: Record<string, string> = FIXTURE_TENANT_HEADERS,
    ) =>
      http
        .post(`/api/app${path}`)
        .set(headers)
        .send(payload as object),
    createTenant: (payload: unknown, headers: Record<string, string> = FIXTURE_OPERATOR_HEADERS) =>
      http
        .post('/api/tenants')
        .set(headers)
        .send(payload as object),
  }
}

import { describe, expect, it } from 'vitest'
import { AppError } from '#src/core/utils/app-error.ts'
import { USER_MESSAGES } from '#src/core/utils/messages.ts'
import {
  FIXTURE_CONNECTION_VIEW,
  FIXTURE_TENANT_HEADERS,
  FIXTURE_TENANT_ID,
  FIXTURE_TICKET_VIEW,
  FIXTURE_USER_ID,
  FIXTURE_ZAPPY_CREDENTIALS,
} from '../support/fixtures.ts'
import { makeApp } from '../support/helpers.ts'

describe('GET /api/app/connections', () => {
  it('devolve as conexões do tenant usando a credencial dele', async () => {
    const { getFromIframe, clientCalls } = await makeApp()

    const res = await getFromIframe('/connections')

    expect(res).toBeSuccessEnvelope(200)
    expect(res.body.body).toEqual([FIXTURE_CONNECTION_VIEW])
    expect(clientCalls).toEqual([FIXTURE_ZAPPY_CREDENTIALS])
  })

  it('instância fora do ar: 502 com mensagem amigável e causa só no log', async () => {
    const { getFromIframe, logsFor } = await makeApp(undefined, {
      zappy: {
        listConnections: async () => {
          throw new AppError(502, USER_MESSAGES.zappyUnavailable, {
            cause: new TypeError('fetch failed'),
          })
        },
      },
    })

    const res = await getFromIframe('/connections')

    expect(res).toBeErrorEnvelope(502)
    expect(res.body.error.message).toBe(USER_MESSAGES.zappyUnavailable)
    expect(JSON.stringify(logsFor(res.headers['x-request-id']))).toContain('fetch failed')
  })
})

describe('GET /api/app/tickets/:ticketId', () => {
  it('devolve a projeção do atendimento consultando pelo id numérico', async () => {
    const requested: number[] = []
    const { getFromIframe } = await makeApp(undefined, {
      zappy: {
        getTicket: async (id) => {
          requested.push(id)
          return FIXTURE_TICKET_VIEW
        },
      },
    })

    const res = await getFromIframe('/tickets/9001')

    expect(res).toBeSuccessEnvelope(200)
    expect(res.body.body).toEqual(FIXTURE_TICKET_VIEW)
    expect(requested).toEqual([9001])
  })

  it('atendimento inexistente responde 404 com mensagem ao usuário', async () => {
    const { getFromIframe } = await makeApp(undefined, {
      zappy: {
        getTicket: async () => {
          throw new AppError(404, USER_MESSAGES.ticketNotFound)
        },
      },
    })

    const res = await getFromIframe('/tickets/1')

    expect(res).toBeErrorEnvelope(404)
    expect(res.body.error.message).toBe(USER_MESSAGES.ticketNotFound)
  })

  it.each(['abc', '1.5', '-1', '1234567890123456'])('ticketId %s responde 422', async (id) => {
    const { getFromIframe } = await makeApp()

    const res = await getFromIframe(`/tickets/${id}`)

    expect(res).toBeErrorEnvelope(422)
    expect(res.body.error.message).toBe(USER_MESSAGES.invalidRequest)
  })
})

describe('Tenant resolvido pelo x-tenant-id', () => {
  const routes = ['/connections', '/tickets/1']

  it.each(routes)('%s: tenant inexistente responde 404', async (path) => {
    const { getFromIframe } = await makeApp()

    const res = await getFromIframe(path, {
      ...FIXTURE_TENANT_HEADERS,
      'x-tenant-id': 'nao-existe',
    })

    expect(res).toBeErrorEnvelope(404)
    expect(res.body.error.message).toBe(USER_MESSAGES.tenantNotFound)
  })

  it.each(routes)('%s: tenant inativo responde 403', async (path) => {
    const { getFromIframe, tenants } = await makeApp()
    await tenants.setActive(FIXTURE_TENANT_ID, false)

    const res = await getFromIframe(path)

    expect(res).toBeErrorEnvelope(403)
    expect(res.body.error.message).toBe(USER_MESSAGES.tenantInactive)
  })

  it.each(routes)('%s: sem headers responde 400 sem consultar a Zappy', async (path) => {
    const { getFromIframe, clientCalls } = await makeApp()

    const res = await getFromIframe(path, {})

    expect(res).toBeErrorEnvelope(400)
    expect(res.body.error.message).toBe(USER_MESSAGES.missingTenantContext)
    expect(clientCalls).toEqual([])
  })

  it('as mensagens ao usuário não vazam detalhe técnico nem a URL da instância', async () => {
    const { getFromIframe, tenants } = await makeApp()
    await tenants.setActive(FIXTURE_TENANT_ID, false)

    const res = await getFromIframe('/connections')

    expect(JSON.stringify(res.body)).not.toContain(FIXTURE_ZAPPY_CREDENTIALS.baseUrl)
  })

  it('anexa tenantId e userId (sem credencial) aos logs da requisição', async () => {
    const { postFromIframe, logsFor } = await makeApp()

    const res = await postFromIframe('/client-logs', { level: 'info', message: 'aberto' })

    const entries = logsFor(res.headers['x-request-id'])
    expect(entries).toContainEqual(
      expect.objectContaining({ tenantId: FIXTURE_TENANT_ID, userId: FIXTURE_USER_ID }),
    )
    expect(JSON.stringify(entries)).not.toContain(FIXTURE_ZAPPY_CREDENTIALS.token)
  })
})

import { describe, expect, it } from 'vitest'
import { USER_MESSAGES } from '#src/core/utils/messages.ts'
import { FIXTURE_TENANT_HEADERS, FIXTURE_TENANT_ID, FIXTURE_USER_ID } from '../support/fixtures.ts'
import { makeApp } from '../support/helpers.ts'

const clientLog = { level: 'info', message: 'aberto', context: { screen: 'home' } }

describe('Rotas do iframe /api/app exigem x-tenant-id e x-user-id', () => {
  it.each([
    ['sem headers', {}],
    ['só x-tenant-id', { 'x-tenant-id': FIXTURE_TENANT_ID }],
    ['só x-user-id', { 'x-user-id': FIXTURE_USER_ID }],
    ['headers em branco', { 'x-tenant-id': ' ', 'x-user-id': '' }],
  ])('responde 400 no envelope de erro %s', async (_label, headers) => {
    const { postFromIframe } = await makeApp()

    const res = await postFromIframe('/client-logs', clientLog, headers)

    expect(res).toBeErrorEnvelope(400)
    expect(res.body.error.message).toBe(USER_MESSAGES.missingTenantContext)
  })

  it('aceita os headers e anexa tenantId e userId aos logs da requisição', async () => {
    const { postFromIframe, logsFor } = await makeApp()

    const res = await postFromIframe('/client-logs', clientLog)

    expect(res).toBeSuccessEnvelope(200)
    expect(logsFor(res.headers['x-request-id'])).toContainEqual(
      expect.objectContaining({
        msg: 'aberto',
        source: 'web',
        screen: 'home',
        tenantId: FIXTURE_TENANT_ID,
        userId: FIXTURE_USER_ID,
      }),
    )
  })

  it('exige os headers também sem o tenant existir: 400 vem antes de 404', async () => {
    const { postFromIframe } = await makeApp(undefined, { seedTenant: false })

    const res = await postFromIframe('/client-logs', clientLog, {})

    expect(res).toBeErrorEnvelope(400)
  })

  it('não exige os headers fora de /api/app', async () => {
    const { http } = await makeApp()

    const res = await http.get('/api/health')

    expect(res.status).toBe(200)
  })

  it('responde 422 para log do front com level fora de error | warn | info', async () => {
    const { postFromIframe } = await makeApp()

    const res = await postFromIframe('/client-logs', { level: 'debug', message: 'x' })

    expect(res).toBeErrorEnvelope(422)
    expect(res.body.error.message).toBe(USER_MESSAGES.invalidRequest)
  })

  it('responde 422 para JSON malformado', async () => {
    const { http } = await makeApp()

    const res = await http
      .post('/api/app/client-logs')
      .set(FIXTURE_TENANT_HEADERS)
      .set('content-type', 'application/json')
      .send('{nao-e-json')

    expect(res).toBeErrorEnvelope(422)
  })
})

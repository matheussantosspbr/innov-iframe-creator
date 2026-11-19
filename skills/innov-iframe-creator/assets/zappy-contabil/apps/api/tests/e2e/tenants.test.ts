import { describe, expect, it } from 'vitest'
import { AppError } from '#src/core/utils/app-error.ts'
import { ADMIN_MESSAGES } from '#src/core/utils/messages.ts'
import {
  FIXTURE_COMHUB_KEY,
  FIXTURE_NEW_TENANT,
  FIXTURE_OPERATOR_HEADERS,
  FIXTURE_TENANT_HEADERS,
  FIXTURE_ZAPPY_CREDENTIALS,
  UUID_V4,
} from '../support/fixtures.ts'
import { makeApp } from '../support/helpers.ts'

describe('Rotas de operação /api/tenants exigem x-comhub-key', () => {
  it.each([
    ['sem a chave', {}],
    ['com chave errada', { 'x-comhub-key': 'chave-errada' }],
    ['com chave vazia', { 'x-comhub-key': '' }],
    ['com prefixo da chave certa', { 'x-comhub-key': FIXTURE_COMHUB_KEY.slice(0, -1) }],
  ])('responde 401 %s em todas as rotas', async (_label, headers) => {
    const { http } = await makeApp()

    const responses = await Promise.all([
      http.post('/api/tenants').set(headers).send(FIXTURE_NEW_TENANT),
      http.get('/api/tenants').set(headers),
      http.patch('/api/tenants/42').set(headers).send({ active: false }),
      http.delete('/api/tenants/42').set(headers),
    ])

    for (const res of responses) {
      expect(res).toBeErrorEnvelope(401)
      expect(res.body.error.message).toBe(ADMIN_MESSAGES.unauthorizedOperation)
    }
  })

  it('autentica antes de validar o corpo (JSON válido com schema ruim não vira 422)', async () => {
    const { http } = await makeApp()

    const res = await http.post('/api/tenants').send({ lixo: true })

    expect(res).toBeErrorEnvelope(401)
  })

  it('a chave de operação não abre as rotas do iframe nem o contrário', async () => {
    const { http, getFromIframe } = await makeApp()

    const tenants = await http.get('/api/tenants').set(FIXTURE_TENANT_HEADERS)
    const iframe = await getFromIframe('/connections', FIXTURE_OPERATOR_HEADERS)

    expect(tenants.status).toBe(401)
    expect(iframe.status).toBe(400)
  })
})

describe('Ciclo de vida do tenant', () => {
  it('cadastra, lista, desativa, reativa e remove', async () => {
    const { http, createTenant } = await makeApp()

    const created = await createTenant(FIXTURE_NEW_TENANT)
    expect(created).toBeSuccessEnvelope(201)
    const { id } = created.body.body
    expect(id).toMatch(UUID_V4)
    expect(created.body.body).toMatchObject({
      name: FIXTURE_NEW_TENANT.name,
      zappyUrl: FIXTURE_NEW_TENANT.zappyUrl,
      active: true,
    })

    const listed = await http.get('/api/tenants').set(FIXTURE_OPERATOR_HEADERS)
    expect(listed).toBeSuccessEnvelope(200)
    expect(listed.body.body.map((t: { id: string }) => t.id)).toContain(id)
    expect(listed.body.body.find((t: { id: string }) => t.id === id).name).toBe(
      FIXTURE_NEW_TENANT.name,
    )

    const off = await http
      .patch(`/api/tenants/${id}`)
      .set(FIXTURE_OPERATOR_HEADERS)
      .send({ active: false })
    expect(off).toBeSuccessEnvelope(200)
    expect(off.body.body).toEqual({ id, active: false })
    const blocked = await http
      .get('/api/app/connections')
      .set({ ...FIXTURE_TENANT_HEADERS, 'x-tenant-id': id })
    expect(blocked.status).toBe(403)

    const on = await http
      .patch(`/api/tenants/${id}`)
      .set(FIXTURE_OPERATOR_HEADERS)
      .send({ active: true })
    expect(on.body.body.active).toBe(true)
    const allowed = await http
      .get('/api/app/connections')
      .set({ ...FIXTURE_TENANT_HEADERS, 'x-tenant-id': id })
    expect(allowed.status).toBe(200)

    const removed = await http.delete(`/api/tenants/${id}`).set(FIXTURE_OPERATOR_HEADERS)
    expect(removed).toBeSuccessEnvelope(200)
    const gone = await http
      .get('/api/app/connections')
      .set({ ...FIXTURE_TENANT_HEADERS, 'x-tenant-id': id })
    expect(gone.status).toBe(404)
  })

  it('usa a credencial cadastrada ao consultar a Zappy pelo iframe', async () => {
    const { createTenant, http, clientCalls } = await makeApp()
    const { id } = (await createTenant(FIXTURE_NEW_TENANT)).body.body
    clientCalls.length = 0

    await http.get('/api/app/connections').set({ ...FIXTURE_TENANT_HEADERS, 'x-tenant-id': id })

    expect(clientCalls).toEqual([
      { baseUrl: FIXTURE_NEW_TENANT.zappyUrl, token: FIXTURE_NEW_TENANT.zappyToken },
    ])
  })

  it('URL duplicada responde 409', async () => {
    const { createTenant } = await makeApp()
    await createTenant(FIXTURE_NEW_TENANT)

    const res = await createTenant(FIXTURE_NEW_TENANT)

    expect(res).toBeErrorEnvelope(409)
    expect(res.body.error.message).toBe(ADMIN_MESSAGES.tenantUrlTaken)
  })

  it('URL já cadastrada pelo seed também conta como duplicada', async () => {
    const { createTenant } = await makeApp()

    const res = await createTenant({
      ...FIXTURE_NEW_TENANT,
      zappyUrl: FIXTURE_ZAPPY_CREDENTIALS.baseUrl,
    })

    expect(res.status).toBe(409)
  })

  it.each([
    ['credencial inválida', 422, ADMIN_MESSAGES.tenantInvalidCredentials],
    ['instância fora do ar', 502, ADMIN_MESSAGES.tenantInstanceDown],
  ])('%s na prova do token responde %i e não cadastra', async (_label, status, message) => {
    const { createTenant, http } = await makeApp(undefined, {
      zappy: {
        verify: async () => {
          throw new AppError(status, message)
        },
      },
    })

    const res = await createTenant(FIXTURE_NEW_TENANT)
    const listed = await http.get('/api/tenants').set(FIXTURE_OPERATOR_HEADERS)

    expect(res).toBeErrorEnvelope(status)
    expect(res.body.error.message).toBe(message)
    expect(listed.body.body).toHaveLength(1)
  })

  it.each([
    ['corpo vazio', {}],
    [
      'nome ausente',
      { zappyUrl: FIXTURE_NEW_TENANT.zappyUrl, zappyToken: FIXTURE_NEW_TENANT.zappyToken },
    ],
    ['nome vazio', { ...FIXTURE_NEW_TENANT, name: '' }],
    ['nome só com espaços', { ...FIXTURE_NEW_TENANT, name: '   ' }],
    ['nome acima do limite', { ...FIXTURE_NEW_TENANT, name: 'n'.repeat(121) }],
    ['token ausente', { name: FIXTURE_NEW_TENANT.name, zappyUrl: FIXTURE_NEW_TENANT.zappyUrl }],
    ['token acima do limite', { ...FIXTURE_NEW_TENANT, zappyToken: 'x'.repeat(257) }],
    ['URL acima do limite', { ...FIXTURE_NEW_TENANT, zappyUrl: `https://${'a'.repeat(260)}` }],
  ])('responde 422 com mensagem de operador para %s', async (_label, payload) => {
    const { createTenant } = await makeApp()

    const res = await createTenant(payload)

    expect(res).toBeErrorEnvelope(422)
    expect(res.body.error.message).toBe(ADMIN_MESSAGES.invalidRequest)
  })

  it('PATCH e DELETE respondem 404 para tenant inexistente e 422 para corpo inválido', async () => {
    const { http } = await makeApp()

    const patch = await http
      .patch('/api/tenants/nao-existe')
      .set(FIXTURE_OPERATOR_HEADERS)
      .send({ active: false })
    const del = await http.delete('/api/tenants/nao-existe').set(FIXTURE_OPERATOR_HEADERS)
    const bad = await http
      .patch('/api/tenants/42')
      .set(FIXTURE_OPERATOR_HEADERS)
      .send({ active: 'sim' })

    expect(patch).toBeErrorEnvelope(404)
    expect(del).toBeErrorEnvelope(404)
    expect(bad).toBeErrorEnvelope(422)
  })
})

describe('O token do tenant nunca sai da API', () => {
  it('não aparece em nenhuma resposta nem nos logs, inclusive em erros', async () => {
    const token = FIXTURE_NEW_TENANT.zappyToken
    const { http, createTenant, logs } = await makeApp(undefined, {
      zappy: {
        getTicket: async () => {
          throw new AppError(502, 'falha', { cause: new Error('upstream') })
        },
      },
    })
    const responses = [
      await createTenant(FIXTURE_NEW_TENANT),
      await createTenant(FIXTURE_NEW_TENANT),
      await createTenant({ ...FIXTURE_NEW_TENANT, zappyToken: 123, token }),
      await http.get('/api/tenants').set(FIXTURE_OPERATOR_HEADERS),
      await http.get('/api/app/tickets/1').set(FIXTURE_TENANT_HEADERS),
      await http.get('/api/app/connections').set(FIXTURE_TENANT_HEADERS),
      await http.get('/api/docs/json'),
    ]

    for (const res of responses) {
      expect(JSON.stringify([res.body, res.headers])).not.toContain(token)
      expect(JSON.stringify([res.body, res.headers])).not.toContain(FIXTURE_ZAPPY_CREDENTIALS.token)
    }
    const everything = JSON.stringify(logs)
    expect(everything).not.toContain(token)
    expect(everything).not.toContain(FIXTURE_ZAPPY_CREDENTIALS.token)
    expect(everything).not.toContain(FIXTURE_COMHUB_KEY)
  })
})

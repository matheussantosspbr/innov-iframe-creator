import { describe, expect, it } from 'vitest'
import { createApi } from '../src/lib/api.ts'
import { FIXTURE_TENANT_ID, FIXTURE_USER_ID } from './fixtures.ts'
import { stubBackend } from './harness.tsx'

const api = createApi({ tenantId: FIXTURE_TENANT_ID, userId: FIXTURE_USER_ID })

describe('Cliente da API do app (createApi)', () => {
  it('envia x-tenant-id e x-user-id em toda chamada', async () => {
    const backend = stubBackend(() => undefined)

    await api.log('info', 'teste')

    expect(backend.calls[0]?.path).toBe('/api/app/client-logs')
    expect(backend.calls[0]?.headers).toMatchObject({
      'x-tenant-id': FIXTURE_TENANT_ID,
      'x-user-id': FIXTURE_USER_ID,
    })
  })

  it('não propaga falha do envio de log', async () => {
    stubBackend(() => ({ status: 400, json: { error: { message: 'sem contexto' } } }))

    await expect(api.log('error', 'falhou')).resolves.toBeUndefined()
  })
})

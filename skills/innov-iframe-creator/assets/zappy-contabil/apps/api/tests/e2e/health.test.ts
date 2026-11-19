import { describe, expect, it } from 'vitest'
import { makeApp } from '../support/helpers.ts'

describe('Health check do container: GET /api/health', () => {
  it('responde 200 sem exigir contexto de tenant, banco ou Zappy', async () => {
    const { http } = await makeApp()

    const res = await http.get('/api/health')

    expect(res).toBeSuccessEnvelope(200)
    expect(res.body.body).toEqual({ status: 'ok' })
  })
})

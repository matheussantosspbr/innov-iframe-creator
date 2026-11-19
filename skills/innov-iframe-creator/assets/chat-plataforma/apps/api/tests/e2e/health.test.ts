import { describe, expect, it } from 'vitest'
import { makeApp } from '../support/helpers.ts'

describe('Health check do container: GET /api/health', () => {
  it('responde 200 sem depender do banco nem do Chat Plataforma', async () => {
    const { http } = await makeApp({
      getMyPermissions: async () => {
        throw new Error('Chat Plataforma fora do ar')
      },
    })

    const res = await http.get('/api/health')

    expect(res).toBeSuccessEnvelope(200)
    expect(res.body.body).toEqual({ status: 'ok' })
  })
})

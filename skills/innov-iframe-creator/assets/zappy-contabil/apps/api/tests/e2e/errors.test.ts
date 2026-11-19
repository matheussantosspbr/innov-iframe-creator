import { describe, expect, it } from 'vitest'
import { AppError } from '#src/core/utils/app-error.ts'
import { ADMIN_MESSAGES, USER_MESSAGES } from '#src/core/utils/messages.ts'
import { FIXTURE_NGINX_REQUEST_ID, UUID_V4 } from '../support/fixtures.ts'
import { makeApp } from '../support/helpers.ts'

const ERROR_LEVEL = 50

describe('Rastreabilidade por requestId (header x-request-id)', () => {
  it('devolve x-request-id em UUID v4 em respostas de sucesso e de erro', async () => {
    const { http } = await makeApp()

    const success = await http.get('/api/health')
    const failure = await http.get('/api/rota-inexistente')

    expect(success.headers['x-request-id']).toMatch(UUID_V4)
    expect(failure.headers['x-request-id']).toMatch(UUID_V4)
  })

  it('reaproveita o x-request-id gerado pelo nginx do web', async () => {
    const { http } = await makeApp()

    const res = await http
      .get('/api/rota-inexistente')
      .set('x-request-id', FIXTURE_NGINX_REQUEST_ID)

    expect(res.headers['x-request-id']).toBe(FIXTURE_NGINX_REQUEST_ID)
  })

  it('descarta x-request-id fora do formato confiável e gera um novo', async () => {
    const { http } = await makeApp()

    const res = await http.get('/api/rota-inexistente').set('x-request-id', 'curto')

    expect(res.headers['x-request-id']).toMatch(UUID_V4)
  })
})

describe('Envelope de erro padrão', () => {
  it('responde 404 com ADMIN_MESSAGES.routeNotFound fora de /api/app', async () => {
    const { http } = await makeApp()

    const res = await http.get('/api/rota-inexistente')

    expect(res).toBeErrorEnvelope(404)
    expect(res.body.error.message).toBe(ADMIN_MESSAGES.routeNotFound)
  })

  it('repassa a mensagem de um AppError 4xx lançado por uma rota', async () => {
    const { getFromIframe } = await makeApp((iframe) => {
      iframe.get('/regra', async () => {
        throw new AppError(409, 'Já existe')
      })
    })

    const res = await getFromIframe('/regra')

    expect(res).toBeErrorEnvelope(409)
    expect(res.body.error.message).toBe('Já existe')
  })
})

describe('Erros 5xx: mensagem amigável ao usuário, detalhes só no log', () => {
  const failing = (iframe: Parameters<NonNullable<Parameters<typeof makeApp>[0]>>[0]) => {
    iframe.get('/quebra', async () => {
      throw new Error('falha inesperada')
    })
  }

  it('responde USER_MESSAGES.unexpected sem identificador na mensagem', async () => {
    const { getFromIframe } = await makeApp(failing)

    const res = await getFromIframe('/quebra')

    expect(res).toBeErrorEnvelope(500)
    expect(res.body.error.message).toBe(USER_MESSAGES.unexpected)
    expect(res.body.error.message).not.toContain(res.headers['x-request-id'])
  })

  it('registra o erro com stack sob o mesmo requestId devolvido ao cliente', async () => {
    const { getFromIframe, logsFor } = await makeApp(failing)

    const res = await getFromIframe('/quebra')

    expect(logsFor(res.headers['x-request-id'])).toContainEqual(
      expect.objectContaining({
        level: ERROR_LEVEL,
        statusCode: 500,
        err: expect.objectContaining({ message: 'falha inesperada', stack: expect.any(String) }),
      }),
    )
  })

  it('registra a causa técnica de um AppError 502 sem expô-la ao cliente', async () => {
    const { getFromIframe, logsFor } = await makeApp((iframe) => {
      iframe.get('/zappy', async () => {
        throw new AppError(502, USER_MESSAGES.zappyUnavailable, {
          cause: new TypeError('fetch failed'),
        })
      })
    })

    const res = await getFromIframe('/zappy')

    expect(res.body.error.message).toBe(USER_MESSAGES.zappyUnavailable)
    expect(JSON.stringify(logsFor(res.headers['x-request-id']))).toContain('fetch failed')
  })
})

import { describe, expect, it } from 'vitest'
import { AppError } from '#src/core/utils/app-error.ts'
import { LOG_EVENT } from '#src/core/utils/log-events.ts'
import { ADMIN_MESSAGES, USER_MESSAGES } from '#src/core/utils/messages.ts'
import {
  FIXTURE_CHAT_PLATAFORMA_AGENT_ID,
  FIXTURE_CHAT_PLATAFORMA_TICKET_ID,
  FIXTURE_CREDENTIALS,
  FIXTURE_EXTERNAL_ID,
  FIXTURE_INSTALL_BODY,
  FIXTURE_NGINX_REQUEST_ID,
  UUID_V4,
} from '../support/fixtures.ts'
import { makeApp } from '../support/helpers.ts'

const ERROR_LEVEL = 50
const ticketPath = `/tickets/${FIXTURE_CHAT_PLATAFORMA_TICKET_ID}`
const failingTicket = {
  getTicket: async () => {
    throw new Error('falha inesperada no cliente')
  },
}

describe('Rastreabilidade por requestId (header x-request-id)', () => {
  it('devolve x-request-id em UUID v4 em respostas de sucesso e de erro', async () => {
    const { http, postSigned } = await makeApp()

    const success = await postSigned('/api/provision/install', FIXTURE_INSTALL_BODY)
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

describe('Erros 5xx: mensagem amigável para o atendente, detalhes só no log', () => {
  it('responde USER_MESSAGES.unexpected sem nenhum identificador na mensagem', async () => {
    const { install, getFromIframe } = await makeApp(failingTicket)
    await install()

    const res = await getFromIframe(ticketPath, FIXTURE_EXTERNAL_ID)

    expect(res).toBeErrorEnvelope(500)
    expect(res.body.error.message).toBe(USER_MESSAGES.unexpected)
    expect(res.body.error.message).not.toContain(res.headers['x-request-id'])
  })

  it('registra o erro com stack no log sob o mesmo requestId devolvido ao cliente', async () => {
    const { install, getFromIframe, logsFor } = await makeApp(failingTicket)
    await install()

    const res = await getFromIframe(ticketPath, FIXTURE_EXTERNAL_ID)

    expect(logsFor(res.headers['x-request-id'])).toContainEqual(
      expect.objectContaining({
        level: ERROR_LEVEL,
        statusCode: 500,
        err: expect.objectContaining({
          message: 'falha inesperada no cliente',
          stack: expect.any(String),
        }),
      }),
    )
  })

  it('registra a causa técnica no log sem expô-la na mensagem ao cliente', async () => {
    const { install, getFromIframe, logsFor } = await makeApp({
      getTicket: async () => {
        throw new AppError(502, USER_MESSAGES.chatPlataformaUnavailable, {
          cause: new TypeError('fetch failed'),
        })
      },
    })
    await install()

    const res = await getFromIframe(ticketPath, FIXTURE_EXTERNAL_ID)

    expect(res.body.error.message).toBe(USER_MESSAGES.chatPlataformaUnavailable)
    expect(JSON.stringify(logsFor(res.headers['x-request-id']))).toContain('fetch failed')
  })

  it('responde ao atendente USER_MESSAGES.installationNotFound quando o accountId não existe', async () => {
    const { getFromIframe } = await makeApp()

    const res = await getFromIframe(ticketPath)

    expect(res).toBeErrorEnvelope(401)
    expect(res.body.error.message).toBe(USER_MESSAGES.installationNotFound)
  })

  it('troca o detalhe do zod por USER_MESSAGES.invalidRequest nas rotas do iframe', async () => {
    const { install, postFromIframe, logsFor } = await makeApp()
    await install()

    const res = await postFromIframe(
      '/client-logs',
      { level: 'debug', message: 'x' },
      FIXTURE_EXTERNAL_ID,
    )

    expect(res).toBeErrorEnvelope(422)
    expect(res.body.error.message).toBe(USER_MESSAGES.invalidRequest)
    expect(JSON.stringify(logsFor(res.headers['x-request-id']))).toContain('level')
  })

  it('troca o detalhe do zod por ADMIN_MESSAGES.invalidRequest nas rotas da plataforma, que o admin da organização lê', async () => {
    const { postSigned, logsFor } = await makeApp()

    const res = await postSigned('/api/provision/uninstall', {})

    expect(res).toBeErrorEnvelope(422)
    expect(res.body.error.message).toBe(ADMIN_MESSAGES.invalidRequest)
    expect(JSON.stringify(logsFor(res.headers['x-request-id']))).toContain('externalId')
  })
})

describe('Campos de busca nos logs das rotas do iframe', () => {
  it('anexa externalId, agentId e ticketId aos logs da requisição', async () => {
    const { install, getFromIframe, logsFor } = await makeApp(failingTicket)
    await install()

    const res = await getFromIframe(ticketPath, FIXTURE_EXTERNAL_ID, {
      'x-agent-id': FIXTURE_CHAT_PLATAFORMA_AGENT_ID,
      'x-ticket-id': FIXTURE_CHAT_PLATAFORMA_TICKET_ID,
    })

    expect(logsFor(res.headers['x-request-id'])).toContainEqual(
      expect.objectContaining({
        level: ERROR_LEVEL,
        externalId: FIXTURE_EXTERNAL_ID,
        agentId: FIXTURE_CHAT_PLATAFORMA_AGENT_ID,
        ticketId: FIXTURE_CHAT_PLATAFORMA_TICKET_ID,
      }),
    )
  })

  it('descarta agentId que não é snowflake numérico', async () => {
    const { install, getFromIframe, logsFor } = await makeApp(failingTicket)
    await install()

    const res = await getFromIframe(ticketPath, FIXTURE_EXTERNAL_ID, { 'x-agent-id': 'abc' })

    const errorLog = logsFor(res.headers['x-request-id']).find(
      (entry) => entry.level === ERROR_LEVEL,
    )
    expect(errorLog).toBeDefined()
    expect(errorLog).not.toHaveProperty('agentId')
  })
})

describe('Eventos de provisionamento no log', () => {
  it('registra o evento LOG_EVENT.installationInstalled com o externalId gerado', async () => {
    const { postSigned, logsFor } = await makeApp()

    const res = await postSigned('/api/provision/install', FIXTURE_INSTALL_BODY)

    expect(logsFor(res.headers['x-request-id'])).toContainEqual(
      expect.objectContaining({
        event: LOG_EVENT.installationInstalled,
        externalId: res.body.body.externalId,
      }),
    )
  })

  it('nunca registra as credentials recebidas no log', async () => {
    const { postSigned, logs } = await makeApp()

    await postSigned('/api/provision/install', FIXTURE_INSTALL_BODY)

    expect(JSON.stringify(logs)).not.toContain(FIXTURE_CREDENTIALS.chatPlataformaApiKey)
  })
})

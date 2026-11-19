import { describe, expect, it } from 'vitest'
import { USER_MESSAGES } from '#src/core/utils/messages.ts'
import { createChatPlataformaClient } from '#src/infrastructure/libs/chatplataforma/client.ts'
import { decrypt, encrypt } from '#src/infrastructure/libs/crypto.ts'
import {
  FIXTURE_ADMIN_PERMISSIONS,
  FIXTURE_CHAT_PLATAFORMA_TICKET_ID,
  FIXTURE_CREDENTIALS,
  FIXTURE_EXTERNAL_ID,
  FIXTURE_NGINX_REQUEST_ID,
  FIXTURE_PLATFORM_TICKET_RESPONSE,
  FIXTURE_TICKET_VIEW,
  FIXTURE_UNKNOWN_EXTERNAL_ID,
} from '../support/fixtures.ts'
import { makeApp } from '../support/helpers.ts'

describe('Rotas do iframe /api/app autenticadas por x-account-id', () => {
  it('responde 401 quando o header x-account-id está ausente', async () => {
    const { getFromIframe } = await makeApp()

    const res = await getFromIframe(`/tickets/${FIXTURE_CHAT_PLATAFORMA_TICKET_ID}`)

    expect(res).toBeErrorEnvelope(401)
  })

  it('responde 401 quando o accountId não corresponde a nenhuma instalação', async () => {
    const { getFromIframe } = await makeApp()

    const res = await getFromIframe(
      `/tickets/${FIXTURE_CHAT_PLATAFORMA_TICKET_ID}`,
      FIXTURE_UNKNOWN_EXTERNAL_ID,
    )

    expect(res).toBeErrorEnvelope(401)
  })

  it('consulta o ticket com o snowflake intacto e repassa o requestId ao cliente do Chat Plataforma', async () => {
    const requestedTicketIds: string[] = []
    const { install, getFromIframe, clientCalls } = await makeApp({
      getTicket: async (ticketId) => {
        requestedTicketIds.push(ticketId)
        return FIXTURE_TICKET_VIEW
      },
    })
    await install()

    const res = await getFromIframe(
      `/tickets/${FIXTURE_CHAT_PLATAFORMA_TICKET_ID}`,
      FIXTURE_EXTERNAL_ID,
    )

    expect(res).toBeSuccessEnvelope(200)
    expect(requestedTicketIds).toEqual([FIXTURE_CHAT_PLATAFORMA_TICKET_ID])
    expect(res.body.body).toEqual(FIXTURE_TICKET_VIEW)
    expect(clientCalls.at(-1)?.options).toEqual({ requestId: res.headers['x-request-id'] })
  })

  it('aceita logs do front em /client-logs para envio ao Axiom', async () => {
    const { install, postFromIframe } = await makeApp()
    await install()

    const res = await postFromIframe(
      '/client-logs',
      { level: 'error', message: 'falha de render', context: { screen: 'home' } },
      FIXTURE_EXTERNAL_ID,
    )

    expect(res).toBeSuccessEnvelope(200)
  })

  it('responde 422 para log do front com level fora de error | warn | info', async () => {
    const { install, postFromIframe } = await makeApp()
    await install()

    const res = await postFromIframe(
      '/client-logs',
      { level: 'debug', message: 'x' },
      FIXTURE_EXTERNAL_ID,
    )

    expect(res).toBeErrorEnvelope(422)
  })
})

describe('Cliente da API do Chat Plataforma', () => {
  const clientWith = (
    respond: (url: string, init: RequestInit) => Promise<Response>,
    requestId?: string,
  ) =>
    createChatPlataformaClient({
      baseUrl: 'http://chatplataforma.fixture',
      apiKey: FIXTURE_CREDENTIALS.chatPlataformaApiKey,
      requestId,
      fetcher: respond as typeof fetch,
    })
  const respondJson = (status: number, payload: unknown) => async () =>
    new Response(JSON.stringify(payload), { status })

  it('autentica com x-api-key, nunca envia x-access-token e repassa o x-request-id', async () => {
    let headers: Record<string, string> = {}
    const client = clientWith(async (_url, init) => {
      headers = init.headers as Record<string, string>
      return new Response(JSON.stringify({ message: 'ok', body: FIXTURE_ADMIN_PERMISSIONS }))
    }, FIXTURE_NGINX_REQUEST_ID)

    await client.getMyPermissions()

    expect(headers['x-api-key']).toBe(FIXTURE_CREDENTIALS.chatPlataformaApiKey)
    expect(headers['x-request-id']).toBe(FIXTURE_NGINX_REQUEST_ID)
    expect(headers).not.toHaveProperty('x-access-token')
  })

  it('devolve só o conteúdo de body do envelope { message, body } da plataforma', async () => {
    const client = clientWith(
      respondJson(200, {
        message: 'Permissões retornadas com sucesso',
        body: FIXTURE_ADMIN_PERMISSIONS,
      }),
    )

    expect(await client.getMyPermissions()).toEqual(FIXTURE_ADMIN_PERMISSIONS)
  })

  it('monta o path com o snowflake do ticket sem perda de precisão', async () => {
    let calledUrl = ''
    const client = clientWith(async (url) => {
      calledUrl = url
      return new Response(JSON.stringify(FIXTURE_PLATFORM_TICKET_RESPONSE))
    })

    await client.getTicket(FIXTURE_CHAT_PLATAFORMA_TICKET_ID)

    expect(calledUrl).toBe(
      `http://chatplataforma.fixture/v1/tickets/${FIXTURE_CHAT_PLATAFORMA_TICKET_ID}`,
    )
  })

  it('descarta hashPassword, e-mail e telefone do agente que GET /v1/tickets/:id devolve', async () => {
    const client = clientWith(respondJson(200, FIXTURE_PLATFORM_TICKET_RESPONSE))

    const ticket = await client.getTicket(FIXTURE_CHAT_PLATAFORMA_TICKET_ID)

    expect(ticket).toEqual(FIXTURE_TICKET_VIEW)
    expect(JSON.stringify(ticket)).not.toContain('hashPassword')
  })

  it('converte resposta fora do schema em 502 com a causa preservada', async () => {
    const client = clientWith(respondJson(200, { message: 'ok', body: { id: 1 } }))

    await expect(client.getTicket(FIXTURE_CHAT_PLATAFORMA_TICKET_ID)).rejects.toMatchObject({
      statusCode: 502,
      message: USER_MESSAGES.chatPlataformaUnavailable,
      cause: expect.any(Error),
    })
  })

  it.each([
    [401, { error: 'Não autorizado' }, 502, USER_MESSAGES.integrationNeedsReconfiguration],
    [
      403,
      { message: 'Você não tem permissão para executar esta ação' },
      502,
      USER_MESSAGES.integrationMissingPermission,
    ],
    [
      429,
      { message: 'Muitas requisições. Tente novamente em 3s.' },
      503,
      USER_MESSAGES.chatPlataformaBusy,
    ],
    [500, { message: 'Houve um erro inesperado' }, 502, USER_MESSAGES.chatPlataformaUnavailable],
  ])(
    'converte HTTP %i da plataforma (%o) em HTTP %i com a mensagem "%s"',
    async (upstream, payload, status, message) => {
      const client = clientWith(respondJson(upstream, payload))

      await expect(client.getMyPermissions()).rejects.toMatchObject({
        statusCode: status,
        message,
        upstreamStatus: upstream,
      })
    },
  )

  it('repassa como 422 a mensagem de regra de negócio da plataforma, já escrita para o atendente', async () => {
    const client = clientWith(
      respondJson(422, { message: 'Este contato não responde há mais de 24 horas' }),
    )

    await expect(client.setContactTags('1', [])).rejects.toMatchObject({
      statusCode: 422,
      message: 'Este contato não responde há mais de 24 horas',
      upstreamStatus: 422,
    })
  })

  it('converte falha de rede em erro 502 com mensagem amigável e causa técnica preservada', async () => {
    const client = clientWith(async () => {
      throw new TypeError('fetch failed')
    })

    await expect(client.getMyPermissions()).rejects.toMatchObject({
      statusCode: 502,
      message: USER_MESSAGES.chatPlataformaUnavailable,
      upstreamStatus: null,
      cause: expect.objectContaining({ message: 'fetch failed' }),
    })
  })
})

describe('Cifra das credentials em repouso (AES-256-GCM)', () => {
  const key = Buffer.alloc(32, 7).toString('base64')
  const otherKey = Buffer.alloc(32, 9).toString('base64')
  const plain = JSON.stringify(FIXTURE_CREDENTIALS)

  it('recupera o JSON original ao decifrar com a mesma chave', () => {
    expect(decrypt(encrypt(plain, key), key)).toBe(plain)
  })

  it('não expõe nenhum trecho da credential no texto cifrado', () => {
    expect(encrypt(plain, key)).not.toContain(FIXTURE_CREDENTIALS.chatPlataformaApiKey)
  })

  it('falha ao decifrar com outra chave', () => {
    expect(() => decrypt(encrypt(plain, key), otherKey)).toThrow()
  })
})

describe('Imutabilidade da instalação compartilhada por referência', () => {
  it('devolve a instalação e as credentials congeladas pelo repositório', async () => {
    const { install, repo } = await makeApp()
    await install()

    const installation = await repo.find(FIXTURE_EXTERNAL_ID)

    expect(Object.isFrozen(installation)).toBe(true)
    expect(Object.isFrozen(installation?.credentials)).toBe(true)
  })
})

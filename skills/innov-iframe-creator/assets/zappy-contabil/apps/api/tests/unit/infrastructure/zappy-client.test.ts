import { describe, expect, it } from 'vitest'
import {
  ZdkAuthError,
  ZdkConfigError,
  ZdkNetworkError,
  ZdkNotFoundError,
  type ZdkOptions,
} from 'zdk'
import { ADMIN_MESSAGES, USER_MESSAGES } from '#src/core/utils/messages.ts'
import { createZappyClient, type ZdkLike } from '#src/infrastructure/libs/zappy/client.ts'
import {
  FIXTURE_TICKET_VIEW,
  FIXTURE_ZAPPY_CONNECTION,
  FIXTURE_ZAPPY_CREDENTIALS,
  FIXTURE_ZAPPY_TICKET,
} from '../../support/fixtures.ts'

const fakeZdk = (
  list: ZdkLike['connections']['list'],
  rest: Partial<Pick<ZdkLike, 'tickets' | 'verify'>> = {},
) => {
  const created: ZdkOptions[] = []
  return {
    created,
    factory: (options: ZdkOptions): ZdkLike => {
      created.push(options)
      return {
        connections: { list },
        tickets: { get: async () => FIXTURE_ZAPPY_TICKET },
        verify: async () => ({}),
        ...rest,
      }
    },
  }
}

const failing = (error: Error) => async (): Promise<never> => {
  throw error
}

describe('Cliente da Zappy sobre o ZDK 1.0', () => {
  it('não cria o ZDK até a primeira chamada', () => {
    const { created, factory } = fakeZdk(async () => [])

    createZappyClient(FIXTURE_ZAPPY_CREDENTIALS, factory)

    expect(created).toEqual([])
  })

  it('cria o ZDK uma vez, com uma tentativa e timeout de 10s', async () => {
    const { created, factory } = fakeZdk(async () => [])
    const client = createZappyClient(FIXTURE_ZAPPY_CREDENTIALS, factory)

    await client.listConnections()
    await client.listConnections()

    expect(created).toEqual([
      { ...FIXTURE_ZAPPY_CREDENTIALS, retryConfig: { attempts: 1 }, defaultTimeoutMs: 10_000 },
    ])
  })

  it('devolve só id, nome e status das conexões', async () => {
    const { factory } = fakeZdk(async () => [FIXTURE_ZAPPY_CONNECTION])
    const client = createZappyClient(FIXTURE_ZAPPY_CREDENTIALS, factory)

    expect(await client.listConnections()).toEqual([
      { id: 1, name: 'Comercial', status: 'CONNECTED' },
    ])
  })

  it('converte falha do ZDK em AppError 502 com mensagem amigável e causa preservada', async () => {
    const cause = new Error('token inválido')
    const { factory } = fakeZdk(async () => {
      throw cause
    })
    const client = createZappyClient(FIXTURE_ZAPPY_CREDENTIALS, factory)

    await expect(client.listConnections()).rejects.toMatchObject({
      statusCode: 502,
      message: USER_MESSAGES.zappyUnavailable,
      cause,
    })
  })

  it('isReachable devolve true quando a lista responde e false quando falha', async () => {
    const up = createZappyClient(FIXTURE_ZAPPY_CREDENTIALS, fakeZdk(async () => []).factory)
    const down = createZappyClient(
      FIXTURE_ZAPPY_CREDENTIALS,
      fakeZdk(async () => {
        throw new Error('fetch failed')
      }).factory,
    )

    expect(await up.isReachable()).toBe(true)
    expect(await down.isReachable()).toBe(false)
  })

  it('trata URL ou token inválidos como indisponibilidade, sem derrubar o app', async () => {
    const client = createZappyClient(FIXTURE_ZAPPY_CREDENTIALS, () => {
      throw new Error('token inválido')
    })

    expect(await client.isReachable()).toBe(false)
  })

  it('getTicket projeta só os campos do TicketView e descarta o resto (lastMessage)', async () => {
    const client = createZappyClient(FIXTURE_ZAPPY_CREDENTIALS, fakeZdk(async () => []).factory)

    expect(await client.getTicket(9001)).toEqual(FIXTURE_TICKET_VIEW)
  })

  it('getTicket converte 404 do ZDK em AppError 404 com mensagem de atendimento', async () => {
    const notFound = new ZdkNotFoundError('não achou', 'ERR_NOT_FOUND', {
      status: 404,
      payload: {},
    })
    const client = createZappyClient(
      FIXTURE_ZAPPY_CREDENTIALS,
      fakeZdk(async () => [], { tickets: { get: failing(notFound) } }).factory,
    )

    await expect(client.getTicket(1)).rejects.toMatchObject({
      statusCode: 404,
      message: USER_MESSAGES.ticketNotFound,
    })
  })

  it('getTicket trata resposta fora do formato como indisponibilidade (502)', async () => {
    const client = createZappyClient(
      FIXTURE_ZAPPY_CREDENTIALS,
      fakeZdk(async () => [], { tickets: { get: async () => ({ sem: 'id' }) } }).factory,
    )

    await expect(client.getTicket(1)).rejects.toMatchObject({
      statusCode: 502,
      message: USER_MESSAGES.zappyUnavailable,
    })
  })

  it('token recusado em uso normal pede reconfiguração, sem detalhe técnico', async () => {
    const auth = new ZdkAuthError('401', 'ERR_INVALID_API_KEY', { status: 401, payload: {} })
    const client = createZappyClient(FIXTURE_ZAPPY_CREDENTIALS, fakeZdk(failing(auth)).factory)

    await expect(client.listConnections()).rejects.toMatchObject({
      statusCode: 502,
      message: USER_MESSAGES.zappyNeedsReconfiguration,
    })
  })

  describe('verify (cadastro de tenant)', () => {
    const verifyWith = (error: Error) =>
      createZappyClient(
        FIXTURE_ZAPPY_CREDENTIALS,
        fakeZdk(async () => [], { verify: failing(error) }).factory,
      ).verify()

    it('passa quando o ZDK prova a credencial', async () => {
      const client = createZappyClient(FIXTURE_ZAPPY_CREDENTIALS, fakeZdk(async () => []).factory)

      await expect(client.verify()).resolves.toBeUndefined()
    })

    it('URL ou token fora do formato (ZdkConfigError) vira 422', async () => {
      await expect(verifyWith(new ZdkConfigError('url'))).rejects.toMatchObject({
        statusCode: 422,
        message: ADMIN_MESSAGES.tenantInvalidUrl,
      })
    })

    it('token recusado (ZdkAuthError) vira 422', async () => {
      await expect(
        verifyWith(new ZdkAuthError('401', 'ERR_INVALID_API_KEY', { status: 401, payload: {} })),
      ).rejects.toMatchObject({
        statusCode: 422,
        message: ADMIN_MESSAGES.tenantInvalidCredentials,
      })
    })

    it('instância fora do ar (ZdkNetworkError) vira 502', async () => {
      await expect(verifyWith(new ZdkNetworkError('dns'))).rejects.toMatchObject({
        statusCode: 502,
        message: ADMIN_MESSAGES.tenantInstanceDown,
      })
    })

    it('`new Zdk` que lança ZdkConfigError também vira 422', async () => {
      const client = createZappyClient(FIXTURE_ZAPPY_CREDENTIALS, () => {
        throw new ZdkConfigError('host fora da allowlist')
      })

      await expect(client.verify()).rejects.toMatchObject({ statusCode: 422 })
    })
  })
})

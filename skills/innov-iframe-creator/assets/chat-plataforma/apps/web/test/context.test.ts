import { describe, expect, it } from 'vitest'
import { readIframeContext } from '../src/lib/context.ts'
import {
  FIXTURE_ACCOUNT_ID,
  FIXTURE_AGENT_ID,
  FIXTURE_CONNECTION_ID,
  FIXTURE_IFRAME_SEARCH,
  FIXTURE_TICKET_ID,
} from './fixtures.ts'

describe('Parâmetros do iframe (readIframeContext)', () => {
  it('aceita apenas os parâmetros sempre enviados e preserva snowflakes como string', () => {
    expect(readIframeContext(FIXTURE_IFRAME_SEARCH)).toEqual({
      ok: true,
      context: {
        accountId: FIXTURE_ACCOUNT_ID,
        agentId: FIXTURE_AGENT_ID,
        ticketId: FIXTURE_TICKET_ID,
        ticketConnectionId: FIXTURE_CONNECTION_ID,
      },
    })
  })

  it('inclui os parâmetros opcionais quando a plataforma os envia', () => {
    const result = readIframeContext(`${FIXTURE_IFRAME_SEARCH}&contactId=182736454928173650`)

    expect(result.ok && result.context.contactId).toBe('182736454928173650')
  })

  it.each(['accountId', 'agentId', 'ticketId', 'ticketConnectionId'])(
    'rejeita o contexto quando falta o parâmetro obrigatório %s',
    (param) => {
      const search = new URLSearchParams(FIXTURE_IFRAME_SEARCH)
      search.delete(param)

      expect(readIframeContext(`?${search}`).ok).toBe(false)
    },
  )

  it('devolve o contexto congelado para que nenhuma tela o altere', () => {
    const result = readIframeContext(FIXTURE_IFRAME_SEARCH)

    expect(result.ok && Object.isFrozen(result.context)).toBe(true)
  })
})

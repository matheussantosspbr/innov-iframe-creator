import { describe, expect, it } from 'vitest'
import { readIframeContext } from '../src/lib/context.ts'
import { FIXTURE_IFRAME_SEARCH, FIXTURE_TENANT_ID, FIXTURE_USER_ID } from './fixtures.ts'

describe('Parâmetros do iframe (readIframeContext)', () => {
  it('aceita tenantId e userId e ignora parâmetros extras', () => {
    expect(readIframeContext(`${FIXTURE_IFRAME_SEARCH}&extra=1`)).toEqual({
      ok: true,
      context: { tenantId: FIXTURE_TENANT_ID, userId: FIXTURE_USER_ID },
    })
  })

  it.each(['tenantId', 'userId'])('rejeita o contexto quando falta %s', (param) => {
    const search = new URLSearchParams(FIXTURE_IFRAME_SEARCH)
    search.delete(param)

    expect(readIframeContext(`?${search}`).ok).toBe(false)
  })

  it('rejeita parâmetros vazios e a URL sem query', () => {
    expect(readIframeContext('?tenantId=&userId=').ok).toBe(false)
    expect(readIframeContext('').ok).toBe(false)
  })

  it('devolve o contexto congelado para que nenhuma tela o altere', () => {
    const result = readIframeContext(FIXTURE_IFRAME_SEARCH)

    expect(result.ok && Object.isFrozen(result.context)).toBe(true)
  })
})

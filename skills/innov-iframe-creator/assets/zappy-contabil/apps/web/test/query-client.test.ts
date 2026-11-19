import { describe, expect, it } from 'vitest'
import { ApiRequestError } from '../src/lib/api.ts'
import { shouldRetry } from '../src/lib/query-client.ts'

describe('Política de retry das queries (shouldRetry)', () => {
  it.each([400, 401, 404, 422])('não repete requisição que falhou com HTTP %i', (status) => {
    expect(shouldRetry(0, new ApiRequestError(status, 'erro'))).toBe(false)
  })

  it.each([
    ['HTTP 502', new ApiRequestError(502, 'erro')],
    ['falha de rede', new TypeError('fetch failed')],
  ])('repete uma única vez em caso de %s', (_label, error) => {
    expect(shouldRetry(0, error)).toBe(true)
    expect(shouldRetry(1, error)).toBe(false)
  })
})

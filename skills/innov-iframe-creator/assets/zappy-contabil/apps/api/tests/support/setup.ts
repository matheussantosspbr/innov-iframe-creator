import { expect } from 'vitest'

type HttpResponse = { status: number; body: unknown }

const keysOf = (value: unknown) =>
  value && typeof value === 'object' ? Object.keys(value).sort().join(',') : typeof value

expect.extend({
  toBeSuccessEnvelope(received: HttpResponse, status: 200 | 201) {
    const pass = received.status === status && keysOf(received.body) === 'body'
    return {
      pass,
      message: () =>
        `esperava HTTP ${status} com envelope { body }, recebeu HTTP ${received.status} ${JSON.stringify(received.body)}`,
    }
  },
  toBeErrorEnvelope(received: HttpResponse, status: number) {
    const body = received.body as { error?: { message?: unknown } }
    const pass =
      received.status === status &&
      keysOf(body) === 'error' &&
      keysOf(body.error) === 'message' &&
      typeof body.error?.message === 'string' &&
      body.error.message.length > 0
    return {
      pass,
      message: () =>
        `esperava HTTP ${status} com envelope { error: { message } }, recebeu HTTP ${received.status} ${JSON.stringify(received.body)}`,
    }
  },
})

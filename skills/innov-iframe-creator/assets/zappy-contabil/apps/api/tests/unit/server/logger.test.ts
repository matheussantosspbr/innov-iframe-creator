import { describe, expect, it } from 'vitest'
import type { Env } from '#src/config/env.ts'
import { loggerOptions } from '#src/server/logger.ts'

const env = { APPLICATION_LOG_LEVEL: 'info', NODE_ENV: 'test' } as Env

describe('loggerOptions', () => {
  it('esconde dos logs os headers com segredo e com os ids do tenant e do usuário', () => {
    const options = loggerOptions(env) as { redact: string[] }

    expect(options.redact).toEqual(
      expect.arrayContaining([
        'req.headers.authorization',
        'req.headers["x-api-key"]',
        'req.headers["x-tenant-id"]',
        'req.headers["x-user-id"]',
      ]),
    )
  })

  it('só envia ao Axiom quando token e dataset existem', () => {
    const targets = (options: unknown) =>
      (options as { transport: { targets: { target: string }[] } }).transport.targets.map(
        (item) => item.target,
      )

    expect(targets(loggerOptions(env))).toEqual(['pino/file'])
    expect(
      targets(loggerOptions({ ...env, AXIOM_TOKEN: 'token', AXIOM_DATASET: 'dataset' } as Env)),
    ).toEqual(['pino/file', '@axiomhq/pino'])
  })
})

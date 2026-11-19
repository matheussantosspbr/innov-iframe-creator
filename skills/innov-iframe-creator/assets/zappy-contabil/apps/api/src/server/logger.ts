import type { FastifyServerOptions } from 'fastify'
import type { Env } from '#src/config/env.ts'

export const loggerOptions = (env: Env): FastifyServerOptions['logger'] => {
  const stdout = {
    target: 'pino/file',
    options: { destination: 1 },
    level: env.APPLICATION_LOG_LEVEL,
  }
  const targets =
    env.AXIOM_TOKEN && env.AXIOM_DATASET
      ? [
          stdout,
          {
            target: '@axiomhq/pino',
            options: { dataset: env.AXIOM_DATASET, token: env.AXIOM_TOKEN },
            level: env.APPLICATION_LOG_LEVEL,
          },
        ]
      : [stdout]

  return {
    level: env.APPLICATION_LOG_LEVEL,
    base: { service: 'api', env: env.NODE_ENV },
    redact: [
      'req.headers.authorization',
      'req.headers["x-api-key"]',
      'req.headers["x-comhub-key"]',
      'req.headers["x-tenant-id"]',
      'req.headers["x-user-id"]',
    ],
    transport: { targets },
  }
}

import type { ValueOf } from '@app/shared'
import { z } from 'zod'

export const RUNTIME_ENV = Object.freeze({
  development: 'development',
  test: 'test',
  production: 'production',
} as const)
export type RuntimeEnv = ValueOf<typeof RUNTIME_ENV>

export const LOG_LEVEL = Object.freeze({
  fatal: 'fatal',
  error: 'error',
  warn: 'warn',
  info: 'info',
  debug: 'debug',
  trace: 'trace',
} as const)

const redisUrl = z.url({ protocol: /^rediss?$/ })

const envSchema = z
  .object({
    NODE_ENV: z.enum(RUNTIME_ENV).default(RUNTIME_ENV.development),
    APPLICATION_PORT: z.coerce.number().default(3333),
    APPLICATION_LOG_LEVEL: z.enum(LOG_LEVEL).default(LOG_LEVEL.info),
    DATABASE_URL: z.string().min(1),
    DATABASE_POOL_SIZE: z.coerce.number().int().min(1).max(50).default(5),
    DATABASE_TLS: z.stringbool().default(false),
    CHATPLATAFORMA_CLIENT_SECRET: z.string().min(16),
    APPLICATION_ENCRYPTION_KEY: z
      .string()
      .refine((v) => Buffer.from(v, 'base64').length === 32, 'precisa ter 32 bytes em base64'),
    CHATPLATAFORMA_API_URL: z.url().default('https://api.chatplataforma.com.br'),
    // Só URL (redis:// ou rediss:// para TLS): em produção aponta para o Redis externo.
    REDIS_QUEUE_URL: redisUrl.optional(),
    REDIS_CACHE_URL: redisUrl.optional(),
    AXIOM_TOKEN: z.string().optional(),
    AXIOM_DATASET: z.string().optional(),
  })
  .readonly()

export type Env = z.infer<typeof envSchema>

export const loadEnv = (source: NodeJS.ProcessEnv = process.env): Env => envSchema.parse(source)

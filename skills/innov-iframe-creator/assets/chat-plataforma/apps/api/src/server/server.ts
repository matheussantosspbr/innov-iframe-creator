import { loadEnv } from '#src/config/env.ts'
import { createPrismaClient } from '#src/infrastructure/libs/prisma.ts'
import { createPrismaRepository } from '#src/infrastructure/repository/installation.repository.ts'
import { buildApp } from './bootstrap.ts'
import { loggerOptions } from './logger.ts'

const env = loadEnv()
const prisma = createPrismaClient(env.DATABASE_URL, {
  poolSize: env.DATABASE_POOL_SIZE,
  tls: env.DATABASE_TLS,
})

const app = await buildApp({
  repo: createPrismaRepository(prisma, env.APPLICATION_ENCRYPTION_KEY),
  secret: env.CHATPLATAFORMA_CLIENT_SECRET,
  chatPlataformaUrl: env.CHATPLATAFORMA_API_URL,
  logger: loggerOptions(env),
})

const shutdown = async () => {
  await app.close()
  await prisma.$disconnect()
  process.exit(0)
}
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)

await app.listen({ host: '0.0.0.0', port: env.APPLICATION_PORT })

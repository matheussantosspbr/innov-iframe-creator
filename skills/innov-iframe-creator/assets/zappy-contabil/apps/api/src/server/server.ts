import { loadEnv } from '#src/config/env.ts'
import { createPrismaClient } from '#src/infrastructure/libs/prisma.ts'
import { createPrismaTenantRepository } from '#src/infrastructure/repository/tenant.repository.ts'
import { buildApp } from './bootstrap.ts'
import { loggerOptions } from './logger.ts'

const env = loadEnv()
const prisma = createPrismaClient(env.DATABASE_URL, {
  poolSize: env.DATABASE_POOL_SIZE,
  tls: env.DATABASE_TLS,
})

const app = await buildApp({
  tenants: createPrismaTenantRepository(prisma, env.APPLICATION_ENCRYPTION_KEY),
  comhubKey: env.APPLICATION_X_COMHUB_KEY,
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

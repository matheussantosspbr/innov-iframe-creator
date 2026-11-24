import { PrismaMariaDb } from '@prisma/adapter-mariadb'
import { PrismaClient } from '@prisma/client'
import { mariaDbConfigFrom } from './database.ts'

export const createPrismaClient = (
  databaseUrl: string,
  options: { poolSize: number; tls: boolean },
) => new PrismaClient({ adapter: new PrismaMariaDb(mariaDbConfigFrom(databaseUrl, options)) })

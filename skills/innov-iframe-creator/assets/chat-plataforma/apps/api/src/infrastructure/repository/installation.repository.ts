import type {
  Installation,
  InstallationRepository,
} from '#src/core/repository/installation.repository.interface.ts'
import type { Credentials } from '#src/core/utils/credentials.ts'
import type { PrismaClient } from '#src/generated/prisma/client.ts'
import { decrypt, encrypt } from '#src/infrastructure/libs/crypto.ts'

const freezeInstallation = (installation: Installation): Installation =>
  Object.freeze({ ...installation, credentials: Object.freeze({ ...installation.credentials }) })

export const createPrismaRepository = (
  prisma: PrismaClient,
  credentialsKey: string,
): InstallationRepository => {
  const seal = (c: Credentials) => encrypt(JSON.stringify(c), credentialsKey)
  const open = (sealed: string) => JSON.parse(decrypt(sealed, credentialsKey)) as Credentials

  return {
    async create({ externalId, credentials }) {
      const row = await prisma.installation.create({
        data: { externalId, credentials: seal(credentials) },
      })
      return freezeInstallation({ id: row.id, externalId, credentials })
    },
    async find(externalId) {
      const row = await prisma.installation.findUnique({ where: { externalId } })
      return row
        ? freezeInstallation({ id: row.id, externalId, credentials: open(row.credentials) })
        : null
    },
    async update({ externalId, credentials }) {
      const { count } = await prisma.installation.updateMany({
        where: { externalId },
        data: { credentials: seal(credentials) },
      })
      return count > 0
    },
    async delete(externalId) {
      const { count } = await prisma.installation.deleteMany({ where: { externalId } })
      return count > 0
    },
    async ping() {
      await prisma.$queryRaw`SELECT 1`
    },
  }
}

export const createMemoryRepository = (): InstallationRepository => {
  const rows = new Map<string, Installation>()
  let seq = 0
  return {
    async create({ externalId, credentials }) {
      const row = freezeInstallation({ id: ++seq, externalId, credentials })
      rows.set(externalId, row)
      return row
    },
    async find(externalId) {
      return rows.get(externalId) ?? null
    },
    async update({ externalId, credentials }) {
      const row = rows.get(externalId)
      if (!row) return false
      rows.set(externalId, freezeInstallation({ ...row, credentials }))
      return true
    },
    async delete(externalId) {
      return rows.delete(externalId)
    },
    async ping() {},
  }
}

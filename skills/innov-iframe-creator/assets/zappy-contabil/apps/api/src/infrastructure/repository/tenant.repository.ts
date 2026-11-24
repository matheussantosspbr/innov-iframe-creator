import type { PrismaClient } from '@prisma/client'
import type {
  NewTenant,
  Tenant,
  TenantRepository,
  TenantWithCredentials,
} from '#src/core/repository/tenant.repository.interface.ts'
import { AppError } from '#src/core/utils/app-error.ts'
import { ADMIN_MESSAGES } from '#src/core/utils/messages.ts'
import { decrypt, encrypt } from '#src/infrastructure/libs/crypto.ts'

const UNIQUE_VIOLATION = 'P2002'

const urlTaken = (cause?: unknown) => new AppError(409, ADMIN_MESSAGES.tenantUrlTaken, { cause })

const toTenant = ({ id, name, zappyUrl, active, createdAt, updatedAt }: Tenant): Tenant =>
  Object.freeze({ id, name, zappyUrl, active, createdAt, updatedAt })

export const createPrismaTenantRepository = (
  prisma: PrismaClient,
  encryptionKey: string,
): TenantRepository => ({
  async create({ id, name, zappyUrl, zappyToken }) {
    try {
      const row = await prisma.tenant.create({
        data: { id, name, zappyUrl, zappyToken: encrypt(zappyToken, encryptionKey) },
      })
      return toTenant(row)
    } catch (err) {
      if ((err as { code?: string }).code === UNIQUE_VIOLATION) throw urlTaken(err)
      throw err
    }
  },
  async findById(id) {
    const row = await prisma.tenant.findUnique({ where: { id } })
    if (!row) return null
    return Object.freeze({
      ...toTenant(row),
      credentials: Object.freeze({
        baseUrl: row.zappyUrl,
        token: decrypt(row.zappyToken, encryptionKey),
      }),
    })
  },
  async list() {
    const rows = await prisma.tenant.findMany({ orderBy: { createdAt: 'asc' } })
    return rows.map(toTenant)
  },
  async setActive(id, active) {
    const { count } = await prisma.tenant.updateMany({ where: { id }, data: { active } })
    return count > 0
  },
  async remove(id) {
    const { count } = await prisma.tenant.deleteMany({ where: { id } })
    return count > 0
  },
})

type MemoryRow = Tenant & Readonly<{ sealedToken: string }>

export const createMemoryTenantRepository = (encryptionKey: string): TenantRepository => {
  const rows = new Map<string, MemoryRow>()
  return {
    async create({ id, name, zappyUrl, zappyToken }: NewTenant) {
      if ([...rows.values()].some((row) => row.zappyUrl === zappyUrl)) throw urlTaken()
      const now = new Date()
      const row = {
        id,
        name,
        zappyUrl,
        active: true,
        createdAt: now,
        updatedAt: now,
        sealedToken: encrypt(zappyToken, encryptionKey),
      }
      rows.set(id, row)
      return toTenant(row)
    },
    async findById(id) {
      const row = rows.get(id)
      if (!row) return null
      return Object.freeze({
        ...toTenant(row),
        credentials: Object.freeze({
          baseUrl: row.zappyUrl,
          token: decrypt(row.sealedToken, encryptionKey),
        }),
      }) satisfies TenantWithCredentials
    },
    async list() {
      return [...rows.values()].map(toTenant)
    },
    async setActive(id, active) {
      const row = rows.get(id)
      if (!row) return false
      rows.set(id, { ...row, active, updatedAt: new Date() })
      return true
    },
    async remove(id) {
      return rows.delete(id)
    },
  }
}

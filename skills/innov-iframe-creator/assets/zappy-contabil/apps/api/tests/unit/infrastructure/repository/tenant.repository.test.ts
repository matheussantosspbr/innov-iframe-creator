import type { PrismaClient } from '@prisma/client'
import { describe, expect, it } from 'vitest'
import type { TenantRepository } from '#src/core/repository/tenant.repository.interface.ts'
import { decrypt } from '#src/infrastructure/libs/crypto.ts'
import {
  createMemoryTenantRepository,
  createPrismaTenantRepository,
} from '#src/infrastructure/repository/tenant.repository.ts'
import {
  FIXTURE_ENCRYPTION_KEY,
  FIXTURE_NEW_TENANT,
  FIXTURE_ZAPPY_CREDENTIALS,
} from '../../../support/fixtures.ts'

const newTenant = { id: 'tenant-1', ...FIXTURE_NEW_TENANT }

const contract = (name: string, make: () => TenantRepository) =>
  describe(`Repositório de tenants (${name})`, () => {
    it('cria o tenant ativo e nunca devolve o token no cadastro nem na listagem', async () => {
      const repo = make()

      const created = await repo.create(newTenant)
      const [listed] = await repo.list()

      expect(created).toMatchObject({
        id: 'tenant-1',
        name: newTenant.name,
        zappyUrl: newTenant.zappyUrl,
        active: true,
      })
      for (const tenant of [created, listed]) {
        expect(JSON.stringify(tenant)).not.toContain(newTenant.zappyToken)
        expect(tenant).not.toHaveProperty('credentials')
        expect(tenant).not.toHaveProperty('zappyToken')
      }
    })

    it('rejeita zappyUrl duplicada com 409', async () => {
      const repo = make()
      await repo.create(newTenant)

      await expect(repo.create({ ...newTenant, id: 'tenant-2' })).rejects.toMatchObject({
        statusCode: 409,
      })
    })

    it('findById devolve a credencial decifrada para uso interno e null se não existir', async () => {
      const repo = make()
      await repo.create(newTenant)

      expect((await repo.findById('tenant-1'))?.credentials).toEqual({
        baseUrl: newTenant.zappyUrl,
        token: newTenant.zappyToken,
      })
      expect(await repo.findById('nao-existe')).toBeNull()
    })

    it('desativa, reativa e remove; operação em id inexistente devolve false', async () => {
      const repo = make()
      await repo.create(newTenant)

      expect(await repo.setActive('tenant-1', false)).toBe(true)
      expect((await repo.findById('tenant-1'))?.active).toBe(false)
      expect(await repo.setActive('tenant-1', true)).toBe(true)
      expect((await repo.findById('tenant-1'))?.active).toBe(true)
      expect(await repo.remove('tenant-1')).toBe(true)
      expect(await repo.findById('tenant-1')).toBeNull()
      expect(await repo.setActive('tenant-1', true)).toBe(false)
      expect(await repo.remove('tenant-1')).toBe(false)
    })
  })

contract('memória', () => createMemoryTenantRepository(FIXTURE_ENCRYPTION_KEY))

type Row = {
  id: string
  name: string
  zappyUrl: string
  zappyToken: string
  active: boolean
  createdAt: Date
  updatedAt: Date
}

// Prisma falso só com as quatro operações usadas, guardando a linha como o MySQL guardaria.
const fakePrisma = () => {
  const rows = new Map<string, Row>()
  const tenant = {
    create: async ({ data }: { data: Pick<Row, 'id' | 'name' | 'zappyUrl' | 'zappyToken'> }) => {
      if ([...rows.values()].some((r) => r.zappyUrl === data.zappyUrl)) {
        throw Object.assign(new Error('Unique constraint failed'), { code: 'P2002' })
      }
      const now = new Date()
      const row = { ...data, active: true, createdAt: now, updatedAt: now }
      rows.set(data.id, row)
      return row
    },
    findUnique: async ({ where }: { where: { id: string } }) => rows.get(where.id) ?? null,
    findMany: async () => [...rows.values()],
    updateMany: async ({ where, data }: { where: { id: string }; data: { active: boolean } }) => {
      const row = rows.get(where.id)
      if (row) rows.set(where.id, { ...row, ...data })
      return { count: row ? 1 : 0 }
    },
    deleteMany: async ({ where }: { where: { id: string } }) => ({
      count: rows.delete(where.id) ? 1 : 0,
    }),
  }
  return { rows, prisma: { tenant } as unknown as PrismaClient }
}

contract('Prisma', () => createPrismaTenantRepository(fakePrisma().prisma, FIXTURE_ENCRYPTION_KEY))

describe('Token do tenant cifrado em repouso (Prisma)', () => {
  it('grava só o token cifrado (AES-256-GCM) e o decifra na leitura', async () => {
    const { rows, prisma } = fakePrisma()
    const repo = createPrismaTenantRepository(prisma, FIXTURE_ENCRYPTION_KEY)

    await repo.create({
      id: 'tenant-1',
      name: 'n',
      zappyUrl: 'u',
      zappyToken: FIXTURE_ZAPPY_CREDENTIALS.token,
    })

    const stored = rows.get('tenant-1')?.zappyToken ?? ''
    expect(stored).not.toContain(FIXTURE_ZAPPY_CREDENTIALS.token)
    expect(decrypt(stored, FIXTURE_ENCRYPTION_KEY)).toBe(FIXTURE_ZAPPY_CREDENTIALS.token)
    expect(stored.length).toBeLessThanOrEqual(512)
  })

  it('o tamanho cifrado de um token no limite do schema cabe no VarChar(512)', async () => {
    const { rows, prisma } = fakePrisma()
    const repo = createPrismaTenantRepository(prisma, FIXTURE_ENCRYPTION_KEY)

    await repo.create({ id: 't', name: 'n', zappyUrl: 'u', zappyToken: 'x'.repeat(256) })

    expect(rows.get('t')?.zappyToken.length).toBeLessThanOrEqual(512)
  })
})

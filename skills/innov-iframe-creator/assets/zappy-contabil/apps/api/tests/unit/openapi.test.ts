import { readFileSync } from 'node:fs'
import { isDeepStrictEqual } from 'node:util'
import { describe, expect, it } from 'vitest'
import { buildOpenApi } from '#src/scripts/print-openapi.ts'

type Operation = { tags: string[]; summary?: string; security: unknown[] }

const COMMITTED = new URL('../../../../docs/api/openapi.json', import.meta.url)

describe('docs/api/openapi.json', () => {
  it('está em dia com as rotas do código', async () => {
    const committed = JSON.parse(readFileSync(COMMITTED, 'utf8'))
    const current = JSON.parse(await buildOpenApi())

    expect(
      isDeepStrictEqual(committed, current),
      'docs/api/openapi.json desatualizado. Rode: pnpm --filter api openapi:schema > docs/api/openapi.json && pnpm exec biome format --write docs/api/openapi.json',
    ).toBe(true)
  })

  it('documenta as sete rotas com tags, resumo e segurança', async () => {
    const spec = JSON.parse(await buildOpenApi())
    const operations = Object.values<Record<string, Operation>>(spec.paths).flatMap((item) =>
      Object.values(item),
    )

    expect(operations).toHaveLength(7)
    for (const op of operations) {
      expect(op.tags).toHaveLength(1)
      expect(op.summary).toBeTruthy()
      expect(op.security).toHaveLength(1)
    }
  })
})

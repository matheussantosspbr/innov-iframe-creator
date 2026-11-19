import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = join(import.meta.dirname, '../../src')

const filesUnder = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return entry.name === 'generated' ? [] : filesUnder(path)
    return entry.name.endsWith('.ts') ? [path] : []
  })

const FROM = /(?:from|import)\s+'([^']+)'/g

// Alias (#src/...) and relative imports become paths relative to src/; packages stay as written.
const importsOf = (file: string) =>
  [...readFileSync(file, 'utf8').matchAll(FROM)].map((match) => {
    const spec = match[1] as string
    if (spec.startsWith('#src/')) return spec.slice('#src/'.length)
    if (spec.startsWith('.')) return relative(SRC, resolve(dirname(file), spec))
    return spec
  })

const sources = filesUnder(SRC).map((file) => ({
  file: relative(SRC, file),
  imports: importsOf(file),
}))

const under = (prefix: string) => sources.filter(({ file }) => file.startsWith(prefix))

const violations = (files: ReturnType<typeof under>, forbidden: (specifier: string) => boolean) =>
  files.flatMap(({ file, imports }) => imports.filter(forbidden).map((spec) => `${file} → ${spec}`))

const inLayer = (spec: string, ...layers: string[]) =>
  layers.some((layer) => spec === layer || spec.startsWith(`${layer}/`))
const isPrisma = (spec: string) => /^generated\/prisma|^@prisma\//.test(spec)
const isFastify = (spec: string) => /^fastify($|[-/])|^@fastify\//.test(spec)

describe('Clean Architecture: core ← infrastructure | presentation ← server', () => {
  it('encontra arquivos em todas as camadas', () => {
    for (const layer of ['core', 'infrastructure', 'presentation', 'server']) {
      expect(under(`${layer}/`).length).toBeGreaterThan(0)
    }
  })

  it('core não importa infrastructure, presentation, server, fastify nem Prisma', () => {
    expect(
      violations(
        under('core/'),
        (spec) =>
          inLayer(spec, 'infrastructure', 'presentation', 'server') ||
          isFastify(spec) ||
          isPrisma(spec),
      ),
    ).toEqual([])
  })

  it('presentation não importa infrastructure nem Prisma', () => {
    expect(
      violations(
        under('presentation/'),
        (spec) => inLayer(spec, 'infrastructure') || isPrisma(spec),
      ),
    ).toEqual([])
  })

  it('controllers não importam repositories', () => {
    expect(
      violations(under('presentation/controllers/'), (spec) => /repository/.test(spec)),
    ).toEqual([])
  })

  it('routes não importam use-cases de infrastructure', () => {
    expect(
      violations(under('presentation/routes/'), (spec) =>
        inLayer(spec, 'infrastructure/use-cases'),
      ),
    ).toEqual([])
  })

  it('infrastructure não importa presentation nem server', () => {
    expect(
      violations(under('infrastructure/'), (spec) => inLayer(spec, 'presentation', 'server')),
    ).toEqual([])
  })

  it('só infrastructure/repository, infrastructure/libs/prisma* e server/server.ts importam o Prisma gerado', () => {
    const allowed = (file: string) =>
      file.startsWith('infrastructure/repository/') ||
      file.startsWith('infrastructure/libs/prisma') ||
      file === 'server/server.ts'

    expect(
      violations(
        sources.filter(({ file }) => !allowed(file)),
        (spec) => /^generated\/prisma/.test(spec),
      ),
    ).toEqual([])
  })
})

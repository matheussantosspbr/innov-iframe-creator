import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { makeApp } from '../support/helpers.ts'

const SPEC_FILE = join(import.meta.dirname, '../../../../docs/api/openapi.json')

describe('Documentação da API: docs/api/openapi.json', () => {
  it('está em dia com as rotas e schemas do código', async () => {
    const { app } = await makeApp()
    const committed = JSON.parse(readFileSync(SPEC_FILE, 'utf8'))
    const current = JSON.parse(JSON.stringify(app.swagger()))
    // o título muda por projeto (scaffold), o resto deve ser idêntico
    current.info.title = committed.info.title

    expect(
      current,
      'docs/api/openapi.json desatualizado: rode `pnpm --filter api openapi:schema > docs/api/openapi.json` e comite',
    ).toEqual(committed)
  })

  it('documenta todas as rotas da API', async () => {
    const { app } = await makeApp()
    const { paths } = app.swagger()

    expect(Object.keys(paths ?? {}).sort()).toEqual([
      '/api/app/client-logs',
      '/api/app/tickets/{ticketId}',
      '/api/health',
      '/api/instances/{externalId}/diagnostics',
      '/api/provision/configure',
      '/api/provision/install',
      '/api/provision/uninstall',
    ])
  })
})

import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FIXTURE_TENANT_ID, FIXTURE_USER_ID } from './fixtures.ts'
import { renderIframeApp, stubBackend } from './harness.tsx'

describe('Acesso ao iframe: exige tenantId e userId na URL', () => {
  it.each([
    ['sem parâmetros', ''],
    ['só tenantId', '?tenantId=42'],
    ['só userId', '?userId=7'],
  ])('mostra "Acesso negado" no lugar do app %s', (_label, search) => {
    const backend = stubBackend(() => undefined)
    renderIframeApp(search)

    expect(screen.getByText('Acesso negado')).toBeInTheDocument()
    expect(screen.queryByText(`Empresa ${FIXTURE_TENANT_ID}`)).not.toBeInTheDocument()
    expect(backend.calls).toEqual([])
  })

  it('abre a Home com a empresa e o usuário recebidos', () => {
    stubBackend(() => undefined)
    renderIframeApp()

    expect(screen.getByText(`Empresa ${FIXTURE_TENANT_ID}`)).toBeInTheDocument()
    expect(screen.getByText(`Usuário ${FIXTURE_USER_ID}`)).toBeInTheDocument()
    expect(screen.queryByText('Acesso negado')).not.toBeInTheDocument()
  })

  it('não exibe "Voltar" na primeira Screen da pilha', () => {
    stubBackend(() => undefined)
    renderIframeApp()

    expect(screen.queryByRole('button', { name: 'Voltar' })).not.toBeInTheDocument()
  })
})

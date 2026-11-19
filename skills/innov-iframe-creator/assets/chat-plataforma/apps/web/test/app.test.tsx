import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  FIXTURE_ACCOUNT_ID,
  FIXTURE_AGENT_ID,
  FIXTURE_REQUEST_ID,
  FIXTURE_TICKET_ID,
} from './fixtures.ts'
import { renderIframeApp, stubBackend } from './harness.tsx'

const ticketRoute = (path: string) =>
  path === `/api/app/tickets/${FIXTURE_TICKET_ID}`
    ? { json: { body: { id: FIXTURE_TICKET_ID, status: 'open' } } }
    : undefined

describe('Navegação em memória: troca de Screen sem alterar a URL do iframe', () => {
  it('abre a Screen { name: "ticket" } ao acionar "Ver dados do ticket" e mantém a URL', async () => {
    stubBackend(ticketRoute)
    const { user, initialHref, initialHistoryLength } = renderIframeApp()

    await user.click(screen.getByRole('button', { name: 'Ver dados do ticket' }))

    expect(await screen.findByText('Dados do ticket')).toBeInTheDocument()
    expect(window.location.href).toBe(initialHref)
    expect(history.length).toBe(initialHistoryLength)
  })

  it('volta para a Screen anterior pelo "Voltar" do Screen.Header', async () => {
    stubBackend(ticketRoute)
    const { user, initialHref } = renderIframeApp()

    await user.click(screen.getByRole('button', { name: 'Ver dados do ticket' }))
    await user.click(await screen.findByRole('button', { name: 'Voltar' }))

    expect(screen.getByRole('button', { name: 'Ver dados do ticket' })).toBeInTheDocument()
    expect(window.location.href).toBe(initialHref)
  })

  it('não exibe "Voltar" na primeira Screen da pilha', () => {
    stubBackend(ticketRoute)
    renderIframeApp()

    expect(screen.queryByRole('button', { name: 'Voltar' })).not.toBeInTheDocument()
  })
})

describe('Contexto do atendimento lido da URL do iframe', () => {
  it('exibe o ticket e o atendente recebidos como snowflakes em string', () => {
    stubBackend(ticketRoute)
    renderIframeApp()

    expect(screen.getByText(`Ticket ${FIXTURE_TICKET_ID}`)).toBeInTheDocument()
  })

  it('exibe aviso de contexto ausente quando a URL não traz os parâmetros obrigatórios', () => {
    stubBackend(ticketRoute)
    renderIframeApp('?agentId=1')

    expect(screen.getByText('Contexto do atendimento ausente')).toBeInTheDocument()
  })
})

describe('Comunicação com o backend do app', () => {
  it('envia accountId, agentId e ticketId do contexto nos headers de toda chamada', async () => {
    const backend = stubBackend(ticketRoute)
    const { user } = renderIframeApp()

    await user.click(screen.getByRole('button', { name: 'Ver dados do ticket' }))
    await screen.findByText(/"status": "open"/)

    expect(backend.calls[0]?.headers).toMatchObject({
      'x-account-id': FIXTURE_ACCOUNT_ID,
      'x-agent-id': FIXTURE_AGENT_ID,
      'x-ticket-id': FIXTURE_TICKET_ID,
    })
  })

  it('exibe Alert com a mensagem do envelope de erro e permite tentar de novo', async () => {
    let attempts = 0
    stubBackend((path) => {
      if (!path.startsWith('/api/app/tickets/')) return undefined
      attempts += 1
      return attempts === 1
        ? { status: 401, json: { error: { message: 'Instalação não encontrada' } } }
        : ticketRoute(path)
    })
    const { user } = renderIframeApp()

    await user.click(screen.getByRole('button', { name: 'Ver dados do ticket' }))
    expect(await screen.findByText('Instalação não encontrada')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(await screen.findByText(/"status": "open"/)).toBeInTheDocument()
  })
})

describe('Erros do backend na tela do ticket', () => {
  it('mostra a mensagem amigável do envelope e "Tentar de novo" em 5xx, sem identificadores', async () => {
    stubBackend((path) =>
      path.startsWith('/api/app/tickets/')
        ? {
            status: 502,
            json: {
              error: { message: 'Tente novamente em instantes.' },
            },
            headers: { 'x-request-id': FIXTURE_REQUEST_ID },
          }
        : undefined,
    )
    const { user } = renderIframeApp()

    await user.click(screen.getByRole('button', { name: 'Ver dados do ticket' }))

    expect(
      await screen.findByText('Tente novamente em instantes.', {}, { timeout: 4000 }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument()
    expect(screen.queryByText(new RegExp(FIXTURE_REQUEST_ID))).not.toBeInTheDocument()
  })
})

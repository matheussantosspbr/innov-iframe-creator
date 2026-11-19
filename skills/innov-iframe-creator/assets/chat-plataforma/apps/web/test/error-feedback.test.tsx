import { ToastProvider } from '@innovui/react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ErrorAlert } from '../src/components/ErrorAlert.tsx'
import { useErrorToast } from '../src/hooks/use-error-toast.ts'
import { ApiRequestError } from '../src/lib/api.ts'
import { FRONT_MESSAGES } from '../src/lib/error-message.ts'
import { FIXTURE_REQUEST_ID } from './fixtures.ts'

const FRIENDLY_SERVER_MESSAGE = 'Não conseguimos falar com o Chat Plataforma agora.'

const serverError = new ApiRequestError(502, FRIENDLY_SERVER_MESSAGE, FIXTURE_REQUEST_ID)

const TriggerErrorToast = ({ error }: { error: unknown }) => {
  const showError = useErrorToast()
  return (
    <button type="button" onClick={() => showError(error, 'Não foi possível salvar')}>
      salvar
    </button>
  )
}

const renderToastTrigger = (error: unknown) => {
  render(
    <ToastProvider>
      <TriggerErrorToast error={error} />
    </ToastProvider>,
  )
  return userEvent.setup()
}

describe('Toast de erro (useErrorToast): só a mensagem amigável', () => {
  it('mostra só a mensagem amigável, sem o requestId', async () => {
    const user = renderToastTrigger(serverError)

    await user.click(screen.getByRole('button', { name: 'salvar' }))

    expect(await screen.findByText(FRIENDLY_SERVER_MESSAGE)).toBeInTheDocument()
    expect(screen.queryByText(new RegExp(FIXTURE_REQUEST_ID))).not.toBeInTheDocument()
  })

  it('troca erro de rede do navegador por mensagem de conexão', async () => {
    const user = renderToastTrigger(new TypeError('Failed to fetch'))

    await user.click(screen.getByRole('button', { name: 'salvar' }))

    expect(await screen.findByText(FRONT_MESSAGES.offline)).toBeInTheDocument()
    expect(screen.queryByText('Failed to fetch')).not.toBeInTheDocument()
  })
})

describe('Alert de erro (ErrorAlert): mensagem amigável sem detalhes técnicos', () => {
  it('mostra a mensagem do envelope sem o requestId', () => {
    render(<ErrorAlert title="Não foi possível carregar" error={serverError} />)

    expect(screen.getByText(FRIENDLY_SERVER_MESSAGE)).toBeInTheDocument()
    expect(screen.queryByText(new RegExp(FIXTURE_REQUEST_ID))).not.toBeInTheDocument()
  })

  it('oferece "Tentar de novo" quando recebe onRetry', async () => {
    const onRetry = vi.fn()
    const user = userEvent.setup()
    render(<ErrorAlert title="Não foi possível carregar" error={serverError} onRetry={onRetry} />)

    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }))

    expect(onRetry).toHaveBeenCalledOnce()
  })
})

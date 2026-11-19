import { Card, IconButton, Skeleton } from '@innovui/react'
import { RefreshCw } from 'lucide-react'
import { ErrorAlert } from '../components/ErrorAlert.tsx'
import { Screen } from '../components/Screen.tsx'
import { useTicket } from '../hooks/use-ticket.ts'

export const TicketScreen = ({ ticketId }: { ticketId: string }) => {
  const ticket = useTicket(ticketId)

  return (
    <Screen.Root>
      <Screen.Header
        title="Dados do ticket"
        actions={
          <IconButton
            aria-label="Atualizar"
            variant="ghost"
            size="sm"
            loading={ticket.isFetching}
            onClick={() => ticket.refetch()}
          >
            <RefreshCw size={16} />
          </IconButton>
        }
      />
      <Screen.Body>
        {ticket.isPending && <Skeleton variant="card" className="w-full" />}
        {ticket.isError && (
          <ErrorAlert
            title="Não foi possível carregar o ticket"
            error={ticket.error}
            onRetry={() => ticket.refetch()}
          />
        )}
        {ticket.isSuccess && (
          <Card padding="md">
            <pre className="m-0 whitespace-pre-wrap wrap-anywhere text-xs">
              {JSON.stringify(ticket.data, null, 2)}
            </pre>
          </Card>
        )}
      </Screen.Body>
    </Screen.Root>
  )
}

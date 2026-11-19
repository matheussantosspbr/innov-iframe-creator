import { Button, Card, Stack } from '@innovui/react'
import { ChevronRight, MessagesSquare, UserRound } from 'lucide-react'
import { Screen } from '../components/Screen.tsx'
import { useAppContext } from '../lib/app-context.tsx'
import { SCREEN, useNavigation } from '../lib/navigation.tsx'

export const HomeScreen = () => {
  const { ctx } = useAppContext()
  const { push } = useNavigation()

  return (
    <Screen.Root>
      <Screen.Body>
        <Card padding="md">
          <Stack gap={2}>
            <Stack direction="row" align="center" gap={2}>
              <MessagesSquare size={18} className="shrink-0 text-(--color-text-brand)" />
              <strong className="truncate">Ticket {ctx.ticketId}</strong>
            </Stack>
            <Stack direction="row" align="center" gap={2} className="text-(--color-text-secondary)">
              <UserRound size={16} className="shrink-0" />
              <span className="truncate">Atendente {ctx.agentId}</span>
            </Stack>
          </Stack>
        </Card>
      </Screen.Body>
      <Screen.Footer>
        <Button
          trailingIcon={<ChevronRight size={16} />}
          onClick={() => push({ name: SCREEN.ticket, ticketId: ctx.ticketId })}
        >
          Ver dados do ticket
        </Button>
      </Screen.Footer>
    </Screen.Root>
  )
}

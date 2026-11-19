import { Card, Stack } from '@innovui/react'
import { Building2, UserRound } from 'lucide-react'
import { Screen } from '../components/Screen.tsx'
import { useAppContext } from '../lib/app-context.tsx'

export const HomeScreen = () => {
  const { ctx } = useAppContext()

  return (
    <Screen.Root>
      <Screen.Body>
        <Card padding="md">
          <Stack gap={2}>
            <Stack direction="row" align="center" gap={2}>
              <Building2 size={18} className="shrink-0 text-(--color-text-brand)" />
              <strong className="truncate">Empresa {ctx.tenantId}</strong>
            </Stack>
            <Stack direction="row" align="center" gap={2} className="text-(--color-text-secondary)">
              <UserRound size={16} className="shrink-0" />
              <span className="truncate">Usuário {ctx.userId}</span>
            </Stack>
          </Stack>
        </Card>
      </Screen.Body>
    </Screen.Root>
  )
}

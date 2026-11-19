import { Button, Stack } from '@innovui/react'
import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { useNavigation } from '../lib/navigation.tsx'

const Root = ({ children }: { children: ReactNode }) => <Stack gap={3}>{children}</Stack>

const Header = ({ title, actions }: { title?: ReactNode; actions?: ReactNode }) => {
  const { canGoBack, back } = useNavigation()
  return (
    <Stack direction="row" align="center" justify="between" gap={2}>
      <Stack direction="row" align="center" gap={2} className="min-w-0">
        {canGoBack && (
          <Button variant="ghost" size="sm" leadingIcon={<ArrowLeft size={16} />} onClick={back}>
            Voltar
          </Button>
        )}
        {title && <strong className="truncate">{title}</strong>}
      </Stack>
      {actions}
    </Stack>
  )
}

const Body = ({ children }: { children: ReactNode }) => <Stack gap={3}>{children}</Stack>

const Footer = ({ children }: { children: ReactNode }) => (
  <Stack gap={2} className="*:w-full">
    {children}
  </Stack>
)

export const Screen = { Root, Header, Body, Footer }

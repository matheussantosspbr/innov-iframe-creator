import { Alert } from '@innovui/react'

export const AccessDeniedScreen = ({ reason }: { reason: string }) => (
  <Alert status="error" title="Acesso negado">
    {reason}
  </Alert>
)

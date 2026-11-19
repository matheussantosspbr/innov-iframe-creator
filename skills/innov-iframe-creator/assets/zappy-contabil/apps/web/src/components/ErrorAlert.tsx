import { Alert, Button } from '@innovui/react'
import { RotateCw } from 'lucide-react'
import { friendlyMessage } from '../lib/error-message.ts'

type Props = { title: string; error: unknown; onRetry?: () => void }

export const ErrorAlert = ({ title, error, onRetry }: Props) => (
  <Alert
    status="error"
    title={title}
    action={
      onRetry && (
        <Button
          size="sm"
          variant="secondary"
          leadingIcon={<RotateCw size={14} />}
          onClick={onRetry}
        >
          Tentar de novo
        </Button>
      )
    }
  >
    {friendlyMessage(error)}
  </Alert>
)

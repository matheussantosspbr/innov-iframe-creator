import { useToast } from '@innovui/react'
import { useCallback } from 'react'
import { friendlyMessage } from '../lib/error-message.ts'

export const useErrorToast = () => {
  const { toast } = useToast()
  return useCallback(
    (error: unknown, title = 'Não foi possível concluir a ação') =>
      toast({ status: 'error', title, description: friendlyMessage(error) }),
    [toast],
  )
}

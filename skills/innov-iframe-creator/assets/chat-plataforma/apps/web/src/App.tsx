import { CLIENT_LOG_LEVEL } from '@app/shared'
import { Alert, ToastProvider } from '@innovui/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { useMemo } from 'react'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import { createApi } from './lib/api.ts'
import { AppContextProvider } from './lib/app-context.tsx'
import { readIframeContext } from './lib/context.ts'
import { NavigationProvider, SCREEN, useNavigation } from './lib/navigation.tsx'
import { createQueryClient } from './lib/query-client.ts'
import { HomeScreen } from './screens/HomeScreen.tsx'
import { TicketScreen } from './screens/TicketScreen.tsx'

const CurrentScreen = () => {
  const { screen } = useNavigation()
  switch (screen.name) {
    case SCREEN.home:
      return <HomeScreen />
    case SCREEN.ticket:
      return <TicketScreen ticketId={screen.ticketId} />
  }
}

export const App = () => {
  const result = useMemo(() => readIframeContext(), [])
  const api = useMemo(() => (result.ok ? createApi(result.context) : null), [result])
  const queryClient = useMemo(() => (api ? createQueryClient(api) : null), [api])
  if (!result.ok || !api || !queryClient) {
    return (
      <Alert status="warning" title="Contexto do atendimento ausente">
        {result.ok ? '' : result.error}
      </Alert>
    )
  }

  return (
    <ErrorBoundary
      onError={(e, clientErrorId) =>
        api.log(CLIENT_LOG_LEVEL.error, e.message, {
          clientErrorId,
          stack: e.stack?.slice(0, 1500),
        })
      }
    >
      <QueryClientProvider client={queryClient}>
        <AppContextProvider ctx={result.context} api={api}>
          <ToastProvider>
            <NavigationProvider>
              <CurrentScreen />
            </NavigationProvider>
          </ToastProvider>
        </AppContextProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}

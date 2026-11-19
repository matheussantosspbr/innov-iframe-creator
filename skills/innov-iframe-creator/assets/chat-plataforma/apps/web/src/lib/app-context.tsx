import type { IframeContext } from '@app/shared'
import { createContext, type ReactNode, useContext, useMemo } from 'react'
import type { Api } from './api.ts'

type AppContextValue = { ctx: IframeContext; api: Api }

const AppContext = createContext<AppContextValue | null>(null)

export const AppContextProvider = ({
  ctx,
  api,
  children,
}: AppContextValue & { children: ReactNode }) => {
  const value = useMemo(() => ({ ctx, api }), [ctx, api])
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export const useAppContext = () => {
  const value = useContext(AppContext)
  if (!value) throw new Error('useAppContext fora do AppContextProvider')
  return value
}

import type { ValueOf } from '@app/shared'
import { createContext, type ReactNode, useContext, useMemo, useReducer } from 'react'

export const SCREEN = Object.freeze({
  home: 'home',
  ticket: 'ticket',
} as const)
export type ScreenName = ValueOf<typeof SCREEN>

export type Screen = Readonly<
  { name: typeof SCREEN.home } | { name: typeof SCREEN.ticket; ticketId: string }
>

export const NAVIGATION_ACTION = Object.freeze({
  push: 'push',
  back: 'back',
  reset: 'reset',
} as const)

type Action = Readonly<
  | { type: typeof NAVIGATION_ACTION.push; screen: Screen }
  | { type: typeof NAVIGATION_ACTION.back }
  | { type: typeof NAVIGATION_ACTION.reset; screen: Screen }
>

export type ScreenStack = readonly Screen[]

const HOME: Screen = { name: SCREEN.home }

export const navigationReducer = (stack: ScreenStack, action: Action): ScreenStack => {
  switch (action.type) {
    case NAVIGATION_ACTION.push:
      return [...stack, action.screen]
    case NAVIGATION_ACTION.back:
      return stack.length > 1 ? stack.slice(0, -1) : stack
    case NAVIGATION_ACTION.reset:
      return [action.screen]
  }
}

type Navigation = Readonly<{
  screen: Screen
  canGoBack: boolean
  push: (screen: Screen) => void
  back: () => void
  reset: (screen: Screen) => void
}>

const NavigationContext = createContext<Navigation | null>(null)

export const NavigationProvider = ({
  initial = HOME,
  children,
}: {
  initial?: Screen
  children: ReactNode
}) => {
  const [stack, dispatch] = useReducer(navigationReducer, [initial])
  const value = useMemo<Navigation>(
    () => ({
      screen: stack[stack.length - 1] ?? initial,
      canGoBack: stack.length > 1,
      push: (screen: Screen) => dispatch({ type: NAVIGATION_ACTION.push, screen }),
      back: () => dispatch({ type: NAVIGATION_ACTION.back }),
      reset: (screen: Screen) => dispatch({ type: NAVIGATION_ACTION.reset, screen }),
    }),
    [stack, initial],
  )
  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>
}

export const useNavigation = () => {
  const nav = useContext(NavigationContext)
  if (!nav) throw new Error('useNavigation fora do NavigationProvider')
  return nav
}

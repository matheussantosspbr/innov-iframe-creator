import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { App } from '../src/App.tsx'
import { FIXTURE_IFRAME_SEARCH } from './fixtures.ts'

type BackendResponse = { status?: number; json: unknown; headers?: Record<string, string> }
type BackendRoute = (path: string, init: RequestInit) => BackendResponse | undefined

export const stubBackend = (route: BackendRoute) => {
  const calls: { path: string; headers: Record<string, string> }[] = []
  const fetchStub = vi.fn(async (input: string, init: RequestInit = {}) => {
    calls.push({ path: input, headers: init.headers as Record<string, string> })
    const response = route(input, init) ?? { json: { body: {} } }
    return new Response(JSON.stringify(response.json), {
      status: response.status ?? 200,
      headers: response.headers,
    })
  })
  vi.stubGlobal('fetch', fetchStub)
  return { calls }
}

export const renderIframeApp = (search = FIXTURE_IFRAME_SEARCH) => {
  window.history.replaceState(null, '', `/${search}`)
  const user = userEvent.setup()
  const view = render(<App />)
  return { ...view, user, initialHref: window.location.href, initialHistoryLength: history.length }
}

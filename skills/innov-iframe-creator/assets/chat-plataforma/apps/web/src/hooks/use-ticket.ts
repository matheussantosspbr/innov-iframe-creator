import { queryOptions, useQuery } from '@tanstack/react-query'
import type { Api } from '../lib/api.ts'
import { useAppContext } from '../lib/app-context.tsx'
import { QUERY_KEYS } from '../lib/query-keys.ts'

export const ticketQuery = (api: Api, ticketId: string) =>
  queryOptions({ queryKey: QUERY_KEYS.ticket(ticketId), queryFn: () => api.getTicket(ticketId) })

export const useTicket = (ticketId: string) => {
  const { api } = useAppContext()
  return useQuery(ticketQuery(api, ticketId))
}

export const QUERY_KEYS = Object.freeze({
  ticket: (ticketId: string) => ['ticket', ticketId] as const,
})

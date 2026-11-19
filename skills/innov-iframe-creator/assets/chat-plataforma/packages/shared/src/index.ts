import { z } from 'zod'

export type ValueOf<T> = T[keyof T]

export const HEADERS = Object.freeze({
  accountId: 'x-account-id',
  agentId: 'x-agent-id',
  ticketId: 'x-ticket-id',
  requestId: 'x-request-id',
} as const)

export const CLIENT_LOG_LEVEL = Object.freeze({
  error: 'error',
  warn: 'warn',
  info: 'info',
} as const)
export type ClientLogLevel = ValueOf<typeof CLIENT_LOG_LEVEL>

export const iframeContextSchema = z
  .object({
    accountId: z.string().min(1),
    agentId: z.string().min(1),
    ticketId: z.string().min(1),
    ticketConnectionId: z.string().min(1),
    contactId: z.string().min(1).optional(),
    ticketAgentId: z.string().min(1).optional(),
    ticketSectorId: z.string().min(1).optional(),
    ticketGroupId: z.string().min(1).optional(),
  })
  .readonly()

export type IframeContext = z.infer<typeof iframeContextSchema>

export type ApiSuccess<T> = Readonly<{ body: T }>
export type ApiError = Readonly<{ error: Readonly<{ message: string }> }>

export const TICKET_STATUS = Object.freeze({
  pending: 1,
  attending: 2,
  resolved: 4,
} as const)
export type TicketStatus = ValueOf<typeof TICKET_STATUS>

export const TICKET_PRIORITY = Object.freeze({
  low: 1,
  medium: 2,
  high: 3,
} as const)
export type TicketPriority = ValueOf<typeof TICKET_PRIORITY>

const namedRefSchema = z.object({ id: z.string(), name: z.string() })

export const ticketViewSchema = z
  .object({
    id: z.string(),
    protocol: z.number(),
    status: z.number(),
    priority: z.number(),
    frozen: z.boolean(),
    archived: z.boolean(),
    contact: namedRefSchema.extend({ phoneNumber: z.string().nullable() }).nullish(),
    group: namedRefSchema.nullish(),
    agent: namedRefSchema.nullish(),
    sector: namedRefSchema.nullish(),
    connection: z.object({ id: z.string(), provider: z.number() }),
  })
  .readonly()

export type TicketView = z.infer<typeof ticketViewSchema>

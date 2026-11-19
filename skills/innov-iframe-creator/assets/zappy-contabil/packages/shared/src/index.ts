import { z } from 'zod'

export type ValueOf<T> = T[keyof T]

export const HEADERS = Object.freeze({
  tenantId: 'x-tenant-id',
  userId: 'x-user-id',
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
    tenantId: z.string().min(1),
    userId: z.string().min(1),
  })
  .readonly()

export type IframeContext = z.infer<typeof iframeContextSchema>

export type ApiSuccess<T> = Readonly<{ body: T }>
export type ApiError = Readonly<{ error: Readonly<{ message: string }> }>

const idSchema = z.union([z.string(), z.number()]).transform(String)

export const ticketViewSchema = z
  .object({
    id: idSchema,
    status: z.string().nullish(),
    isGroup: z.boolean().nullish(),
    unreadMessages: z.number().nullish(),
    contactId: idSchema.nullish(),
    userId: idSchema.nullish(),
    queueId: idSchema.nullish(),
    whatsappId: idSchema.nullish(),
    createdAt: z.string().nullish(),
    updatedAt: z.string().nullish(),
  })
  .readonly()

export type TicketView = z.infer<typeof ticketViewSchema>

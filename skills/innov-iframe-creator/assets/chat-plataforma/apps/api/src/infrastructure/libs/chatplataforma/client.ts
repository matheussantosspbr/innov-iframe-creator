import { HEADERS, type TicketView, ticketViewSchema } from '@app/shared'
import { z } from 'zod'
import type { Permissions } from '#src/core/repository/chat-plataforma-client.interface.ts'
import { ChatPlataformaError } from '#src/core/utils/chat-plataforma-error.ts'
import { USER_MESSAGES } from '#src/core/utils/messages.ts'

export type Fetcher = typeof fetch

export const DEFAULT_TIMEOUT_MS = 8_000

const BUSINESS_ERROR_STATUSES: ReadonlySet<number> = new Set([400, 404, 409, 422])

const upstreamMessageOf = (text: string): string | undefined => {
  try {
    const parsed = JSON.parse(text) as { message?: unknown; error?: unknown }
    const candidate = parsed.message ?? parsed.error
    return typeof candidate === 'string' && candidate.length > 0 ? candidate : undefined
  } catch {
    return undefined
  }
}

const errorFor = (status: number, upstreamMessage: string | undefined, where: string) => {
  const cause = new Error(
    `Chat Plataforma respondeu ${status} em ${where}${upstreamMessage ? `: ${upstreamMessage}` : ''}`,
  )
  if (status === 401) {
    return new ChatPlataformaError(502, USER_MESSAGES.integrationNeedsReconfiguration, status, {
      cause,
    })
  }
  if (status === 403) {
    return new ChatPlataformaError(502, USER_MESSAGES.integrationMissingPermission, status, {
      cause,
    })
  }
  if (status === 429) {
    return new ChatPlataformaError(503, USER_MESSAGES.chatPlataformaBusy, status, { cause })
  }
  if (BUSINESS_ERROR_STATUSES.has(status)) {
    return new ChatPlataformaError(
      422,
      upstreamMessage ?? USER_MESSAGES.chatPlataformaRejected,
      status,
      { cause },
    )
  }
  return new ChatPlataformaError(502, USER_MESSAGES.chatPlataformaUnavailable, status, { cause })
}

export const permissionsSchema = z
  .object({ isAdmin: z.boolean(), permissions: z.array(z.string()).readonly() })
  .readonly()

export const createChatPlataformaClient = (opts: {
  baseUrl: string
  apiKey: string
  requestId?: string
  timeoutMs?: number
  fetcher?: Fetcher
}) => {
  const fetcher = opts.fetcher ?? fetch

  const request = async (method: string, path: string, body?: unknown): Promise<unknown> => {
    const where = `${method} ${path}`
    const res = await fetcher(`${opts.baseUrl}${path}`, {
      method,
      headers: {
        'x-api-key': opts.apiKey,
        ...(opts.requestId ? { [HEADERS.requestId]: opts.requestId } : {}),
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(opts.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    }).catch((err: Error) => {
      throw new ChatPlataformaError(502, USER_MESSAGES.chatPlataformaUnavailable, null, {
        cause: err,
      })
    })
    const text = await res.text()
    if (!res.ok) throw errorFor(res.status, upstreamMessageOf(text), where)
    if (!text) return undefined
    return (JSON.parse(text) as { body?: unknown }).body
  }

  const requestParsed = async <S extends z.ZodType>(
    schema: S,
    method: string,
    path: string,
    body?: unknown,
  ): Promise<z.infer<S>> => {
    const result = schema.safeParse(await request(method, path, body))
    if (result.success) return result.data
    throw new ChatPlataformaError(502, USER_MESSAGES.chatPlataformaUnavailable, null, {
      cause: new Error(`Resposta inesperada do Chat Plataforma em ${method} ${path}`, {
        cause: result.error,
      }),
    })
  }

  return {
    request,
    requestParsed,
    getMyPermissions: (): Promise<Permissions> =>
      requestParsed(permissionsSchema, 'GET', '/v1/me/permissions'),
    getTicket: (ticketId: string): Promise<TicketView> =>
      requestParsed(ticketViewSchema, 'GET', `/v1/tickets/${ticketId}`),
    setContactTags: (contactId: string, tagIds: readonly string[]) =>
      request('PUT', `/v1/contacts/${contactId}/tags`, { tags: tagIds }),
  }
}

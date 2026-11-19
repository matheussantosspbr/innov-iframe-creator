import {
  type ApiError,
  type ApiSuccess,
  type ClientLogLevel,
  HEADERS,
  type IframeContext,
} from '@app/shared'

export class ApiRequestError extends Error {
  readonly status: number
  readonly requestId: string | null
  constructor(status: number, message: string, requestId: string | null = null) {
    super(message)
    this.status = status
    this.requestId = requestId
  }
}

export const failedRequestId = (error: unknown) =>
  error instanceof ApiRequestError ? error.requestId : null

export const createApi = (ctx: IframeContext) => {
  const call = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
    const res = await fetch(`/api/app${path}`, {
      ...init,
      headers: {
        'content-type': 'application/json',
        [HEADERS.tenantId]: ctx.tenantId,
        [HEADERS.userId]: ctx.userId,
        ...init.headers,
      },
    })
    const json = (await res.json().catch(() => ({ error: { message: `HTTP ${res.status}` } }))) as
      | ApiSuccess<T>
      | ApiError
    if ('error' in json) {
      throw new ApiRequestError(res.status, json.error.message, res.headers.get(HEADERS.requestId))
    }
    return json.body
  }

  return {
    log: (level: ClientLogLevel, message: string, context?: Record<string, unknown>) =>
      call('/client-logs', {
        method: 'POST',
        body: JSON.stringify({ level, message: message.slice(0, 2000), context }),
      }).catch(() => undefined),
  }
}

export type Api = ReturnType<typeof createApi>

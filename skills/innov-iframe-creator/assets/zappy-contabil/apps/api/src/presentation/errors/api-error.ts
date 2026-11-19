import type { ApiError, ApiSuccess } from '@app/shared'

export const ok = <T>(body: T): ApiSuccess<T> => ({ body })
export const fail = (message: string): ApiError => ({ error: { message } })

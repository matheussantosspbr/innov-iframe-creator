import { CLIENT_LOG_LEVEL } from '@app/shared'
import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { type Api, ApiRequestError, failedRequestId } from './api.ts'

export const shouldRetry = (failureCount: number, error: unknown) => {
  if (error instanceof ApiRequestError && error.status >= 400 && error.status < 500) return false
  return failureCount < 1
}

export const createQueryClient = (api: Api) =>
  new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, retry: shouldRetry },
      mutations: { retry: false },
    },
    queryCache: new QueryCache({
      onError: (error, query) =>
        api.log(CLIENT_LOG_LEVEL.warn, `query falhou: ${error.message}`, {
          queryKey: query.queryKey,
          failedRequestId: failedRequestId(error),
        }),
    }),
    mutationCache: new MutationCache({
      onError: (error, _vars, _ctx, mutation) =>
        api.log(CLIENT_LOG_LEVEL.warn, `mutation falhou: ${error.message}`, {
          mutationKey: mutation.options.mutationKey,
          failedRequestId: failedRequestId(error),
        }),
    }),
  })

import { ticketViewSchema } from '@app/shared'
import {
  type Connection,
  Zdk,
  ZdkAuthError,
  ZdkConfigError,
  ZdkNotFoundError,
  type ZdkOptions,
} from 'zdk'
import type { ZappyClient, ZappyCredentials } from '#src/core/repository/zappy-client.interface.ts'
import { AppError } from '#src/core/utils/app-error.ts'
import { ADMIN_MESSAGES, USER_MESSAGES } from '#src/core/utils/messages.ts'

export type ZdkLike = Readonly<{
  connections: Readonly<{ list(): Promise<readonly Connection[]> }>
  tickets: Readonly<{ get(id: number): Promise<unknown> }>
  verify(): Promise<unknown>
}>

export type ZdkFactory = (options: ZdkOptions) => ZdkLike

export const ZAPPY_TIMEOUT_MS = 10_000

const toRuntimeError = (cause: unknown) => {
  if (cause instanceof AppError) return cause
  if (cause instanceof ZdkNotFoundError) {
    return new AppError(404, USER_MESSAGES.ticketNotFound, { cause })
  }
  if (cause instanceof ZdkAuthError) {
    return new AppError(502, USER_MESSAGES.zappyNeedsReconfiguration, { cause })
  }
  return new AppError(502, USER_MESSAGES.zappyUnavailable, { cause })
}

const toVerifyError = (cause: unknown) => {
  if (cause instanceof ZdkConfigError) {
    return new AppError(422, ADMIN_MESSAGES.tenantInvalidUrl, { cause })
  }
  if (cause instanceof ZdkAuthError) {
    return new AppError(422, ADMIN_MESSAGES.tenantInvalidCredentials, { cause })
  }
  return new AppError(502, ADMIN_MESSAGES.tenantInstanceDown, { cause })
}

export const createZappyClient = (
  credentials: ZappyCredentials,
  createZdk: ZdkFactory = (options) => new Zdk(options),
): ZappyClient => {
  let zdk: ZdkLike | undefined
  // `new Zdk` lança ZdkConfigError com URL/token inválidos: criar na primeira chamada degrada como qualquer outra falha.
  const call = async <T>(
    run: (zdk: ZdkLike) => Promise<T>,
    toError: (cause: unknown) => AppError,
  ) => {
    try {
      zdk ??= createZdk({
        baseUrl: credentials.baseUrl,
        token: credentials.token,
        retryConfig: { attempts: 1 },
        defaultTimeoutMs: ZAPPY_TIMEOUT_MS,
      })
      return await run(zdk)
    } catch (cause) {
      throw toError(cause)
    }
  }

  const listConnections = () =>
    call(async (zdk) => {
      const connections = await zdk.connections.list()
      return connections.map(({ id, name, status }) => ({ id, name, status }))
    }, toRuntimeError)

  return {
    listConnections,
    isReachable: () =>
      listConnections().then(
        () => true,
        () => false,
      ),
    getTicket: (ticketId) =>
      call(async (zdk) => ticketViewSchema.parse(await zdk.tickets.get(ticketId)), toRuntimeError),
    verify: () =>
      call(async (zdk) => {
        await zdk.verify()
      }, toVerifyError),
  }
}

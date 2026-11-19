import type { ValueOf } from '@app/shared'

export const LOG_EVENT = Object.freeze({
  clientLogReceived: 'client-log.received',
  tenantRegistered: 'tenant.registered',
  tenantActiveChanged: 'tenant.active-changed',
  tenantRemoved: 'tenant.removed',
} as const)
export type LogEvent = ValueOf<typeof LOG_EVENT>

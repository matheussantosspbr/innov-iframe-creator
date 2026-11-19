import type { ValueOf } from '@app/shared'

export const DIAGNOSTIC_STATUS = Object.freeze({
  operational: 'operational',
  degraded: 'degraded',
  outage: 'outage',
} as const)
export type DiagnosticStatus = ValueOf<typeof DIAGNOSTIC_STATUS>

export const DIAGNOSTIC_COMPONENT = Object.freeze({
  database: 'database',
  chatPlataformaApi: 'chatplataforma-api',
} as const)

export type DiagnosticComponent = Readonly<{
  name: string
  status: DiagnosticStatus
  detail?: string
}>

export type DiagnosticReport = Readonly<{
  externalId: string
  status: DiagnosticStatus
  components: readonly DiagnosticComponent[]
  checkedAt: string
}>

export const aggregate = (components: readonly DiagnosticComponent[]): DiagnosticStatus => {
  if (components.every((c) => c.status === DIAGNOSTIC_STATUS.operational)) {
    return DIAGNOSTIC_STATUS.operational
  }
  if (components.every((c) => c.status === DIAGNOSTIC_STATUS.outage)) {
    return DIAGNOSTIC_STATUS.outage
  }
  return DIAGNOSTIC_STATUS.degraded
}

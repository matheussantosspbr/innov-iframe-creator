import { describe, expect, it } from 'vitest'
import { aggregate, DIAGNOSTIC_STATUS } from '#src/core/utils/diagnostics.ts'

describe('Regra de negócio de diagnóstico', () => {
  it.each([
    [[DIAGNOSTIC_STATUS.operational, DIAGNOSTIC_STATUS.operational], DIAGNOSTIC_STATUS.operational],
    [[DIAGNOSTIC_STATUS.operational, DIAGNOSTIC_STATUS.outage], DIAGNOSTIC_STATUS.degraded],
    [[DIAGNOSTIC_STATUS.outage, DIAGNOSTIC_STATUS.outage], DIAGNOSTIC_STATUS.outage],
  ])('diagnostics.aggregate(%o) resume como %s', (statuses, expected) => {
    expect(aggregate(statuses.map((status, index) => ({ name: `c${index}`, status })))).toBe(
      expected,
    )
  })
})

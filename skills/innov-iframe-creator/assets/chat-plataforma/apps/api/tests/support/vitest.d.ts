import 'vitest'

interface ContractMatchers<R = unknown> {
  toBeSuccessEnvelope(status: 200 | 201): R
  toBeErrorEnvelope(status: number): R
}

declare module 'vitest' {
  interface Assertion<T = unknown> extends ContractMatchers<T> {}
  interface AsymmetricMatchersContaining extends ContractMatchers {}
}

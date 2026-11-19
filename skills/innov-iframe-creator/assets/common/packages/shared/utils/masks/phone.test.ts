import { describe, expect, it } from 'vitest'

import { maskPhone, unmaskPhone } from './phone.ts'

describe('maskPhone', () => {
  it('masks a mobile number', () => {
    expect(maskPhone('11987654321')).toBe('(11) 98765-4321')
  })

  it('masks a landline number', () => {
    expect(maskPhone('1134567890')).toBe('(11) 3456-7890')
  })

  it('masks progressively while typing', () => {
    expect(maskPhone('')).toBe('')
    expect(maskPhone('1')).toBe('(1')
    expect(maskPhone('11')).toBe('(11')
    expect(maskPhone('119')).toBe('(11) 9')
    expect(maskPhone('119876')).toBe('(11) 9876')
    expect(maskPhone('1198765')).toBe('(11) 9876-5')
  })

  it('is idempotent and caps at 11 digits', () => {
    expect(maskPhone('(11) 98765-4321')).toBe('(11) 98765-4321')
    expect(maskPhone('119876543219999')).toBe('(11) 98765-4321')
  })
})

describe('unmaskPhone', () => {
  it('strips every non-digit character', () => {
    expect(unmaskPhone('(11) 98765-4321')).toBe('11987654321')
    expect(unmaskPhone('')).toBe('')
  })
})

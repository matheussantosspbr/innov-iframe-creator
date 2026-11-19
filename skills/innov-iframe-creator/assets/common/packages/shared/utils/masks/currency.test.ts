import { describe, expect, it } from 'vitest'

import { maskCurrency, unmaskCurrency } from './currency.ts'

describe('maskCurrency', () => {
  it('masks BRL by default', () => {
    expect(maskCurrency('123456')).toBe('1.234,56')
    expect(maskCurrency('1')).toBe('0,01')
  })

  it('masks USD with its own separators', () => {
    expect(maskCurrency('123456', 'USD')).toBe('1,234.56')
  })

  it('returns an empty string for empty input', () => {
    expect(maskCurrency('')).toBe('')
  })

  it('ignores non-digit characters', () => {
    expect(maskCurrency('R$ 1.234,56')).toBe('1.234,56')
  })
})

describe('unmaskCurrency', () => {
  it('strips every non-digit character', () => {
    expect(unmaskCurrency('1.234,56')).toBe('123456')
    expect(unmaskCurrency('R$ 1.234,56')).toBe('123456')
    expect(unmaskCurrency('')).toBe('')
  })
})

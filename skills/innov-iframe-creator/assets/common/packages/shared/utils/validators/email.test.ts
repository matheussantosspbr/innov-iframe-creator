import { describe, expect, it } from 'vitest'

import { validateEmail } from './email.ts'

describe('validateEmail', () => {
  it('accepts valid emails', () => {
    expect(validateEmail('user@example.com')).toBe(true)
    expect(validateEmail('  user@example.com  ')).toBe(true)
    expect(validateEmail('first.last+tag@sub.example.com')).toBe(true)
  })

  it('rejects invalid emails', () => {
    expect(validateEmail('user@')).toBe(false)
    expect(validateEmail('user@example')).toBe(false)
    expect(validateEmail('user example@mail.com')).toBe(false)
    expect(validateEmail('user..name@example.com')).toBe(false)
    expect(validateEmail('')).toBe(false)
  })
})

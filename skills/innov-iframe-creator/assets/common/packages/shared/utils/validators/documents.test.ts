import { describe, expect, it } from 'vitest'

import { validateCei, validateCnpj, validateCpf } from './documents.ts'

describe('validateCpf', () => {
  it('accepts valid CPFs with and without mask', () => {
    expect(validateCpf('529.982.247-25')).toBe(true)
    expect(validateCpf('52998224725')).toBe(true)
    expect(validateCpf('111.444.777-35')).toBe(true)
  })

  it('rejects invalid CPFs', () => {
    expect(validateCpf('111.111.111-11')).toBe(false)
    expect(validateCpf('123.456.789-00')).toBe(false)
    expect(validateCpf('123')).toBe(false)
    expect(validateCpf('')).toBe(false)
  })

  it('rejects letters mixed with a valid CPF digit sequence', () => {
    expect(validateCpf('ABC52998224725')).toBe(false)
    expect(validateCpf('529.982.247-25x')).toBe(false)
  })
})

describe('validateCnpj', () => {
  it('accepts valid numeric CNPJs with and without mask', () => {
    expect(validateCnpj('11.222.333/0001-81')).toBe(true)
    expect(validateCnpj('11222333000181')).toBe(true)
    expect(validateCnpj('04.252.011/0001-10')).toBe(true)
  })

  it('accepts the alphanumeric CNPJ format', () => {
    expect(validateCnpj('12.ABC.345/01DE-35')).toBe(true)
  })

  it('rejects invalid CNPJs', () => {
    expect(validateCnpj('11.222.333/0001-00')).toBe(false)
    expect(validateCnpj('11.111.111/1111-11')).toBe(false)
    expect(validateCnpj('12.ABC.345/01DE-00')).toBe(false)
    expect(validateCnpj('123')).toBe(false)
  })
})

describe('validateCei', () => {
  it('accepts valid CEIs with and without mask', () => {
    expect(validateCei('123456789010')).toBe(true)
    expect(validateCei('12.345.67890/10')).toBe(true)
    expect(validateCei('112223334446')).toBe(true)
    expect(validateCei('000001122331')).toBe(true)
    expect(validateCei('987654321015')).toBe(true)
    expect(validateCei('501234567899')).toBe(true)
  })

  it('rejects wrong check digit, size, letters, repeated digits and zero prefix', () => {
    expect(validateCei('123456789011')).toBe(false)
    expect(validateCei('12345678901')).toBe(false)
    expect(validateCei('1234567890100')).toBe(false)
    expect(validateCei('12345678901A')).toBe(false)
    expect(validateCei('111111111111')).toBe(false)
    expect(validateCei('000000000000')).toBe(false)
    expect(validateCei('000000000012')).toBe(false)
  })
})

describe('validateCei (QA cross-checks)', () => {
  // Literal transliteration of the ANS "novaValidaCEI" Java code (getUnidade/getDezena on the sum).
  const ans = (cei: string) => {
    const peso = [7, 4, 1, 8, 5, 2, 1, 6, 3, 7, 4]
    const soma = peso.reduce((acc, p, i) => acc + p * Number(cei[i]), 0)
    const soma2 = (soma % 10) + (Math.floor(soma / 10) % 10)
    return (10 - (soma2 % 10)) % 10 === Number(cei[11])
  }

  it('matches the ANS reference over a deterministic sweep of 12-digit values', () => {
    for (let i = 1; i < 300000; i++) {
      const cei = String(i * 3331 + 1000000).padStart(12, '5')

      if (/^(\d)\1{11}$/.test(cei) || /^0{10}/.test(cei)) continue
      expect(validateCei(cei), cei).toBe(ans(cei))
    }
  }, 30_000)

  it('does not mistake a valid 14-digit numeric CNPJ for a CEI, nor a CEI for a CNPJ/CPF', () => {
    expect(validateCnpj('11222333000181')).toBe(true)
    expect(validateCei('11222333000181')).toBe(false)
    expect(validateCei('11.222.333/0001-81')).toBe(false)
    expect(validateCnpj('123456789010')).toBe(false)
    expect(validateCpf('123456789010')).toBe(false)
  })

  it('accepts a CEI whose first 11 digits are a valid CPF only as a CEI', () => {
    expect(validateCpf('52998224725')).toBe(true)
    expect(validateCei('529982247257')).toBe(true)
    expect(validateCei('52998224725')).toBe(false)
  })
})

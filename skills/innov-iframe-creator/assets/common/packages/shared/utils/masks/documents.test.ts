import { describe, expect, it } from 'vitest'

import {
  docMask,
  maskCei,
  maskCnpj,
  maskCpf,
  unmaskCei,
  unmaskCnpj,
  unmaskCpf,
} from './documents.ts'

describe('maskCpf / unmaskCpf', () => {
  it('masks a CPF', () => {
    expect(maskCpf('12345678909')).toBe('123.456.789-09')
    expect(maskCpf('123.456.789-09')).toBe('123.456.789-09')
  })

  it('caps the input at 11 digits', () => {
    expect(maskCpf('123456789012345')).toBe('123.456.789-01')
  })

  it('unmasks a CPF', () => {
    expect(unmaskCpf('123.456.789-09')).toBe('12345678909')
  })
})

describe('maskCnpj / unmaskCnpj', () => {
  it('masks a numeric CNPJ', () => {
    expect(maskCnpj('12345678000199')).toBe('12.345.678/0001-99')
    expect(maskCnpj('12.345.678/0001-99')).toBe('12.345.678/0001-99')
  })

  it('masks an alphanumeric CNPJ', () => {
    expect(maskCnpj('12ABC34501DE35')).toBe('12.ABC.345/01DE-35')
  })

  it('unmasks a CNPJ', () => {
    expect(unmaskCnpj('12.345.678/0001-99')).toBe('12345678000199')
    expect(unmaskCnpj('12.ABC.345/01DE-35')).toBe('12ABC34501DE35')
  })
})

describe('docMask', () => {
  it('masks as CPF while only digits and up to 11 characters', () => {
    expect(docMask('mask', '12345678909')).toBe('123.456.789-09')
    expect(docMask('unmask', '123.456.789-09')).toBe('12345678909')
  })

  it('masks as CNPJ when there are more than 11 characters', () => {
    expect(docMask('mask', '12345678000199')).toBe('12.345.678/0001-99')
  })

  it('masks as CNPJ when the value has letters', () => {
    expect(docMask('mask', '12ABC34501DE35')).toBe('12.ABC.345/01DE-35')
  })
})

describe('CEI mask', () => {
  it('masks and unmasks 12 digits as 00.000.00000/00', () => {
    expect(maskCei('123456789010')).toBe('12.345.67890/10')
    expect(unmaskCei('12.345.67890/10')).toBe('123456789010')
    expect(maskCei('12345')).toBe('12.345')
    expect(maskCei('12345678')).toBe('12.345.678')
  })

  it('docMask picks CEI for exactly 12 digits and CNPJ again at 13-14 characters', () => {
    expect(docMask('mask', '123456789010')).toBe('12.345.67890/10')
    expect(docMask('unmask', '12.345.67890/10')).toBe('123456789010')
    expect(docMask('mask', '1234567890101')).toBe('12.345.678/9010-1')
    expect(docMask('mask', '12345678901012')).toBe('12.345.678/9010-12')
    expect(docMask('mask', '12ABC34501DE')).toBe('12.ABC.345/01DE')
  })
})

describe('docMask typing and deleting across the 11/12/13/14 boundaries (QA)', () => {
  it('never loses or reorders characters when typing a numeric or alphanumeric CNPJ', () => {
    for (const full of ['11222333000181', '12ABC34501DE35', '12345678901012']) {
      let typed = ''

      for (const ch of full) {
        typed += ch
        const masked = docMask('mask', typed)

        expect(docMask('unmask', masked)).toBe(typed.toUpperCase())
        // Re-feeding the masked value (what the input does on the next keystroke) is stable.
        expect(docMask('mask', masked)).toBe(masked)
      }
    }
  })

  it('deleting from 14 characters back down keeps the remaining characters', () => {
    let value = docMask('mask', '11222333000181')

    for (let n = 13; n >= 0; n--) {
      value = docMask('mask', value.slice(0, -1))
      expect(docMask('unmask', value)).toBe('11222333000181'.slice(0, n))
    }
  })

  it('pasted formatted values keep their type', () => {
    expect(docMask('mask', '529.982.247-25')).toBe('529.982.247-25')
    expect(docMask('mask', '12.345.67890/10')).toBe('12.345.67890/10')
    expect(docMask('mask', '12.ABC.345/01DE-35')).toBe('12.ABC.345/01DE-35')
    expect(docMask('mask', '12.345.678/9010-12')).toBe('12.345.678/9010-12')
  })
})

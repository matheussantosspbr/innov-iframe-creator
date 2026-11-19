function calcDigit(values: number[], weights: number[]): number {
  const sum = values.reduce((acc, value, i) => acc + value * (weights[i] ?? 0), 0)
  const remainder = sum % 11

  return remainder < 2 ? 0 : 11 - remainder
}

function isValidCpf(value: string): boolean {
  // Only mask characters may be ignored; letters must not be stripped into a valid digit sequence.
  if (/[^\d.\-\s]/.test(value)) return false

  const clean = value.replace(/\D/g, '')

  if (clean.length !== 11 || /^(\d)\1{10}$/.test(clean)) return false

  const digits = clean.split('').map(Number)

  const dv1 = calcDigit(digits.slice(0, 9), [10, 9, 8, 7, 6, 5, 4, 3, 2])
  const dv2 = calcDigit(digits.slice(0, 10), [11, 10, 9, 8, 7, 6, 5, 4, 3, 2])

  return dv1 === digits[9] && dv2 === digits[10]
}

function isValidCnpj(value: string): boolean {
  const clean = value.toUpperCase().replace(/[^A-Z0-9]/g, '')

  if (clean.length !== 14 || /^(.)\1{13}$/.test(clean) || !/^\d{2}$/.test(clean.slice(12))) {
    return false
  }

  const values = clean.split('').map((char) => char.charCodeAt(0) - 48)

  const dv1 = calcDigit(values.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  const dv2 = calcDigit(values.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])

  return dv1 === values[12] && dv2 === values[13]
}

export function validateCpf(value: string): boolean {
  return isValidCpf(value)
}

export function validateCnpj(value: string): boolean {
  return isValidCnpj(value)
}

// CEI check digit (ANS "Algoritmos do Aplicativo de Carga"): weights over the first 11 digits; the units and
// tens digits of the sum are added, and the DV is the units digit of 10 minus the units digit of that result.
export function validateCei(value: string): boolean {
  if (/[^\d.\-/\s]/.test(value)) return false

  const clean = value.replace(/\D/g, '')

  if (clean.length !== 12 || /^(\d)\1{11}$/.test(clean) || /^0{10}/.test(clean)) return false

  const weights = [7, 4, 1, 8, 5, 2, 1, 6, 3, 7, 4]
  const sum = weights.reduce((acc, w, i) => acc + w * Number(clean[i]), 0)
  const x = ((sum % 10) + (Math.floor(sum / 10) % 10)) % 10

  return (10 - x) % 10 === Number(clean[11])
}

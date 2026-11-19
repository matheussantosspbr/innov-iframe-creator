function onlyDigits(value: string): string {
  return value.replace(/\D/g, '')
}

export function maskPhone(value: string): string {
  const digits = onlyDigits(value).slice(0, 11)

  if (digits === '') return ''
  if (digits.length <= 2) return `(${digits}`

  // 11 digits = mobile (9 digit number), up to 10 = landline (8 digit number)
  const split = digits.length > 10 ? 7 : 6
  const number = digits.slice(2)
  const first = number.slice(0, split - 2)
  const last = number.slice(split - 2)

  return `(${digits.slice(0, 2)}) ${first}${last ? `-${last}` : ''}`
}

export function unmaskPhone(value: string): string {
  return onlyDigits(value).slice(0, 11)
}

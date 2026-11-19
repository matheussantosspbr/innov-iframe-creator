type Currency = 'BRL' | 'USD' | 'EUR'

const SEPARATORS: Record<Currency, { thousands: string; decimal: string }> = {
  BRL: { thousands: '.', decimal: ',' },
  EUR: { thousands: '.', decimal: ',' },
  USD: { thousands: ',', decimal: '.' },
}

function onlyDigits(value: string): string {
  return value.replace(/\D/g, '')
}

export function maskCurrency(value: string, currency: Currency = 'BRL'): string {
  const digits = onlyDigits(value)

  if (digits === '') return ''

  const { thousands, decimal } = SEPARATORS[currency]
  const [integer = '0', decimals = '00'] = (Number(digits) / 100).toFixed(2).split('.')

  return `${integer.replace(/\B(?=(\d{3})+(?!\d))/g, thousands)}${decimal}${decimals}`
}

export function unmaskCurrency(value: string): string {
  return onlyDigits(value)
}

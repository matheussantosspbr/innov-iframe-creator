function cnpjMask(type: 'mask' | 'unmask', cnpj: string): string {
  const clean = cnpj
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 14)

  if (type === 'unmask') return clean

  return clean
    .replace(/^([A-Z0-9]{2})([A-Z0-9])/, '$1.$2')
    .replace(/^([A-Z0-9]{2})\.([A-Z0-9]{3})([A-Z0-9])/, '$1.$2.$3')
    .replace(/\.([A-Z0-9]{3})([A-Z0-9])/, '.$1/$2')
    .replace(/([A-Z0-9]{4})([A-Z0-9])/, '$1-$2')
}

function cpfMask(type: 'mask' | 'unmask', cpf: string): string {
  const clean = cpf.replace(/\D/g, '').slice(0, 11)

  if (type === 'unmask') return clean

  return clean
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2')
}

// CEI (INSS): 12 digits, 00.000.00000/00.
function ceiMask(type: 'mask' | 'unmask', cei: string): string {
  const clean = cei.replace(/\D/g, '').slice(0, 12)

  if (type === 'unmask') return clean

  return clean
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/^(\d{2}\.\d{3})\.(\d{5})(\d)/, '$1.$2/$3')
}

// Length-based pick: digits only, up to 11 = CPF, exactly 12 = CEI, otherwise CNPJ (letters or 13-14 chars).
// Typing a 14-character CNPJ passes through the 12-digit CEI state; no typed character is lost because
// every mask keeps the same characters in the same order. 13 characters render as a partial CNPJ (00.000.000/0000-0).
export function docMask(type: 'mask' | 'unmask', value: string): string {
  const clean = value.toUpperCase().replace(/[^A-Z0-9]/g, '')
  const digitsOnly = /^\d*$/.test(clean)

  if (digitsOnly && clean.length <= 11) return cpfMask(type, clean)
  if (digitsOnly && clean.length === 12) return ceiMask(type, clean)

  return cnpjMask(type, clean)
}

export function maskCnpj(value: string): string {
  return cnpjMask('mask', value)
}

export function unmaskCnpj(value: string): string {
  return cnpjMask('unmask', value)
}

export function maskCpf(value: string): string {
  return cpfMask('mask', value)
}

export function unmaskCpf(value: string): string {
  return cpfMask('unmask', value)
}

export function maskCei(value: string): string {
  return ceiMask('mask', value)
}

export function unmaskCei(value: string): string {
  return ceiMask('unmask', value)
}

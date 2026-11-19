const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function isValidEmail(value: string): boolean {
  const clean = value.trim()

  return EMAIL_REGEX.test(clean) && !clean.includes('..')
}

export function validateEmail(value: string): boolean {
  return isValidEmail(value)
}

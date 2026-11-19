import { jwtVerify } from 'jose'

export const verifyDiagnosticsToken = async (input: {
  secret: string
  authorization?: string
  externalId: string
}): Promise<boolean> => {
  const match = input.authorization?.match(/^Bearer (.+)$/)
  if (!match?.[1]) return false
  try {
    const { payload } = await jwtVerify(match[1], new TextEncoder().encode(input.secret), {
      algorithms: ['HS256'],
    })
    return payload.scope === 'diagnostics:read' && payload.externalId === input.externalId
  } catch {
    return false
  }
}

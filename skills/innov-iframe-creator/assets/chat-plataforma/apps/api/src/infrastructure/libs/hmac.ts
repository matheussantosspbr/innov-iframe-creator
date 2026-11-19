import { createHmac, timingSafeEqual } from 'node:crypto'

const FIVE_MINUTES = 5 * 60 * 1000

export const signPayload = (secret: string, timestamp: string, rawBody: string) =>
  createHmac('sha256', secret).update(`${timestamp}:${rawBody}`).digest('hex')

export const verifyHmac = (input: {
  secret: string
  timestamp?: string
  signature?: string
  rawBody: string
  now?: number
}): boolean => {
  const { secret, timestamp, signature, rawBody, now = Date.now() } = input
  if (!timestamp || !signature) return false
  const ts = Number(timestamp)
  if (!Number.isFinite(ts) || Math.abs(now - ts) > FIVE_MINUTES) return false

  const expected = Buffer.from(signPayload(secret, timestamp, rawBody), 'hex')
  const received = Buffer.from(signature, 'hex')
  return expected.length === received.length && timingSafeEqual(expected, received)
}

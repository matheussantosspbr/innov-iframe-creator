import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

export const encrypt = (plain: string, keyBase64: string): string => {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(keyBase64, 'base64'), iv)
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString('base64')).join('.')
}

export const decrypt = (payload: string, keyBase64: string): string => {
  const [iv, tag, data] = payload.split('.').map((p) => Buffer.from(p, 'base64'))
  if (!iv || !tag || !data) throw new Error('payload cifrado inválido')
  const decipher = createDecipheriv('aes-256-gcm', Buffer.from(keyBase64, 'base64'), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
}

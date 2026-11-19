import { CREDENTIAL_FIELDS } from '#src/core/utils/credentials.ts'
import { signPayload } from '#src/infrastructure/libs/hmac.ts'

const apiUrl =
  process.env.APPLICATION_DEV_API_URL ?? `http://localhost:${process.env.APPLICATION_PORT ?? 3333}`
const webUrl = process.env.APPLICATION_DEV_WEB_URL ?? 'http://localhost:8080'
const secret = process.env.CHATPLATAFORMA_CLIENT_SECRET
if (!secret) throw new Error('Defina CHATPLATAFORMA_CLIENT_SECRET (mesmo valor do .env)')
const apiKey = process.env.CHATPLATAFORMA_TEST_API_KEY
if (!apiKey) throw new Error('Defina CHATPLATAFORMA_TEST_API_KEY com uma key de uma conta de teste')

const arg = process.argv.slice(2).find((a) => a.startsWith('{'))
const credentials = arg
  ? JSON.parse(arg)
  : { [CREDENTIAL_FIELDS.chatPlataformaApiKey.value]: apiKey }
const raw = JSON.stringify(credentials)
const ts = String(Date.now())

const res = await fetch(`${apiUrl}/api/provision/install`, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'x-timestamp': ts,
    'x-signature': signPayload(secret, ts, raw),
  },
  body: raw,
})
const json = await res.json()
console.log(res.status, JSON.stringify(json))

const externalId = json?.body?.externalId
if (externalId) {
  const params = new URLSearchParams({
    accountId: externalId,
    agentId: process.env.APPLICATION_DEV_AGENT_ID ?? '1',
    ticketId: process.env.APPLICATION_DEV_TICKET_ID ?? '1',
    ticketConnectionId: process.env.APPLICATION_DEV_CONNECTION_ID ?? '1',
    ...(process.env.APPLICATION_DEV_CONTACT_ID
      ? { contactId: process.env.APPLICATION_DEV_CONTACT_ID }
      : {}),
  })
  console.log(`\nAbra (simula o iframe): ${webUrl}/?${params}`)
}

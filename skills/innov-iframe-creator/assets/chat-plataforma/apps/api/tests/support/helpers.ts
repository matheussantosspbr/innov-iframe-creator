import { Writable } from 'node:stream'
import { SignJWT } from 'jose'
import request from 'supertest'
import type {
  ChatPlataformaClient,
  ClientOptions,
} from '#src/core/repository/chat-plataforma-client.interface.ts'
import type { Credentials } from '#src/core/utils/credentials.ts'
import { signPayload } from '#src/infrastructure/libs/hmac.ts'
import { createMemoryRepository } from '#src/infrastructure/repository/installation.repository.ts'
import { buildApp } from '#src/server/bootstrap.ts'
import {
  FIXTURE_ADMIN_PERMISSIONS,
  FIXTURE_CREDENTIALS,
  FIXTURE_EXTERNAL_ID,
  FIXTURE_SHARED_SECRET,
  FIXTURE_TICKET_VIEW,
} from './fixtures.ts'

type SignOptions = { timestamp?: number; signature?: string; secret?: string }

export const generateHarnessSignature = (rawBody: string, options: SignOptions = {}) => {
  const timestamp = String(options.timestamp ?? Date.now())
  return {
    'x-timestamp': timestamp,
    'x-signature':
      options.signature ?? signPayload(options.secret ?? FIXTURE_SHARED_SECRET, timestamp, rawBody),
  }
}

export const generateDiagnosticsToken = (
  claims: Record<string, unknown>,
  { secret = FIXTURE_SHARED_SECRET, expiresIn = '5m' } = {},
) =>
  new SignJWT(claims)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(expiresIn)
    .sign(new TextEncoder().encode(secret))

export type LogEntry = Record<string, unknown> & { level: number; msg: string }

const captureLogs = () => {
  const entries: LogEntry[] = []
  const stream = new Writable({
    write(chunk, _encoding, done) {
      for (const line of String(chunk).split('\n').filter(Boolean)) entries.push(JSON.parse(line))
      done()
    },
  })
  return { entries, logger: { level: 'info', stream } }
}

export const makeApp = async (client: Partial<ChatPlataformaClient> = {}) => {
  const repo = createMemoryRepository()
  const logs = captureLogs()
  const chatPlataforma = {
    getMyPermissions: async () => FIXTURE_ADMIN_PERMISSIONS,
    getTicket: async (ticketId: string) => ({ ...FIXTURE_TICKET_VIEW, id: ticketId }),
    ...client,
  } as ChatPlataformaClient
  const clientCalls: Array<{ credentials: Credentials; options?: ClientOptions }> = []
  const app = await buildApp({
    repo,
    secret: FIXTURE_SHARED_SECRET,
    chatPlataformaUrl: 'http://chatplataforma.fixture',
    clientFor: (credentials, options) => {
      clientCalls.push({ credentials, options })
      return chatPlataforma
    },
    logger: logs.logger,
  })
  await app.ready()
  const http = request(app.server)

  return {
    app,
    repo,
    http,
    clientCalls,
    logs: logs.entries,
    logsFor: (requestId: string | undefined) =>
      logs.entries.filter((entry) => entry.requestId === requestId),
    install: (externalId = FIXTURE_EXTERNAL_ID, credentials: Credentials = FIXTURE_CREDENTIALS) =>
      repo.create({ externalId, credentials }),
    postSigned: (path: string, payload: unknown, options: SignOptions = {}) => {
      const rawBody = JSON.stringify(payload)
      return http
        .post(path)
        .set('content-type', 'application/json')
        .set(generateHarnessSignature(rawBody, options))
        .send(rawBody)
    },
    postSignedRaw: (path: string, rawBody: string, signedBody: string) =>
      http
        .post(path)
        .set('content-type', 'application/json')
        .set(generateHarnessSignature(signedBody))
        .send(rawBody),
    getDiagnostics: (externalId: string, authorization?: string) => {
      const req = http.get(`/api/instances/${externalId}/diagnostics`)
      return authorization ? req.set('authorization', authorization) : req
    },
    getFromIframe: (path: string, accountId?: string, headers: Record<string, string> = {}) => {
      const req = http.get(`/api/app${path}`).set(headers)
      return accountId ? req.set('x-account-id', accountId) : req
    },
    postFromIframe: (path: string, payload: unknown, accountId: string) =>
      http
        .post(`/api/app${path}`)
        .set('x-account-id', accountId)
        .send(payload as object),
  }
}

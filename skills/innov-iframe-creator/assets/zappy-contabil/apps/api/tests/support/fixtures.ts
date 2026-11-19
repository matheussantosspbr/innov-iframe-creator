import type { TicketView } from '@app/shared'
import type { Connection } from 'zdk'

export const FIXTURE_TENANT_ID = '42'
export const FIXTURE_TENANT_NAME = 'Escritório Fixture'
export const FIXTURE_USER_ID = '7'
export const FIXTURE_TENANT_HEADERS = {
  'x-tenant-id': FIXTURE_TENANT_ID,
  'x-user-id': FIXTURE_USER_ID,
}

export const FIXTURE_ZAPPY_CREDENTIALS = {
  baseUrl: 'https://api-fixture.zapcontabil.chat',
  token: 'z'.repeat(250),
}

export const FIXTURE_ZAPPY_CONNECTION = {
  id: 1,
  name: 'Comercial',
  status: 'CONNECTED',
  number: '5511999998888',
} as unknown as Connection

export const FIXTURE_ENCRYPTION_KEY = Buffer.alloc(32, 5).toString('base64')

export const FIXTURE_COMHUB_KEY = 'chave-de-operacao-fixture-0123456789'
export const FIXTURE_OPERATOR_HEADERS = { 'x-comhub-key': FIXTURE_COMHUB_KEY }

export const FIXTURE_NEW_TENANT = {
  name: 'Escritório Novo',
  zappyUrl: 'https://api-novo.zapcontabil.chat',
  zappyToken: 'n'.repeat(250),
}

export const FIXTURE_TICKET_ID = 9001

// Formato do ZDK: traz campos que o app descarta (lastMessage).
export const FIXTURE_ZAPPY_TICKET = {
  id: '9001',
  status: 'open',
  userId: '7',
  contactId: '55',
  whatsappId: '1',
  queueId: '3',
  unreadMessages: 2,
  lastMessage: 'texto privado do cliente',
  isGroup: false,
  createdAt: '2026-01-01T10:00:00.000Z',
  updatedAt: '2026-01-01T10:05:00.000Z',
}

export const FIXTURE_TICKET_VIEW: TicketView = {
  id: '9001',
  status: 'open',
  userId: '7',
  contactId: '55',
  whatsappId: '1',
  queueId: '3',
  unreadMessages: 2,
  isGroup: false,
  createdAt: '2026-01-01T10:00:00.000Z',
  updatedAt: '2026-01-01T10:05:00.000Z',
}

export const FIXTURE_CONNECTION_VIEW = { id: 1, name: 'Comercial', status: 'CONNECTED' }

export const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
export const FIXTURE_NGINX_REQUEST_ID = '9f2c4e1a7b3d5f6081a2b3c4d5e6f708'

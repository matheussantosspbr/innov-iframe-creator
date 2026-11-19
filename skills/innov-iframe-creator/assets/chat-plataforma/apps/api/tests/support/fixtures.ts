import type { TicketView } from '@app/shared'
import { CREDENTIAL_FIELDS, type Credentials, MASKED_SECRET } from '#src/core/utils/credentials.ts'

export const FIXTURE_SHARED_SECRET = 'fixture-shared-secret-123456'
export const FIXTURE_OTHER_SECRET = 'fixture-other-secret-654321'

export const FIXTURE_EXTERNAL_ID = '6f1c2a9e-1b2c-4d5e-8f90-123456789abc'
export const FIXTURE_UNKNOWN_EXTERNAL_ID = '00000000-0000-4000-8000-000000000000'

export const FIXTURE_CHAT_PLATAFORMA_TICKET_ID = '182736454928173645'
export const FIXTURE_CHAT_PLATAFORMA_AGENT_ID = '182736454928173647'

export const FIXTURE_CREDENTIALS: Credentials = { chatPlataformaApiKey: 'cp-fixture-api-key' }
export const FIXTURE_ROTATED_CREDENTIALS: Credentials = {
  chatPlataformaApiKey: 'cp-rotated-api-key',
}

export const API_KEY_LABEL = CREDENTIAL_FIELDS.chatPlataformaApiKey.label
export const API_KEY_VALUE = CREDENTIAL_FIELDS.chatPlataformaApiKey.value
export const FIXTURE_INSTALL_BODY = { [API_KEY_VALUE]: FIXTURE_CREDENTIALS.chatPlataformaApiKey }
export const FIXTURE_MASKED_SECRET = MASKED_SECRET

export const FIXTURE_ADMIN_PERMISSIONS = { isAdmin: true, permissions: [] }

export const FIXTURE_TICKET_VIEW: TicketView = {
  id: '182736454928173645',
  protocol: 4821,
  status: 2,
  priority: 2,
  frozen: false,
  archived: false,
  contact: { id: '182736454928173650', name: 'Maria Contábil', phoneNumber: '5511999998888' },
  agent: { id: '182736454928173647', name: 'Ana Atendente' },
  connection: { id: '182736454928173660', provider: 1 },
}

export const FIXTURE_PLATFORM_TICKET_RESPONSE = {
  message: 'Ticket retornado com sucesso',
  body: {
    ...FIXTURE_TICKET_VIEW,
    lastMessage: { id: '182736454928173699', body: 'olá' },
    agent: {
      ...FIXTURE_TICKET_VIEW.agent,
      email: 'ana@contabil.fixture',
      mobilePhone: '5511988887777',
      hashPassword: '$argon2id$fixture-hash',
    },
    connection: { ...FIXTURE_TICKET_VIEW.connection, session: 'Comercial', sectors: [] },
  },
}

export const MINUTE_MS = 60 * 1000
export const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
export const FIXTURE_NGINX_REQUEST_ID = '9f2c4e1a7b3d5f6081a2b3c4d5e6f708'

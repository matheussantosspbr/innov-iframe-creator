import { describe, expect, it } from 'vitest'
import type { ChatPlataformaClient } from '#src/core/repository/chat-plataforma-client.interface.ts'
import { LOG_EVENT } from '#src/core/utils/log-events.ts'
import type { RequestContext } from '#src/core/utils/request-context.ts'
import { createMemoryRepository } from '#src/infrastructure/repository/installation.repository.ts'
import { createGetTicketUseCase } from '#src/infrastructure/use-cases/get-ticket.use-case.ts'
import { createInstallUseCase } from '#src/infrastructure/use-cases/install.use-case.ts'
import {
  FIXTURE_ADMIN_PERMISSIONS,
  FIXTURE_CHAT_PLATAFORMA_TICKET_ID,
  FIXTURE_CREDENTIALS,
  FIXTURE_EXTERNAL_ID,
  FIXTURE_INSTALL_BODY,
  FIXTURE_NGINX_REQUEST_ID,
  FIXTURE_TICKET_VIEW,
} from '../../../support/fixtures.ts'

const recordingContext = () => {
  const entries: Array<Record<string, unknown>> = []
  const record = (fields: Record<string, unknown>) => {
    entries.push(fields)
  }
  const log = { info: record, warn: record, error: record } as unknown as RequestContext['log']
  return { entries, ctx: { requestId: FIXTURE_NGINX_REQUEST_ID, log } as RequestContext }
}

const fakeClient = (overrides: Partial<ChatPlataformaClient> = {}) =>
  ({
    getMyPermissions: async () => FIXTURE_ADMIN_PERMISSIONS,
    getTicket: async () => FIXTURE_TICKET_VIEW,
    ...overrides,
  }) as ChatPlataformaClient

describe('Camada de use-case: regra de negócio testada sem HTTP', () => {
  it('install grava a instalação e registra o evento com o externalId gerado', async () => {
    const installations = createMemoryRepository()
    const useCase = createInstallUseCase({ installations, clientFor: () => fakeClient() })
    const { ctx, entries } = recordingContext()

    const externalId = await useCase.execute(FIXTURE_INSTALL_BODY, ctx)

    expect((await installations.find(externalId))?.credentials).toEqual(FIXTURE_CREDENTIALS)
    expect(entries).toContainEqual(
      expect.objectContaining({ externalId, event: LOG_EVENT.installationInstalled }),
    )
  })

  it('get-ticket usa as credentials da instalação e repassa o requestId ao cliente', async () => {
    const installations = createMemoryRepository()
    const installation = await installations.create({
      externalId: FIXTURE_EXTERNAL_ID,
      credentials: FIXTURE_CREDENTIALS,
    })
    const calls: unknown[] = []
    const useCase = createGetTicketUseCase({
      clientFor: (credentials, options) => {
        calls.push({ credentials, options })
        return fakeClient()
      },
    })
    const { ctx } = recordingContext()

    const ticket = await useCase.execute(installation, FIXTURE_CHAT_PLATAFORMA_TICKET_ID, ctx)

    expect(ticket).toEqual(FIXTURE_TICKET_VIEW)
    expect(calls).toEqual([
      { credentials: FIXTURE_CREDENTIALS, options: { requestId: FIXTURE_NGINX_REQUEST_ID } },
    ])
  })
})

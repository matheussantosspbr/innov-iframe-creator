import { describe, expect, it } from 'vitest'
import type { ZappyClient, ZappyCredentials } from '#src/core/repository/zappy-client.interface.ts'
import { AppError } from '#src/core/utils/app-error.ts'
import { LOG_EVENT } from '#src/core/utils/log-events.ts'
import { ADMIN_MESSAGES } from '#src/core/utils/messages.ts'
import type { RequestContext, TenantContext } from '#src/core/utils/request-context.ts'
import { createMemoryTenantRepository } from '#src/infrastructure/repository/tenant.repository.ts'
import { createGetTicketUseCase } from '#src/infrastructure/use-cases/get-ticket.use-case.ts'
import { createListConnectionsUseCase } from '#src/infrastructure/use-cases/list-connections.use-case.ts'
import { createListTenantsUseCase } from '#src/infrastructure/use-cases/list-tenants.use-case.ts'
import { createRegisterTenantUseCase } from '#src/infrastructure/use-cases/register-tenant.use-case.ts'
import { createRemoveTenantUseCase } from '#src/infrastructure/use-cases/remove-tenant.use-case.ts'
import { createSetTenantActiveUseCase } from '#src/infrastructure/use-cases/set-tenant-active.use-case.ts'
import {
  FIXTURE_CONNECTION_VIEW,
  FIXTURE_ENCRYPTION_KEY,
  FIXTURE_NEW_TENANT,
  FIXTURE_NGINX_REQUEST_ID,
  FIXTURE_TICKET_ID,
  FIXTURE_TICKET_VIEW,
  FIXTURE_ZAPPY_CREDENTIALS,
} from '../../../support/fixtures.ts'
import { fakeZappyClient } from '../../../support/helpers.ts'

const recordingContext = () => {
  const entries: Array<Record<string, unknown>> = []
  const record = (fields: Record<string, unknown>) => {
    entries.push(fields)
  }
  const log = { info: record, warn: record, error: record } as unknown as RequestContext['log']
  return { entries, ctx: { requestId: FIXTURE_NGINX_REQUEST_ID, log } as RequestContext }
}

const recordingClientFor = (client: ZappyClient) => {
  const calls: ZappyCredentials[] = []
  return {
    calls,
    clientFor: (credentials: ZappyCredentials) => {
      calls.push(credentials)
      return client
    },
  }
}

const tenantContext: TenantContext = {
  tenantId: 't1',
  userId: 'u1',
  credentials: FIXTURE_ZAPPY_CREDENTIALS,
}

const failWith = (statusCode: number, message: string) => async () => {
  throw new AppError(statusCode, message)
}

describe('register-tenant', () => {
  it('prova a credencial, grava o tenant ativo e registra o evento sem o token', async () => {
    const tenants = createMemoryTenantRepository(FIXTURE_ENCRYPTION_KEY)
    const { clientFor, calls } = recordingClientFor(fakeZappyClient())
    const { ctx, entries } = recordingContext()

    const tenant = await createRegisterTenantUseCase({ tenants, clientFor }).execute(
      FIXTURE_NEW_TENANT,
      ctx,
    )

    expect(tenant).toMatchObject({
      name: FIXTURE_NEW_TENANT.name,
      zappyUrl: FIXTURE_NEW_TENANT.zappyUrl,
      active: true,
    })
    expect(calls).toEqual([
      { baseUrl: FIXTURE_NEW_TENANT.zappyUrl, token: FIXTURE_NEW_TENANT.zappyToken },
    ])
    expect((await tenants.findById(tenant.id))?.credentials.token).toBe(
      FIXTURE_NEW_TENANT.zappyToken,
    )
    expect(entries).toContainEqual(
      expect.objectContaining({ tenantId: tenant.id, event: LOG_EVENT.tenantRegistered }),
    )
    expect(JSON.stringify(entries)).not.toContain(FIXTURE_NEW_TENANT.zappyToken)
  })

  it('normaliza a URL (espaços, barra final, maiúsculas) antes de provar e gravar', async () => {
    const tenants = createMemoryTenantRepository(FIXTURE_ENCRYPTION_KEY)
    const { clientFor, calls } = recordingClientFor(fakeZappyClient())

    const tenant = await createRegisterTenantUseCase({ tenants, clientFor }).execute(
      {
        ...FIXTURE_NEW_TENANT,
        name: '  Escritório Novo  ',
        zappyUrl: ' HTTPS://api-novo.zapcontabil.chat/ ',
      },
      recordingContext().ctx,
    )

    expect(tenant.name).toBe(FIXTURE_NEW_TENANT.name)
    expect(tenant.zappyUrl).toBe(FIXTURE_NEW_TENANT.zappyUrl)
    expect(calls[0]?.baseUrl).toBe(FIXTURE_NEW_TENANT.zappyUrl)
  })

  it.each([
    ['credencial inválida (422)', 422],
    ['instância fora do ar (502)', 502],
  ])('%s: propaga o erro e não grava nada', async (_label, status) => {
    const tenants = createMemoryTenantRepository(FIXTURE_ENCRYPTION_KEY)
    const { clientFor } = recordingClientFor(
      fakeZappyClient({ verify: failWith(status, 'falhou') }),
    )

    await expect(
      createRegisterTenantUseCase({ tenants, clientFor }).execute(
        FIXTURE_NEW_TENANT,
        recordingContext().ctx,
      ),
    ).rejects.toMatchObject({ statusCode: status })
    expect(await tenants.list()).toEqual([])
  })

  it('URL já cadastrada (mesmo com outra grafia) responde 409', async () => {
    const tenants = createMemoryTenantRepository(FIXTURE_ENCRYPTION_KEY)
    const useCase = createRegisterTenantUseCase({
      tenants,
      clientFor: recordingClientFor(fakeZappyClient()).clientFor,
    })
    await useCase.execute(FIXTURE_NEW_TENANT, recordingContext().ctx)

    await expect(
      useCase.execute(
        { ...FIXTURE_NEW_TENANT, zappyUrl: `${FIXTURE_NEW_TENANT.zappyUrl}/` },
        recordingContext().ctx,
      ),
    ).rejects.toMatchObject({ statusCode: 409, message: ADMIN_MESSAGES.tenantUrlTaken })
  })
})

describe('list-tenants, set-tenant-active e remove-tenant', () => {
  const seeded = async () => {
    const tenants = createMemoryTenantRepository(FIXTURE_ENCRYPTION_KEY)
    const tenant = await tenants.create({ id: 't1', ...FIXTURE_NEW_TENANT })
    return { tenants, tenant }
  }

  it('list-tenants lista sem o token', async () => {
    const { tenants } = await seeded()

    const listed = await createListTenantsUseCase({ tenants }).execute()

    expect(listed).toHaveLength(1)
    expect(listed[0]?.name).toBe(FIXTURE_NEW_TENANT.name)
    expect(JSON.stringify(listed)).not.toContain(FIXTURE_NEW_TENANT.zappyToken)
  })

  it('set-tenant-active desativa e reativa, registrando o evento', async () => {
    const { tenants } = await seeded()
    const useCase = createSetTenantActiveUseCase({ tenants })
    const { ctx, entries } = recordingContext()

    await useCase.execute('t1', false, ctx)
    expect((await tenants.findById('t1'))?.active).toBe(false)
    await useCase.execute('t1', true, ctx)
    expect((await tenants.findById('t1'))?.active).toBe(true)

    expect(entries).toContainEqual(
      expect.objectContaining({ active: false, event: LOG_EVENT.tenantActiveChanged }),
    )
  })

  it('set-tenant-active e remove-tenant respondem 404 para tenant inexistente', async () => {
    const { tenants } = await seeded()

    await expect(
      createSetTenantActiveUseCase({ tenants }).execute('x', false, recordingContext().ctx),
    ).rejects.toMatchObject({ statusCode: 404, message: ADMIN_MESSAGES.tenantNotFound })
    await expect(
      createRemoveTenantUseCase({ tenants }).execute('x', recordingContext().ctx),
    ).rejects.toMatchObject({ statusCode: 404 })
  })

  it('remove-tenant apaga o tenant e registra o evento', async () => {
    const { tenants } = await seeded()
    const { ctx, entries } = recordingContext()

    await createRemoveTenantUseCase({ tenants }).execute('t1', ctx)

    expect(await tenants.findById('t1')).toBeNull()
    expect(entries).toContainEqual(
      expect.objectContaining({ tenantId: 't1', event: LOG_EVENT.tenantRemoved }),
    )
  })
})

describe('list-connections e get-ticket', () => {
  it('list-connections usa a credencial do tenant e devolve as conexões', async () => {
    const { clientFor, calls } = recordingClientFor(fakeZappyClient())

    const connections = await createListConnectionsUseCase({ clientFor }).execute(tenantContext)

    expect(connections).toEqual([FIXTURE_CONNECTION_VIEW])
    expect(calls).toEqual([FIXTURE_ZAPPY_CREDENTIALS])
  })

  it('get-ticket usa a credencial do tenant e devolve a projeção segura', async () => {
    const { clientFor, calls } = recordingClientFor(
      fakeZappyClient({ getTicket: async () => FIXTURE_TICKET_VIEW }),
    )

    const ticket = await createGetTicketUseCase({ clientFor }).execute(
      tenantContext,
      FIXTURE_TICKET_ID,
    )

    expect(ticket).toEqual(FIXTURE_TICKET_VIEW)
    expect(calls).toEqual([FIXTURE_ZAPPY_CREDENTIALS])
  })

  it('instância fora do ar: o erro 502 do cliente sobe sem mudança', async () => {
    const { clientFor } = recordingClientFor(
      fakeZappyClient({ listConnections: failWith(502, 'fora do ar') }),
    )

    await expect(
      createListConnectionsUseCase({ clientFor }).execute(tenantContext),
    ).rejects.toMatchObject({ statusCode: 502 })
  })
})

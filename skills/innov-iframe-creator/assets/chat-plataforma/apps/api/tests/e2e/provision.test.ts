import { describe, expect, it } from 'vitest'
import { ChatPlataformaError } from '#src/core/utils/chat-plataforma-error.ts'
import { toBackstageCredentialsSchema } from '#src/core/utils/credentials.ts'
import { ADMIN_MESSAGES, USER_MESSAGES } from '#src/core/utils/messages.ts'
import { REQUIRED_PERMISSIONS } from '#src/infrastructure/libs/chatplataforma/permissions.ts'
import { PROVISION_TIMEOUT_MS } from '#src/infrastructure/use-cases/assert-api-key-works.ts'
import {
  API_KEY_LABEL,
  FIXTURE_CREDENTIALS,
  FIXTURE_EXTERNAL_ID,
  FIXTURE_INSTALL_BODY,
  FIXTURE_MASKED_SECRET,
  FIXTURE_OTHER_SECRET,
  FIXTURE_ROTATED_CREDENTIALS,
  FIXTURE_UNKNOWN_EXTERNAL_ID,
  MINUTE_MS,
  UUID_V4,
} from '../support/fixtures.ts'
import { makeApp } from '../support/helpers.ts'

const INSTALL = '/api/provision/install'
const CONFIGURE = '/api/provision/configure'
const UNINSTALL = '/api/provision/uninstall'

const rejectedApiKey = (upstreamStatus: number | null) => ({
  getMyPermissions: async () => {
    throw new ChatPlataformaError(
      502,
      USER_MESSAGES.integrationNeedsReconfiguration,
      upstreamStatus,
    )
  },
})

describe('credentialsSchema no formato do Backstage', () => {
  it('gera { fields: [{ label, type, required, secret }] } a partir de CREDENTIAL_FIELDS', () => {
    expect(toBackstageCredentialsSchema()).toEqual({
      fields: [{ label: API_KEY_LABEL, type: 'string', required: true, secret: true }],
    })
  })
})

describe('Contrato de provisionamento: POST /api/provision/install', () => {
  it('responde 201 com { body: { externalId } } em UUID v4 para o corpo plano indexado pelo label', async () => {
    const { postSigned } = await makeApp()

    const res = await postSigned(INSTALL, FIXTURE_INSTALL_BODY)

    expect(res).toBeSuccessEnvelope(201)
    expect(res.body.body.externalId).toMatch(UUID_V4)
  })

  it('persiste as credentials com as chaves internas vinculadas ao externalId devolvido', async () => {
    const { postSigned, repo } = await makeApp()

    const res = await postSigned(INSTALL, FIXTURE_INSTALL_BODY)

    expect(await repo.find(res.body.body.externalId)).toMatchObject({
      id: expect.any(Number),
      credentials: FIXTURE_CREDENTIALS,
    })
  })

  it('ignora chaves que não são labels de CREDENTIAL_FIELDS', async () => {
    const { postSigned, repo } = await makeApp()

    const res = await postSigned(INSTALL, { ...FIXTURE_INSTALL_BODY, 'Campo antigo': 'x' })

    expect((await repo.find(res.body.body.externalId))?.credentials).toEqual(FIXTURE_CREDENTIALS)
  })

  it('gera um externalId diferente a cada instalação', async () => {
    const { postSigned } = await makeApp()

    const first = await postSigned(INSTALL, FIXTURE_INSTALL_BODY)
    const second = await postSigned(INSTALL, FIXTURE_INSTALL_BODY)

    expect(first.body.body.externalId).not.toBe(second.body.body.externalId)
  })

  it.each([
    ['o campo obrigatório está ausente', {}],
    ['o campo obrigatório veio vazio', { [API_KEY_LABEL]: '' }],
    ['o valor excede o tamanho máximo', { [API_KEY_LABEL]: 'k'.repeat(513) }],
    [
      'o corpo veio no formato { credentials } da documentação antiga',
      { credentials: FIXTURE_INSTALL_BODY },
    ],
  ])('responde 422 citando o label do campo quando %s', async (_rule, body) => {
    const { postSigned } = await makeApp()

    const res = await postSigned(INSTALL, body)

    expect(res).toBeErrorEnvelope(422)
    expect(res.body.error.message).toContain(API_KEY_LABEL)
  })

  it('valida a API key em GET /v1/me/permissions com timeout menor que os 10 s da plataforma', async () => {
    const { postSigned, clientCalls } = await makeApp()

    const res = await postSigned(INSTALL, FIXTURE_INSTALL_BODY)

    expect(clientCalls).toEqual([
      {
        credentials: FIXTURE_CREDENTIALS,
        options: { requestId: res.headers['x-request-id'], timeoutMs: PROVISION_TIMEOUT_MS },
      },
    ])
    expect(PROVISION_TIMEOUT_MS).toBeLessThan(10_000)
  })

  it('responde 422 com ADMIN_MESSAGES.invalidApiKey e não persiste quando o Chat Plataforma recusa a key', async () => {
    const { postSigned, logs } = await makeApp(rejectedApiKey(401))

    const res = await postSigned(INSTALL, FIXTURE_INSTALL_BODY)

    expect(res).toBeErrorEnvelope(422)
    expect(res.body.error.message).toBe(ADMIN_MESSAGES.invalidApiKey)
    expect(logs.some((entry) => entry.event)).toBe(false)
  })

  it('responde 422 com ADMIN_MESSAGES.apiKeyBlocked quando o Chat Plataforma responde 403', async () => {
    const { postSigned } = await makeApp(rejectedApiKey(403))

    const res = await postSigned(INSTALL, FIXTURE_INSTALL_BODY)

    expect(res.body.error.message).toBe(ADMIN_MESSAGES.apiKeyBlocked)
  })

  it('responde 502 com ADMIN_MESSAGES.chatPlataformaUnavailable quando o Chat Plataforma não responde', async () => {
    const { postSigned } = await makeApp(rejectedApiKey(null))

    const res = await postSigned(INSTALL, FIXTURE_INSTALL_BODY)

    expect(res).toBeErrorEnvelope(502)
    expect(res.body.error.message).toBe(ADMIN_MESSAGES.chatPlataformaUnavailable)
  })

  it('responde 422 listando as REQUIRED_PERMISSIONS ausentes quando a key não é de administrador', async () => {
    const { postSigned } = await makeApp({
      getMyPermissions: async () => ({ isAdmin: false, permissions: ['contacts:list'] }),
    })

    const res = await postSigned(INSTALL, FIXTURE_INSTALL_BODY)

    expect(res).toBeErrorEnvelope(422)
    for (const permission of REQUIRED_PERMISSIONS)
      expect(res.body.error.message).toContain(permission)
  })

  it('aceita key sem admin quando o perfil tem o curinga do módulo', async () => {
    const { postSigned } = await makeApp({
      getMyPermissions: async () => ({ isAdmin: false, permissions: ['tickets:*'] }),
    })

    expect(await postSigned(INSTALL, FIXTURE_INSTALL_BODY)).toBeSuccessEnvelope(201)
  })
})

describe('Autenticação HMAC das rotas de provisionamento', () => {
  it('responde 401 quando x-timestamp e x-signature estão ausentes', async () => {
    const { http } = await makeApp()

    const res = await http.post(INSTALL).send(FIXTURE_INSTALL_BODY)

    expect(res).toBeErrorEnvelope(401)
  })

  it('responde 401 com ADMIN_MESSAGES.untrustedCall quando a assinatura usa outro segredo', async () => {
    const { postSigned } = await makeApp()

    const res = await postSigned(INSTALL, FIXTURE_INSTALL_BODY, { secret: FIXTURE_OTHER_SECRET })

    expect(res).toBeErrorEnvelope(401)
    expect(res.body.error.message).toBe(ADMIN_MESSAGES.untrustedCall)
  })

  it('responde 401 quando a assinatura não é hexadecimal de HMAC-SHA256', async () => {
    const { postSigned } = await makeApp()

    const res = await postSigned(INSTALL, FIXTURE_INSTALL_BODY, {
      signature: 'assinatura-invalida',
    })

    expect(res).toBeErrorEnvelope(401)
  })

  it('responde 401 quando o corpo enviado difere byte a byte do corpo assinado', async () => {
    const { postSignedRaw } = await makeApp()
    const signedBody = JSON.stringify(FIXTURE_INSTALL_BODY)
    const reserializedBody = JSON.stringify(FIXTURE_INSTALL_BODY, null, 2)

    const res = await postSignedRaw(INSTALL, reserializedBody, signedBody)

    expect(res).toBeErrorEnvelope(401)
  })

  it('responde 401 e não 422 quando a assinatura é inválida e o payload também', async () => {
    const { postSigned } = await makeApp()

    const res = await postSigned(INSTALL, {}, { secret: FIXTURE_OTHER_SECRET })

    expect(res).toBeErrorEnvelope(401)
  })
})

describe('Janela de tolerância de 5 minutos do x-timestamp', () => {
  it('aceita assinatura com timestamp de 4 minutos atrás', async () => {
    const { postSigned } = await makeApp()

    const res = await postSigned(INSTALL, FIXTURE_INSTALL_BODY, {
      timestamp: Date.now() - 4 * MINUTE_MS,
    })

    expect(res).toBeSuccessEnvelope(201)
  })

  it.each([
    ['6 minutos no passado', -6],
    ['6 minutos no futuro', 6],
  ])('responde 401 para timestamp %s', async (_label, offsetMinutes) => {
    const { postSigned } = await makeApp()

    const res = await postSigned(INSTALL, FIXTURE_INSTALL_BODY, {
      timestamp: Date.now() + offsetMinutes * MINUTE_MS,
    })

    expect(res).toBeErrorEnvelope(401)
  })
})

describe('Contrato de provisionamento: POST /api/provision/configure (atualização parcial)', () => {
  it('responde 200 com { body: { externalId } } e grava o valor novo', async () => {
    const { postSigned, install, repo } = await makeApp()
    await install()

    const res = await postSigned(CONFIGURE, {
      externalId: FIXTURE_EXTERNAL_ID,
      credentials: { [API_KEY_LABEL]: FIXTURE_ROTATED_CREDENTIALS.chatPlataformaApiKey },
    })

    expect(res).toBeSuccessEnvelope(200)
    expect(res.body.body).toEqual({ externalId: FIXTURE_EXTERNAL_ID })
    expect((await repo.find(FIXTURE_EXTERNAL_ID))?.credentials).toEqual(FIXTURE_ROTATED_CREDENTIALS)
  })

  it.each([
    ['o campo não foi enviado', {}],
    ['o campo secreto veio com a máscara ••••••••', { [API_KEY_LABEL]: FIXTURE_MASKED_SECRET }],
  ])('mantém a credential salva quando %s', async (_rule, credentials) => {
    const { postSigned, install, repo } = await makeApp()
    await install()

    const res = await postSigned(CONFIGURE, { externalId: FIXTURE_EXTERNAL_ID, credentials })

    expect(res).toBeSuccessEnvelope(200)
    expect((await repo.find(FIXTURE_EXTERNAL_ID))?.credentials).toEqual(FIXTURE_CREDENTIALS)
  })

  it('responde 422 citando o label quando um campo obrigatório é apagado', async () => {
    const { postSigned, install, repo } = await makeApp()
    await install()

    const res = await postSigned(CONFIGURE, {
      externalId: FIXTURE_EXTERNAL_ID,
      credentials: { [API_KEY_LABEL]: '' },
    })

    expect(res).toBeErrorEnvelope(422)
    expect(res.body.error.message).toContain(API_KEY_LABEL)
    expect((await repo.find(FIXTURE_EXTERNAL_ID))?.credentials).toEqual(FIXTURE_CREDENTIALS)
  })

  it('responde 422 e mantém as credentials quando a key nova é recusada pelo Chat Plataforma', async () => {
    const { postSigned, install, repo } = await makeApp(rejectedApiKey(401))
    await install()

    const res = await postSigned(CONFIGURE, {
      externalId: FIXTURE_EXTERNAL_ID,
      credentials: { [API_KEY_LABEL]: FIXTURE_ROTATED_CREDENTIALS.chatPlataformaApiKey },
    })

    expect(res.body.error.message).toBe(ADMIN_MESSAGES.invalidApiKey)
    expect((await repo.find(FIXTURE_EXTERNAL_ID))?.credentials).toEqual(FIXTURE_CREDENTIALS)
  })

  it('responde 404 com ADMIN_MESSAGES.installationNotFound quando o externalId não existe', async () => {
    const { postSigned } = await makeApp()

    const res = await postSigned(CONFIGURE, {
      externalId: FIXTURE_UNKNOWN_EXTERNAL_ID,
      credentials: FIXTURE_INSTALL_BODY,
    })

    expect(res).toBeErrorEnvelope(404)
    expect(res.body.error.message).toBe(ADMIN_MESSAGES.installationNotFound)
  })

  it('responde 422 com ADMIN_MESSAGES.invalidRequest quando externalId está ausente', async () => {
    const { postSigned } = await makeApp()

    const res = await postSigned(CONFIGURE, { credentials: FIXTURE_INSTALL_BODY })

    expect(res).toBeErrorEnvelope(422)
    expect(res.body.error.message).toBe(ADMIN_MESSAGES.invalidRequest)
  })
})

describe('Contrato de provisionamento: POST /api/provision/uninstall (idempotente)', () => {
  it('responde 200 com { body: { success: true } } e remove a instalação', async () => {
    const { postSigned, install, repo } = await makeApp()
    await install()

    const res = await postSigned(UNINSTALL, { externalId: FIXTURE_EXTERNAL_ID })

    expect(res).toBeSuccessEnvelope(200)
    expect(res.body.body).toEqual({ success: true })
    expect(await repo.find(FIXTURE_EXTERNAL_ID)).toBeNull()
  })

  it('responde 200 quando a instalação já não existe, para a plataforma conseguir concluir a desinstalação', async () => {
    const { postSigned } = await makeApp()

    const res = await postSigned(UNINSTALL, { externalId: FIXTURE_UNKNOWN_EXTERNAL_ID })

    expect(res).toBeSuccessEnvelope(200)
  })

  it('aceita um install novo depois do uninstall e devolve outro externalId', async () => {
    const { postSigned } = await makeApp()
    const first = await postSigned(INSTALL, FIXTURE_INSTALL_BODY)
    await postSigned(UNINSTALL, { externalId: first.body.body.externalId })

    const second = await postSigned(INSTALL, FIXTURE_INSTALL_BODY)

    expect(second).toBeSuccessEnvelope(201)
    expect(second.body.body.externalId).not.toBe(first.body.body.externalId)
  })
})

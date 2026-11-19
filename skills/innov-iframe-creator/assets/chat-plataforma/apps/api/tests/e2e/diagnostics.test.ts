import { describe, expect, it } from 'vitest'
import { AppError } from '#src/core/utils/app-error.ts'
import { DIAGNOSTIC_COMPONENT, DIAGNOSTIC_STATUS } from '#src/core/utils/diagnostics.ts'
import { USER_MESSAGES } from '#src/core/utils/messages.ts'
import {
  FIXTURE_EXTERNAL_ID,
  FIXTURE_OTHER_SECRET,
  FIXTURE_UNKNOWN_EXTERNAL_ID,
} from '../support/fixtures.ts'
import { generateDiagnosticsToken, makeApp } from '../support/helpers.ts'

const validClaims = { scope: 'diagnostics:read', externalId: FIXTURE_EXTERNAL_ID }

describe('Contrato de diagnóstico: GET /api/instances/:externalId/diagnostics', () => {
  it('responde 200 com status operational, componentes e checkedAt em ISO 8601', async () => {
    const { install, getDiagnostics } = await makeApp()
    await install()
    const token = await generateDiagnosticsToken(validClaims)

    const res = await getDiagnostics(FIXTURE_EXTERNAL_ID, `Bearer ${token}`)

    expect(res).toBeSuccessEnvelope(200)
    expect(res.body.body).toMatchObject({
      externalId: FIXTURE_EXTERNAL_ID,
      status: DIAGNOSTIC_STATUS.operational,
      components: [
        { name: DIAGNOSTIC_COMPONENT.database, status: DIAGNOSTIC_STATUS.operational },
        { name: DIAGNOSTIC_COMPONENT.chatPlataformaApi, status: DIAGNOSTIC_STATUS.operational },
      ],
    })
    expect(new Date(res.body.body.checkedAt).toISOString()).toBe(res.body.body.checkedAt)
  })

  it('responde degraded com o detalhe técnico (cause) quando a API key do Chat Plataforma foi revogada', async () => {
    const { install, getDiagnostics } = await makeApp({
      getMyPermissions: async () => {
        throw new AppError(502, USER_MESSAGES.integrationNeedsReconfiguration, {
          cause: new Error('Chat Plataforma respondeu 401: API key inválida ou revogada'),
        })
      },
    })
    await install()
    const token = await generateDiagnosticsToken(validClaims)

    const res = await getDiagnostics(FIXTURE_EXTERNAL_ID, `Bearer ${token}`)

    expect(res.body.body.status).toBe(DIAGNOSTIC_STATUS.degraded)
    expect(res.body.body.components).toContainEqual({
      name: DIAGNOSTIC_COMPONENT.chatPlataformaApi,
      status: DIAGNOSTIC_STATUS.outage,
      detail: 'Chat Plataforma respondeu 401: API key inválida ou revogada',
    })
  })

  it('responde 404 quando o externalId não pertence a nenhuma instalação', async () => {
    const { getDiagnostics } = await makeApp()
    const token = await generateDiagnosticsToken({
      scope: 'diagnostics:read',
      externalId: FIXTURE_UNKNOWN_EXTERNAL_ID,
    })

    const res = await getDiagnostics(FIXTURE_UNKNOWN_EXTERNAL_ID, `Bearer ${token}`)

    expect(res).toBeErrorEnvelope(404)
  })
})

describe('Autenticação Bearer JWT (HS256) do diagnóstico', () => {
  it.each([
    ['o header Authorization está ausente', async () => undefined],
    ['o header não segue o formato Bearer <token>', async () => 'Basic abc'],
    [
      'o scope não é diagnostics:read',
      async () => `Bearer ${await generateDiagnosticsToken({ ...validClaims, scope: 'admin' })}`,
    ],
    [
      'o externalId da claim difere do externalId da URL',
      async () =>
        `Bearer ${await generateDiagnosticsToken({ ...validClaims, externalId: FIXTURE_UNKNOWN_EXTERNAL_ID })}`,
    ],
    [
      'o token foi assinado com outro segredo',
      async () =>
        `Bearer ${await generateDiagnosticsToken(validClaims, { secret: FIXTURE_OTHER_SECRET })}`,
    ],
    [
      'o token está expirado',
      async () => `Bearer ${await generateDiagnosticsToken(validClaims, { expiresIn: '-1m' })}`,
    ],
  ])('responde 401 quando %s', async (_rule, authorization) => {
    const { install, getDiagnostics } = await makeApp()
    await install()

    const res = await getDiagnostics(FIXTURE_EXTERNAL_ID, await authorization())

    expect(res).toBeErrorEnvelope(401)
  })
})

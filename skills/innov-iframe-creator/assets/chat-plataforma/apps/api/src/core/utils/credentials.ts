import type { ValueOf } from '@app/shared'
import { z } from 'zod'
import { AppError } from './app-error.ts'
import { ADMIN_MESSAGES } from './messages.ts'

export const CREDENTIAL_TYPE = Object.freeze({
  string: 'string',
  number: 'number',
  boolean: 'boolean',
} as const)
export type CredentialType = ValueOf<typeof CREDENTIAL_TYPE>

type CredentialField = Readonly<{
  label: string
  type: CredentialType
  required: boolean
  secret: boolean
}>

export const CREDENTIAL_FIELDS = Object.freeze({
  chatPlataformaApiKey: Object.freeze({
    label: 'API Key do Chat Plataforma',
    type: CREDENTIAL_TYPE.string,
    required: true,
    secret: true,
  }),
} as const satisfies Record<string, CredentialField>)

export type CredentialKey = keyof typeof CREDENTIAL_FIELDS

export const MASKED_SECRET = '••••••••'

export const CREDENTIALS_JSON_MAX_BYTES = 2900

export const credentialsSchema = z
  .object({
    chatPlataformaApiKey: z.string().trim().min(1).max(512),
  })
  .refine((c) => Buffer.byteLength(JSON.stringify(c)) <= CREDENTIALS_JSON_MAX_BYTES)

export type Credentials = Readonly<z.infer<typeof credentialsSchema>>

export const platformCredentialsSchema = z.record(z.string(), z.unknown())
export type PlatformCredentials = z.infer<typeof platformCredentialsSchema>

const CREDENTIAL_ENTRIES = Object.entries(CREDENTIAL_FIELDS) as ReadonlyArray<
  readonly [CredentialKey, CredentialField]
>

const isUnchanged = (value: unknown) => value === undefined || value === MASKED_SECRET
const isCleared = (value: unknown) => value === null || value === ''

export const applyPlatformCredentials = (
  current: Partial<Record<CredentialKey, unknown>>,
  received: PlatformCredentials,
): Partial<Record<CredentialKey, unknown>> => {
  const next: Partial<Record<CredentialKey, unknown>> = { ...current }
  for (const [key, field] of CREDENTIAL_ENTRIES) {
    const value = received[field.label]
    if (isUnchanged(value)) continue
    if (isCleared(value)) delete next[key]
    else next[key] = value
  }
  return next
}

export const describeInvalidCredentials = (
  candidate: Partial<Record<CredentialKey, unknown>>,
): string | null => {
  const result = credentialsSchema.safeParse(candidate)
  if (result.success) return null
  const invalidKeys = new Set(result.error.issues.map((issue) => issue.path[0]))
  const labels = CREDENTIAL_ENTRIES.filter(([key]) => invalidKeys.has(key)).map(
    ([, field]) => `"${field.label}"`,
  )
  return labels.length > 0
    ? `Revise o preenchimento de: ${labels.join(', ')}.`
    : ADMIN_MESSAGES.invalidCredentials
}

export const toValidCredentials = (candidate: Partial<Record<string, unknown>>): Credentials => {
  const problem = describeInvalidCredentials(candidate)
  if (problem) throw new AppError(422, problem)
  return credentialsSchema.parse(candidate)
}

export const toBackstageCredentialsSchema = () => ({
  fields: CREDENTIAL_ENTRIES.map(([, field]) => ({
    label: field.label,
    type: field.type,
    required: field.required,
    secret: field.secret,
  })),
})

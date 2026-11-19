import { validateCnpj } from '../validators/documents.ts'

export type CnpjData = Readonly<{
  cnpj: string
  razaoSocial: string
  nomeFantasia: string
  situacao: string
  dataAbertura: string
  capitalSocial: number | null
  atividadePrincipal: Readonly<{ codigo: string; descricao: string }>
  endereco: Readonly<{
    logradouro: string
    numero: string
    complemento: string
    bairro: string
    municipio: string
    uf: string
    cep: string
  }>
  telefone: string
  email: string
  provider: string
}>

export type CnpjProvider = Readonly<{
  name: string
  url: (cnpj: string) => string
  parse: (body: unknown) => Omit<CnpjData, 'cnpj' | 'provider'>
}>

export type CnpjLookupAttempt = Readonly<{ provider: string; error: string }>

export class CnpjLookupError extends Error {
  readonly attempts: readonly CnpjLookupAttempt[]

  constructor(message: string, attempts: readonly CnpjLookupAttempt[]) {
    super(message)
    this.name = 'CnpjLookupError'
    this.attempts = attempts
  }
}

type Json = Record<string, unknown>

const record = (value: unknown): Json =>
  typeof value === 'object' && value !== null ? (value as Json) : {}
const first = (value: unknown): Json => record(Array.isArray(value) ? value[0] : undefined)
const text = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : ''
const digits = (value: unknown): string => text(value).replace(/\D/g, '')
const money = (value: unknown): number | null => {
  const number = typeof value === 'string' && value.trim() === '' ? Number.NaN : Number(value)

  return Number.isFinite(number) ? number : null
}
// ReceitaWS devolve DD/MM/AAAA; os demais já devolvem AAAA-MM-DD.
const isoDate = (value: unknown): string => {
  const match = text(value).match(/^(\d{2})\/(\d{2})\/(\d{4})$/)

  return match ? `${match[3]}-${match[2]}-${match[1]}` : text(value)
}
const required = (name: string) => {
  throw new Error(`resposta sem razão social (${name})`)
}

const brasilApi: CnpjProvider = {
  name: 'brasilapi',
  url: (cnpj) => `https://brasilapi.com.br/api/cnpj/v1/${cnpj}`,
  parse: (body) => {
    const b = record(body)

    return {
      razaoSocial: text(b.razao_social) || required('brasilapi'),
      nomeFantasia: text(b.nome_fantasia),
      situacao: text(b.descricao_situacao_cadastral).toUpperCase(),
      dataAbertura: isoDate(b.data_inicio_atividade),
      capitalSocial: money(b.capital_social),
      atividadePrincipal: {
        codigo: digits(b.cnae_fiscal),
        descricao: text(b.cnae_fiscal_descricao),
      },
      endereco: {
        logradouro: text(b.logradouro),
        numero: text(b.numero),
        complemento: text(b.complemento),
        bairro: text(b.bairro),
        municipio: text(b.municipio),
        uf: text(b.uf),
        cep: digits(b.cep),
      },
      telefone: digits(b.ddd_telefone_1),
      email: text(b.email),
    }
  },
}

const cnpja: CnpjProvider = {
  name: 'cnpja',
  url: (cnpj) => `https://open.cnpja.com/office/${cnpj}`,
  parse: (body) => {
    const b = record(body)
    const company = record(b.company)
    const address = record(b.address)
    const activity = record(b.mainActivity)
    const phone = first(b.phones)

    return {
      razaoSocial: text(company.name) || required('cnpja'),
      nomeFantasia: text(b.alias),
      situacao: text(record(b.status).text).toUpperCase(),
      dataAbertura: isoDate(b.founded),
      capitalSocial: money(company.equity),
      atividadePrincipal: { codigo: digits(activity.id), descricao: text(activity.text) },
      endereco: {
        logradouro: text(address.street),
        numero: text(address.number),
        complemento: text(address.details),
        bairro: text(address.district),
        municipio: text(address.city),
        uf: text(address.state),
        cep: digits(address.zip),
      },
      telefone: `${digits(phone.area)}${digits(phone.number)}`,
      email: text(first(b.emails).address),
    }
  },
}

const receitaWs: CnpjProvider = {
  name: 'receitaws',
  url: (cnpj) => `https://receitaws.com.br/v1/cnpj/${cnpj}`,
  parse: (body) => {
    const b = record(body)
    // Limite de uso e CNPJ inexistente voltam com status "ERROR" no corpo.
    if (b.status === 'ERROR') throw new Error(text(b.message) || 'erro da ReceitaWS')
    const activity = first(b.atividade_principal)

    return {
      razaoSocial: text(b.nome) || required('receitaws'),
      nomeFantasia: text(b.fantasia),
      situacao: text(b.situacao).toUpperCase(),
      dataAbertura: isoDate(b.abertura),
      capitalSocial: money(b.capital_social),
      atividadePrincipal: { codigo: digits(activity.code), descricao: text(activity.text) },
      endereco: {
        logradouro: text(b.logradouro),
        numero: text(b.numero),
        complemento: text(b.complemento),
        bairro: text(b.bairro),
        municipio: text(b.municipio),
        uf: text(b.uf),
        cep: digits(b.cep),
      },
      telefone: digits(b.telefone),
      email: text(b.email),
    }
  },
}

// Ordem de tentativa: a primeira que responder vence.
export const CNPJ_PROVIDERS: readonly CnpjProvider[] = Object.freeze([brasilApi, cnpja, receitaWs])

export type CnpjLookupOptions = Readonly<{
  providers?: readonly CnpjProvider[]
  /** Timeout de cada API, em ms. */
  timeoutMs?: number
  fetch?: typeof fetch
}>

/**
 * Consulta o CNPJ nas APIs públicas, uma de cada vez: se uma falhar (rede, timeout, HTTP != 2xx,
 * limite de uso ou resposta inválida), tenta a próxima. Só lança `CnpjLookupError` quando todas
 * falham (com o motivo de cada uma em `attempts`) ou quando o CNPJ é inválido (sem chamar API).
 */
export async function lookupCnpj(
  value: string,
  options: CnpjLookupOptions = {},
): Promise<CnpjData> {
  const cnpj = value.toUpperCase().replace(/[^A-Z0-9]/g, '')

  if (!validateCnpj(cnpj)) throw new CnpjLookupError(`CNPJ inválido: ${value}`, [])

  const { providers = CNPJ_PROVIDERS, timeoutMs = 8000, fetch: request = fetch } = options
  const attempts: CnpjLookupAttempt[] = []

  for (const provider of providers) {
    try {
      const response = await request(provider.url(cnpj), {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(timeoutMs),
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      return { ...provider.parse(await response.json()), cnpj, provider: provider.name }
    } catch (error) {
      attempts.push({
        provider: provider.name,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  throw new CnpjLookupError('Nenhuma API de CNPJ respondeu', attempts)
}

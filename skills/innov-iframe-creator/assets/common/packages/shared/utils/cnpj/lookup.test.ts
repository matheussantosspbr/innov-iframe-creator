import { describe, expect, it } from 'vitest'

import { CNPJ_PROVIDERS, CnpjLookupError, lookupCnpj } from './lookup.ts'

const CNPJ = '00000000000191'

const BRASILAPI = {
  razao_social: 'BANCO DO BRASIL SA',
  nome_fantasia: 'DIRECAO GERAL',
  descricao_situacao_cadastral: 'ATIVA',
  data_inicio_atividade: '1966-08-01',
  capital_social: 120000000000,
  cnae_fiscal: 6422100,
  cnae_fiscal_descricao: 'Bancos múltiplos, com carteira comercial',
  logradouro: 'SAUN QUADRA 5 BLOCO B',
  numero: 'SN',
  complemento: 'ANDAR T I',
  bairro: 'ASA NORTE',
  municipio: 'BRASILIA',
  uf: 'DF',
  cep: '70040912',
  ddd_telefone_1: '6134939002',
  email: null,
}

const CNPJA = {
  alias: 'Direcao Geral',
  founded: '1966-08-01',
  company: { name: 'BANCO DO BRASIL SA', equity: 120000000000 },
  status: { text: 'Ativa' },
  address: {
    street: 'SAUN QUADRA 5 BLOCO B',
    number: 'SN',
    details: 'ANDAR T I',
    district: 'Asa Norte',
    city: 'Brasília',
    state: 'DF',
    zip: '70040912',
  },
  mainActivity: { id: 6422100, text: 'Bancos múltiplos, com carteira comercial' },
  phones: [{ area: '61', number: '34939002' }],
  emails: [{ address: 'secex@bb.com.br' }],
}

const RECEITAWS = {
  nome: 'BANCO DO BRASIL SA',
  fantasia: 'DIRECAO GERAL',
  situacao: 'ATIVA',
  abertura: '01/08/1966',
  capital_social: '120000000000.00',
  atividade_principal: [{ code: '64.22-1-00', text: 'Bancos múltiplos, com carteira comercial' }],
  logradouro: 'Q SAUN QUADRA 5 BLOCO B',
  numero: 'SN',
  complemento: 'ANDAR T I',
  bairro: 'ASA NORTE',
  municipio: 'BRASILIA',
  uf: 'DF',
  cep: '70.040-912',
  telefone: '(61) 3493-9002',
  email: 'secex@bb.com.br',
  status: 'OK',
}

type Reply = number | Error | unknown

// Responde em ordem: cada item é um corpo (200), um status HTTP (number) ou um erro de rede.
const fakeFetch = (replies: Reply[]) => {
  const urls: string[] = []
  const request = (async (url: string) => {
    urls.push(url)
    const reply = replies.shift()

    if (reply instanceof Error) throw reply
    if (typeof reply === 'number') return new Response('{}', { status: reply })

    return new Response(JSON.stringify(reply), { status: 200 })
  }) as unknown as typeof fetch

  return { request, urls }
}

describe('lookupCnpj', () => {
  it('usa a primeira API quando ela responde e não chama as outras', async () => {
    const { request, urls } = fakeFetch([BRASILAPI])

    const data = await lookupCnpj(CNPJ, { fetch: request })

    expect(urls).toEqual([`https://brasilapi.com.br/api/cnpj/v1/${CNPJ}`])
    expect(data).toEqual({
      cnpj: CNPJ,
      razaoSocial: 'BANCO DO BRASIL SA',
      nomeFantasia: 'DIRECAO GERAL',
      situacao: 'ATIVA',
      dataAbertura: '1966-08-01',
      capitalSocial: 120000000000,
      atividadePrincipal: {
        codigo: '6422100',
        descricao: 'Bancos múltiplos, com carteira comercial',
      },
      endereco: {
        logradouro: 'SAUN QUADRA 5 BLOCO B',
        numero: 'SN',
        complemento: 'ANDAR T I',
        bairro: 'ASA NORTE',
        municipio: 'BRASILIA',
        uf: 'DF',
        cep: '70040912',
      },
      telefone: '6134939002',
      email: '',
      provider: 'brasilapi',
    })
  })

  it('aceita o CNPJ com máscara', async () => {
    const { request, urls } = fakeFetch([BRASILAPI])

    await lookupCnpj('00.000.000/0001-91', { fetch: request })

    expect(urls[0]).toContain(CNPJ)
  })

  it('cai para a segunda API quando a primeira dá erro HTTP', async () => {
    const { request, urls } = fakeFetch([500, CNPJA])

    const data = await lookupCnpj(CNPJ, { fetch: request })

    expect(urls).toHaveLength(2)
    expect(data.provider).toBe('cnpja')
    expect(data).toMatchObject({
      razaoSocial: 'BANCO DO BRASIL SA',
      situacao: 'ATIVA',
      dataAbertura: '1966-08-01',
      capitalSocial: 120000000000,
      atividadePrincipal: { codigo: '6422100' },
      endereco: { municipio: 'Brasília', cep: '70040912' },
      telefone: '6134939002',
      email: 'secex@bb.com.br',
    })
  })

  it('cai para a próxima em erro de rede e em resposta sem razão social', async () => {
    const { request } = fakeFetch([new TypeError('fetch failed'), { company: {} }, RECEITAWS])

    const data = await lookupCnpj(CNPJ, { fetch: request })

    expect(data.provider).toBe('receitaws')
    expect(data).toMatchObject({
      dataAbertura: '1966-08-01',
      capitalSocial: 120000000000,
      atividadePrincipal: { codigo: '6422100' },
      endereco: { cep: '70040912' },
      telefone: '6134939002',
    })
  })

  it('trata status ERROR da ReceitaWS (limite de uso) como falha', async () => {
    const { request } = fakeFetch([500, 500, { status: 'ERROR', message: 'Too many requests' }])

    const error = await lookupCnpj(CNPJ, { fetch: request }).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(CnpjLookupError)
    expect((error as CnpjLookupError).attempts[2]).toEqual({
      provider: 'receitaws',
      error: 'Too many requests',
    })
  })

  it('lança CnpjLookupError com o motivo de cada API quando todas falham', async () => {
    const { request } = fakeFetch([429, new Error('timeout'), 503])

    const error = await lookupCnpj(CNPJ, { fetch: request }).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(CnpjLookupError)
    expect((error as CnpjLookupError).attempts).toEqual([
      { provider: 'brasilapi', error: 'HTTP 429' },
      { provider: 'cnpja', error: 'timeout' },
      { provider: 'receitaws', error: 'HTTP 503' },
    ])
  })

  it('rejeita CNPJ inválido sem chamar nenhuma API', async () => {
    const { request, urls } = fakeFetch([BRASILAPI])

    await expect(lookupCnpj('11.222.333/0001-00', { fetch: request })).rejects.toBeInstanceOf(
      CnpjLookupError,
    )
    expect(urls).toEqual([])
  })

  it('permite trocar a ordem e a lista de APIs', async () => {
    const { request, urls } = fakeFetch([RECEITAWS])
    const providers = CNPJ_PROVIDERS.filter((p) => p.name === 'receitaws')

    const data = await lookupCnpj(CNPJ, { fetch: request, providers })

    expect(urls[0]).toContain('receitaws')
    expect(data.provider).toBe('receitaws')
  })
})

import { describe, expect, it } from 'vitest'
import { loadEnv } from '#src/config/env.ts'
import { mariaDbConfigFrom } from '#src/infrastructure/libs/database.ts'

const DBAAS_URL = 'mysql://app_user:s%40nh%3Aforte@10.0.0.12:3306/chat_app'
const baseEnv = {
  DATABASE_URL: DBAAS_URL,
  CHATPLATAFORMA_CLIENT_SECRET: 'fixture-shared-secret-123456',
  APPLICATION_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString('base64'),
}

describe('Conexão com MySQL de DBaaS pelo adapter mariadb', () => {
  it('decodifica usuário, senha com caracteres especiais, host, porta e database do DATABASE_URL', () => {
    expect(mariaDbConfigFrom(DBAAS_URL, { poolSize: 5, tls: false })).toMatchObject({
      host: '10.0.0.12',
      port: 3306,
      user: 'app_user',
      password: 's@nh:forte',
      database: 'chat_app',
      connectionLimit: 5,
    })
  })

  it('usa a porta 3306 quando o DATABASE_URL não informa porta', () => {
    expect(mariaDbConfigFrom('mysql://u:p@db.interno/app', { poolSize: 5, tls: false }).port).toBe(
      3306,
    )
  })

  it('libera a recuperação da chave pública sem TLS, exigida pelo caching_sha2_password do MySQL 8', () => {
    const config = mariaDbConfigFrom(DBAAS_URL, { poolSize: 5, tls: false })

    expect(config.allowPublicKeyRetrieval).toBe(true)
    expect(config).not.toHaveProperty('ssl')
  })

  it('cifra a conexão e dispensa a recuperação da chave pública com DATABASE_TLS=true', () => {
    const config = mariaDbConfigFrom(DBAAS_URL, { poolSize: 5, tls: true })

    expect(config.ssl).toEqual({ rejectUnauthorized: false })
    expect(config.allowPublicKeyRetrieval).toBe(false)
  })

  it('aplica pool de 5 conexões e TLS desligado por padrão', () => {
    expect(loadEnv(baseEnv)).toMatchObject({ DATABASE_POOL_SIZE: 5, DATABASE_TLS: false })
  })

  it('lê DATABASE_TLS e DATABASE_POOL_SIZE das variáveis de ambiente', () => {
    expect(loadEnv({ ...baseEnv, DATABASE_TLS: 'true', DATABASE_POOL_SIZE: '10' })).toMatchObject({
      DATABASE_POOL_SIZE: 10,
      DATABASE_TLS: true,
    })
  })

  it('aceita Redis só como URL redis:// ou rediss:// e rejeita host:porta solto', () => {
    const urls = {
      REDIS_QUEUE_URL: 'redis://localhost:6379',
      REDIS_CACHE_URL: 'rediss://u:p@h:6380',
    }

    expect(loadEnv({ ...baseEnv, ...urls })).toMatchObject(urls)
    expect(loadEnv(baseEnv).REDIS_QUEUE_URL).toBeUndefined()
    expect(() => loadEnv({ ...baseEnv, REDIS_QUEUE_URL: 'localhost:6379' })).toThrow()
    expect(() => loadEnv({ ...baseEnv, REDIS_CACHE_URL: 'http://localhost' })).toThrow()
  })
})

export type DatabaseOptions = Readonly<{ poolSize: number; tls: boolean }>

export type MariaDbConfig = Readonly<{
  host: string
  port: number
  user: string
  password: string
  database: string
  connectionLimit: number
  connectTimeout: number
  allowPublicKeyRetrieval: boolean
  ssl?: Readonly<{ rejectUnauthorized: boolean }>
}>

const DEFAULT_MYSQL_PORT = 3306

export const mariaDbConfigFrom = (databaseUrl: string, options: DatabaseOptions): MariaDbConfig => {
  const url = new URL(databaseUrl)
  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : DEFAULT_MYSQL_PORT,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.slice(1)),
    connectionLimit: options.poolSize,
    connectTimeout: 5_000,
    allowPublicKeyRetrieval: !options.tls,
    ...(options.tls ? { ssl: { rejectUnauthorized: false } } : {}),
  }
}

#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

const [, , spec, projectDir = '.'] = process.argv
if (!spec) {
  console.error('uso: node check-dependency.mjs <pacote[@versão]> [diretório-do-pacote-que-vai-receber]')
  process.exit(1)
}

const DAY_MS = 86_400_000
const STALE_DAYS = 365
const FRESH_DAYS = 14
const LOW_DOWNLOADS = 10_000
const PERMISSIVE_LICENSES = Object.freeze(['MIT', 'ISC', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', '0BSD', 'BlueOak-1.0.0'])

const findings = []
const flag = (level, text) => findings.push({ level, text })

const npmView = (target) =>
  JSON.parse(execFileSync('npm', ['view', target, '--json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }))

const fetchJson = async (url, init) => {
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(8000) })
    return res.ok ? await res.json() : null
  } catch {
    return null
  }
}

const readProjectPackages = (dir) => {
  const manifests = []
  let current = resolve(dir)
  while (true) {
    const file = join(current, 'package.json')
    if (existsSync(file)) manifests.push(JSON.parse(readFileSync(file, 'utf8')))
    const parent = dirname(current)
    if (parent === current) break
    current = parent
  }
  return manifests
}

const meta = (() => {
  try {
    const result = npmView(spec)
    return Array.isArray(result) ? result.at(-1) : result
  } catch {
    console.error(`pacote não encontrado no registry: ${spec}`)
    process.exit(1)
  }
})()

const name = meta.name
const version = meta.version
const publishedAt = meta.time?.[version] ? new Date(meta.time[version]) : null
const releaseDates = Object.entries(meta.time ?? {})
  .filter(([key]) => key !== 'created' && key !== 'modified')
  .map(([, date]) => new Date(date).getTime())
const lastRelease = releaseDates.length ? new Date(Math.max(...releaseDates)) : publishedAt
const daysSincePublish = lastRelease ? Math.round((Date.now() - lastRelease.getTime()) / DAY_MS) : null
const latest = meta['dist-tags']?.latest
if (latest && latest !== version) flag('INFO', `versão pedida ${version}; a mais recente é ${latest}`)

if (meta.deprecated) flag('BLOQUEIA', `versão deprecada: ${meta.deprecated}`)
const isStable = (v) => /^\d+\.\d+\.\d+$/.test(v)
const versionAgeDays = publishedAt ? Math.floor((Date.now() - publishedAt.getTime()) / DAY_MS) : null
if (versionAgeDays !== null && versionAgeDays < FRESH_DAYS) {
  const matured = Object.entries(meta.time ?? {})
    .filter(([v, date]) => isStable(v) && Date.now() - new Date(date).getTime() >= FRESH_DAYS * DAY_MS)
    .sort(([, a], [, b]) => new Date(b).getTime() - new Date(a).getTime())[0]?.[0]
  flag(
    'ATENÇÃO',
    `versão publicada há ${versionAgeDays} dias (política: ≥ ${FRESH_DAYS})${matured ? ` — considere ${name}@${matured}` : ''}`,
  )
}
if (!isStable(version)) flag('ATENÇÃO', `versão de pré-lançamento (${version}) — use uma estável`)
if (daysSincePublish !== null && daysSincePublish > STALE_DAYS) {
  flag('ATENÇÃO', `sem publicação há ${daysSincePublish} dias — confira se o projeto ainda é mantido`)
}
if (!PERMISSIVE_LICENSES.includes(meta.license)) {
  flag('ATENÇÃO', `licença "${meta.license ?? 'ausente'}" fora da lista permissiva — avalie antes de usar`)
}
const installScripts = ['preinstall', 'install', 'postinstall'].filter((s) => meta.scripts?.[s])
if (installScripts.length) {
  flag('ATENÇÃO', `executa scripts na instalação (${installScripts.join(', ')}) — o pnpm bloqueia por padrão: libere em allowBuilds (pacote: true) só se for indispensável, senão registre pacote: false`)
}
const dependencyCount = Object.keys(meta.dependencies ?? {}).length
if (dependencyCount > 15) flag('ATENÇÃO', `${dependencyCount} dependências diretas — avalie o peso na árvore`)
if (!meta.types && !meta.typings) {
  flag('INFO', 'sem tipos embutidos — verifique se existe @types correspondente')
}

const downloads = await fetchJson(`https://api.npmjs.org/downloads/point/last-week/${name}`)
if (downloads === null) {
  flag('INFO', 'não foi possível consultar os downloads — confira em https://www.npmjs.com/package/' + name)
} else if (downloads.downloads < LOW_DOWNLOADS) {
  flag('ATENÇÃO', `pouca adoção: ${downloads.downloads} downloads na última semana`)
}

const reportVulnerability = (id, severity, summary) => {
  const blocking = ['HIGH', 'CRITICAL'].includes(String(severity).toUpperCase())
  flag(blocking ? 'BLOQUEIA' : 'ATENÇÃO', `vulnerabilidade ${id} (${severity}): ${summary ?? ''}`)
}

const advisories = await fetchJson('https://registry.npmjs.org/-/npm/v1/security/advisories/bulk', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ [name]: [version] }),
})
const osv = await fetchJson('https://api.osv.dev/v1/query', {
  method: 'POST',
  body: JSON.stringify({ package: { name, ecosystem: 'npm' }, version }),
})
if (advisories === null && osv === null) {
  flag('ATENÇÃO', 'não foi possível consultar vulnerabilidades — rode `pnpm audit` após instalar e confira https://osv.dev')
}
const seen = new Set()
for (const advisory of advisories?.[name] ?? []) {
  seen.add(advisory.url)
  reportVulnerability(advisory.url?.split("/").pop() ?? advisory.id, advisory.severity, advisory.title)
}
for (const vuln of osv?.vulns ?? []) {
  if ((vuln.aliases ?? []).some((alias) => [...seen].some((url) => url?.includes(alias)))) continue
  reportVulnerability(vuln.id, vuln.database_specific?.severity ?? 'desconhecida', vuln.summary)
}

const projectManifests = readProjectPackages(projectDir)
const installed = Object.assign(
  {},
  ...projectManifests.flatMap((m) => [m.devDependencies ?? {}, m.dependencies ?? {}]),
)
for (const [peer, range] of Object.entries(meta.peerDependencies ?? {})) {
  const current = installed[peer]
  const optional = meta.peerDependenciesMeta?.[peer]?.optional === true
  const level = current || optional ? 'INFO' : 'ATENÇÃO'
  flag(level, `peer${optional ? ' opcional' : ''} ${peer}@${range} — no projeto: ${current ?? 'não instalado'}`)
}
const engine = projectManifests.find((m) => m.engines?.node)?.engines.node
if (meta.engines?.node) flag('INFO', `engines.node do pacote: ${meta.engines.node} (projeto: ${engine ?? 'n/d'})`)
if (installed[name]) flag('INFO', `já existe no projeto: ${name}@${installed[name]}`)

console.log(`${name}@${version}`)
console.log(`  licença: ${meta.license ?? 'n/d'} · esta versão: ${publishedAt?.toISOString().slice(0, 10) ?? 'n/d'} · último release do pacote há ${daysSincePublish ?? '?'} dias`)
console.log(`  downloads/semana: ${downloads?.downloads ?? 'n/d'} · deps diretas: ${dependencyCount} · tipos: ${meta.types || meta.typings ? 'sim' : 'não'}`)
console.log(`  repositório: ${meta.repository?.url ?? meta.homepage ?? 'n/d'}`)
for (const { level, text } of findings) console.log(`  [${level}] ${text}`)
const blocked = findings.some((f) => f.level === 'BLOQUEIA')
console.log(blocked ? '\nRESULTADO: não instalar sem resolver os bloqueios.' : '\nRESULTADO: sem bloqueios automáticos — conclua a análise manual (references/chat-plataforma/dependencies.md).')
process.exit(blocked ? 2 : 0)

#!/usr/bin/env bash
# Copia o template do app (monorepo pnpm) para <destino>, aplica o nome do projeto e gera o .env de desenvolvimento.
# Uso: [PLATFORM=chat-plataforma|zappy-contabil] [SERVICES=mysql,redis-queue,redis-cache] bash scaffold.sh <destino> <nome-kebab> ["Nome de exibição"]
#   PLATFORM: template usado, de assets/<PLATFORM> (padrão: chat-plataforma)
#   nome-kebab: pacote raiz, dataset do Axiom e placeholder `iframe-name` (containers, Dockerfile e CI) (ex.: pipedrive, pedidos-erp)
#   No Chat Plataforma o placeholder e o dataset levam o sufixo -cp (onvio-cp-api, onvio-cp); na Zappy ficam só com o nome (onvio-api, onvio)
#   Nome de exibição: README, título da aba e do Swagger (padrão: derivado do nome-kebab, ex.: "Pedidos Erp")
#   SERVICES: serviços locais do docker-compose.dev.yml, separados por vírgula: mysql,redis-queue,redis-cache (padrão: os três; vazio = sem compose de dev)
set -euo pipefail
DEST="${1:?destino obrigatório}"
NAME="${2:?nome do app obrigatório (kebab-case)}"
DISPLAY_NAME="${3:-}"
SKILL_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PLATFORM="${PLATFORM:-chat-plataforma}"
TEMPLATE="$SKILL_DIR/assets/$PLATFORM"
if ! [ -f "$TEMPLATE/package.json" ]; then
  echo "Template '$PLATFORM' não existe ou está vazio em $TEMPLATE" >&2
  exit 1
fi

if ! [[ "$NAME" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ ]]; then
  echo "Nome '$NAME' inválido: use kebab-case (ex.: pedidos-erp)" >&2
  exit 1
fi
if [ -e "$DEST" ] && [ -n "$(ls -A "$DEST" 2>/dev/null)" ]; then
  echo "Destino $DEST já existe e não está vazio" >&2
  exit 1
fi

random_base64() { openssl rand -base64 32 2>/dev/null || node -e 'console.log(require("crypto").randomBytes(32).toString("base64"))'; }
random_hex() { openssl rand -hex 32 2>/dev/null || node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))'; }

mkdir -p "$DEST"
cp -R "$SKILL_DIR/assets/common/." "$DEST/" # packages/shared igual nas duas plataformas
cp -R "$TEMPLATE/." "$DEST/"
node - "$DEST" "$NAME" "$DISPLAY_NAME" "$PLATFORM" <<'NODE'
const { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } = require('node:fs')
const { join } = require('node:path')
const [dest, name, displayArg, platform] = process.argv.slice(2)
const display = displayArg || name.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ')
// Nome usado nos containers e serviços do compose de dev e no dataset do Axiom: <nome>-cp no Chat Plataforma, <nome> na Zappy.
const slug = platform === 'chat-plataforma' ? `${name}-cp` : name
const html = display.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const jsLiteral =
  display.includes("'") && !display.includes('"')
    ? JSON.stringify(display)
    : `'${display.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
// Pontos fixos do template do Chat Plataforma; o da Zappy Contabil só usa o placeholder iframe-name.
const edits = platform === 'zappy-contabil' ? [['apps/api/.env.example', 'AXIOM_DATASET=\n', `AXIOM_DATASET=${name}\n`]] : [
  ['package.json', '"name": "chatplataforma-app"', `"name": "${slug}"`],
  ['README.md', '# App para o Chat Plataforma', `# ${display}`],
  ['apps/web/index.html', '<title>Chat Plataforma App</title>', `<title>${html}</title>`],
  ['apps/api/src/server/plugins/swagger.ts', "title: 'Chat Plataforma App'", `title: ${jsLiteral}`],
  ['apps/api/.env.example', 'AXIOM_DATASET=\n', `AXIOM_DATASET=${slug}\n`],
]
for (const [file, from, to] of edits) {
  const path = join(dest, file)
  const content = readFileSync(path, 'utf8')
  if (!content.includes(from)) {
    console.error(`scaffold: não achei ${JSON.stringify(from)} em ${file}; o template mudou?`)
    process.exit(1)
  }
  writeFileSync(path, content.replace(from, () => to))
}
// Placeholder `iframe-name` (containers, Dockerfile, CI e compose de dev) vira o nome do projeto, com sufixo -cp no Chat Plataforma.
const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.name === 'node_modules' || e.name === '.git'
      ? []
      : e.isDirectory()
        ? walk(join(dir, e.name))
        : [join(dir, e.name)],
  )
let replaced = 0
for (const file of walk(dest)) {
  const content = readFileSync(file, 'utf8')
  if (!content.includes('iframe-name') && !content.includes('iframe_name')) continue
  writeFileSync(file, content.replaceAll('iframe-name', slug).replaceAll('iframe_name', slug.replaceAll('-', '_')))
  replaced++
}
// Serviços locais do docker-compose.dev.yml: fica só o que foi escolhido.
const KNOWN_SERVICES = ['mysql', 'redis-queue', 'redis-cache']
const wanted = new Set(
  (process.env.SERVICES ?? KNOWN_SERVICES.join(',')).split(',').map((item) => item.trim()).filter(Boolean),
)
for (const item of wanted) {
  if (!KNOWN_SERVICES.includes(item)) {
    console.error(`scaffold: serviço '${item}' inválido; use ${KNOWN_SERVICES.join(', ')}`)
    process.exit(1)
  }
}
const VOLUME_OF = { mysql: 'mysql-data', 'redis-queue': 'redis-queue-data' }
const composePath = join(dest, 'docker-compose.dev.yml')
if (wanted.size === 0) {
  rmSync(composePath, { force: true })
  rmSync(join(dest, 'docker'), { recursive: true, force: true })
} else {
  const droppedVolumes = new Set(KNOWN_SERVICES.filter((item) => !wanted.has(item)).map((item) => VOLUME_OF[item]))
  let section = ''
  let skip = false
  const kept = []
  for (const line of readFileSync(composePath, 'utf8').split('\n')) {
    const top = line.match(/^([\w-]+):/)
    if (top) {
      section = top[1]
      skip = false
    }
    const key = line.match(/^ {2}([\w-]+):/)
    if (key && section === 'services') skip = !wanted.has(key[1])
    if (key && section === 'volumes') skip = droppedVolumes.has(key[1])
    if (!skip) kept.push(line)
  }
  writeFileSync(composePath, kept.join('\n').replace(/\n{3,}/g, '\n\n').replace(/\nvolumes:\n(?=\n|networks:)/, '\n'))
  if (!wanted.has('mysql')) rmSync(join(dest, 'docker', 'mysql-init'), { recursive: true, force: true })
}
const apiEnvExample = join(dest, 'apps/api/.env.example')
if (existsSync(apiEnvExample)) {
  let env = readFileSync(apiEnvExample, 'utf8')
  for (const [service, variable] of [['redis-queue', 'REDIS_QUEUE_URL'], ['redis-cache', 'REDIS_CACHE_URL']]) {
    if (!wanted.has(service)) env = env.replace(new RegExp(`^${variable}=`, 'm'), `# ${variable}=`)
  }
  writeFileSync(apiEnvExample, env)
}
console.log(`Placeholder iframe-name trocado em ${replaced} arquivo(s)`)
console.log(`Nome de exibição: ${display}`)
NODE
if [ "$PLATFORM" = "chat-plataforma" ]; then
  cp "$DEST/apps/api/.env.example" "$DEST/apps/api/.env"
  cp "$DEST/apps/web/.env.example" "$DEST/apps/web/.env"
  sed -i.bak \
    -e "s|^APPLICATION_ENCRYPTION_KEY=.*|APPLICATION_ENCRYPTION_KEY=$(random_base64)|" \
    -e "s|^CHATPLATAFORMA_CLIENT_SECRET=.*|CHATPLATAFORMA_CLIENT_SECRET=$(random_hex)|" \
    "$DEST/apps/api/.env" && rm "$DEST/apps/api/.env.bak"
else
  for envdir in "$DEST"/apps/*/; do
    [ -f "${envdir}.env.example" ] && cp "${envdir}.env.example" "${envdir}.env"
  done
  sed -i.bak \
    -e "s|^APPLICATION_ENCRYPTION_KEY=.*|APPLICATION_ENCRYPTION_KEY=$(random_base64)|" \
    -e "s|^APPLICATION_X_COMHUB_KEY=.*|APPLICATION_X_COMHUB_KEY=$(random_hex)|" \
    "$DEST/apps/api/.env" && rm "$DEST/apps/api/.env.bak"
fi

INFRA_STEP=""
[ -f "$DEST/docker-compose.dev.yml" ] && INFRA_STEP="  docker compose -f docker-compose.dev.yml up -d
"
if [ "$PLATFORM" = "chat-plataforma" ]; then
cat <<MSG
App '$NAME' criado em $DEST (apps/api/.env e apps/web/.env de desenvolvimento, com APPLICATION_ENCRYPTION_KEY e CHATPLATAFORMA_CLIENT_SECRET aleatórios).

Próximos passos (Node 24 + pnpm):
  cd $DEST
  git init                       # antes do install, para o Lefthook instalar os hooks
  pnpm install
${INFRA_STEP}  pnpm --filter api db:migrate --name init
  pnpm dev
  CHATPLATAFORMA_TEST_API_KEY=<key de uma conta de teste> pnpm --filter api dev:install

Em produção, CHATPLATAFORMA_CLIENT_SECRET é o clientSecret gerado pelo Backstage, não o valor do apps/api/.env.
MSG
else
cat <<MSG
Projeto '$NAME' ($PLATFORM) criado em $DEST (apps/*/.env copiados de cada .env.example, com APPLICATION_ENCRYPTION_KEY e APPLICATION_X_COMHUB_KEY aleatórios em apps/api/.env).

Próximos passos (Node 24 + pnpm):
  cd $DEST
  git init                       # antes do install, para o Lefthook instalar os hooks
  pnpm install
${INFRA_STEP}  pnpm --filter api db:migrate        # aplica a migration inicial (tenants)
  pnpm dev

Cadastre o primeiro tenant com POST /api/tenants e o header x-comhub-key (valor de APPLICATION_X_COMHUB_KEY no apps/api/.env); veja o README.
MSG
fi

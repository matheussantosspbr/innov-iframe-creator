#!/bin/sh
# Aplica as migrations pendentes e sobe a API; se a migration falhar, o container não sobe.
set -e
./node_modules/.bin/prisma migrate deploy
exec node src/server/server.ts

# Features

Um arquivo por feature, numerado (`01-nome.md`), em português e curto: o que a feature faz, rotas e corpos, validações, erros e tabelas.
Descreva o que está implementado, não o que se pretende fazer. Atualize o arquivo no mesmo PR que muda o código.
Se a feature mexe nas rotas, rode `pnpm --filter api openapi:schema > docs/api/openapi.json` e `pnpm exec biome format --write docs/api/openapi.json` (o teste de OpenAPI falha se o arquivo ficar desatualizado).
O ponto de partida é `00-tenant.md`.

# Dependências: analisar antes de instalar

Leia antes de qualquer `pnpm add`. O objetivo é não reinventar a roda nem trazer risco desnecessário.

## 1. Precisa mesmo de uma lib?

Resolva **sem lib** o que a plataforma já oferece ou o que cabe em poucas linhas e é fácil de testar:
- **Node 24 e browser:** `fetch`, `AbortSignal.timeout`, `crypto.randomUUID`/`createHmac`/`timingSafeEqual`, `structuredClone`, `URL`/`URLSearchParams`, `Intl` (datas, moeda, plural), `Array.prototype.toSorted`/`groupBy` (`Object.groupBy`), `TextDecoderStream` e `--env-file`.
- **Já no template:** Zod (validação), TanStack Query (cache e retry), InnovUI (UI), Lucide (ícones), jose (JWT), pino (logs, via Fastify).
- **Utilitários de 5 a 30 linhas**, como formatar telefone, debounce, chunk ou retry simples: escreva com teste.

Use lib quando o problema for **complexo, sensível ou caro de acertar**: parsing de formatos (xlsx, pdf), criptografia além do `node:crypto`, protocolos (WebSocket, OAuth), datas com fuso e recorrência, editores ricos, gráficos, SDK oficial de um serviço (Resend, Langfuse). Nesses casos, prefira a lib madura a uma implementação própria.

## 2. Checklist (rode o script e complete à mão)

```bash
node <skill>/scripts/check-dependency.mjs <pacote[@versão]> apps/<api|web>
```

O script consulta registry, advisories do npm e OSV. Ele mostra licença, última release, versão deprecada, vulnerabilidades (HIGH ou CRITICAL **bloqueiam**), scripts de instalação, número de dependências, tipos, peers e engines comparados com o projeto. Sai com código 2 quando encontra bloqueio.

Complete à mão:

| Critério | Aceitável |
|---|---|
| **Manutenção** | Release ou commit relevante no último ano; issues e PRs respondidos; mais de um mantenedor ou organização conhecida (`@fastify/*`, `@tanstack/*`, SDK oficial). Sem release há mais de 1 ano exige justificativa. |
| **Adoção** | Uso amplo (downloads/semana na casa dos milhares ou mais) ou mantida pelo fornecedor do serviço. |
| **Segurança** | Nenhuma CVE HIGH/CRITICAL aberta na versão escolhida; histórico de correções rápidas; sem scripts de `postinstall` (se tiver, justifique e libere em `allowBuilds` do `pnpm-workspace.yaml`); nome conferido contra typosquatting. |
| **Licença** | MIT, ISC, Apache-2.0, BSD ou 0BSD. GPL/AGPL/SSPL ou "sem licença" exigem decisão explícita. |
| **Compatibilidade** | ESM ou dual; tipos próprios; funciona no Node 24; peers compatíveis com React 19, Fastify 5 e Zod 4; não duplica nem conflita com algo já instalado (`pnpm why <pacote>`). |
| **Peso** | No web, impacto no bundle aceitável para 384px dentro de um iframe; avalie com `pnpm --filter web build` antes e depois. Na API, árvore de dependências enxuta. |
| **Saída** | É fácil trocar ou remover depois? Isole a lib atrás de um módulo do app em `infrastructure/libs/` (como `chatplataforma/client.ts`, `<sistema>/client.ts`, `mailer.ts`), com o contrato em `core/repository/` em vez de espalhar imports. |

Exemplo: `@microsoft/fetch-event-source` parece a escolha óbvia para SSE com headers, mas o script mostra **mais de 5 anos sem release**. Como o leitor tem ~25 linhas (`references/chat-plataforma/realtime.md`), a decisão é não usar a lib.

## 3. Instalando

1. Versão com `^` da mais recente estável. Evite majors recém-saídas (menos de ~2 semanas) e versões `rc`/`beta`.
2. `pnpm --filter <app> add <pacote>`, para nunca instalar na raiz o que é de um app só.
3. `pnpm audit --prod --audit-level=high`, `pnpm lint`, `pnpm typecheck`, `pnpm test` e `pnpm build`. O CI repete o audit.
4. Na entrega, informe o que foi adicionado, por quê e o resultado do checklist.

## 4. Manutenção contínua

- Majors são atualizadas uma por vez, lendo o changelog e rodando tudo.
- Se o `pnpm audit` do CI falhar por uma CVE nova, atualize a dependência ou aplique `overrides` no `pnpm-workspace.yaml` com a versão corrigida. Nunca desligue o passo.

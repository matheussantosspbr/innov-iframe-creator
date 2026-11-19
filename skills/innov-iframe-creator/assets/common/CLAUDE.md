# Regras do projeto

## Tipos de commit

| Tipo       | Ícone | Descrição                                              |
| ---------- | :---: | ------------------------------------------------------ |
| `feat`     |  ✨   | Nova funcionalidade para o usuário                     |
| `fix`      |  🐛   | Correção de um bug                                     |
| `docs`     |  📚   | Alterações apenas em documentação                      |
| `style`    |  💄   | Formatação, ponto e vírgula, espaços — sem lógica      |
| `refactor` |  ♻️   | Refatoração sem adicionar feature ou corrigir bug      |
| `test`     |  🧪   | Adição ou correção de testes                           |
| `chore`    |  🔧   | Tarefas de manutenção, configs, dependências           |
| `perf`     |  ⚡   | Melhoria de performance                                |
| `ci`       |  🤖   | Mudanças em arquivos e scripts de CI/CD                |
| `build`    |  📦   | Mudanças no sistema de build ou dependências externas  |
| `revert`   |  ⏪   | Reverte um commit anterior                             |

### Estrutura do commit

```text
<tipo>(<escopo>): <descrição>

[corpo opcional]

[rodapé(s) opcional(is)]
```

## Idioma do projeto

| Contexto    | Idioma  |
| ----------- | ------- |
| Código      | Inglês  |
| Comentários | Inglês  |
| Commits     | Inglês  |
| Chat        | Inglês  |

> **Obs:** se eu pedir para mudar o idioma de algo, altere em cima. Siga
> obrigatoriamente os idiomas descritos acima.

## Subagentes

Este projeto tem três subagentes em `.claude/agents/`. Delegue as tarefas para
eles em vez de fazer o trabalho diretamente:

| Agente      | Escopo                                                                                                                        |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `frontend`  | Tudo em `/web` (React, Vite, Tailwind, TanStack Query, InnovUI, Vitest), incluindo telas a partir do Figma.                                  |
| `backend`   | Tudo em `/api` (Fastify, Prisma, Zod, testes, Docker, CI/CD).                                                              |
| `qa`        | Valida toda entrega do frontend e do backend antes de ser considerada pronta. Pode criar e alterar testes em `/web` e `/api`, mas não altera código de produção. |

### Fluxo padrão para funcionalidades

1. **backend** implementa e retorna o contrato dos endpoints.
2. **frontend** implementa usando esse contrato.
3. **qa** valida tudo.
4. Se o **qa** reprovar, envie cada bug para o agente indicado no relatório, peça
   a correção e chame o **qa** de novo, até ser aprovado.

### Regras de delegação

- **Tarefas só de um lado:** chame o agente daquele lado e depois o qa.
- **Tarefas independentes nos dois lados:** chame frontend e backend em paralelo
  e depois o qa.
- **Ao delegar:** inclua no pedido todo o contexto necessário (regras de negócio,
  links do Figma, casos de erro, critérios de aceite), porque o subagente não vê
  esta conversa. Para o qa, inclua também os resumos dos agentes que
  implementaram.
- **Seu papel é coordenar:** planejar, dividir a tarefa, delegar e revisar os
  resumos dos agentes antes de me responder.
- **Só dê a tarefa como concluída** depois que o qa aprovar, ou explique por que
  não foi possível.
- **Exceção:** perguntas rápidas sobre o código e ajustes triviais (um texto, uma
  classe CSS, um typo) podem ser feitos direto, sem delegar e sem passar pelo qa.

## Modo de trabalho

- **Em toda tarefa:** invoque a skill `caveman` (respostas curtas, economia de
  tokens) antes de responder.
- **Só quando eu pedir para escrever código:** invoque também a skill `ponytail`
  (solução mínima).
- **Ao delegar para subagentes:** peça que sigam os mesmos modos.

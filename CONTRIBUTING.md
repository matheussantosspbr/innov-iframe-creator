# Como contribuir

Obrigado por querer contribuir com o **innov-iframe-creator**! Este repositório é um plugin do Claude Code com a skill que cria e migra iframes da Innov para o Chat Plataforma e para a Zappy Contabil. Este guia explica como propor mudanças.

## Fluxo de trabalho

A branch `main` é protegida: **ninguém faz push direto nela, incluindo os mantenedores**. Toda mudança entra por pull request.

1. Faça um fork do repositório (ou, se você tem acesso de escrita, crie uma branch direto nele).
2. Crie uma branch a partir da `main` atualizada, com um nome que descreva a mudança:
   - `feat/nome-da-melhoria`
   - `fix/nome-do-problema`
   - `docs/o-que-mudou`
3. Faça suas alterações em commits pequenos e focados.
4. Abra um pull request para a `main`, explicando o que mudou e por quê.
5. Aguarde a revisão. Ajuste o que for pedido e envie novos commits na mesma branch.

## Reportando problemas e sugestões

Antes de abrir uma issue, procure se já existe uma parecida. Ao abrir, descreva:

- o que você esperava que acontecesse e o que aconteceu de fato;
- os passos para reproduzir (comando, plataforma escolhida, nome do iframe, serviços marcados);
- versões de Node, pnpm e Claude Code, se forem relevantes.

## Onde mexer

| O que você quer mudar | Onde |
| --- | --- |
| Comportamento da skill, questionário, regras de migração | `skills/innov-iframe-creator/SKILL.md` |
| Template só do Chat Plataforma | `skills/innov-iframe-creator/assets/chat-plataforma/` |
| Template só da Zappy Contabil | `skills/innov-iframe-creator/assets/zappy-contabil/` |
| Algo igual nas duas plataformas | `skills/innov-iframe-creator/assets/common/` |
| Documentação de apoio | `skills/innov-iframe-creator/references/` |
| Geração do projeto | `skills/innov-iframe-creator/scripts/scaffold.sh` |
| Manifesto do plugin e do marketplace | `.claude-plugin/` |

O que está em `assets/common/` vale para as duas plataformas: mudou lá, mudou nas duas.

## Testando sua alteração

Mexeu em template ou no scaffold? Gere um projeto de teste e valide dentro dele:

```bash
bash skills/innov-iframe-creator/scripts/scaffold.sh /tmp/teste meu-iframe "Meu Iframe"

cd /tmp/teste/meu-iframe
pnpm install --frozen-lockfile
pnpm exec biome check .
pnpm exec turbo run typecheck test
```

Para testar a skill localmente no Claude Code:

```bash
claude --plugin-dir /caminho/para/innov-iframe-creator
```

Teste os dois templates quando a mudança for em `assets/common/` ou no `scaffold.sh`.

### Dependências

- Node 24 e pnpm 12.
- O pnpm 12 recusa versões publicadas há menos de 24 horas. Atualize com `pnpm update -r --latest` e, se a instalação acusar a violação, volte o pacote para a versão anterior.
- Antes de adicionar um pacote com `pnpm add`, rode a checagem de segurança em `skills/innov-iframe-creator/scripts/check-dependency.mjs`.
- Mexeu em dependências? Gere de novo o `pnpm-lock.yaml` dos dois templates, como descrito em `references/chat-plataforma/stack.md`.

## Convenções

- **Variáveis de ambiente** sempre com prefixo de dono: `APPLICATION_` para o que é do app e o nome do serviço para o resto (`DATABASE_`, `REDIS_`, `AXIOM_`, `CHATPLATAFORMA_`...). Exceções só para as definidas por terceiros (`NODE_ENV`, `MYSQL_*`, `PNPM_HOME`, `VITE_*`). Cada app mantém o seu `.env.example`.
- **Portas:** backend 3333, frontend 8080, nos dois templates.
- **Deploy:** nenhum compose usa `ports:` (o Coolify não aceita). A porta vem do `EXPOSE` do Dockerfile.
- **Lint e formato:** o projeto usa Biome. Rode `pnpm exec biome check .` antes de commitar.
- **Documentação:** se o comportamento da skill mudou, atualize o `SKILL.md` e os arquivos em `references/` no mesmo pull request.

## Mensagens de commit

Use mensagens curtas, no imperativo, e de preferência no padrão Conventional Commits:

```
feat: adiciona opção de Redis de cache no scaffold
fix: corrige porta do nginx no template da Zappy
docs: atualiza referência do ZDK
```

## Pull requests

Um bom pull request:

- tem um escopo único e fácil de revisar;
- descreve o que mudou, por que mudou e como você testou;
- indica qual plataforma foi afetada (Chat Plataforma, Zappy Contabil ou ambas);
- atualiza a documentação quando necessário;
- passa nas verificações automáticas.

## Limites conhecidos

Algumas partes ainda não foram exercitadas em condições reais: a skill em uma sessão com o plugin instalado, a CI no GitHub, o deploy no Coolify e a importação no Apidog. Contribuições que validem ou corrijam esses pontos são muito bem-vindas.

## Conduta

Seja respeitoso e construtivo nas issues e nas revisões. Críticas são sobre o código, nunca sobre as pessoas.

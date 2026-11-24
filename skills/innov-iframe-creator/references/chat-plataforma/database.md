# Banco de dados: convenções (MySQL 8 + Prisma 7)

Leia antes de criar ou alterar qualquer model.

## Regras

1. **snake_case no banco, camelCase no TS.** Todo model tem `@@map("<tabela>")` e todo campo com mais de uma palavra tem `@map("<coluna>")`. A tabela fica no plural (`contact_notes`) e o model no singular (`ContactNote`).
2. **PK surrogate `id`**: `Int @id @default(autoincrement()) @db.UnsignedInt`. Use `BigInt … @db.UnsignedBigInt` só se a tabela puder passar de ~4 bilhões de linhas.
3. **FK `<entidade>_id`**, com o mesmo tipo da PK referenciada, `onDelete` explícito e constraint nomeada. Tudo que pertence a uma organização referencia `installations.id` com `onDelete: Cascade`, para que o uninstall limpe tudo sozinho.
4. **Constraints nomeadas** (o padrão do Prisma gera nomes ruins):
   - unique: `uq_<tabela>_<colunas>`, com `@unique(map:)` ou `@@unique(..., map:)`;
   - índice: `idx_<tabela>_<colunas>`, com `@@index(..., map:)`;
   - FK: `fk_<tabela>_<coluna>`, com `@relation(..., map:)`.
   - Mantenha os nomes com até 64 caracteres (limite do MySQL).
5. **Tipo e tamanho sempre explícitos com `@db.*`.** Sem eles, o Prisma usa `VARCHAR(191)` em toda `String`.

   | Dado | Tipo |
   |---|---|
   | UUID (ex: `external_id`) | `@db.Char(36)` |
   | ID do Chat Plataforma (snowflake numérico de 18 a 20 dígitos) | `BigInt @db.UnsignedBigInt` |
   | Texto curto com limite conhecido | `@db.VarChar(n)`, com o mesmo `n` no `.max(n)` do zod |
   | Texto realmente longo e sem limite | `@db.Text`, só com justificativa |
   | Dinheiro | `Decimal @db.Decimal(12, 2)`. Nunca `Float` |
   | Flag | `Boolean` (`TINYINT(1)`) |
   | Data e hora | `DateTime @db.DateTime(3)`, sempre em UTC |
   | Status | `String @db.VarChar(n)` validado com `z.enum(CONSTANTE)` (objeto `Object.freeze({...} as const)`). Evite `enum` do Prisma: um ENUM no MySQL exige migration para cada valor novo |
   | JSON | `Json`, só para payload opaco que nunca será filtrado |

6. **Timestamps:** `created_at DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3)` em toda tabela. `updated_at` (`@default(now()) @updatedAt`) só onde houver update. O `@updatedAt` é preenchido pelo Prisma, não pelo banco. Se precisar que updates fora do Prisma também atualizem a coluna, acrescente `ON UPDATE CURRENT_TIMESTAMP(3)` à mão no SQL da migration.
7. **`NOT NULL` por padrão.** Use `?` (nullable) só quando a ausência tiver significado.
8. **Índices pelas consultas reais.** O app é multi-organização, então quase toda consulta filtra por `installation_id`, que deve vir primeiro nos índices compostos.
9. **Charset:** `utf8mb4` (padrão do MySQL 8). Não use o `utf8` antigo.
10. **IDs snowflake e JS:** o Prisma devolve `BigInt` como `bigint`, que o `JSON.stringify` não serializa. Converta na borda do repositório: `BigInt(ctx.contactId)` ao gravar e `.toString()` ao devolver. Rotas e front só veem `string`.
11. **Migrations:** rode `pnpm --filter api db:migrate --name <verbo_objeto>` (ex: `create_contact_notes`). Revise o SQL gerado antes de commitar e nunca edite uma migration já aplicada em produção.

## Prisma 7: o `output` no generator

O generator é o `prisma-client-js`, sem `output`: o client é gerado dentro de `node_modules/@prisma/client` e não existe pasta `generated` no projeto. O generator novo (`prisma-client`) exige `output` e gera o client dentro do `src`, por isso não é usado aqui.

- é regenerado por `dev`, `test`, `typecheck` e pelo Dockerfile (`prisma generate`);
- é importado como `@prisma/client`.

## Tabela `installations` (já no template)

| Coluna | Tipo | Observação |
|---|---|---|
| `id` | `INT UNSIGNED` PK, auto-increment | Identificador **interno**. É a FK das tabelas do app e nunca sai do backend. |
| `external_id` | `CHAR(36)` UNIQUE (`uq_installations_external_id`) | UUID gerado por nós no install. É o identificador **público**: volta em configure, uninstall e diagnostics e é o `accountId` do iframe. |
| `credentials` | `VARCHAR(4096)` | JSON cifrado (AES-256-GCM, base64). O zod limita cada campo (`.max`) e o JSON a 2900 bytes, para caber cifrado. |
| `created_at` / `updated_at` | `DATETIME(3)` | |

**Por que dois identificadores:** o Chat Plataforma não manda ID próprio no install. O corpo traz só as credenciais (indexadas pelo value do campo), e é o app que gera o `externalId` e devolve. Esse valor precisa ser imprevisível, porque aparece na URL do iframe. Já como chave de junção, um inteiro sequencial é menor e mais rápido (4 bytes contra 36), e deixa a URL desacoplada do modelo relacional.

## Exemplo: tabela do app (verificado em MariaDB)

```prisma
model Installation {
  // ...campos existentes...
  contactNotes ContactNote[]
}

model ContactNote {
  id             Int          @id @default(autoincrement()) @db.UnsignedInt
  installationId Int          @map("installation_id") @db.UnsignedInt
  contactId      BigInt       @map("contact_id") @db.UnsignedBigInt
  agentId        BigInt       @map("agent_id") @db.UnsignedBigInt
  body           String       @db.VarChar(2000)
  createdAt      DateTime     @default(now()) @map("created_at") @db.DateTime(3)
  installation   Installation @relation(fields: [installationId], references: [id], onDelete: Cascade, map: "fk_contact_notes_installation_id")

  @@index([installationId, contactId], map: "idx_contact_notes_installation_id_contact_id")
  @@map("contact_notes")
}
```

O schema da rota (`presentation/schemas/contact-notes.schemas.ts`) usa `body: z.string().trim().min(1).max(2000)`, o mesmo limite da coluna. O use case recebe a instalação e os IDs do contexto como string e chama o repositório (interface em `core/repository/`, implementação `infrastructure/repository/contact-note.repository.ts`), que usa `installation.id` e converte os snowflakes com `BigInt()` ao gravar e `.toString()` ao devolver.

## Produção: MySQL em DBaaS (Magalu Cloud)

Verificado com o servidor real contra MySQL 8.0 (`caching_sha2_password`), com e sem TLS.

- **Driver:** `@prisma/adapter-mariadb` é o adapter oficial do Prisma 7 para MySQL e MariaDB; não há outro para MySQL. Fala o protocolo do MySQL normalmente.
- ⚠ **Autenticação do MySQL 8:** o usuário padrão usa `caching_sha2_password`. Sem TLS, o driver precisa buscar a chave RSA do servidor; sem `allowPublicKeyRetrieval` a conexão falha com `ER_CANNOT_RETRIEVE_RSA_KEY` e o Prisma mostra só "pool failed to retrieve a connection from pool". Por isso `server.ts` não passa a URL crua ao adapter: `lib/database.ts` (`mariaDbConfigFrom`) decodifica a URL e liga `allowPublicKeyRetrieval` quando não há TLS. O `DATABASE_URL` continua no formato padrão `mysql://user:senha@host:3306/db` (senha com caracteres especiais em URL-encode), que também é o que a CLI do Prisma usa no `migrate deploy`.
- **TLS:** `DATABASE_TLS=true` cifra a conexão (`ssl.rejectUnauthorized: false`, ou seja, cifra sem validar o certificado, que é autoassinado na maioria dos DBaaS). Na Magalu Cloud o banco só tem IP privado dentro da VPC; sem TLS a senha não trafega em claro (vai cifrada com a chave RSA), mas os dados sim. Ligue se o banco aceitar TLS.
- **Rede:** a instância MySQL da Magalu só é acessível de dentro da rede da Magalu Cloud, na mesma região. O servidor do Coolify que roda a API precisa estar lá. Da sua máquina, acesse por túnel SSH num jumphost (`ssh -L 3306:<ip_privado>:3306 ubuntu@<ip_vm>`).
- **Banco e usuário:** o DBaaS cria só a instância e o usuário admin. Antes do primeiro deploy, crie um banco e um usuário por app, sem usar o admin:
  ```sql
  CREATE DATABASE chat_app_<nome> CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
  CREATE USER 'app_<nome>'@'%' IDENTIFIED BY '<senha forte>';
  GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, DROP, INDEX, REFERENCES ON chat_app_<nome>.* TO 'app_<nome>'@'%';
  ```
  Os privilégios de DDL são para o `migrate deploy` no start. O `migrate deploy` não usa shadow database.
- **Pool:** `DATABASE_POOL_SIZE` (padrão 5) por réplica. Some as réplicas de todos os apps que usam a mesma instância e mantenha abaixo do `max_connections` do plano.
- **Versão:** a Magalu oferece MySQL 8.4; o `docker-compose.dev.yml` usa `mysql:8.4` para ser igual a produção.

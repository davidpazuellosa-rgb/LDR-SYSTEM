# Handoff — SASI LDR Hub (para o Codex)

Você está assumindo o desenvolvimento do **SASI LDR Hub**. Este documento te dá todo o
contexto para continuar **o sistema** e fazer o **deploy no VPS**. Leia inteiro antes de mexer.

---

## 1. O que é o projeto

Central interna do setor comercial da SASI para **sanear bases de prefeituras** antes de irem ao
HubSpot. O foco hoje é a campanha **"Cidade na Mão 2026"**, região **Nordeste** (1.794 prefeituras).
Fluxo: importar planilha → trabalhar como planilha → telefones errados vão para uma **fila de
correção** → ao corrigir, o contato é atualizado **de volta no HubSpot**.

- **Pasta do projeto:** `/Users/davidpazuello/Desktop/Projetos/SASI/sasi-ldr-hub`
- **Idioma da UI:** Português (BR). Identidade visual SASI (sidebar navy `#191d45`, indigo).

## 2. Stack

- **Next.js 15** (App Router, TypeScript) — **fixado no 15** (o 16 exige Node ≥20.19; ambiente tem 20.18)
- **Tailwind v4**
- **Prisma + SQLite** (banco em arquivo; em produção vive num volume Docker)
- **NextAuth v5 (beta)** — credentials provider, sessão JWT
- HubSpot via **fetch** direto à API REST (o `@hubspot/api-client` está instalado mas pouco usado)
- `xlsx` + `papaparse` para importação

## 3. Como rodar (local)

```bash
npm install
npm run db:push      # cria/atualiza tabelas (SQLite em prisma/dev.db)
npm run db:seed      # cria admin + base vazia "Cidade na mão - Região Nordeste"
npm run dev          # http://localhost:3000
```

- **Reset do banco:** o Prisma BLOQUEIA `--force-reset` por segurança. Para zerar local, apague
  `prisma/dev.db` e rode `db:push` + `db:seed`.
- **Login admin:** `admin@sasi.com` / `sasi1234`
- **Login LDR de teste:** `ldr@sasi.com` / `ldr12345`

## 4. Variáveis de ambiente (`.env`)

```
DATABASE_URL="file:./dev.db"
AUTH_SECRET="<segredo aleatório>"
SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD / SEED_ADMIN_NAME
HUBSPOT_TOKEN="pat-..."           # Private App Token (escopos de leitura + escrita de contatos)
NEXT_PUBLIC_BASE_PATH=""          # subcaminho no nginx (ex.: "/sasi-ldr"); vazio = raiz
CRM_AUTO_SYNC="true"              # "false" desliga a sync automática
CRM_SYNC_INTERVAL_MIN="360"       # intervalo da sync (min)
```

> ⚠️ **Segurança:** o token atual do HubSpot foi exposto em chat durante o desenvolvimento.
> **Gere um novo Private App Token** no HubSpot e substitua antes de produção.

## 5. Modelo de dados (Prisma — `prisma/schema.prisma`)

- **User**: `email`, `passwordHash`, `role` (`admin` | `ldr`).
- **Base**: lote de contatos. Convenção de nome: **"Solução - Local"** (ex.: `Cidade na mão - Região Nordeste`).
- **Contact** (uma prefeitura): 19 colunas definidas em `src/lib/contact-fields.ts`
  (`cidade, estado, regiao, populacao, telefonePrefeitura, emailInstitucional, secretariaAdmin,
  nomePrefeito, siteOficial, whatsapp, codigoIbge, origemContato, faseCicloVida, campanha, setor,
  departamentos, solucaoInteresse, prospectante, proprietario`) + `status`, `hubspotId`.
- **Correction**: fila/histórico de correção de telefone (`oldValue`, `newValue`, `status` pending/resolved, `createdById`, `resolvedById`).

**Status do telefone** (`src/lib/status.ts`) — usa a **nomenclatura do HubSpot**:
`ok` ("Telefone OK") · `telefone_incorreto` ("Telefone Incorreto") · `telefone_atualizado` ("Telefone Atualizado").

## 6. Cargos e permissões (`src/lib/permissions.ts`, `src/lib/guard.ts`)

- **admin**: tudo.
- **ldr**: pode **importar** e **corrigir** telefones; **NÃO** pode apagar, exportar, gerenciar
  usuários, nem acessar áreas sensíveis (HubSpot, Usuários).
- Aplicado **na UI** (esconde botões) **e nas rotas de API** (`requireAdmin` / `requirePermission(action)` → 403).
- Páginas sensíveis (`/usuarios`, `/hubspot`) fazem `redirect("/dashboard")` para não-admin.

## 7. Telas

- **/dashboard** — indicadores (Telefone Incorreto/Atualizado etc.)
- **/bases** e **/bases/[id]** — planilha editável; **abas por estado (UF)**; **filtros** Todos /
  Telefone Incorreto / Telefone Atualizado / Telefone OK (contagem global); **Importar CSV/Excel**;
  **Exportar CSV** (admin); adicionar/editar/excluir (excluir = admin).
- **/correcoes** — navegação por **cards**: Campanha → Região → contatos; no nível dos contatos há
  **filtro por Proprietário do contato** (pré-vendedor/vendedor). Corrigir resolve a correção.
- **/hubspot** (admin) — apenas **teste de conexão** (read-only). Sem importação/exportação manual.
- **/usuarios** (admin) — CRUD de usuários e cargos.
- **/configuracoes** — dados da conta.

Shell da aplicação: `src/components/AppShell.tsx` (sidebar + topbar). Título da página vai na
**topbar** via `src/components/TitleContext.tsx` (cada página usa `<PageHeader>` que define o título).

## 8. Integração HubSpot

- **Portal:** 23563863. Propriedades de contato relevantes:
  - `campanha` (enumeration) — valor usado: `"Cidade Na Mão 2026"`
  - `regiao` (enumeration) — valor usado: `"Nordeste"`
  - `lifecyclestage` (pipeline custom): **"Telefone Incorreto" = `1320556150`**, **"Telefone Atualizado" = `1320496031`**
  - `hubspot_owner_id` → resolver nome via `GET /crm/v3/owners`
  - `phone` (telefone do contato), `city`, `state`
- **Sync automática (somente leitura)** — `src/lib/crm-sync.ts`, disparada por `src/instrumentation.ts`
  (no boot + a cada `CRM_SYNC_INTERVAL_MIN`). Traz: proprietário, fase do ciclo de vida e `hubspotId`.
  É **não destrutiva** (não desfaz correção local). Cruza com a base local por **cidade + UF**.
- **Escrita de volta (na correção)** — `src/lib/hubspot-write.ts`, chamada em
  `src/app/api/corrections/[id]/route.ts`: ao corrigir um número válido, faz `PATCH` no contato do
  HubSpot atualizando `phone` e `lifecyclestage = 1320496031` ("Telefone Atualizado"). É best-effort
  (se falhar, a correção local continua salva; a resposta traz `hubspot: {ok,error}`).
  **Ainda não foi testado em produção pelo usuário** — validar o write real.

**Proprietários (owners) atuais:** Tayane Cristina Lopes Ferreira, Miriam Maciel, Hanny Mendonça,
Igor Cañizo Melo Dantas, Macley da Costa Polezi, Ariela Salgado.

## 9. Scripts utilitários (`scripts/`, todos read-only no HubSpot exceto onde diz `--apply`)

- `import-nordeste.js` — importou a planilha (xlsx, 1 guia por UF) para a base.
- `align-crm-status.js` — alinha status local com a fase do CRM (`--apply`).
- `enrich-owner.js` — traz o proprietário do CRM (`--apply`).
- `diff-hubspot.js` — confere prefeituras no CRM x base local.

## 10. Estado atual dos dados

Base **"Cidade na mão - Região Nordeste"**: **1.794** prefeituras (AL 102, BA 417, CE 184, MA 217,
PB 223, PE 185, PI 224, RN 167, SE 75). Status alinhado ao CRM: **661** Telefone Incorreto, **87**
Telefone Atualizado, restante OK. Proprietário e `hubspotId` preenchidos (~1.790).

## 11. Deploy no VPS (PENDENTE — principal tarefa de infra)

Contexto do VPS (ver também o manual `MANUAL-EQUIPE-AMBIENTES.md` do usuário):
- Acesso: `ssh sasiteam1@82.29.60.60` (chave SSH já cadastrada). Docker **rootless**, conta isolada.
- Limites: 4 CPU / 12 GB RAM / **15 GB disco**. Usar **portas ≥ 9000**. Sem sudo.
- Publicação pública é feita pelo **admin (Natan)** via nginx — enviar a "Ficha de Publicação"
  (está no manual). Por padrão só 80/443 são públicas.

Arquivos de deploy já existem no repo:
- **`Dockerfile`** (node:20-alpine; `prisma generate` + `next build`; entrypoint faz `prisma db push`
  + seed + `npm start`). `DATABASE_URL=file:/data/app.db`.
- **`docker-compose.yml`** — serviço `app`, porta **9010:3000**, volume `ldr-data:/data`,
  `env_file: .env.production`.
- **`docker-entrypoint.sh`** — migra o banco, garante admin e sobe.
- **`.dockerignore`**.

Pendências de deploy:
1. Criar **`.env.production`** no VPS (NÃO commitar) com `AUTH_SECRET`, `HUBSPOT_TOKEN` (token NOVO),
   `SEED_ADMIN_*`, `CRM_AUTO_SYNC`, `CRM_SYNC_INTERVAL_MIN`. `DATABASE_URL` já vem do Dockerfile.
2. Decidir **basePath**: se for publicar em subcaminho (`/sasi-ldr`), buildar com
   `NEXT_PUBLIC_BASE_PATH=/sasi-ldr` (e `apiPath()` em `src/lib/path.ts` já prefixa as chamadas).
   Recomendado pedir **subdomínio** ao admin para rodar na raiz e evitar dor de cabeça com basePath.
3. `docker compose up -d --build` na conta `sasiteam1`. Validar `curl -I http://localhost:9010/`.
4. Preencher a **Ficha de Publicação** e enviar ao admin para criar a rota nginx (HTTPS).
5. Confirmar que a **sync automática** roda no container (precisa de saída de internet — liberada no VPS).

`next.config.ts` já usa `output: "standalone"` e lê `NEXT_PUBLIC_BASE_PATH`.

## 12. Próximos passos sugeridos

- [ ] Testar o **write-back no HubSpot** ao corrigir (validar phone + fase no CRM real).
- [ ] **Rotacionar o HUBSPOT_TOKEN** (o atual foi exposto).
- [ ] Fazer o **deploy no VPS** (seção 11) e publicar via admin.
- [ ] (Opcional) Tema escuro (botão de sol na topbar é cosmético hoje); seletor de idioma é cosmético.
- [ ] (Opcional) Generalizar a sync para outras campanhas/regiões (hoje "Cidade Na Mão 2026"/"Nordeste" estão fixos em `crm-sync.ts`).

## 13. Convenções importantes

- Chamadas de API no client usam **`apiPath()`** (`src/lib/path.ts`) por causa do basePath.
- Status sempre pelos consts de `src/lib/status.ts`; permissões por `src/lib/permissions.ts`.
- Nomes de base seguem **"Solução - Local"**.
- Não escrever no HubSpot fora do fluxo de correção sem alinhar com o usuário (ele controla o CRM).

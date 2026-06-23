# SASI LDR Hub

Central de saneamento, organização e operação das bases comerciais da SASI — uma camada
operacional **antes** do HubSpot CRM. A equipe trabalha as bases em formato de planilha,
corrige telefones incorretos (com histórico) e envia dados limpos para o HubSpot.

## O que tem dentro
- 🔐 Login e senha (controle de acesso)
- 📊 Dashboard de acompanhamento
- 🗂️ Bases de dados editáveis (formato planilha) + importação de CSV/Excel + cadastro manual
- 📞 Fila de correção de telefones com histórico de quem alterou
- 🔗 Integração com HubSpot CRM (envio dos contatos saneados)

## Stack
Next.js 15 · React 19 · Tailwind · Prisma + SQLite · NextAuth · @hubspot/api-client

---

## Rodar localmente (no seu Mac)

```bash
npm install
cp .env.example .env      # já vem preenchido para uso local
npm run db:push           # cria o banco
npm run db:seed           # cria o usuário admin + base de exemplo
npm run dev               # abre em http://localhost:3000
```

**Login inicial:** `admin@sasi.com` / `sasi1234` (troque depois).

Para ativar o HubSpot localmente, cole o token em `.env` (`HUBSPOT_TOKEN="pat-..."`) e reinicie.

---

## Deploy no VPS da SASI (conta sasiteam1)

> Pré-requisito: acesso SSH funcionando (`ssh sasiteam1@82.29.60.60`) e Docker rootless (já vem pronto).

1. **Suba o código para o servidor.** Duas opções:
   - via `git clone` (recomendado — versione num repositório), ou
   - copiando a pasta:
     ```bash
     # do seu Mac, na pasta do projeto:
     rsync -av --exclude node_modules --exclude .next --exclude prisma/dev.db \
       ./ sasiteam1@82.29.60.60:~/sasi-ldr-hub/
     ```

2. **No servidor**, entre na pasta e configure os segredos:
   ```bash
   ssh sasiteam1@82.29.60.60
   cd ~/sasi-ldr-hub
   cp .env.production.example .env.production
   nano .env.production       # gere o AUTH_SECRET e cole o HUBSPOT_TOKEN
   #   AUTH_SECRET: rode `openssl rand -base64 32` e cole o resultado
   ```

3. **Suba com Docker** (porta interna 9010, conforme regra >= 9000 da SASI):
   ```bash
   docker compose up -d --build
   docker compose logs -f      # acompanhe o boot (Ctrl+C para sair dos logs)
   ```

4. **Teste localmente no servidor:**
   ```bash
   curl -I http://localhost:9010/      # deve responder 200/307
   ```

5. **Publicar na internet:** envie a *Ficha de Publicação* (abaixo) para o admin (Natan).

### Atualizar depois de mudanças
```bash
cd ~/sasi-ldr-hub && git pull   # (ou rsync de novo)
docker compose up -d --build
```

### Comandos úteis
```bash
docker compose ps               # status
docker compose logs -f          # logs
docker compose down             # parar (os dados ficam no volume ldr-data)
docker system df                # de olho na cota de 15 GB
```

---

## 📋 Ficha de Publicação (enviar ao admin)

```
1.  Nome do projeto:            SASI LDR Hub
2.  Caminho público desejado:   lab-ldr.comserver1.cloud  (SUBDOMÍNIO recomendado)
                                (ou subcaminho /sasi-ldr/ — exige rebuild, ver nota abaixo)
3.  Nome do container:          sasi-ldr-hub
4.  Porta interna:              9010
5.  Protocolo:                  http
6.  Tipo:                       [x] site/app web
7.  Suporta subcaminho (basePath)? [x] sim (precisa rebuild com NEXT_PUBLIC_BASE_PATH)
8.  Faz upload de arquivos grandes? [x] sim -> planilhas CSV/Excel (até ~20 MB)
9.  Público ou restrito?        [x] só com senha (login próprio do sistema)
10. Healthcheck:                /login
11. Observações:                Next.js. Se publicar em subcaminho, avisar para
                                rebuildar a imagem com NEXT_PUBLIC_BASE_PATH=/sasi-ldr.
```

> **Subcaminho x subdomínio:** o mais simples é pedir um **subdomínio** (app roda na raiz `/`,
> sem ajustes). Se for subcaminho (ex.: `/sasi-ldr/`), rebuilde com:
> ```bash
> NEXT_PUBLIC_BASE_PATH=/sasi-ldr docker compose up -d --build
> ```

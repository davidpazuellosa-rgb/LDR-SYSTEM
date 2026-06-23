# Publicação do SASI LDR Hub — para o Natan (admin)

Olá, Natan! O **SASI LDR Hub** já está rodando no VPS, em Docker, na minha conta `sasiteam1`.
Ele responde internamente; falta só a **publicação externa** (rota no nginx ou liberação de porta),
que depende de você. Abaixo a **Ficha de Publicação** preenchida e uma **explicação do sistema**.

---

## 📋 Ficha de Publicação

| # | Campo | Valor |
|---|---|---|
| 1 | **Nome do projeto** | SASI LDR Hub |
| 2 | **Caminho público desejado** | **Subdomínio** (preferido), ex.: `ldr.comserver1.cloud` — ou subcaminho `/sasi-ldr/` |
| 3 | **Nome do container** | `sasi-ldr-hub` (na conta `sasiteam1`) |
| 4 | **Porta interna** | **9010** (container expõe `9010:3000`) → proxyar para `127.0.0.1:9010` |
| 5 | **Protocolo** | `http` (o HTTPS fica com o nginx) |
| 6 | **Tipo** | ☑ site/app web (Next.js) · ☐ API · ☐ WebSocket (**não usa WebSocket**) |
| 7 | **Suporta subcaminho (basePath)?** | ☑ Sim — via build com `NEXT_PUBLIC_BASE_PATH=/sasi-ldr`. **Mas prefiro subdomínio** (roda na raiz, sem complicação de assets) |
| 8 | **Upload de arquivos grandes?** | ☑ Sim, leve — importação de planilhas CSV/Excel. Sugiro `client_max_body_size 25M;` no nginx |
| 9 | **Público ou restrito?** | O app **tem login próprio** (usuário/senha). Pode ser público que a autenticação protege. Se preferir, pode restringir por IP também |
| 10 | **Healthcheck** | `GET /login` responde **200** |
| 11 | **Observações** | Container roda em Docker rootless na conta `sasiteam1`, pasta `~/sasi-ldr-hub`. Banco SQLite em volume Docker (`/data/app.db`). Se for **subcaminho**, eu preciso **rebuildar** a imagem com `NEXT_PUBLIC_BASE_PATH=/sasi-ldr` antes de você apontar a rota — me avise qual caminho você vai usar. Se for **subdomínio**, não preciso mudar nada. |

### Resumo técnico (o que você precisa)
- Proxy reverso de **`ldr.comserver1.cloud`** (ou `/sasi-ldr/`) → **`http://127.0.0.1:9010`**
- HTTPS (certificado) no nginx
- `client_max_body_size 25M;` (uploads de planilha)
- Sem WebSocket, sem necessidade de sticky session

> Exemplo de bloco nginx (subdomínio), só como referência:
> ```nginx
> server {
>   server_name ldr.comserver1.cloud;
>   client_max_body_size 25M;
>   location / {
>     proxy_pass http://127.0.0.1:9010;
>     proxy_set_header Host $host;
>     proxy_set_header X-Forwarded-Proto $scheme;
>     proxy_set_header X-Real-IP $remote_addr;
>   }
> }
> ```

---

## 🧭 O que é o sistema (explicação)

O **SASI LDR Hub** é uma ferramenta **interna do setor comercial** da SASI. Ele serve para
**organizar e "sanear" as bases de prefeituras** (limpar/corrigir dados de contato) **antes** de
trabalhá-las no HubSpot. Não substitui o CRM — é uma **camada operacional** em cima dele.

**O que ele faz:**
- **Bases em formato planilha**: a equipe importa planilhas (CSV/Excel) de prefeituras e edita os
  dados célula a célula, organizadas por **estado (UF)**.
- **Fila de correção de telefones**: telefones marcados como errados (a fase **"Telefone Incorreto"**
  no HubSpot) entram numa fila; o pré-vendedor/vendedor responsável corrige o número.
- **Integração com o HubSpot**: o sistema lê do CRM (campanha, região, fase do ciclo de vida e o
  proprietário do contato) automaticamente, e ao corrigir um telefone, atualiza o contato de volta
  no HubSpot (telefone + fase "Telefone Atualizado").
- **Controle de acesso**: login por usuário/senha, com dois cargos — **Admin** (acesso total) e
  **LDR** (importa e corrige, mas não apaga/exporta nem acessa áreas sensíveis).

**Stack / como está hospedado:**
- App **Next.js** (Node) rodando em **container Docker** na conta `sasiteam1`.
- Banco **SQLite** em arquivo, dentro de um **volume Docker** (persiste entre deploys).
- Porta interna **9010**. Sem dependências externas além do HubSpot (saída HTTPS).
- Uso de recursos leve (ferramenta interna de poucos usuários); cabe tranquilo no sandbox.

**Dados atuais:** ~1.794 prefeituras da campanha "Cidade na Mão 2026" (região Nordeste).

Qualquer dúvida sobre a parte técnica, é só falar. Obrigado! 🙏

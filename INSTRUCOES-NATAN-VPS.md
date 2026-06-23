# Publicar o SASI LDR Hub (instruções para o admin do VPS)

> **Para a IA do Natan:** este documento é uma tarefa de infraestrutura. Você tem `sudo`.
> Objetivo: deixar o **SASI LDR Hub** acessível publicamente via HTTPS. O app **já está rodando**
> dentro do VPS; falta apenas o **proxy reverso (nginx) + certificado**. Não é preciso mexer no
> código nem no container — só publicar. Leia tudo, confirme a decisão da Seção 2 e execute.

---

## 1. Contexto (o que já existe)

- **App:** SASI LDR Hub — ferramenta interna do comercial (Next.js em Docker). Tem **login próprio** (usuário/senha).
- **Onde roda:** container Docker **`sasi-ldr-hub`** na conta **`sasiteam1`** (Docker rootless).
- **Porta interna (no host):** o container publica em **`127.0.0.1:9010`** (→ porta 3000 do app).
  - Confirme: `curl -I http://127.0.0.1:9010/login` deve responder **HTTP 200**.
- **Tipo:** site/app web. **Não usa WebSocket.** Faz **upload de planilhas** (CSV/Excel).
- **Hoje:** acessível só internamente (e via túnel SSH). Falta o proxy público.

## 2. Decisão necessária (escolha UMA antes de executar)

**Opção A — Subdomínio (RECOMENDADA).** Ex.: `ldr.SEU_DOMINIO.com.br`.
O app roda na raiz `/`, sem nenhum ajuste extra. **Mais simples e sem risco de quebrar CSS/JS.**
→ Requer criar um registro **DNS A** apontando o subdomínio para o IP do VPS (`82.29.60.60`).

**Opção B — Subcaminho.** Ex.: `https://SEU_DOMINIO.com.br/sasi-ldr/`.
⚠️ Exige que a **equipe do app rebuilde a imagem** com `NEXT_PUBLIC_BASE_PATH=/sasi-ldr` **antes**
de você publicar (senão o HTML carrega mas imagens/CSS/JS quebram). Se escolher esta opção,
**avise a equipe** e só configure o nginx depois que eles confirmarem o rebuild.

> Se possível, use a **Opção A**. As instruções abaixo cobrem as duas.

## 3. Pré-checagem

```bash
# 1) App respondendo internamente?
curl -I http://127.0.0.1:9010/login        # esperado: HTTP/1.1 200 OK

# 2) nginx instalado?
nginx -v || sudo apt-get update && sudo apt-get install -y nginx

# 3) (Opção A) DNS já propagado para o subdomínio?
dig +short ldr.SEU_DOMINIO.com.br          # deve retornar 82.29.60.60
```

---

## 4A. Publicar via SUBDOMÍNIO (Opção A — recomendada)

Crie o arquivo do site (troque `ldr.SEU_DOMINIO.com.br`):

```bash
sudo tee /etc/nginx/sites-available/sasi-ldr-hub > /dev/null <<'NGINX'
server {
    listen 80;
    server_name ldr.SEU_DOMINIO.com.br;

    # uploads de planilha (CSV/Excel)
    client_max_body_size 25M;

    location / {
        proxy_pass http://127.0.0.1:9010;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;   # a "Varredura" pode levar alguns segundos
    }
}
NGINX

sudo ln -sf /etc/nginx/sites-available/sasi-ldr-hub /etc/nginx/sites-enabled/sasi-ldr-hub
sudo nginx -t && sudo systemctl reload nginx
```

Emita o certificado HTTPS (Let's Encrypt):

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d ldr.SEU_DOMINIO.com.br --redirect -m SEU_EMAIL@dominio.com --agree-tos -n
```

O certbot ajusta o `server` para `443` + redireciona `80→443`. Renovação é automática.

---

## 4B. Publicar via SUBCAMINHO (Opção B — só se a equipe rebuildou com basePath)

Adicione um `location /sasi-ldr/` ao server do domínio principal:

```nginx
# dentro do server { server_name SEU_DOMINIO.com.br; ... } já existente:
location /sasi-ldr/ {
    client_max_body_size 25M;
    proxy_pass http://127.0.0.1:9010/sasi-ldr/;   # mantenha o /sasi-ldr/ no final
    proxy_http_version 1.1;
    proxy_set_header Host              $host;
    proxy_set_header X-Real-IP         $remote_addr;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 120s;
}
```

```bash
sudo nginx -t && sudo systemctl reload nginx
```

> O HTTPS do domínio principal já deve existir. Se não, rode o certbot para `SEU_DOMINIO.com.br`.

---

## 5. Verificação (faça após publicar)

```bash
# Opção A:
curl -I https://ldr.SEU_DOMINIO.com.br/login      # esperado: HTTP/2 200
# Opção B:
curl -I https://SEU_DOMINIO.com.br/sasi-ldr/login # esperado: HTTP/2 200
```

No navegador, a tela de **login** deve abrir com o visual correto (logo SASI, CSS aplicado).
Se na Opção B o layout vier quebrado (sem CSS), o app **não** foi buildado com o basePath —
volte para a equipe (não é problema do nginx).

## 6. Rollback (se precisar desfazer)

```bash
sudo rm -f /etc/nginx/sites-enabled/sasi-ldr-hub
sudo nginx -t && sudo systemctl reload nginx
```

(Opção B: remova o bloco `location /sasi-ldr/` e recarregue.)

---

## 7. Observações importantes

- **Não** é preciso abrir a porta 9010 no firewall — o acesso público entra por **80/443** e o
  nginx faz o proxy para `127.0.0.1:9010`. Mantenha a 9010 fechada para o mundo.
- **Docker rootless:** o container roda na conta `sasiteam1`. O nginx (root) só precisa alcançar
  `127.0.0.1:9010`, o que funciona normalmente. Você **não** precisa parar/alterar o container.
- **Sem WebSocket** e **sem sticky session** — proxy HTTP simples basta.
- **`client_max_body_size 25M`** é importante: sem isso, importar planilhas grandes dá erro 413.
- **`proxy_read_timeout 120s`**: a função de "Varredura" consulta uma IA externa e pode levar
  alguns segundos; o timeout maior evita 504.
- O app tem **autenticação própria**, então pode ficar público com segurança. Se preferir
  restringir por IP, dá pra adicionar `allow/deny` no `location` — opcional.

## 8. O que devolver para a equipe

- A **URL pública final** (ex.: `https://ldr.SEU_DOMINIO.com.br`).
- Confirmação de que `…/login` retorna **200** e abre com CSS ok.

Qualquer dúvida sobre o app em si (porta, container, basePath), falar com o David / a equipe do LDR Hub.

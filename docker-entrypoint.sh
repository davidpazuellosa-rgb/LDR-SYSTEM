#!/bin/sh
set -e
# NAO rodar "prisma db push" nem seed aqui. O banco de producao tem tabelas que o
# schema.prisma nao declara (ex.: ContactFillArquivo, 117 linhas) — o push tenta
# APAGA-LAS e aborta, ou apaga se alguem passar --accept-data-loss. Mudanca de schema
# e decisao deliberada, feita a mao, nunca a cada start do container.
echo "==> Subindo o SASI LDR Hub..."
exec node .next/standalone/server.js

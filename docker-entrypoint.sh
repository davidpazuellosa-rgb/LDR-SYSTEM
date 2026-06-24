#!/bin/sh
set -e

echo "==> Garantindo a pasta de dados..."
mkdir -p /data

echo "==> Criando/atualizando as tabelas do banco (SQLite)..."
npx prisma db push --skip-generate

echo "==> Garantindo usuário admin e dados iniciais..."
npm run db:seed || echo "(seed pulado)"

echo "==> Subindo o SASI LDR Hub..."
exec node .next/standalone/server.js

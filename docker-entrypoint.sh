#!/bin/sh
set -e

echo "==> Criando/atualizando as tabelas do banco (Postgres)..."
npx prisma db push --skip-generate

echo "==> Garantindo usuário admin e dados iniciais..."
npm run db:seed || echo "(seed pulado)"

echo "==> Subindo o SASI LDR Hub..."
exec node .next/standalone/server.js

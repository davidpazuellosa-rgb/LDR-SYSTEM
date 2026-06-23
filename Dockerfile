# ===== SASI LDR Hub — imagem Docker (para o VPS) =====
FROM node:20-alpine

# Tudo roda dentro de /app
WORKDIR /app

# O banco SQLite vive em /data (montado como volume, persiste entre deploys)
ENV DATABASE_URL="file:/data/app.db"
ENV PORT=3000

# basePath (subcaminho no nginx). Vazio = raiz. É build-time, então vem como ARG.
ARG NEXT_PUBLIC_BASE_PATH=""
ENV NEXT_PUBLIC_BASE_PATH=$NEXT_PUBLIC_BASE_PATH

# 1) Instala dependências (cache eficiente)
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci

# 2) Copia o código e gera o cliente Prisma + build de produção
COPY . .
RUN npx prisma generate && npm run build

# 3) Script de inicialização (cria/atualiza tabelas e cria o admin)
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 3000
ENV NODE_ENV=production
CMD ["/docker-entrypoint.sh"]

# Backend Galeriku — image produksi.
# Build context adalah ROOT repo (dibutuhkan pnpm workspace + lockfile di root).
# Contoh build dari root repo:
#   docker build -f backend/Dockerfile -t galeriku-backend:latest .

# ---------- Tahap 1: install dependency workspace ----------
FROM node:24-bookworm-slim AS deps
# openssl juga dibutuhkan DI SINI (bukan hanya di runtime): postinstall
# @prisma/engines mendeteksi libssl saat install untuk mengunduh flavor
# schema-engine yang tepat (debian-openssl-3.0.x). Tanpa ini, yang
# terunduh flavor 1.1.x lalu migrate gagal di runtime yang sudah
# punya openssl 3.0 (butuh download sebagai user node -> EACCES).
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
WORKDIR /app

# Samakan versi pnpm dengan field packageManager di package.json root.
RUN corepack enable && corepack prepare pnpm@12.10.1 --activate

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY backend/package.json ./backend/package.json
COPY packages/contracts/package.json ./packages/contracts/package.json
COPY frontend/package.json ./frontend/package.json
RUN pnpm install --frozen-lockfile

# ---------- Tahap 2: build backend ----------
FROM deps AS build
# Dummy agar evaluasi prisma.config.ts (env DATABASE_URL) tidak gagal saat
# generate/build. Tidak terbawa ke image final (stage terpisah).
ENV DATABASE_URL=postgresql://dummy:dummy@localhost:5432/dummy
COPY backend ./backend
COPY packages/contracts ./packages/contracts
RUN pnpm --filter backend prisma:generate
RUN pnpm --filter backend build
# Kemas backend + dependency production saja ke /prod/backend.
RUN pnpm --filter backend deploy --prod /prod/backend

# ---------- Tahap 3: image runtime ----------
FROM node:24-bookworm-slim AS production
ENV NODE_ENV=production
WORKDIR /app/backend

COPY --from=build /prod/backend ./
# Sisakan dependency production + hasil build (dist).
RUN rm -rf src test \
  && rm -f *.tsbuildinfo \
  && mkdir -p /data/media \
  && chown node:node /data/media

# Prisma membutuhkan libssl yang terdeteksi + CA agar tidak warning
# "failed to detect the libssl/openssl version".
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

USER node
EXPOSE 4000
# Migrasi dijalankan saat container start (pengganti deploy.sh di Coolify).
# Syarat: migrasi harus kompatibel mundur (container lama masih jalan saat
# image baru start). Kegagalan migrasi membuat container keluar dengan kode
# bukan nol (jangan ditutupi): Coolify menandai deploy gagal dan backend
# lama tetap jalan. `exec` wajib agar SIGTERM sampai ke node (shutdown rapi).
# CLI prisma + folder prisma/migrations terbukti ada di image ini
# (prisma dependency production; lihat laporan infra-coolify).
CMD ["sh", "-c", "node ./node_modules/prisma/build/index.js migrate deploy && exec node dist/main.js"]

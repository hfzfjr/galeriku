# syntax=docker/dockerfile:1
# Backend Galeriku — image produksi teroptimasi.
# Build context adalah ROOT repo (dibutuhkan pnpm workspace + lockfile di root).
# Contoh build dari root repo:
#   docker build -f backend/Dockerfile -t galeriku-backend:latest .

# ---------- Tahap 1: install dependency workspace (hanya backend & contracts) ----------
FROM node:24-bookworm-slim AS deps

# Pasang dependency OS dasar (openssl untuk Prisma schema engine) dengan cache apt
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
WORKDIR /app

# Aktifkan pnpm versi monorepo
RUN corepack enable && corepack prepare pnpm@12.10.1 --activate

# Salin manifest workspace & package.json yang diperlukan
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY backend/package.json ./backend/package.json
COPY packages/contracts/package.json ./packages/contracts/package.json
COPY frontend/package.json ./frontend/package.json

# Unduh dan pasang HANYA dependensi backend & paket dependensinya (lewati Next.js/React frontend)
# Menggunakan cache mount pnpm store agar dependency tidak diunduh ulang dari internet jika lockfile sama
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm --filter backend... install --frozen-lockfile

# ---------- Tahap 2: build backend ----------
FROM deps AS build
ENV DATABASE_URL=postgresql://dummy:dummy@localhost:5432/dummy
COPY backend ./backend
COPY packages/contracts ./packages/contracts

RUN pnpm --filter backend prisma:generate
RUN pnpm --filter backend build

# Kemas backend + dependency production saja ke /prod/backend.
RUN pnpm --filter backend deploy --prod /prod/backend

# ---------- Tahap 3: image runtime produksi ----------
FROM node:24-bookworm-slim AS production
ENV NODE_ENV=production
WORKDIR /app/backend

# KRITIS UNTUK KECEPATAN BUILD:
# Pasang seluruh dependensi OS multimedia (ffmpeg, libheif, openssl) DI AWAL tahap runtime.
# Karena berada sebelum salinan kode aplikasi (COPY), layer ini 100% DI-CACHE PERMANEN oleh Docker.
# Perubahan kode aplikasi tidak akan pernah membust atau mendownload ulang paket apt ini lagi!
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates libheif-examples ffmpeg \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /data/media \
    && chown node:node /data/media

# Salin hasil deploy backend yang bersih (tanpa devDependencies dan tanpa frontend)
COPY --from=build --chown=node:node /prod/backend ./

# Hapus sisa source TypeScript dan cache kompilasi
RUN rm -rf src test && rm -f *.tsbuildinfo

USER node
EXPOSE 4000

# Migrasi dijalankan saat container start (pengganti deploy.sh di Coolify).
CMD ["sh", "-c", "node ./node_modules/prisma/build/index.js migrate deploy && exec node dist/main.js"]

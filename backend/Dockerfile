# Backend Galeriku — image produksi.
# Build context adalah ROOT repo (dibutuhkan pnpm workspace + lockfile di root).
# Contoh build dari root repo:
#   docker build -f backend/Dockerfile -t galeriku-backend:latest .

# ---------- Tahap 1: install dependency workspace ----------
FROM node:24-bookworm-slim AS deps
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
WORKDIR /app

# Samakan versi pnpm dengan field packageManager di package.json root.
RUN corepack enable && corepack prepare pnpm@12.10.1 --activate

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json
RUN pnpm install --frozen-lockfile

# ---------- Tahap 2: build backend ----------
FROM deps AS build
COPY backend ./backend
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

USER node
EXPOSE 4000
CMD ["node", "dist/main.js"]

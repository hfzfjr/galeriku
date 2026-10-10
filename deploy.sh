#!/usr/bin/env bash
#
# Deploy Galeriku ke server Debian. Dijalankan DI SERVER, bukan di laptop.
#   ./deploy.sh [--no-pull]
#
# Alur: validasi .env -> (opsional) git pull --ff-only -> tandai image
# previous -> BUILD backend dulu -> up -d -> tunggu healthy -> rollback
# otomatis bila gagal.
set -euo pipefail

# Bisa dijalankan dari direktori mana pun: pindah ke root repo (direktori script ini).
cd "$(dirname "${BASH_SOURCE[0]}")"

COMPOSE_FILE="infrastructure/docker-compose.yml"
ENV_FILE="infrastructure/.env"
SERVICE="backend"
CONTAINER="galeriku-backend"
IMAGE="galeriku-backend"
HEALTH_TIMEOUT=60

NO_PULL=0
if [[ "${1:-}" == "--no-pull" ]]; then
  NO_PULL=1
fi

log() { echo "[deploy] $*"; }
fail() { echo "[deploy] ERROR: $*" >&2; exit 1; }

# a. Pastikan infrastructure/.env ada dan MEDIA_HOST_DIR terisi.
[[ -f "$ENV_FILE" ]] || fail "$ENV_FILE tidak ditemukan. Salin dari infrastructure/.env.example lalu isi nilainya."
# Catatan: nilai .env tidak boleh mengandung '#' atau baris baru.
# shellcheck disable=SC1090
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a
[[ -n "${MEDIA_HOST_DIR:-}" ]] || fail "MEDIA_HOST_DIR kosong di $ENV_FILE. Variabel ini wajib diisi (tanpa default)."
mkdir -p "$MEDIA_HOST_DIR"
log "MEDIA_HOST_DIR=$MEDIA_HOST_DIR"

# b. Ambil kode terbaru (hanya fast-forward).
if [[ "$NO_PULL" -eq 0 ]]; then
  log "git pull --ff-only..."
  git pull --ff-only
else
  log "Lewati git pull (--no-pull)."
fi

# c. Simpan image yang sedang berjalan sebagai previous untuk rollback.
if docker image inspect "$IMAGE:latest" >/dev/null 2>&1; then
  log "Menandai image berjalan sebagai $IMAGE:previous..."
  docker tag "$IMAGE:latest" "$IMAGE:previous"
else
  log "Belum ada image $IMAGE:latest (deploy pertama)."
fi

# d. BUILD DULU: bila gagal, script berhenti di sini dan container lama
# tetap berjalan tak tersentuh.
log "Build image backend..."
docker compose -f "$COMPOSE_FILE" build backend

# Migrasi database (Prisma Migrate), SETELAH build dan SEBELUM container
# baru naik. Catatan: migrasi harus backward-compatible dengan image yang
# sedang berjalan, karena rollback hanya mengembalikan image, bukan skema.
# Pastikan postgres berjalan dan healthy dulu (deploy pertama: belum jalan).
log "Memastikan postgres berjalan..."
docker compose -f "$COMPOSE_FILE" up -d postgres
log "Menunggu galeriku-postgres berstatus healthy..."
pg_healthy=0
for ((i = 0; i < HEALTH_TIMEOUT; i++)); do
  pg_status="$(docker inspect -f '{{.State.Health.Status}}' galeriku-postgres 2>/dev/null || echo starting)"
  if [[ "$pg_status" == "healthy" ]]; then
    pg_healthy=1
    break
  fi
  sleep 1
done
[[ "$pg_healthy" -eq 1 ]] || fail "galeriku-postgres tidak healthy dalam $HEALTH_TIMEOUT detik."
log "Menjalankan migrasi database..."
docker compose -f "$COMPOSE_FILE" run --rm backend node ./node_modules/prisma/build/index.js migrate deploy

# e. Naikkan service (tanpa --force-recreate agar postgres tidak ikut
# dibuat ulang bila konfigurasinya tidak berubah).
log "docker compose up..."
docker compose -f "$COMPOSE_FILE" up -d --remove-orphans

# f. Tunggu backend berstatus healthy (maksimal $HEALTH_TIMEOUT detik).
log "Menunggu $CONTAINER berstatus healthy..."
healthy=0
for ((i = 0; i < HEALTH_TIMEOUT; i++)); do
  status="$(docker inspect -f '{{.State.Health.Status}}' "$CONTAINER" 2>/dev/null || echo starting)"
  if [[ "$status" == "healthy" ]]; then
    healthy=1
    break
  fi
  sleep 1
done

if [[ "$healthy" -ne 1 ]]; then
  echo "[deploy] ERROR: $CONTAINER tidak healthy dalam $HEALTH_TIMEOUT detik. 50 baris log terakhir:" >&2
  docker compose -f "$COMPOSE_FILE" logs --tail 50 "$SERVICE"
  if docker image inspect "$IMAGE:previous" >/dev/null 2>&1; then
    echo "[deploy] Rollback ke image previous..." >&2
    docker tag "$IMAGE:previous" "$IMAGE:latest"
    docker compose -f "$COMPOSE_FILE" up -d --no-build
  else
    echo "[deploy] Tidak ada image previous (deploy pertama); rollback dilewati." >&2
  fi
  exit 1
fi

# g. Bersihkan dangling image dan tampilkan status akhir.
log "Backend healthy. Membersihkan dangling image..."
docker image prune -f
docker compose -f "$COMPOSE_FILE" ps
log "Deploy selesai."

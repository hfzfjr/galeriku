#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Skrip Restore Media Galeriku (US-31)
# Penggunaan: ./restore-media.sh /path/to/galeriku_media_YYYYMMDD_HHMMSS.tar.gz
# ==============================================================================

if [ "$#" -ne 1 ]; then
  echo "Penggunaan: $0 <path_arsip_backup.tar.gz>"
  exit 1
fi

BACKUP_ARCHIVE="$1"
TARGET_DIR="${MEDIA_DIR:-/home/hafiz/galeriku-data/media}"

if [ ! -f "${BACKUP_ARCHIVE}" ]; then
  echo "ERROR: File arsip backup '${BACKUP_ARCHIVE}' tidak ditemukan!" >&2
  exit 1
fi

echo "PERINGATAN: Restore akan mengekstrak file ke ${TARGET_DIR}."
read -p "Apakah Anda yakin ingin melanjutkan? (y/N): " CONFIRM
if [[ "${CONFIRM}" != [yY] && "${CONFIRM}" != [yY][eE][sS] ]]; then
  echo "Restore dibatalkan."
  exit 0
fi

echo "[$(date -Iseconds)] Memulai restore media ke ${TARGET_DIR}..."
mkdir -p "${TARGET_DIR}"

# Ekstrak arsip
tar -xzf "${BACKUP_ARCHIVE}" -C "${TARGET_DIR}"

# Pastikan permission user node (uid 1000)
chown -R 1000:1000 "${TARGET_DIR}"

echo "[$(date -Iseconds)] Restore selesai! Media berhasil dipulihkan ke ${TARGET_DIR}."

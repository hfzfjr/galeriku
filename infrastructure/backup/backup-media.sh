#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Skrip Backup Media Galeriku (US-31)
# Jadwal: cron harian (misal jam 02:00 WIB)
# Retensi: 14 backup terakhir
# Target: Lokasi backup di luar volume utama (mis. hard disk eksternal / NFS / S3 mount)
# ==============================================================================

SOURCE_DIR="${MEDIA_DIR:-/home/hafiz/galeriku-data/media}"
BACKUP_DIR="${BACKUP_DEST:-/home/hafiz/galeriku-backups/media}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/galeriku_media_${TIMESTAMP}.tar.gz"
RETENTION_DAYS=14

echo "[$(date -Iseconds)] Memulai backup media dari ${SOURCE_DIR} ke ${BACKUP_DIR}..."

# Buat folder backup tujuan bila belum ada
mkdir -p "${BACKUP_DIR}"

# Periksa apakah folder sumber ada
if [ ! -d "${SOURCE_DIR}" ]; then
  echo "[$(date -Iseconds)] ERROR: Folder sumber ${SOURCE_DIR} tidak ditemukan!" >&2
  exit 1
fi

# Buat arsip tar.gz
tar -czf "${BACKUP_FILE}" -C "${SOURCE_DIR}" .

echo "[$(date -Iseconds)] Backup berhasil dibuat: ${BACKUP_FILE} ($(du -sh "${BACKUP_FILE}" | cut -f1))"

# Pembersihan retensi 14 hari
echo "[$(date -Iseconds)] Membersihkan backup media yang lebih lama dari ${RETENTION_DAYS} hari..."
find "${BACKUP_DIR}" -name "galeriku_media_*.tar.gz" -type f -mtime +${RETENTION_DAYS} -delete

echo "[$(date -Iseconds)] Backup media selesai."

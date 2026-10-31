#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Skrip Health & Monitoring Host Galeriku (US-34)
# Menjalankan:
# 1. Uptime check frontend & backend API
# 2. Pengecekan sisa disk (< 20% memberi alert)
# 3. Pengecekan status kesehatan drive SMART (smartctl)
# ==============================================================================

FRONTEND_URL="${FRONTEND_URL:-https://galeriku.hafizfajar.com/api/health}"
API_HEALTH_URL="${API_HEALTH_URL:-http://localhost:4000/health}"
ALERT_EMAIL="${ALERT_EMAIL:-admin@hafizfajar.com}"
DISK_MOUNT="${DISK_MOUNT:-/home/hafiz/galeriku-data/media}"
SMART_DEV="${SMART_DEV:-/dev/sda}"

ERRORS=()

# 1. Cek Uptime Frontend
HTTP_FE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "${FRONTEND_URL}" || echo "000")
if [ "${HTTP_FE}" != "200" ]; then
  ERRORS+=("Frontend Uptime GAGAL: ${FRONTEND_URL} mengembalikan HTTP ${HTTP_FE}")
fi

# 2. Cek Uptime Backend API
API_RESP=$(curl -s --max-time 10 "${API_HEALTH_URL}" || echo "")
if [[ "${API_RESP}" != *"\"status\":\"ok\""* ]]; then
  ERRORS+=("Backend API Health GAGAL: ${API_HEALTH_URL} tidak merespons status ok (${API_RESP})")
fi

# 3. Cek Sisa Kapasitas Disk (Peringatan bila < 20% sisa / > 80% terpakai)
if [ -d "${DISK_MOUNT}" ]; then
  USAGE_PERCENT=$(df -P "${DISK_MOUNT}" | awk 'NR==2 {gsub("%",""); print $5}')
  if [ "${USAGE_PERCENT}" -gt 80 ]; then
    ERRORS+=("Peringatan Kapasitas Disk: Disk ${DISK_MOUNT} terpakai ${USAGE_PERCENT}% (sisa < 20%)")
  fi
fi

# 4. Cek SMART status jika smartctl terpasang
if command -v smartctl &> /dev/null && [ -b "${SMART_DEV}" ]; then
  SMART_HEALTH=$(smartctl -H "${SMART_DEV}" | grep -i "test result" || echo "")
  if [[ "${SMART_HEALTH}" != *"PASSED"* ]]; then
    ERRORS+=("Peringatan Hardware SMART: Drive ${SMART_DEV} melaporkan SMART tidak PASSED (${SMART_HEALTH})")
  fi
fi

# Notifikasi bila ditemukan masalah
if [ ${#ERRORS[@]} -gt 0 ]; then
  MESSAGE=$(printf "%s\n" "${ERRORS[@]}")
  echo "[$(date -Iseconds)] ALERT MONITORING TERDETEKSI:"
  echo "${MESSAGE}"
  # Kirim mailx / webhook jika dikonfigurasi
  if command -v mail &> /dev/null; then
    echo "${MESSAGE}" | mail -s "[ALERT] Galeriku Monitoring Bermasalah" "${ALERT_EMAIL}"
  fi
  exit 1
else
  echo "[$(date -Iseconds)] Semua pemeriksaan monitoring OK (Frontend 200, Backend OK, Disk > 20%, SMART PASSED)."
fi


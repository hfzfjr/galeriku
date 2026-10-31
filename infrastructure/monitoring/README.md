# Panduan Uptime Monitoring dan Notifikasi (US-34)

Dokumen ini menjelaskan strategi monitoring ketersediaan (uptime) dan kesehatan infrastruktur Galeriku di lingkungan produksi.

---

## 1. Titik Pantau Uptime Publik (External Monitoring)

Gunakan layanan monitoring eksternal gratis/murah seperti **BetterStack**, **Uptime Kuma**, atau **Cronitor** untuk memantau endpoint publik setiap 1-3 menit:

1. **Frontend Uptime Check**:
   - URL: `https://galeriku.hafizfajar.com/api/health`
   - Ekspektasi: HTTP 200 `{ "status": "ok" }`.
2. **Backend API Health Check**:
   - URL: `https://galeriku-api.hafizfajar.com/health`
   - Ekspektasi: HTTP 200 `{ "status": "ok", "database": "up", "diskFreePercent": ... }`.
   - Alert jika status 503 (database down) atau waktu respons > 3000 ms.

---

## 2. Pengecekan Kapasitas Disk dan Kesehatan SMART (Host Level)

Skrip `infrastructure/monitoring/check-health.sh` memeriksa sisa kapasitas disk lokal dan kesehatan hardware SMART drive setiap jam.

### Setup Cron di Server Debian:
1. Berikan izin eksekusi:
   ```bash
   chmod +x /home/hafiz/galeriku/infrastructure/monitoring/check-health.sh
   ```
2. Pastikan paket `smartmontools` terinstal jika ingin pemantauan drive:
   ```bash
   sudo apt-get install -y smartmontools
   ```
3. Pasang cron job per jam (`crontab -e`):
   ```cron
   # Cek kesehatan Galeriku setiap jam
   0 * * * * /home/hafiz/galeriku/infrastructure/monitoring/check-health.sh >> /var/log/galeriku-health.log 2>&1
   ```

### Ambang Batas Peringatan:
- **Kapasitas Disk**: Peringatan terbit bila sisa disk kurang dari 20% (disk usage > 80%).
- **Disk Guard Backend**: Backend akan otomatis menolak upload baru bila sisa disk bebas di bawah 15 GB (`DISK_GUARD_MIN_FREE_BYTES = 16_106_127_360`) untuk melindungi server dari kehabisan disk.
- **SMART Health**: Peringatan terbit bila status SMART pada `/dev/sda` tidak melaporkan `PASSED` (terdapat *bad sector*, *reallocated sector*, atau *failing attributes*).


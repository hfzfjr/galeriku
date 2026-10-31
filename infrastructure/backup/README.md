# Prosedur Backup dan Restore Galeriku (US-31)

Dokumen ini menjelaskan konfigurasi backup otomatis harian dengan retensi 14 hari serta prosedur restore untuk database PostgreSQL dan media fisik di server produksi.

---

## 1. Backup Otomatis Database PostgreSQL (Bawaan Coolify)

PostgreSQL 16 dijalankan sebagai resource Database terpisah di Coolify.

### Konfigurasi di Dashboard Coolify:
1. Buka dashboard Coolify -> pilih project **Galeriku** -> pilih resource **Database (PostgreSQL)**.
2. Klik menu **Backups** di bilah sisi.
3. Aktifkan **Automated Backups**:
   - **Frequency / Cron**: `0 2 * * *` (Setiap hari jam 02:00 WIB).
   - **Number of backups to keep (Retention)**: `14`.
   - **Destination**: S3 Storage terpisah atau disk di luar volume utama host (`/home/hafiz/galeriku-backups/postgres`).
4. Klik **Save**.
5. Untuk menguji, klik tombol **Backup Now** sekali, pastikan status backup `Success`.

---

## 2. Backup Otomatis File Media Fisik (StorageAdapter)

File foto, video, dan thumbnail disimpan di direktori lokal host `/home/hafiz/galeriku-data/media`.

### Setup Cron di Host Debian Server:
1. Buat direktori tujuan backup di luar volume utama:
   ```bash
   mkdir -p /home/hafiz/galeriku-backups/media
   ```
2. Berikan izin eksekusi pada skrip:
   ```bash
   chmod +x /home/hafiz/galeriku/infrastructure/backup/backup-media.sh
   chmod +x /home/hafiz/galeriku/infrastructure/backup/restore-media.sh
   ```
3. Tambahkan ke cron host (`crontab -e`):
   ```cron
   # Backup media Galeriku setiap hari jam 02:30 WIB (retensi 14 hari)
   30 2 * * * /home/hafiz/galeriku/infrastructure/backup/backup-media.sh >> /var/log/galeriku-backup-media.log 2>&1
   ```

---

## 3. Prosedur Pengujian Restore (Uji Pemulihan Bencana)

### A. Restore Database:
1. Di Coolify dashboard -> Resource Database -> tab **Backups**.
2. Pilih salah satu titik restore yang diinginkan dari daftar riwayat.
3. Klik tombol **Restore**.
4. Restart container backend di Coolify agar koneksi prisma terhubung ulang.

### B. Restore File Media:
1. Jalankan skrip restore dengan menunjuk file arsip yang diinginkan:
   ```bash
   bash /home/hafiz/galeriku/infrastructure/backup/restore-media.sh /home/hafiz/galeriku-backups/media/galeriku_media_20261031_023000.tar.gz
   ```
2. Verifikasi hak akses file media agar kontainer backend tetap bisa membaca dan menulis:
   ```bash
   chown -R 1000:1000 /home/hafiz/galeriku-data/media
   ```
3. Verifikasi dengan membuka galeri web di browser dan memastikan foto/video muncul kembali.

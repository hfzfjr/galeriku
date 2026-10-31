# Panduan Pengujian Manual — Sprint 7: Stabilisasi dan Rilis v1.0

Panduan ini disiapkan untuk pengujian manual fitur-fitur Sprint 7 oleh admin/pengguna, mencakup backup otomatis dan uji restore, pengujian di perangkat nyata (Android Chrome dan iPhone Safari), dokumentasi README & runbook, serta health monitoring dan notifikasi kapasitas disk/SMART.

---

## Prasyarat Pengujian

1. Backend aktif di port 4000 atau di server lokal Coolify (`galeriku-api.hafizfajar.com`).
2. Frontend aktif di port 3000 atau di Vercel (`galeriku.hafizfajar.com`).
3. Akun pengguna dengan hak `ADMIN` (email sesuai `ADMIN_EMAIL`).
4. Smartphone Android (Chrome) dan iPhone (Safari) dengan koneksi internet / seluler.

---

## Skenario 1: Backup Otomatis dan Uji Restore — US-31

### Langkah-langkah:
1. **Pemeriksaan Backup Database:**
   - Masuk ke dashboard Coolify server Anda.
   - Buka resource **Database (PostgreSQL 16)** -> pilih tab **Backups**.
   - Tekan tombol **Backup Now** untuk membuat cadangan langsung.
   - Pastikan backup berhasil dibuat dengan timestamp saat ini.
2. **Pemeriksaan Backup Media Fisik:**
   - Di terminal server host Debian, jalankan skrip backup:
     ```bash
     bash infrastructure/backup/backup-media.sh
     ```
   - Periksa file arsip `.tar.gz` yang dihasilkan di folder tujuan backup.
3. **Uji Simulasi Restore Media:**
   - Jalankan skrip restore ke folder tujuan:
     ```bash
     bash infrastructure/backup/restore-media.sh /path/ke/galeriku_media_YYYYMMDD_HHMMSS.tar.gz
     ```
   - Konfirmasi dengan menekan `y`.
   - Pastikan file diekstrak dan kepemilikan folder diatur ke `chown 1000:1000`.

### Hasil yang Diharapkan:
- File database dan media ter-backup tanpa galat.
- Skrip restore memulihkan arsip dengan integritas utuh dan aplikasi tetap dapat membaca seluruh foto/video.

---

## Skenario 2: Pengujian di Perangkat Nyata (Cross-Device) — US-32

### Langkah-langkah:
1. **Pengujian di HP Android (Chrome):**
   - Buka `https://galeriku.hafizfajar.com` lewat jaringan seluler (4G/5G).
   - Lakukan registrasi atau login akun Google.
   - Unggah foto dan video (coba matikan dan hidupkan koneksi internet di tengah upload untuk menguji resumable).
   - Buka galeri, coba *swipe* foto di viewer layar penuh, dan tes tombol *Bagikan* (pastikan share sheet Android muncul).
2. **Pengujian di iPhone (Safari):**
   - Buka `https://galeriku.hafizfajar.com` di Safari iOS.
   - Pasang aplikasi ke Home Screen via tombol *Share Safari* -> *Add to Home Screen*.
   - Buka aplikasi dari Home Screen (mode standalone PWA).
   - Putar video berdurasi panjang, gerakkan scrubber timeline untuk memastikan pemutaran streaming HTTP Range berfungsi lancar tanpa jeda panjang.
   - Buka tautan publik ber-password dan coba unduh album sebagai ZIP langsung ke aplikasi *Files* di iPhone.

### Hasil yang Diharapkan:
- Tidak ada pergeseran tata letak horizontal (*horizontal scroll*) pada lebar 360 px.
- Area sentuh terasa nyaman (minimal 44 px).
- Layout menyesuaikan safe area *Home Indicator* dan *Dynamic Island* iOS tanpa terpotong.
- Streaming video langsung berputar tanpa mengunduh seluruh berkas ke memori HP.

---

## Skenario 3: Verifikasi Dokumentasi dan Runbook — US-33

### Langkah-langkah:
1. Buka berkas `README.md` di repositori:
   - Periksa kejelasan deskripsi produk, arsitektur monorepo, dan instruksi memulai lokal (*Getting Started*).
2. Buka berkas `docs/RUNBOOK.md`:
   - Baca langkah deployment Vercel dan Coolify.
   - Periksa alur pemulihan bencana (*Disaster Recovery*) dan langkah promosi role Admin.

### Hasil yang Diharapkan:
- Dokumentasi lengkap, jelas, tidak ada tautan rusak, dan mencerminkan konfigurasi aktual aplikasi.

---

## Skenario 4: Monitoring Uptime, Sisa Kapasitas Disk & SMART — US-34

### Langkah-langkah:
1. **Cek Health Endpoint Frontend:**
   - Akses `https://galeriku.hafizfajar.com/api/health` (atau `http://localhost:3000/api/health`).
   - Periksa respons JSON: status `200 OK` dengan payload `{ "status": "ok", "uptime": ..., "timestamp": ... }`.
2. **Cek Health Endpoint Backend:**
   - Akses `https://galeriku-api.hafizfajar.com/health` (atau `http://localhost:4000/health`).
   - Periksa respons JSON: status `200 OK` dengan informasi kesehatan database (`database: "up"`), `diskFreeBytes`, `diskTotalBytes`, dan `diskFreePercent`.
3. **Simulasi Skrip Monitoring Host:**
   - Jalankan skrip monitoring di terminal server:
     ```bash
     bash infrastructure/monitoring/check-health.sh
     ```

### Hasil yang Diharapkan:
- Endpoint health merespons dalam waktu singkat (< 200 ms).
- Backend melaporkan peringatan kapasitas disk (`diskWarning: true`) bila sisa disk di bawah 20%.
- Skrip monitoring host mencetak status kesehatan `OK` untuk frontend, backend API, kapasitas disk, dan status SMART.

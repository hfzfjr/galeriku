# Runbook Operasional Galeriku (v1.0)

Dokumen ini adalah panduan praktis untuk admin dan developer dalam mengelola, men-deploy, memperbarui, dan memelihara sistem Galeriku di lingkungan produksi.

---

## 1. Arsitektur Produksi

```
                         [ Pengguna HP / Web ]
                                   │
              ┌────────────────────┴────────────────────┐
              ▼ (HTTPS)                                 ▼ (HTTPS)
   galeriku.hafizfajar.com                   galeriku-api.hafizfajar.com
   ┌───────────────────────┐                 ┌───────────────────────┐
   │ Vercel (Next.js 16)   │                 │ Cloudflare Tunnel     │
   │ App Router + Tailwind │                 │ (cf-tunnel service)   │
   └───────────────────────┘                 └───────────┬───────────┘
                                                         │
                                             ┌───────────▼───────────┐
                                             │ Debian Server Lokal   │
                                             │ Coolify (Traefik: 80) │
                                             └───────────┬───────────┘
                                                         │
                                             ┌───────────▼───────────┐
                                             │ galeriku-backend      │
                                             │ (NestJS + Fastify)    │
                                             └─────┬───────────┬─────┘
                                                   │           │
                                                   ▼           ▼
                                            [PostgreSQL 16] [Disk Media]
                                            (Coolify DB)   (Volume Host)
```

---

## 2. Deploy dan Konfigurasi Frontend (Vercel)

### Prasyarat:
- Akun Vercel terhubung ke repositori GitHub `hfzfjr/galeriku`.

### Langkah Deploy:
1. Import repositori di Vercel:
   - **Framework Preset**: Next.js
   - **Root Directory**: `frontend`
   - **Node.js Version**: 24.x
   - **Build Command**: `pnpm build`
   - **Install Command**: `pnpm install`
2. Atur Environment Variables di Vercel:
   - `NEXT_PUBLIC_API_URL`: `https://galeriku-api.hafizfajar.com`
   - `NEXT_PUBLIC_CONTACT_EMAIL`: `admin@hafizfajar.com`
3. Domain:
   - Tambahkan domain `galeriku.hafizfajar.com`.
   - Pastikan record DNS di Cloudflare mengarah ke Vercel (CNAME `cname.vercel-dns.com` dengan mode DNS-only / grey-cloud agar sertifikat SSL terbit sempurna).

---

## 3. Deploy dan Konfigurasi Backend (Coolify)

### Prasyarat Host Debian:
1. Buat folder penyimpanan media fisik:
   ```bash
   sudo mkdir -p /home/hafiz/galeriku-data/media
   sudo chown -R 1000:1000 /home/hafiz/galeriku-data/media
   ```
2. Pastikan service Cloudflare Tunnel (`cloudflared`) di host meneruskan rute `galeriku-api.hafizfajar.com` ke port proxy Coolify `http://localhost:80`.

### Langkah di Coolify Dashboard:
1. **Resource Database**:
   - Buat resource **Database** -> **PostgreSQL 16**.
   - Destination: `coolify`.
   - Ambil **Internal URL** koneksi database (misal: `postgresql://postgres:...@...:5432/postgres`).
2. **Resource Backend**:
   - Buat resource **Docker Compose**:
     - Repo: `hfzfjr/galeriku`, branch: `main`.
     - Base Directory: `/infrastructure`.
     - Docker Compose Location: `/docker-compose.yml`.
   - Domain: `http://galeriku-api.hafizfajar.com:4000`.
   - Auto Deploy: Aktif (memicu deploy otomatis saat push ke `main`).
3. **Environment Variables**:
   Isi variabel lingkungan berikut di dashboard Coolify:
   ```env
   DATABASE_URL=postgresql://...
   FRONTEND_ORIGIN=https://galeriku.hafizfajar.com
   ADMIN_EMAIL=admin@hafizfajar.com
   DEFAULT_QUOTA_BYTES=5368709120
   IP_HASH_SECRET=secret_acak_minimal_32_karakter
   TURNSTILE_SECRET_KEY=kunci_rahasia_cloudflare_turnstile
   MAIL_PROVIDER=resend
   MAIL_API_KEY=re_kunci_api_resend_anda
   MAIL_FROM=Galeriku <noreply@send.hafizfajar.com>
   GOOGLE_CLIENT_ID=kunci_oauth_google_anda
   GOOGLE_CLIENT_SECRET=rahasia_oauth_google_anda
   GOOGLE_CALLBACK_URL=https://galeriku-api.hafizfajar.com/auth/google/callback
   MEDIA_HOST_DIR=/home/hafiz/galeriku-data/media
   CONTACT_EMAIL=admin@hafizfajar.com
   ```
4. Tekan tombol **Deploy**.

---

## 4. Pembaruan Aplikasi (Update Workflow)

### Pembaruan Rutin:
1. Lakukan perubahan pada branch fitur terpisah, lakukan pengujian (`pnpm test`, `pnpm test:e2e`, `pnpm build:frontend`, `pnpm build:backend`).
2. Merge ke branch `main` via fast-forward.
3. Push commit ke GitHub:
   - Vercel mendeteksi perubahan di `frontend/**` dan melakukan build & rilis otomatis tanpa downtime.
   - Coolify mendeteksi perubahan via webhook Git (disaring oleh *Watch Paths*) dan menjalankan rebuild container backend serta migrasi database otomatis (`prisma migrate deploy`).

---

## 5. Manajemen Pengguna dan Kuota

1. **Pemberian Hak ADMIN:**
   - Pengguna dengan email yang sama dengan `ADMIN_EMAIL` akan otomatis mendapatkan role `ADMIN` segera setelah emailnya berhasil diverifikasi (melalui OTP atau login Google).
2. **Kelola Pengguna di Dashboard:**
   - Buka `/app/admin` di browser saat login sebagai admin.
   - Admin dapat:
     - Melihat daftar seluruh pengguna dan persentase kuota terpakai.
     - Mengubah kuota penyimpanan per pengguna (misal dari 5 GB ke 20 GB).
     - Menangguhkan (*Suspend*) akun: sesi dicabut seketika, login ditolak, dan seluruh link publik milik akun tersebut dinonaktifkan (404).
     - Mengaktifkan kembali (*Activate*) akun yang ditangguhkan.
     - Menghapus (*Delete*) akun beserta seluruh data foto, video, dan filenya di disk secara permanen.

---

## 6. Prosedur Pemulihan (Disaster Recovery & Restore)

1. **Restore Database:**
   - Buka Coolify -> Resource PostgreSQL -> tab **Backups**.
   - Pilih cadangan yang diinginkan -> klik **Restore**.
2. **Restore Media:**
   - Jalankan skrip pemulihan media:
     ```bash
     bash /home/hafiz/galeriku/infrastructure/backup/restore-media.sh /home/hafiz/galeriku-backups/media/galeriku_media_YYYYMMDD_HHMMSS.tar.gz
     ```
   - Pastikan kepemilikan folder media:
     ```bash
     sudo chown -R 1000:1000 /home/hafiz/galeriku-data/media
     ```
3. Restart container backend di Coolify.

# Galeriku

> Ruang simpan pribadi untuk foto dan videomu. Bagikan momen penting lewat satu tautan publik yang cepat, aman, dan elegan.

Galeriku adalah aplikasi *personal cloud storage* yang dirancang *mobile-first* dengan estetika editorial hangat. Pengguna dapat mengunggah foto dan video berukuran besar secara *resumable* dari HP, mengelompokkannya ke dalam album, dan membagikannya ke keluarga atau kerabat melalui tautan publik yang dapat dibuka langsung tanpa perlu membuat akun.

---

## ✨ Fitur Utama

- 📱 **Mobile-First & PWA**: Dirancang presisi untuk layar HP (360×800), safe-area insets, *Add to Home Screen*, dan integrasi Web Share sheet asli.
- 🚀 **Resumable Upload (tus protocol)**: Upload foto & video (hingga gigabyte) chunk demi chunk (5 MB); otomatis melanjutkan upload bila koneksi terputus tanpa mulai dari awal.
- 🔒 **Keamanan & Otorisasi Ketat**:
  - Autentikasi sesi berbasis cookie `HttpOnly; Secure; SameSite=Lax` pada host API.
  - Opsi tautan publik dengan masa berlaku (1 hari, 7 hari, 30 hari, selamanya), proteksi kata sandi (argon2id), dan toggle izin unduh.
  - Pencabutan tautan publik seketika.
  - Default-deny otorisasi di seluruh endpoint privat backend (matriks auth otomatis).
  - Rate limiting pintar pada registrasi, login, dan percobaan buka sandi.
  - Kebijakan privasi IDOR: akses ke konten milik akun lain menjawab 404 identik dengan konten tidak ada.
- 🖼️ **Galeri & Viewer Halus**:
  - Grid galeri foto dengan infinite scroll dan seleksi multi-berkas.
  - Fullscreen viewer dengan gesture swipe horizontal, swipe down to close, dan pinch-to-zoom.
  - Streaming video berbasis HTTP Range (RFC 7233) tanpa unduhan penuh di awal.
  - Unduh seluruh isi album sebagai file ZIP secara *streaming* langsung tanpa membebani disk atau CPU server.
- 👥 **Kelola Pengguna & Kuota**: Dashboard admin untuk mengatur kuota per pengguna, suspend/aktivasi akun, dan pemantauan kapasitas penyimpanan.

---

## 🏗️ Arsitektur Teknologi

- **Frontend**: Next.js 16 (App Router, React 19, TypeScript, Tailwind CSS, TanStack Query). Dihosting di **Vercel** (`galeriku.hafizfajar.com`).
- **Backend**: NestJS 12 dengan Fastify adapter, Prisma ORM, PostgreSQL 16. Dihosting di **Debian Server Lokal** via **Coolify** dan **Cloudflare Tunnel** (`galeriku-api.hafizfajar.com`).
- **Storage**: Media fisik disimpan di disk lokal server host di balik `StorageAdapter`, terisolasi dari filesystem web publik.
- **Shared Contracts**: Paket `@galeriku/contracts` berisi skema validasi Zod dan TypeScript types bersama.

---

## 🚀 Memulai Pengembangan Lokal

### Prasyarat
- Node.js LTS (24.x)
- pnpm (>= 9.x)
- Docker & Docker Compose (untuk database PostgreSQL lokal)

### Instalasi & Menjalankan Aplikasi
```bash
# 1. Klon repositori dan install dependency
git clone https://github.com/hfzfjr/galeriku.git
cd galeriku
pnpm install

# 2. Siapkan file konfigurasi lingkungan
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local

# 3. Jalankan database PostgreSQL lokal
docker compose -f infrastructure/docker-compose.dev.yml up -d

# 4. Jalankan migrasi database
pnpm --filter backend prisma:generate
pnpm --filter backend migrate:dev

# 5. Jalankan backend dan frontend secara bersamaan
pnpm dev:backend   # Berjalan di port 4000
pnpm dev:frontend  # Berjalan di port 3000
```

### Menjalankan Pengujian
```bash
# Unit test backend
pnpm --filter backend test

# End-to-end (E2E) test backend
pnpm --filter backend test:e2e

# Linting kode
pnpm --filter backend lint
pnpm --filter frontend lint

# Build produksi
pnpm build:backend
pnpm build:frontend
```

---

## 📖 Dokumentasi Lengkap

- [Spesifikasi Kebutuhan Produk (PRD)](./docs/PRD.md)
- [Panduan Desain Visual & Token UI](./docs/DESIGN.md)
- [Runbook Operasional Produksi](./docs/RUNBOOK.md)
- [Prosedur Backup & Restore](./infrastructure/backup/README.md)
- [Matriks Pengujian Perangkat Nyata Android & iOS](./docs/DEVICE-TESTING.md)
- [Panduan Pengujian Manual Sprint](./docs/testing/)

---

## 📄 Lisensi
Hak Cipta © 2026 Hafiz Fajar Ramadhan. Seluruh hak cipta dilindungi undang-undang.

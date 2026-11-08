# PROGRESS — Galeriku

Daftar centang story per sprint. ID dan judul persis seperti `docs/PRD.md` §12.4.
Aturan: centang pada commit terakhir story tersebut.

## Sprint 0 — Fondasi Infrastruktur

- [x] US-01 Sebagai developer, saya ingin monorepo yang rapi
- [x] US-02 Sebagai admin, saya ingin Docker Compose di server lokal
- [x] US-03 Sebagai admin, saya ingin tunnel dan CORS yang benar
- [x] US-04 Sebagai developer, saya ingin frontend ter-deploy ke Vercel
- [x] US-05 Sebagai developer, saya ingin skema database awal
- [x] US-06 Sebagai admin, saya ingin health check

Catatan carry-over: pesan fallback "Galeriku lagi istirahat" dikerjakan di US-10 (Sprint 2) karena landing statis tidak memanggil API.

## Sprint 1 — UI Dasar, Landing Page, Login, dan Verifikasi Email

- [x] US-07 Sebagai pengguna HP, saya ingin tampilan yang konsisten dan nyaman
- [x] US-08 Sebagai pengunjung, saya ingin landing page Galeriku di root domain
- [x] US-09 Sebagai pengguna, saya ingin mendaftar dan login dengan email + password
- [x] US-09b Sebagai pengguna, saya ingin verifikasi email dan lupa password

## Sprint 2 — Layar Auth, Google Login, dan Kelola Pengguna

- [x] US-10 Sebagai pengguna, saya ingin halaman login dan registrasi
- [x] US-11 Sebagai pengguna, saya ingin login dengan Google
- [x] US-12 Sebagai admin, saya ingin mengelola pengguna dan kuota
- [x] US-13 Sebagai admin, saya ingin akses yang terkunci di backend

Sprint 2 selesai; catatan penutupan dikerjakan di branch sprint-2-penutupan.
Catatan penutupan: deploy backend kini lewat Coolify (deploy.sh dihapus).
Catatan penutupan: auto-deploy dan Watch Paths Coolify aktif; Google OAuth sudah Publish app (In production); Postgres dipisah menjadi resource Database Coolify dengan backup harian 03:00 UTC, retensi 14 backup; risiko Cloudflare dicatat di PRD.

## Sprint 3 — Upload dan Penyimpanan

Catatan carry-over: hapus pengguna (US-12) hanya menghapus baris database; file fisik di disk wajib ikut dihapus saat hapus pengguna (US-17).

- [x] US-16 Spike: tus di dalam NestJS
- [x] US-17 Sebagai pengguna, saya ingin upload banyak file sekaligus yang bisa dilanjutkan
- [x] US-18 Sebagai admin, saya ingin validasi, kuota, dan disk guard
- [x] US-19 Sebagai pengguna, saya ingin thumbnail foto

## Sprint 4 — Galeri dan Viewer

- [x] US-20 Sebagai pengguna, saya ingin grid galeri
- [x] US-21 Sebagai pengguna, saya ingin viewer layar penuh
- [x] US-22 Sebagai pengguna, saya ingin mengunduh dan menghapus file sendiri
- [x] US-15 Sebagai pengguna, saya ingin halaman profil dan pengaturan

## Sprint 5 — Album dan Link Publik Inti

Catatan carry-over: link publik hanya berfungsi bila pemilik berstatus ACTIVE (aturan baca US-25); US-12 tidak menandai revoked_at saat menangguhkan.

- [x] US-23 Sebagai pengguna, saya ingin membuat album
- [x] US-24 Sebagai pengguna, saya ingin membuat link publik
- [x] US-25 Sebagai penerima, saya ingin membuka dan mengunduh tanpa login

## Sprint 6 — Opsi Berbagi dan Pengerasan

- [x] US-26 Sebagai pengguna, saya ingin mengatur opsi link
- [x] US-27 Sebagai pengguna, saya ingin mengelola dan mencabut link
- [x] US-28 Sebagai penerima, saya ingin mengunduh album sebagai ZIP
- [x] US-29 Sebagai admin, saya ingin rate limit dan header keamanan
- [x] US-30 Sebagai pengguna HP, saya ingin PWA dan Web Share

## Sprint 7 — Stabilisasi dan Rilis v1.0

- [x] US-31 Sebagai admin, saya ingin backup otomatis
- [x] US-32 Sebagai admin, saya ingin pengujian di perangkat nyata
- [x] US-33 Sebagai admin, saya ingin dokumentasi
- [x] US-34 Sebagai admin, saya ingin monitoring

_Catatan: US-14 dihapus, digabung ke US-09/10/11._

## Refactor v1.1 — Metadata, Live Foto, Berbagi, dan Album Bersarang

### Fase 0 — Dokumen dan Hotfix
- [x] RF-00 Amandemen dokumen
- [x] RF-01 Hotfix hapus permanen, sampul album, retensi sampah
- [x] RF-02 Hotfix unduhan, ZIP64, fallback video
- [x] RF-03 Hotfix link publik: unlock, hitungan view, link yatim, album service

### Fase 1 — Fondasi Metadata
- [x] RF-10 Skema dan ekstraksi metadata saat upload
- [x] RF-11 Preview 2048 px dan pipeline HEIC
- [x] RF-12 Urutan dan pengelompokan berdasarkan captured_at
- [x] RF-13 MediaViewer terpadu
- [x] RF-14 Panel Info
- [x] RF-15 Backfill file lama
- [x] RF-16 Nama tempat offline

### Fase 2 — Berbagi yang Matang
- [x] RF-20 Halaman publik SSR dan preview OG
- [x] RF-21 allowDownload yang nyata, toggle lokasi, pembersihan GPS
- [x] RF-22 Default kedaluwarsa album tanpa batas
- [x] RF-23 Unduhan ramah HP dan "Baru ditambahkan"

### Fase 3 — Live Photo, Motion Photo, dan Video
- [x] RF-30 Spike Live Photo di iPhone asli
- [x] RF-31 Motion Photo Android
- [x] RF-32 Pairing Live Photo iOS
- [x] RF-33 Tampilan Live
- [x] RF-34 Metadata dan poster video (US-35 dimajukan)

### Fase 4 — Sortir, Filter, dan Aksi Massal
- [x] RF-40 API daftar: sortir, filter, pencarian
- [x] RF-41 Timeline dan loncat waktu
- [x] RF-42 Filter bar dan sheet urutan
- [x] RF-43 Seleksi, aksi massal, picker album
- [x] RF-44 ZIP milik pemilik
- [x] RF-45 Deteksi duplikat

### Fase 5 — Album Bersarang
- [x] RF-50 Skema dan API album bersarang
- [x] RF-51 UI album bersarang
- [x] RF-52 Berbagi subtree, halaman publik, dan ZIP berstruktur

## Fase 2 — Pemrosesan Video Lanjutan (Backlog v2.0)

- [ ] US-36 Sebagai developer, saya ingin antrian job
- [ ] US-37 Sebagai pengguna, saya ingin video dikompres agar hemat disk dan kuota penerima
- [ ] US-38 Sebagai pengguna, saya ingin melihat status pemrosesan
- [ ] US-39 Sebagai pengguna, saya ingin opsi menghapus file asli setelah transcode

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
- [ ] US-17 Sebagai pengguna, saya ingin upload banyak file sekaligus yang bisa dilanjutkan
- [ ] US-18 Sebagai admin, saya ingin validasi, kuota, dan disk guard
- [ ] US-19 Sebagai pengguna, saya ingin thumbnail foto

## Sprint 4 — Galeri dan Viewer

- [ ] US-20 Sebagai pengguna, saya ingin grid galeri
- [ ] US-21 Sebagai pengguna, saya ingin viewer layar penuh
- [ ] US-22 Sebagai pengguna, saya ingin mengunduh dan menghapus file sendiri
- [ ] US-15 Sebagai pengguna, saya ingin halaman profil dan pengaturan

## Sprint 5 — Album dan Link Publik Inti

Catatan carry-over: link publik hanya berfungsi bila pemilik berstatus ACTIVE (aturan baca US-25); US-12 tidak menandai revoked_at saat menangguhkan.

- [ ] US-23 Sebagai pengguna, saya ingin membuat album
- [ ] US-24 Sebagai pengguna, saya ingin membuat link publik
- [ ] US-25 Sebagai penerima, saya ingin membuka dan mengunduh tanpa login

## Sprint 6 — Opsi Berbagi dan Pengerasan

- [ ] US-26 Sebagai pengguna, saya ingin mengatur opsi link
- [ ] US-27 Sebagai pengguna, saya ingin mengelola dan mencabut link
- [ ] US-28 Sebagai penerima, saya ingin mengunduh album sebagai ZIP
- [ ] US-29 Sebagai admin, saya ingin rate limit dan header keamanan
- [ ] US-30 Sebagai pengguna HP, saya ingin PWA dan Web Share

## Sprint 7 — Stabilisasi dan Rilis v1.0

- [ ] US-31 Sebagai admin, saya ingin backup otomatis
- [ ] US-32 Sebagai admin, saya ingin pengujian di perangkat nyata
- [ ] US-33 Sebagai admin, saya ingin dokumentasi
- [ ] US-34 Sebagai admin, saya ingin monitoring

_Catatan: US-14 dihapus, digabung ke US-09/10/11._

## Fase 2 — Pemrosesan Video

- [ ] US-35 Sebagai pengguna, saya ingin poster dan metadata video
- [ ] US-36 Sebagai developer, saya ingin antrian job
- [ ] US-37 Sebagai pengguna, saya ingin video dikompres agar hemat disk dan kuota penerima
- [ ] US-38 Sebagai pengguna, saya ingin melihat status pemrosesan
- [ ] US-39 Sebagai pengguna, saya ingin opsi menghapus file asli setelah transcode

# PRD — Galeriku: Aplikasi Cloud Storage Pribadi (Berbagi Foto & Video)

Versi 1.2 · 11 Oktober 2026 · Product Owner & Developer: Hafiz · Status: Draft siap dikerjakan

## 1. Ringkasan

Galeriku adalah aplikasi web untuk menyimpan foto dan video, lalu membagikannya ke teman lewat link publik tanpa bergantung pada kuota Google Drive. Frontend (Next.js) di-deploy ke Vercel pada galeriku.hafizfajar.com (subdomain sementara dari domain pribadi), sedangkan backend (NestJS) dan database PostgreSQL berjalan di server lokal (Debian 13) sebagai container Docker terpisah, diakses lewat Cloudflare Tunnel pada galeriku-api.hafizfajar.com. Mayoritas pengguna membuka aplikasi dari HP, sehingga desain mobile-first menjadi syarat utama. Halaman root domain berupa landing page publik, sedangkan area aplikasi berada di balik login. Tanpa login, pengunjung hanya dapat membuka dan mengunduh dari link publik; upload dan file pribadi hanya tersedia setelah login.

Skala: pribadi dengan registrasi terbuka. Siapa pun boleh mendaftar dan memakai aplikasi. Penerima link tidak perlu punya akun.

## 2. Latar Belakang dan Masalah

- Google Drive gratis (15 GB) cepat penuh oleh foto dan video perjalanan.
- Mengirim lewat aplikasi chat menurunkan kualitas dan menyulitkan untuk video besar.
- Kebutuhan inti: pilih banyak file dari HP, buat satu link, kirim ke teman, teman langsung membuka tanpa login.

## 3. Tujuan, Non-Tujuan, dan Indikator Keberhasilan

**Tujuan v1.0**

- Landing page publik di root domain yang memperkenalkan Galeriku dan mengarahkan pengunjung ke halaman masuk.
- Registrasi terbuka (email + password atau Google) dengan verifikasi email dan perlindungan antispam (Turnstile, rate limit).
- Aturan akses ditegakkan di backend: tanpa login hanya boleh membuka dan mengunduh dari link publik; upload, galeri pribadi, dan pengelolaan link hanya setelah login.
- Upload foto/video dari HP yang tahan koneksi tidak stabil (resumable).
- Galeri dan album yang nyaman di layar kecil.
- Link publik untuk file atau album, dengan opsi kedaluwarsa, password, dan izin unduh.
- Berjalan stabil di server lokal dengan sumber daya terbatas.

**Non-tujuan v1.0**

- Pemrosesan video (kompresi/transcode) dicatat sebagai Fase 2.
- Folder bersarang, tempat sampah (trash), komentar, kolaborasi real-time, aplikasi native, enkripsi end-to-end.

**Indikator keberhasilan**

| Indikator | Target |
| --- | --- |
| Upload video 500 MB lewat jaringan seluler | Selesai, dan dapat dilanjutkan setelah koneksi putus |
| Galeri (24 item pertama) | Tampil < 3 detik di 4G |
| Link publik | Terbuka di Chrome Android dan Safari iOS tanpa login |
| Pemakaian RAM seluruh stack | < 3 GB pada kondisi normal |
| Keamanan akses | Tidak ada file yang bisa diakses tanpa sesi login atau token link yang valid |

## 4. Pengguna

| Peran | Deskripsi |
| --- | --- |
| ADMIN | Admin situs. Mengelola pengguna, kuota, dan semua tautan. |
| USER | Pengguna terdaftar. Login dengan email + password atau Google, upload, buat album dan link, serta mengunduh file sendiri maupun dari link publik orang lain. |
| Penerima (viewer) | Siapa pun yang memegang link. Tanpa login, sebagian besar dari HP. Dapat membuka dan mengunduh, tidak dapat upload. |

**Matriks akses.** Aturan ini ditegakkan di backend pada setiap request. Menyembunyikan tombol di frontend hanya untuk kenyamanan, bukan pengamanan.

| Aksi | Tanpa login | USER/ADMIN login |
| --- | --- | --- |
| Membuka link publik | Ya | Ya |
| Mengunduh foto/video dari link publik (izin unduh aktif secara default) | Ya | Ya |
| Upload foto/video | Tidak | Ya |
| Melihat dan mengunduh file sendiri | Tidak | Ya |
| Membuat album dan link publik | Tidak | Ya |
| Mengelola pengguna dan kuota | Tidak | ADMIN saja |

## 5. Kelayakan Teknis (Perangkat Server)

**Kesimpulan: layak untuk skala pribadi**, selama video tidak diproses di server pada v1.0 dan penggunaan disk dijaga.

| Komponen | Spesifikasi | Penilaian |
| --- | --- | --- |
| CPU | Core i3-7020U (2 core / 4 thread, 15 W) | Cukup untuk web app, Postgres, dan thumbnail foto. Lemah untuk transcode video (lihat Fase 2). |
| RAM | 12 GB LPDDR4 | Lebih dari cukup. Sisa RAM dipakai sebagai page cache sehingga membantu HDD. |
| Disk | HDD 2,5 inch 320 GB, sisa sekitar 54% (± 173 GB) | Cukup. Latensi acak HDD lambat, jadi galeri wajib memakai thumbnail kecil. Tidak ada redundansi. |
| Jaringan | Cloudflare Tunnel untuk host API (galeriku-api.hafizfajar.com), tanpa port terbuka | Aman dari sisi eksposur. Kecepatan download ISP rumah membatasi upload ke server, sedangkan kecepatan upload ISP rumah membatasi unduhan penerima. |

**Anggaran sumber daya**

| Komponen | Estimasi RAM |
| --- | --- |
| cloudflared (layanan host `cf-tunnel`, di luar Compose) | ± 50 MB |
| PostgreSQL | 300–600 MB |
| NestJS (backend) | 150–300 MB |
| OS + Docker | ± 1 GB |
| **Total** | **< 2,5 GB** (frontend berjalan di Vercel; sisa RAM menjadi page cache) |

**Anggaran disk**

- Batas pemakaian media: ± 120 GB (menyisakan ruang untuk OS, database, dan log).
- Kuota default akun baru: 5 GB (env DEFAULT_QUOTA_BYTES=5368709120, dapat diubah admin per pengguna). Kuota adalah batas, bukan reservasi; disk guard global tetap berlaku di atas kuota.
- Disk guard: upload ditolak otomatis jika sisa disk < 15 GB.
- Mount volume media dengan opsi `noatime` untuk mengurangi beban tulis HDD.

## 6. Ruang Lingkup Fitur (MoSCoW)

| ID | Fitur | Prioritas | Sprint |
| --- | --- | --- | --- |
| FR-00 | Landing page publik di root domain dengan tombol masuk | Must | 1 |
| FR-01 | Registrasi terbuka dan login dengan email + password | Must | 1 |
| FR-02 | Registrasi dan login dengan Google, satu email satu akun | Must | 2 |
| FR-03 | Peran (USER/ADMIN), status akun, dan kelola pengguna | Must | 2 |
| FR-04 | Proteksi akses di backend (sesi, guard, kepemilikan) | Must | 1–2 |
| FR-05 | Upload resumable, multi-file, dengan progress | Must | 3 |
| FR-06 | Validasi file, kuota, dan disk guard | Must | 3 |
| FR-07 | Thumbnail foto | Must | 3 |
| FR-08 | Galeri grid dengan infinite scroll | Must | 4 |
| FR-09 | Viewer foto (swipe, zoom) dan pemutar video (streaming) | Must | 4 |
| FR-10 | Hapus file dan unduh file sendiri | Must | 4 |
| FR-11 | Album | Must | 5 |
| FR-12 | Link publik untuk file/album | Must | 5 |
| FR-13 | Halaman publik mobile-first tanpa login, dengan unduhan | Must | 5 |
| FR-14 | Opsi link: kedaluwarsa, password, izin unduh | Should | 6 |
| FR-15 | Kelola dan cabut link | Should | 6 |
| FR-16 | Unduh album sebagai ZIP | Should | 6 |
| FR-17 | PWA dan Web Share API | Should | 6 |
| FR-18 | Backup dan monitoring | Must | 7 |
| FR-19 | Poster/thumbnail video dan metadata (ffprobe) | Could | Fase 2 |
| FR-20 | Transcode video ke 720p | Could | Fase 2 |
| FR-21 | Folder bersarang dan trash | Won't (v1.0) | Backlog |
| FR-22 | Dashboard pemakaian storage | Could | Backlog |
| FR-23 | Hapus metadata lokasi (EXIF GPS) dari file yang dibagikan | Could | Backlog |
| FR-24 | Verifikasi email (OTP) dan lupa password | Must | 1 |

## 7. Kebutuhan Non-Fungsional

- **Mobile-first:** desain dasar 360 px, tombol dan area sentuh minimal 44 px, tanpa hover-only interaction.
- **Kompatibilitas:** Chrome Android dan Safari iOS versi 2 tahun terakhir; desktop sebagai pendukung.
- **Performa:** thumbnail WebP ± 400 px, lazy loading, streaming video dengan HTTP Range.
- **Ketersediaan:** best effort (server rumah). Semua container `restart: unless-stopped` dan pulih otomatis setelah reboot. Frontend di Vercel tetap tampil saat server mati dan menampilkan pesan layanan tidak tersedia.
- **Keamanan dan privasi:** lihat bagian 11.
- **Pemeliharaan:** migrasi database terversi, konfigurasi lewat environment variable, dokumentasi runbook.

## 8. Arsitektur dan Tech Stack

```text
HP / Browser
  |
  |-- halaman web (HTML/JS) ----> Vercel: galeriku.hafizfajar.com (Next.js)
  |
  '-- API, upload, unduh, streaming (langsung, tidak lewat Vercel)
        --HTTPS--> Cloudflare --Tunnel--> cloudflared (layanan host "cf-tunnel")
                                              |
                        host API: galeriku-api.hafizfajar.com -> http://localhost:4000
                                              |
                       backend NestJS (Docker, 127.0.0.1:4000) ---> PostgreSQL (Docker)
                                              |
                       Volume /data/media (HDD)
```

| Lapisan | Pilihan |  |
| --- | --- | --- |
| Monorepo | pnpm workspaces: frontend, backend, packages (opsional), infrastructure |  |
| Frontend | Next.js (App Router, TypeScript), Tailwind CSS, shadcn/ui, TanStack Query; di-deploy ke Vercel |  |
| Viewer foto | PhotoSwipe atau yet-another-react-lightbox (swipe dan pinch-zoom) |  |
| Backend | NestJS (adapter Fastify) dalam container Docker; modul auth, files, albums, shares, uploads |  |
| Autentikasi | Dikelola backend NestJS: sesi di PostgreSQL (cookie HttpOnly), email + password (argon2id), dan Google OAuth (Passport) |  |
| Database | PostgreSQL, Prisma ORM, Prisma Migrate untuk migrasi |  |
| Upload | Protokol tus: klien `tus-js-client`/Uppy, server `@tus/server di dalam NestJS` dengan hook penyimpanan metadata ke database |  |
| Media | `sharp` untuk thumbnail WebP; Fase 2: ffmpeg/ffprobe |  |
| Antrian job | Fase 2: pg-boss (memakai PostgreSQL, tanpa Redis) |  |
| Infrastruktur | Docker Compose (backend, postgres) di Debian 13; tunnel Cloudflare sebagai layanan host; frontend di Vercel |  |
| Backup/monitoring | `pg_dump` terjadwal, restic/rclone, smartmontools, Uptime Kuma |  |

**Keputusan arsitektur**

- **AD-1 Monorepo pnpm workspaces.** Folder `frontend/` (Next.js), `backend/` (NestJS), `packages/` (opsional, untuk skema bersama), dan `infrastructure/` (Docker Compose, skrip deploy, backup). Tunnel `cf-tunnel` dikelola di host, bukan dari repo.
- **AD-2 Frontend di Vercel, backend dan database di server lokal.** Container di server: `backend` dan `postgres` saja. Tunnel Cloudflare (`cf-tunnel`) jalan sebagai layanan host (bukan container Compose) dengan route `galeriku-api.hafizfajar.com` -> `http://localhost:4000`; backend hanya dipublish di loopback. Frontend tetap tampil saat server mati dan menampilkan pesan layanan tidak tersedia.
- **AD-3 Byte file tidak melewati Vercel.** Body request dan response Vercel Functions dibatasi 4,5 MB, sehingga browser upload, unduh, dan streaming langsung ke host API. Next.js hanya merender UI.
- **AD-4 Auth sepenuhnya di backend.** Sesi server-side di PostgreSQL dengan cookie HttpOnly, Secure, SameSite=Lax di host API. Frontend dan API sama-sama di `hafizfajar.com` (same-site), sehingga cookie ikut terkirim untuk fetch, gambar, video, dan link unduh. Token tidak pernah dipegang JavaScript. CORS hanya mengizinkan origin frontend, dan request yang mengubah data memeriksa header Origin. Halaman privat dirender di sisi klien.
- **AD-5 Host API satu tingkat di bawah domain** (`galeriku-api.hafizfajar.com`), karena sertifikat Universal SSL Cloudflare hanya mencakup root dan subdomain tingkat pertama.
- **AD-6 File disimpan di filesystem, bukan MinIO.** Skala kecil dan RAM terbatas. Akses lewat lapisan `StorageAdapter` agar bisa dipindah ke MinIO/S3 kelak.
- **AD-7 Upload memakai tus dengan chunk 5 MB** (`@tus/server` di dalam NestJS). Cloudflare membatasi body request sekitar 100 MB dan jaringan seluler sering putus.
- **AD-8 Penerima link tidak perlu login.** Aturan akses ditegakkan di backend pada setiap request, bukan di frontend.
- **AD-9 Tanpa Redis.** Antrian job (Fase 2) memakai pg-boss di PostgreSQL.
- **AD-10 Alamat dasar dibaca dari environment variable** (`NEXT_PUBLIC_API_URL`, `FRONTEND_ORIGIN`), karena domain bersifat sementara.

## 9. Model Data

| Tabel | Kolom penting |
| --- | --- |
| users | id, email (unik), email\_verified\_at (null = belum verifikasi), name, avatar\_url, password\_hash (opsional), google\_sub (opsional, unik), role (USER/ADMIN), status (ACTIVE/SUSPENDED), quota\_bytes, created\_at, last\_login\_at |
| sessions | id (hash token sesi), user\_id, expires\_at, created\_at, ip\_hash, user\_agent |
| ~~allowed\_emails~~ | DIHAPUS di migrasi US-09 (registrasi terbuka tidak memakai allowlist) |
| files | id, owner\_id, original\_name, storage\_key (UUID), mime\_type, size\_bytes, kind (image/video), width, height, duration\_s, thumb\_key, status (uploading/ready/failed), taken\_at, created\_at, deleted\_at |
| albums | id, owner\_id, title, cover\_file\_id, created\_at |
| album\_files | album\_id, file\_id, position, added\_at |
| share\_links | id, token (unik), owner\_id, target\_type (file/album), target\_id, expires\_at, password\_hash, allow\_download (default aktif), view\_count, revoked\_at, created\_at |
| share\_access\_logs | id, link\_id, accessed\_at, ip\_hash, user\_agent (opsional) |
| email\_codes (baru di migrasi US-09) | id, email, jenis (VERIFY\_EMAIL/RESET\_PASSWORD), code\_hash, expires\_at, attempts, last\_sent\_at |

Indeks yang disarankan: `files(owner_id, created_at DESC)`, `share_links(token)`, `album_files(album_id, position)`.

**Kepemilikan dan berbagi.** Pembuat file/album adalah pemilik lewat `owner_id`. Membagikan link TIDAK mengubah role siapa pun: `share_links` adalah capability baca anonim untuk satu target — penerima boleh melihat/mengunduh bila diizinkan, tidak pernah upload/ubah/hapus.

**Catatan migrasi US-09** (skema saat ini belum berubah): nilai enum `role` `owner/member` menjadi `USER/ADMIN`; kolom baru `users.email_verified_at`, `users.status`, dan tabel `email_codes`; tabel `allowed_emails` dihapus.

## 10. Rute dan Endpoint

| Lapisan | Rute / endpoint | Fungsi | Akses |
| --- | --- | --- | --- |
| Frontend | `/` | Landing page Galeriku: pengenalan singkat dan tombol Masuk | Publik |
| Frontend | `/privasi` | Kebijakan privasi (statis, noindex) | Publik |
| Frontend | `/login`, `/register` | Form login, registrasi terbuka, tombol Google | Publik |
| Frontend | `/verify-email`, `/forgot-password`, `/reset-password` | Verifikasi OTP, minta dan atur ulang password | Publik |
| Frontend | `/app` | Galeri milik pengguna | Login |
| Frontend | `/app/albums` | Daftar album | Login |
| Frontend | `/app/albums/[id]` | Detail album | Login |
| Frontend | `/app/shares` | Daftar dan kelola link | Login |
| Frontend | `/app/settings` | Profil dan kuota | Login |
| Frontend | `/app/admin` | Daftar pengguna, kuota, suspend/aktifkan | ADMIN |
| Frontend | `/s/[token]` | Halaman publik file/album (SSR, noindex) | Token valid |
| API | `POST /auth/register` | Registrasi email + password (akun belum terverifikasi + kirim OTP) | Publik (rate limit, Turnstile) |
| API | `POST /auth/login` | Login email + password | Publik (rate limit, Turnstile) |
| API | `GET /auth/google`, `/auth/google/callback` | Alur Google OAuth (env `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`; wajib di produksi) | Publik |
| API | `POST /auth/logout`, `GET /auth/me` | Keluar dan status sesi | Login |
| API | `POST /auth/verify-email` | Verifikasi kode OTP, langsung buat sesi | Publik (rate limit) |
| API | `POST /auth/resend-code` | Kirim ulang OTP (jeda 60 detik) | Publik (rate limit) |
| API | `POST /auth/forgot-password` | Minta OTP reset (respons tidak membocorkan email) | Publik (rate limit) |
| API | `POST /auth/reset-password` | Reset password + cabut semua sesi | Publik (rate limit) |
| API | `/uploads/*` | Upload resumable (tus) | Login |
| API | `GET /files`, `DELETE /files/:id` | Daftar dan hapus file | Login + pemilik |
| API | `GET /files/:id/thumb`, `/files/:id/content` | Thumbnail dan isi file (Range, `?download=1`) | Login + pemilik |
| API | `/albums`, `/albums/:id`, `/albums/:id/files` | CRUD album dan isinya | Login + pemilik |
| API | `/shares`, `/shares/:id` | Buat, ubah, dan cabut link | Login + pemilik |
| API | `GET /public/s/:token`, `POST /public/s/:token/unlock` | Metadata link dan buka password | Token valid |
| API | `GET /public/s/:token/files/:fileId` | Isi dan unduhan file untuk penerima (Range) | Token valid |
| API | `GET /public/s/:token/zip` | Unduh ZIP album | Token valid + izin unduh |
| API | `GET /public/s/:token/cover` | Gambar sampul untuk preview Open Graph | Token valid, tanpa password |
| API | `GET /admin/users`, `POST /admin/users/:id/suspend`, `POST /admin/users/:id/activate`, `PATCH /admin/users/:id/quota`, `DELETE /admin/users/:id` | Daftar pengguna (paginasi cursor), suspend/aktifkan (cabut sesi), ubah kuota, hapus pengguna beserta datanya | ADMIN |
| API | `GET /health` | Status DB dan sisa disk | Internal |

## 11. Keamanan dan Privasi

- Semua otorisasi ditegakkan di backend pada setiap request (sesi, peran, kepemilikan, kuota). Pemeriksaan di frontend hanya untuk kenyamanan tampilan.
- Sesi: ID acak 32 byte yang disimpan sebagai hash di PostgreSQL; cookie HttpOnly, Secure, SameSite=Lax, host-only di host API; berlaku 30 hari. JavaScript tidak pernah memegang token (tanpa localStorage).
- CORS hanya untuk origin frontend dengan credentials, dan request yang mengubah data memeriksa header Origin (perlindungan CSRF bersama SameSite). Preview `*.vercel.app` berbeda site, sehingga login tidak berlaku di sana.
- Password di-hash dengan argon2id; rate limit per IP dan per email, dengan penundaan setelah beberapa kali gagal. Pesan error login tidak membocorkan keberadaan email.
- Registrasi terbuka: siapa pun boleh mendaftar dengan email + password atau Google, tanpa undangan. Pendaftaran membuat akun belum terverifikasi (`email_verified_at` null) dan mengirim kode OTP 6 digit (berlaku 10 menit, hanya hash yang disimpan, maks 5 percobaan lalu hangus; kirim ulang berjeda 60 detik; rate limit per email dan per IP). Login sebelum verifikasi ditolak dan mengarah ke layar kode; setelah verifikasi sukses sesi langsung dibuat. Pendaftaran ulang dengan email yang akunnya belum terverifikasi menimpa akun tersebut (tanpa mewarisi peran apa pun) agar pemilik email asli tidak terkunci; akun belum terverifikasi dibersihkan otomatis setelah 24 jam. Login/daftar via Google dianggap terverifikasi bila email Google terverifikasi. Satu email satu akun.
- Lupa password lewat OTP email: `POST /auth/forgot-password` dan `POST /auth/reset-password` (kode OTP terpisah dari verifikasi, aturan kedaluwarsa/percobaan sama; reset mencabut semua sesi aktif; respons tidak membocorkan apakah email terdaftar).
- Peran ADMIN dari env `ADMIN_EMAIL` hanya diberikan SETELAH email itu terverifikasi (lewat OTP atau Google), bukan saat pendaftaran. Akun yang belum terverifikasi tidak pernah mendapat peran istimewa.
- Email dikirim lewat MailService (satu antarmuka) yang memanggil REST API penyedia transaksional dengan `fetch`, tanpa dependency npm baru. Env: `MAIL_PROVIDER`, `MAIL_API_KEY` (generik; mis. kunci Resend), `MAIL_FROM` (mis. "Galeriku <noreply@send.hafizfajar.com>"). Di non-produksi tanpa kunci API, kode dicetak ke log (jangan pernah di produksi). Operasional: domain pengirim diverifikasi lewat record DNS di Cloudflare (DNS only). Risiko: form publik disalahgunakan untuk spam email ke alamat orang lain sehingga merusak reputasi domain; mitigasi wajib Turnstile + rate limit.
- Akun SUSPENDED: login ditolak, semua sesi dicabut, dan link publik miliknya tidak aktif.
- Kuota default akun baru 5 GB (`DEFAULT_QUOTA_BYTES=5368709120`); admin dapat menaikkan per pengguna. Kuota adalah batas, bukan reservasi; disk guard global (sisa < 15 GB) tetap berlaku di atas kuota. Menurunkan kuota di bawah pemakaian saat ini hanya menghalangi upload baru, tidak menghapus file.
- Form registrasi dan login memakai Cloudflare Turnstile dengan verifikasi server-side lewat `fetch` (tanpa dependency npm baru). Env: `TURNSTILE_SECRET_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`. Rate limit registrasi per IP.
- Kepemilikan per resource ditegakkan di backend: pengguna hanya boleh mengakses file/album/link miliknya sendiri (mencegah IDOR lintas pengguna). Berbagi link tidak mengubah role siapa pun. Akses ke milik pengguna lain dijawab 404 identik dengan id yang tidak ada (bukan 403) agar keberadaan data tidak bocor; diuji otomatis pola A-vs-B (`backend/test/ownership.ts`).
- Google OAuth: daftarkan redirect URI `https://galeriku-api.hafizfajar.com/auth/google/callback` dan origin frontend di Google Cloud Console. Ubah status aplikasi ke In production (scope dasar openid/email/profile umumnya tidak memerlukan verifikasi) agar tidak terbatas pada test user. Env backend: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL` (URL callback penuh, wajib diisi di production; backend menolak start bila kurang, deploy.sh akan rollback).
- Token link berupa 32 byte acak (base64url) dan disimpan apa adanya agar pemilik link bisa menyalin ulang link (trade-off diterima untuk skala pribadi). Password link di-hash; kedaluwarsa dan pencabutan berlaku seketika.
- Setiap akses file di area login memeriksa kepemilikan (mencegah IDOR). Nama file asli tidak dipakai di disk; `storage_key` berupa UUID.
- Validasi tipe file dengan MIME sniffing, bukan hanya ekstensi. Whitelist: JPEG, PNG, WebP, GIF, HEIC, MP4, MOV, WebM. SVG ditolak. Respons memakai `X-Content-Type-Options: nosniff`.
- Landing page boleh diindeks. `/login`, `/register`, `/verify-email`, `/forgot-password`, `/reset-password`, `/privasi`, `/app/*`, dan `/s/*` diberi noindex; API mengirim `X-Robots-Tag: noindex`; robots.txt melarang `/s/` dan `/app/`.
- Rate limit pada registrasi (per IP), login, dan endpoint publik (`@nestjs/throttler`), ditambah aturan WAF di Cloudflare.
- Semua galat API berbentuk standar `{statusCode, code, message, details?}`, termasuk galat level adapter Fastify (body kosong/JSON rusak, Content-Type tak didukung, payload berlebih: `VALIDATION_ERROR`/`UNSUPPORTED_MEDIA_TYPE`/`PAYLOAD_TOO_LARGE`; route tak dikenal: `NOT_FOUND`), tanpa detail internal.
- IP pada log akses disimpan dalam bentuk hash. Secret disimpan di `.env` di luar repository (dan di dashboard Vercel untuk frontend). PostgreSQL tidak diekspos ke host.
- Foto dari HP biasanya memuat koordinat GPS. Fitur penghapusan metadata lokasi dicatat di backlog (FR-23).

## 12. Rencana Pengembangan (Agile)

### 12.1 Cara Kerja

- Metode: Scrum ringan untuk satu developer. **Durasi sprint 1 minggu** (boleh 2 minggu jika sedang padat kuliah; estimasi SP tetap berlaku).
- Kapasitas asumsi: 10–15 jam per minggu, sekitar 13–16 story point (SP) per sprint. Skala SP: 1, 2, 3, 5, 8.
- Seremoni: Sprint Planning (awal minggu, 30–60 menit), catatan harian singkat (5 menit), Sprint Review (demo langsung di HP asli), Retrospective (15 menit), Backlog Refinement (30 menit di tengah sprint).
- Alat: GitHub Projects atau Trello (kolom Backlog, Sprint, Doing, Review, Done) dan Git dengan branch per story.

### 12.2 Definition of Done

1. Kriteria penerimaan story terpenuhi dan sudah dites manual di HP asli.
2. Tampilan layak di lebar 360 px.
3. Tidak ada error di log container; migrasi database terversi.
4. Kode ter-commit dan ter-merge ke `main`, lalu ter-deploy (frontend di Vercel, backend di server lokal).
5. README/runbook diperbarui bila ada perubahan konfigurasi.

### 12.3 Roadmap Ringkas

| Sprint | Fokus | SP | Hasil |
| --- | --- | --- | --- |
| 0 | Fondasi infrastruktur | 14 | Monorepo, backend dan frontend ter-deploy, tunnel dan Vercel berjalan |
| 1 | UI dasar, landing page, login + verifikasi email | 16 | Landing tampil; registrasi + login manual dan OTP lewat API |
| 2 | Layar auth, Google login, dan kelola pengguna | 17 | Layar auth lengkap; login ganda; akses terkunci |
| 3 | Upload dan penyimpanan | 16 | Upload resumable dan thumbnail foto |
| 4 | Galeri dan viewer | 15 | Melihat, memutar, mengunduh, dan menghapus file; halaman pengaturan |
| 5 | Album dan link publik inti | 15 | Link publik dapat dibuka dan diunduh tanpa login |
| 6 | Opsi berbagi dan pengerasan | 14 | Kedaluwarsa, password, ZIP, PWA |
| 7 | Stabilisasi dan rilis | 13 | **Rilis v1.0 (MVP)** |
| 8–9 | Pemrosesan video (Fase 2) | 21 | Thumbnail video dan transcode |

### 12.4 Detail Sprint

**Sprint 0 — Fondasi Infrastruktur** (Goal: monorepo siap, backend dan frontend ter-deploy di lingkungan tujuan masing-masing)

| ID | User story | SP | Kriteria penerimaan |
| --- | --- | --- | --- |
| US-01 | Sebagai developer, saya ingin monorepo yang rapi | 2 | Folder `frontend`, `backend`, `packages`, `infrastructure`; workspace pnpm berjalan; `AGENTS.md`, `opencode.json`, `docs/PRD.md`, `docs/DESIGN.md` ada di repo; `.env.example` untuk tiap aplikasi; port dev: frontend 3000, backend 4000 |
| US-02 | Sebagai admin, saya ingin Docker Compose di server lokal | 3 | `docker compose up -d` di `infrastructure` menjalankan `backend` dan `postgres` (tanpa `cloudflared`); data Postgres di volume persisten dan media di bind mount; `restart: unless-stopped`; backend hanya dipublish di `127.0.0.1:4000`; image backend memakai Node LTS |
| US-03 | Sebagai admin, saya ingin tunnel dan CORS yang benar | 3 | Route `galeriku-api.hafizfajar.com` -> `http://localhost:4000` ditambahkan pada tunnel `cf-tunnel` yang sudah ada (lewat dashboard Cloudflare); backend dapat diakses lewat HTTPS; tidak ada port yang dibuka di router; CORS hanya mengizinkan origin frontend dengan credentials |
| US-04 | Sebagai developer, saya ingin frontend ter-deploy ke Vercel | 3 | Root Directory `frontend`; domain `galeriku.hafizfajar.com` aktif (DNS sesuai petunjuk Vercel); `NEXT_PUBLIC_API_URL` terisi; build dilewati bila hanya `backend` yang berubah |
| US-05 | Sebagai developer, saya ingin skema database awal | 2 | Skema Prisma untuk users, sessions, allowed\_emails, files, albums, album\_files, share\_links; migrasi dijalankan otomatis oleh deploy.sh sebelum container baru naik |
| US-06 | Sebagai admin, saya ingin health check | 1 | `GET /health` menampilkan status DB dan sisa disk; frontend menampilkan pesan layanan tidak tersedia bila API tidak terjangkau |

**Sprint 1 — UI Dasar, Landing Page, Login, dan Verifikasi Email** (Goal: pengunjung melihat landing page, dan siapa pun dapat mendaftar dan login manual via API)

| ID | User story | SP | Kriteria penerimaan |
| --- | --- | --- | --- |
| US-07 | Sebagai pengguna HP, saya ingin tampilan yang konsisten dan nyaman | 3 | Token warna, tipografi, spacing, dan radius dari `DESIGN.md` masuk ke tema Tailwind; bottom navigation; komponen dasar (tombol, input, kartu); area sentuh ≥ 44 px; tema terang/gelap |
| US-08 | Sebagai pengunjung, saya ingin landing page Galeriku di root domain | 3 | Halaman `/` statis dan mobile-first: judul, penjelasan singkat, tiga keunggulan (upload dari HP, bagikan lewat link, penerima tanpa login), tombol Masuk ke `/login`; tag meta dan Open Graph terisi; tampil < 2,5 detik di 4G; boleh diindeks |
| US-09 | Sebagai pengguna, saya ingin mendaftar dan login dengan email + password | 5 | `POST /auth/register` (terbuka, tanpa token; `ADMIN_EMAIL` dicatat untuk penetapan peran setelah verifikasi), `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`; password argon2id; Turnstile terverifikasi server-side; rate limit register per IP; email yang sudah terdaftar boleh dijawab jelas saat registrasi; login tetap tidak membocorkan keberadaan email; pendaftaran ulang email yang belum terverifikasi menimpa akun tanpa mewarisi peran; sesi di PostgreSQL dengan cookie HttpOnly, Secure, SameSite=Lax; sesi bertahan 30 hari |
| US-09b | Sebagai pengguna, saya ingin verifikasi email dan lupa password | 5 | `POST /auth/verify-email`, `POST /auth/resend-code`, `POST /auth/forgot-password`, `POST /auth/reset-password`; kode OTP 6 digit, berlaku 10 menit, hanya hash disimpan, maks 5 percobaan lalu hangus, kirim ulang berjeda 60 detik, rate limit per email dan IP; login sebelum verifikasi ditolak dan mengarah ke layar kode; verifikasi sukses langsung membuat sesi; peran ADMIN dari `ADMIN_EMAIL` ditetapkan setelah verifikasi (tidak untuk akun belum terverifikasi); reset mencabut semua sesi; respons lupa password tidak membocorkan email; MailService via fetch tanpa dependency baru (kode dicetak ke log di non-produksi); akun belum terverifikasi dibersihkan otomatis setelah 24 jam |
| US-10 | Sebagai pengguna, saya ingin halaman login dan registrasi | 5 | `/login` dan `/register` (tanpa query token) dengan widget Turnstile; layar kode verifikasi, layar lupa password, dan layar reset password; login akun belum terverifikasi mengarah ke layar kode; status sesi dari `GET /auth/me`; `/app/*` mengalihkan ke `/login` bila belum login (di sisi klien); berfungsi di Chrome Android dan Safari iOS |

**Sprint 2 — Layar Auth, Google Login, dan Kelola Pengguna** (Goal: layar auth lengkap, login ganda berfungsi, dan akses terkunci rapat)

| ID | User story | SP | Kriteria penerimaan |
| --- | --- | --- | --- |
| US-11 | Sebagai pengguna, saya ingin login dengan Google | 5 | Alur OAuth di backend (`/auth/google` dan callback di host API); akun dibuat untuk siapa pun dengan email Google terverifikasi (dianggap terverifikasi); peran ADMIN dari `ADMIN_EMAIL` ditetapkan setelah verifikasi; cookie sesi sama dengan login manual; tombol Masuk dengan Google di `/login` dan `/register` untuk semua pengunjung; error alur Google ditangani |
| US-12 | Sebagai admin, saya ingin mengelola pengguna dan kuota | 5 | Halaman `/app/admin`: daftar pengguna + pemakaian storage; ubah kuota per pengguna (batas bukan reservasi; penurunan di bawah pemakaian hanya menghalangi upload baru); suspend/aktifkan (login ditolak, sesi dicabut, link publik miliknya nonaktif); hapus pengguna beserta datanya; hanya untuk ADMIN (403 bila bukan) |
| US-13 | Sebagai admin, saya ingin akses yang terkunci di backend | 2 | Semua endpoint privat menolak akses tanpa sesi (401); endpoint admin hanya untuk ADMIN (403); pengguna ditolak mengakses milik pengguna lain; uji otomatis matriks auth/admin; kepemilikan per resource diuji di tiap story resource (pola A-vs-B) |

**Sprint 3 — Upload dan Penyimpanan** (Goal: foto dan video dari HP dapat diunggah dengan andal)

| ID | User story | SP | Kriteria penerimaan |
| --- | --- | --- | --- |
| US-16 | Spike: tus di dalam NestJS | 2 | `@tus/server` berjalan di NestJS; prototipe upload 100 MB dari browser langsung ke host API melalui tunnel berhasil; keputusan tertulis |
| US-17 | Sebagai pengguna, saya ingin upload banyak file sekaligus yang bisa dilanjutkan | 8 | Pilih banyak file dari galeri HP; progress per file; dapat dilanjutkan setelah koneksi putus; chunk 5 MB; dapat dibatalkan; pengguna tanpa login ditolak (401) |
| US-18 | Sebagai admin, saya ingin validasi, kuota, dan disk guard | 3 | MIME sniffing dengan whitelist; batas foto 25 MB dan video 2 GB (konfigurasi env); ditolak bila kuota habis atau sisa disk < 15 GB |
| US-19 | Sebagai pengguna, saya ingin thumbnail foto | 3 | Thumbnail WebP ± 400 px dibuat setelah upload selesai; orientasi EXIF dihormati; konkurensi pemrosesan ≤ 2 |

**Sprint 4 — Galeri dan Viewer** (Goal: melihat, mengunduh, dan mengelola file dengan nyaman di HP)

| ID | User story | SP | Kriteria penerimaan |
| --- | --- | --- | --- |
| US-20 | Sebagai pengguna, saya ingin grid galeri | 5 | 3 kolom di HP; thumbnail lazy-load; infinite scroll 24 item per halaman; urut terbaru; video diberi ikon penanda |
| US-21 | Sebagai pengguna, saya ingin viewer layar penuh | 5 | Foto dapat di-swipe dan di-zoom; video diputar dengan streaming (Range) dan bisa di-seek; cookie sesi ikut terkirim untuk gambar dan video dari host API |
| US-22 | Sebagai pengguna, saya ingin mengunduh dan menghapus file sendiri | 3 | Tombol unduh (`?download=1`, Content-Disposition attachment); mode pilih dengan long-press; hapus banyak file dengan konfirmasi; file dan thumbnail fisik terhapus; pemakaian storage diperbarui |
| US-15 | Sebagai pengguna, saya ingin halaman profil dan pengaturan | 2 | `/app/settings` menampilkan nama, avatar, dan pemakaian storage terhadap kuota; akun Google dapat menambahkan password; tautan ke `/app/admin` untuk ADMIN; tombol keluar |

**Sprint 5 — Album dan Link Publik Inti** (Goal: link dapat dibuat, dibuka, dan diunduh tanpa login)

| ID | User story | SP | Kriteria penerimaan |
| --- | --- | --- | --- |
| US-23 | Sebagai pengguna, saya ingin membuat album | 5 | Buat, ubah nama, hapus album; tambah/keluarkan file; cover otomatis dari file pertama |
| US-24 | Sebagai pengguna, saya ingin membuat link publik | 5 | Dari file atau album, tombol Bagikan membuat `/s/<token>` dan menyalinnya ke clipboard; izin unduh aktif secara default |
| US-25 | Sebagai penerima, saya ingin membuka dan mengunduh tanpa login | 5 | `/s/[token]` dirender di Vercel dan mengambil data dari API; galeri/file tampil mobile-first; pemutar video berfungsi; unduh per file tanpa login; link tidak valid atau kedaluwarsa menampilkan halaman ramah; `noindex` aktif; tanpa login tidak ada akses upload; tombol Laporkan konten (mailto ke alamat kontak dari env) |

**Sprint 6 — Opsi Berbagi dan Pengerasan** (Goal: berbagi aman dan nyaman dari HP)

| ID | User story | SP | Kriteria penerimaan |
| --- | --- | --- | --- |
| US-26 | Sebagai pengguna, saya ingin mengatur opsi link | 3 | Kedaluwarsa (1 hari / 7 hari / 30 hari / tanpa batas, default 30 hari); password opsional; toggle izin unduh |
| US-27 | Sebagai pengguna, saya ingin mengelola dan mencabut link | 2 | Daftar link aktif dengan jumlah dilihat; pencabutan berlaku seketika |
| US-28 | Sebagai penerima, saya ingin mengunduh album sebagai ZIP | 3 | ZIP di-stream tanpa kompresi dan tanpa file sementara; hanya jika izin unduh aktif |
| US-29 | Sebagai admin, saya ingin rate limit dan header keamanan | 3 | `@nestjs/throttler` pada login, endpoint publik, dan percobaan password; CSP, nosniff, dan `X-Robots-Tag` aktif |
| US-30 | Sebagai pengguna HP, saya ingin PWA dan Web Share | 3 | Aplikasi dapat dipasang ke layar utama; tombol Bagikan memakai share sheet bawaan HP bila tersedia |

**Sprint 7 — Stabilisasi dan Rilis v1.0** (Goal: aplikasi siap dipakai harian)

| ID | User story | SP | Kriteria penerimaan |
| --- | --- | --- | --- |
| US-31 | Sebagai admin, saya ingin backup otomatis | 3 | `pg_dump` harian (retensi 14 hari) ke lokasi di luar volume utama; prosedur restore diuji sekali |
| US-32 | Sebagai admin, saya ingin pengujian di perangkat nyata | 5 | Diuji di minimal 1 Android (Chrome) dan 1 iPhone (Safari) lewat jaringan seluler, termasuk login ganda, upload, dan link publik; bug kritis diperbaiki |
| US-33 | Sebagai admin, saya ingin dokumentasi | 2 | README dan runbook (deploy frontend dan backend, update, restore, tambah pengguna) |
| US-34 | Sebagai admin, saya ingin monitoring | 3 | Uptime check untuk frontend dan API; notifikasi bila sisa disk < 20% atau SMART bermasalah |

_Catatan: US-14 dihapus, digabung ke US-09/10/11 (tombol Google, logout, sesi 30 hari, status sesi)._

## 13. Fase 2 — Pemrosesan Video (Dicatat, Dikerjakan Setelah v1.0 Stabil)

Pemrosesan video baru dimulai setelah v1.0 berjalan lancar minimal 2–4 minggu pemakaian nyata. Pada v1.0, video disimpan apa adanya dan diputar langsung (streaming) dengan ikon penanda di galeri.

| ID | User story | SP | Kriteria penerimaan |
| --- | --- | --- | --- |
| US-35 | Sebagai pengguna, saya ingin poster dan metadata video | 5 | ffprobe di backend membaca durasi dan resolusi; satu frame diambil sebagai poster di galeri |
| US-36 | Sebagai developer, saya ingin antrian job | 3 | pg-boss di backend NestJS dengan konkurensi 1 dan prioritas rendah; job gagal dapat diulang |
| US-37 | Sebagai pengguna, saya ingin video dikompres agar hemat disk dan kuota penerima | 8 | Transcode ke MP4 H.264 maksimal 720p dengan `+faststart`; memakai Intel QSV bila tersedia (`/dev/dri` diteruskan ke container backend), jika tidak libx264 preset veryfast dengan prioritas CPU rendah |
| US-38 | Sebagai pengguna, saya ingin melihat status pemrosesan | 3 | Status menunggu / diproses / siap / gagal terlihat di UI |
| US-39 | Sebagai pengguna, saya ingin opsi menghapus file asli setelah transcode | 2 | Opsi per pengguna; file asli dihapus hanya setelah hasil transcode terverifikasi |

**Pertimbangan performa:** CPU i3-7020U hanya 2 core dan tidak punya turbo, sehingga software encoding diperkirakan sekitar 0,5–1× kecepatan real-time (video 10 menit bisa memakan 10–20 menit). Angka ini perkiraan kasar dan perlu diuji pada Sprint 9. Jalankan satu job pada satu waktu, utamakan QSV, dan pertimbangkan menjalankan antrian pada malam hari.

**Backlog lanjutan:** folder bersarang dan trash (FR-21), dashboard pemakaian storage (FR-22), penghapusan EXIF GPS (FR-23), konversi HEIC ke JPEG untuk thumbnail.

## 14. Risiko dan Mitigasi

| Risiko | Dampak | Mitigasi |
| --- | --- | --- |
| HDD rusak (tanpa redundansi) | Data hilang | Pantau SMART; backup database harian; anggap media sebagai salinan dari file asli di HP |
| Disk penuh | Layanan gagal | Disk guard < 15 GB, kuota per pengguna, alert < 20% |
| HDD lambat saat banyak proses paralel | Galeri lambat | Thumbnail kecil, konkurensi pemrosesan ≤ 2, page cache dari RAM besar |
| Upload ISP rumah lambat dan jaringan seluler putus | Upload gagal | Upload resumable, chunk 5 MB, tampilkan perkiraan waktu |
| Kecepatan upload ISP rumah membatasi unduhan penerima | Video besar lambat dibuka | Thumbnail agresif, batas ukuran file, transcode di Fase 2 |
| Batas body Cloudflare (± 100 MB) dan ketentuan layanan untuk konten non-HTML dalam jumlah besar | Upload/akses terblokir | Upload per chunk; untuk pemakaian pribadi kecil risikonya rendah, tetapi cek ketentuan Cloudflare terbaru secara berkala |
| Batas 4,5 MB body Vercel Functions | Upload/unduh gagal bila lewat Vercel | Byte file langsung ke host API; Next.js hanya merender UI |
| Cookie dan preview Vercel berbeda site | Login gagal di preview deployment | Frontend dan API sama-sama di `hafizfajar.com`; uji di domain produksi |
| Host API bertingkat dua tidak tercakup SSL Universal Cloudflare | Error SSL | Pakai `galeriku-api.hafizfajar.com` (tingkat pertama) |
| Akun dibuat dengan email orang lain | Akun diambil alih | Verifikasi OTP sebelum akun aktif; pendaftaran ulang menimpa akun belum terverifikasi; Google hanya dengan email terverifikasi |
| Server rumah mati (listrik atau internet) | Aplikasi tidak bisa dipakai | Frontend menampilkan pesan layanan tidak tersedia; auto-restart container; UPS opsional |
| Versi Node bukan LTS | Masalah kompatibilitas | Pakai Node LTS (24.x) di lokal, Docker, dan Vercel |
| Foto HEIC dari iPhone: `sharp` bawaan umumnya tidak membaca HEIC | Thumbnail gagal | Uji di Sprint 3; solusi dengan libheif/ImageMagick di container, atau simpan tanpa thumbnail sementara |
| Link bocor | Konten terlihat orang lain | Token 256 bit, kedaluwarsa default 30 hari, password opsional, cabut seketika |
| Transcode membebani i3 | Server lambat | Ditunda ke Fase 2, konkurensi 1, QSV, jadwal malam |
| OAuth dalam mode Testing | Login dibatasi test user | Ubah ke In production dengan scope dasar |
| Registrasi terbuka disalahgunakan (bot, spam) | Akun palsu membanjiri DB; spam email | Turnstile di form publik; rate limit per IP/email; kuota default kecil 5 GB; akun belum terverifikasi dibersihkan 24 jam |
| Konten ilegal diunggah pendaftar | Risiko hukum dan reputasi; disk habis | Kuota 5 GB + disk guard; suspend/aktifkan + hapus pengguna oleh admin; tombol Laporkan konten (mailto); opsi pengetatan: registrasi hanya via Google |
| Penyedia email down | Pendaftaran dan reset password terhenti | Login sesi yang sudah ada tetap jalan; kirim ulang setelah pulih; pantau status penyedia |
| Reputasi domain pengirim rusak (spam via form) | Email OTP masuk spam/tidak terkirim | Turnstile + rate limit wajib di semua endpoint pengirim email; verifikasi DNS Cloudflare; batasi kirim ulang (jeda 60 dtk) |

## 15. Asumsi dan Pertanyaan Terbuka

**Asumsi yang dipakai dalam PRD ini**

1. Pengguna terdaftar boleh upload; penerima link tidak perlu login dan dapat mengunduh (izin unduh aktif secara default).
2. Registrasi terbuka dengan verifikasi email OTP; tanpa undangan.
3. Struktur v1.0 memakai album datar, bukan folder bersarang.
4. Domain `hafizfajar.com` memakai Cloudflare: frontend di `galeriku.hafizfajar.com` (Vercel) dan API di `galeriku-api.hafizfajar.com` (tunnel).
5. Media di server adalah salinan; file asli masih ada di HP.

**Perlu dikonfirmasi**

1. Apakah batas 2 GB per video dan kuota default 5 GB per pengguna sudah sesuai?
2. Lokasi backup database (HDD eksternal, cloud, atau perangkat lain)?
3. Identitas visual Galeriku (logo dan warna utama) mengikuti arah desain di `DESIGN.md`.

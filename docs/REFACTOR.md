# REFACTOR — Galeriku v1.1: Metadata, Live Foto, Berbagi, dan Album Bersarang

Versi 1.0 · 7 November 2026 · Pemilik: Hafiz · Status: **Disetujui, siap dieksekusi** · Pelaksana: Antigravity

Dokumen ini adalah rencana kerja hasil audit UI/UX dan QA atas repo Galeriku (backend NestJS, frontend Next.js, docs). Temuan berasal dari **membaca kode**; aplikasi belum dijalankan dan test belum dieksekusi. Karena itu, untuk setiap bug: tulis dulu tes yang gagal (red) untuk membuktikan temuan, baru perbaiki. Bila temuan ternyata tidak terbukti, laporkan, jangan "memperbaiki" hal yang tidak rusak.

## 0. Aturan eksekusi (wajib)

1. Baca `AGENTS.md`, `docs/PRD.md`, `docs/DESIGN.md`, `docs/PROGRESS.md` sebelum mulai. Semua aturan arsitektur di `AGENTS.md` (1-12) tetap berlaku, terutama: otorisasi di backend, kepemilikan menjawab 404 identik (helper A-vs-B di `backend/test/ownership.ts` wajib dipanggil untuk setiap resource baru), byte file tidak lewat Next.js/Vercel, BigInt dikirim sebagai string, validasi input di batas API (Zod di `packages/contracts`).
2. Satu story (RF-xx) per branch dari `main`. Commit kecil, conventional commits, staging per-path (dilarang `git add -A`). Centang story di `docs/PROGRESS.md` pada commit terakhir story (tambahkan bagian "Refactor v1.1" bila belum ada). `opencode.json` jangan di-stage.
3. Selesai hanya bila lint, build, dan test relevan lolos (verifikasi serial: backend lint, test, test:e2e, build frontend). UI dicek di 360x800 dan tidak ada scroll horizontal.
4. **Story fitur (RF-1x sampai RF-5x): STOP sebelum merge**, Hafiz tes manual dulu di HP. Story docs/hotfix yang lolos review boleh langsung merge ff-only.
5. Klaim tampilan hanya bila benar-benar melihat screenshot; selain itu tulis "tampilan belum dilihat". Tulis "belum diverifikasi" untuk hal yang belum dijalankan.
6. Migrasi database **aditif dan terversi** (Prisma Migrate). Jangan menghapus atau mengganti nama kolom lama pada story yang sama dengan pemakaiannya; kolom baru nullable atau punya default sampai backfill selesai.
7. UI mengikuti `docs/DESIGN.md` ketat: token warna/tipografi/spasi, target sentuh >= 44 px, input >= 16 px, ikon Lucide stroke 1.5, bottom sheet untuk aksi/menu, tanpa gradien, tanpa emoji sebagai ikon, tanpa interaksi hover-only, teks Bahasa Indonesia ("kamu", kalimat pendek, tombol berupa kata kerja). Hormati `prefers-reduced-motion`.
8. Larangan server (dari CONTEXT-MEMORY §6): jangan sentuh `coolify-db`, `portofolio-db_pgdata`, container/volume proyek lain; jangan `docker volume prune`, `docker system prune`, `rm -f`. Foto contoh untuk repo publik harus bersih EXIF/GPS. Jangan menulis rahasia ke file docs.
9. Dependensi baru hanya yang tercantum di §3. Dependensi di luar daftar: berhenti dan tanya.

## 1. Keputusan final (disetujui Hafiz)

| ID | Keputusan |
| --- | --- |
| D1 | Tampilan galeri, album, dan halaman publik diurutkan dan dikelompokkan berdasarkan **tanggal foto diambil** (`captured_at`). Tanggal upload disimpan terpisah dan tersedia sebagai urutan "Baru ditambahkan". |
| D2 | Unduhan menyajikan **file asli tanpa mengubah tanggal/EXIF** (kecuali pembersihan lokasi untuk link publik, lihat RF-21). Kemudahan menemukan hasil unduhan diselesaikan lewat nama file, mtime ZIP, tombol "Simpan ke Galeri", dan tampilan "Baru ditambahkan" (RF-23), bukan dengan memalsukan tanggal. |
| D3 | Dependensi baru disetujui: `exifr`, ffmpeg/ffprobe (US-35 dimajukan dari Fase 2), libheif di image Docker, geocoder offline. |
| D4 | Lokasi ditampilkan sebagai **nama tempat saja** (geocoder offline). Tanpa peta pihak ketiga pada tahap ini. Koordinat dan nama tempat **disembunyikan di link publik secara default** (toggle per link). |
| D5 | Kedaluwarsa default link **album = tanpa batas**; link file tunggal tetap 30 hari. |
| D6 | Album bersarang maksimum **4 tingkat** (induk -> anak -> cucu -> cicit). |

Asumsi saya yang boleh diubah Hafiz (tandai bila tidak cocok): retensi Sampah 30 hari dan file di Sampah tetap dihitung kuota sampai dihapus permanen (RF-01); preview viewer 2048 px sisi terpanjang (RF-11); judul album unik per induk, tidak peka huruf besar-kecil (RF-50); duplikat upload ditandai, tidak dihapus otomatis (RF-45).

## 2. Ringkasan temuan audit

Kode bug dipakai di story di bawah.

| Kode | Prioritas | Temuan | Lokasi |
| --- | --- | --- | --- |
| B1 | Tinggi | `deletePermanent` dan `emptyTrash` gagal 500 untuk file yang menjadi sampul album (FK `Album.coverFile` = `Restrict`). File fisik dihapus lebih dulu, sisa baris DB hantu. `addFilesToAlbum` mengisi `coverFileId` otomatis, jadi skenario ini umum. | `files.service.ts`, `schema.prisma` |
| B2 | Tinggi | `allowDownload=false` hanya memblokir `?download=1`; tampilan inline tetap menyajikan file asli. | `shares.service.ts` (`getPublicFileContentInfo`) |
| B3 | Tinggi | File asli (termasuk GPS EXIF) ikut ke penerima link. FR-23 masih backlog. | PRD FR-23 |
| B4 | Tinggi | Viewer pemilik dan publik memuat file asli (sampai 25 MB) pada setiap geser; uplink rumah teramati 51 KB/dtk sampai 3 MB/dtk (PRD AD-11). | `full-viewer.tsx`, `public-viewer.tsx` |
| B5 | Sedang | Sampah tidak punya retensi dan tidak dihitung kuota (`deletedAt: null` di `checkUserQuotaAndStatus`); teks konfirmasi hapus bilang "dihapus permanen" padahal soft-delete. | `uploads.utils.ts`, `gallery-grid.tsx`, `full-viewer.tsx` |
| B6 | Sedang | `/s/[token]` client-render dengan metadata statis: tidak ada preview OG per link (PRD/AGENTS menyebut SSR). Endpoint `/cover` tidak dipakai `page.tsx` dan memanggil `getPublicShare` sehingga menambah `viewCount`. Kemungkinan `viewCount` juga naik tiap refetch saat fokus (belum cek `QueryProvider`). | `s/[token]/page.tsx`, `public-shares.controller.ts` |
| B7 | Sedang | `getUnlockTokenFromReq` mengambil cookie pertama berawalan `galeriku_unlock_`, bukan milik link ini. Unlock token deterministik, tidak kedaluwarsa, tidak terikat password link (ganti password tidak mencabut akses). Perbandingan token memakai `===`. | `public-shares.controller.ts`, `shares.service.ts` |
| B8 | Sedang | `filename="${encodeURIComponent(...)}"` pada unduhan publik dan ZIP menghasilkan nama `%20`. Rute pemilik sudah benar. | `public-shares.controller.ts` |
| B9 | Sedang | ZIP tanpa ZIP64: total > 4 GiB membuat `writeUInt32LE` melempar di tengah stream (ZIP rusak). Kuota default 5 GB membuatnya realistis. | `zip-stream.ts` |
| B10 | Sedang | Video di detail album dan halaman publik memakai `<Image>` ke thumbnail yang 404 (video tak punya thumb): ikon gambar rusak, tanpa fallback. | `album-detail-client.tsx`, `public-share-client.tsx` |
| B11 | Sedang | Thumbnail HEIC kemungkinan gagal (sharp bawaan umumnya tak decode HEIC; Dockerfile belum diperiksa): `thumbKey`, `width`, `height` null; HEIC tak tampil di browser non-Safari. Dimensi juga mengabaikan orientasi EXIF. | `thumbnail.service.ts`, `uploads.service.ts` |
| B12 | Sedang | `taken_at` tak pernah diisi; `duration_s` video tak pernah diisi. Header grup memakai `takenAt \|\| createdAt` tetapi urutan/cursor memakai `createdAt`; format tanggal memakai zona waktu perangkat pemirsa. | `files.service.ts`, `gallery-grid.tsx` |
| B13 | Sedang | Picker "Tambah Foto" ke album hanya memuat 100 file terbaru tanpa paginasi/cari. | `album-detail-client.tsx` |
| B14 | Sedang | Tombol "Keluarkan dari album" hover-only (melanggar DESIGN §10/§12; tak bisa di HP). Bilah pilih galeri tak punya "Tambah ke album" dan "Bagikan" (DESIGN §6). | `album-detail-client.tsx`, `gallery-grid.tsx` |
| B15 | Sedang | Unduh banyak = N klik `<a download>` (diblokir browser, iOS hanya satu); pemilik tak punya ZIP untuk pilihan atau album. | `gallery-grid.tsx` |
| B16 | Rendah | Viewer: tanpa pinch-zoom/pan (`touch-none`, hanya double-tap tanpa translate), tanpa preload/transisi; dua viewer hampir identik. | viewer |
| B17 | Rendah | `deleteAlbum` meninggalkan share link yatim; `updateAlbum` memakai `as any` dan mengembalikan `coverFileId` mentah; tak ada deteksi duplikat. | `albums.service.ts` |
| B18 | Dokumen | PRD tertinggal dari kode (sampah dan favorit ada tetapi FR-21 "Won't"; bottom nav 5 tab vs DESIGN 4 tab); CONTEXT-MEMORY §7 bilang posisi Sprint 4 sedangkan PROGRESS sudah sampai Sprint 7. | docs |

## 3. Dependensi dan batasan sumber daya

| Dependensi | Dipakai untuk | Catatan |
| --- | --- | --- |
| `exifr` | Baca EXIF/XMP (tanggal, GPS, kamera, orientasi, penanda Motion Photo, ContentIdentifier bila terbaca) | JS murni, hanya baca. Untuk menulis/membuang EXIF, lihat RF-21. |
| ffmpeg + ffprobe (apt di image Docker) | Metadata video (durasi, dimensi, `creation_time`, GPS ISO6709), frame poster, penanda pasangan Live Photo | Dijalankan lewat `child_process.spawn` dengan argumen array (tanpa shell). Konkurensi 1, prioritas rendah (`nice`). |
| libheif (libvips global atau `heif-convert`) | Decode HEIC untuk thumbnail dan preview | Antigravity memilih opsi paling sederhana yang lolos tes, lalu melaporkan pilihannya dan ukuran image. |
| Geocoder offline (dataset GeoNames kota) | Nama tempat dari koordinat | Pilih paket/dataset ringan; tambahan RAM <= 150 MB; laporkan pilihan, ukuran, dan RAM terukur sebelum commit. Tidak boleh memanggil layanan pihak ketiga saat runtime. |

Anggaran: total RAM seluruh stack tetap < 3 GB (PRD §3). Disk: preview dan poster menambah sekitar 0,3-0,8 MB per item; laporkan estimasi per 1.000 item di PR RF-11.

Di luar daftar (jangan dikerjakan): peta Leaflet/OSM, Redis, MinIO, transcode video ke 720p (US-37), antrian pg-boss (US-36). Gunakan job sederhana berbasis `setInterval` seperti `upload-cleanup.service.ts`.

## 4. Model data target

Semua perubahan aditif, dibagi ke migrasi per story.

**`files`** (RF-10, RF-11, RF-16, RF-30-34, RF-45)

| Kolom | Tipe | Keterangan |
| --- | --- | --- |
| `captured_at` | timestamptz not null | Tanggal foto diambil. Backfill awal `COALESCE(taken_at, created_at)`. Indeks `(owner_id, captured_at DESC, id DESC)`. |
| `captured_tz_offset_min` | int null | Offset zona waktu foto (menit) bila diketahui; dipakai untuk menampilkan jam lokal foto. |
| `captured_at_source` | enum `exif`, `video`, `filename`, `client_modified`, `upload`, `manual` | Sumber tanggal. |
| `gps_lat`, `gps_lng` | double null | Koordinat. |
| `gps_alt_m` | real null | Opsional. |
| `place_country`, `place_admin1`, `place_city` | text null | Hasil geocoder offline. |
| `camera_make`, `camera_model`, `lens_model` | text null | |
| `iso`, `f_number`, `exposure_s`, `focal_length_mm` | numerik null | |
| `orientation` | smallint null | |
| `preview_key` | text null | Preview 2048 px. |
| `content_hash` | text null | SHA-256 hex; indeks `(owner_id, content_hash)`; `duplicate_of_id` null (tanpa FK Restrict ke sampul). |
| `live_kind` | enum `none`, `ios_pair`, `motion` default `none` | |
| `live_group_id` | text null | ContentIdentifier Live Photo iOS; indeks `(owner_id, live_group_id)`. |
| `live_video_key` | text null | Untuk `ios_pair`: storage key MOV pasangan. |
| `live_offset`, `live_length` | bigint null | Untuk `motion`: potongan MP4 di dalam file JPEG. |
| `meta_version` | smallint default 0 | Penanda versi ekstraksi untuk backfill idempoten. |

`taken_at` lama dipertahankan (tidak dihapus) sampai dokumen berikutnya memutuskan.

**`share_links`** (RF-21, RF-52): `show_location boolean default false`, `include_children boolean default true`.

**`albums`** (RF-50): `parent_id text null` (self FK, `onDelete: Restrict`), indeks `(owner_id, parent_id)`.

Serialisasi: BigInt/ukuran sebagai string di DTO; koordinat sebagai number; semua kontrak baru di `packages/contracts`.

---

## Fase 0 — Dokumen dan hotfix

### RF-00 Amandemen dokumen (3 SP)

Sebelum kode apa pun, karena `AGENTS.md` melarang fitur di luar PRD.

- `docs/PRD.md` -> v1.3: tambah FR baru untuk fase ini; angkat FR-21 (folder bersarang, kini album bersarang maks 4 tingkat) dan FR-23 (pembersihan lokasi) ke Must; catat sampah dan favorit sebagai fitur yang sudah ada (§6, §9, §10); perbarui §9 model data (§4 dokumen ini), §10 endpoint, §11 privasi (lokasi tersembunyi di link publik, `allowDownload` nyata); ubah default kedaluwarsa link album (US-26); majukan US-35 (poster dan metadata video) dari Fase 2.
- `docs/DESIGN.md`: tambah komponen: panel Info, badge LIVE, filter bar dan sort sheet, scrubber timeline, kartu sub-album, breadcrumb album, bottom sheet pemilih album; perbarui bottom nav menjadi 5 tab (Galeri, Favorit, Album, Link, Akun).
- `AGENTS.md`: ubah baris "Out of scope" agar ffmpeg hanya untuk metadata/poster; transcode tetap di luar lingkup.
- `docs/PROGRESS.md`: tambah bagian "Refactor v1.1" berisi semua RF; `docs/CONTEXT-MEMORY.md` §7: perbarui posisi (sprint 0-7 selesai, mulai refactor v1.1).

Kriteria penerimaan: tidak ada kode berubah; dokumen konsisten satu sama lain; PR hanya docs. Boleh langsung merge ff-only setelah review.

### RF-01 Hotfix hapus permanen, sampul album, retensi sampah (5 SP) — B1, B5

- Tes e2e merah dulu: album dengan sampul file X; X ke Sampah; `DELETE /files/:id/permanent` dan `DELETE /files/trash` harus berhasil.
- Perbaiki urutan: dalam satu transaksi, kosongkan/ganti `coverFileId` album yang memakai file tersebut (ganti ke file aktif berikutnya di album, atau null), hapus baris DB; **hapus file fisik hanya setelah commit berhasil**. Kegagalan hapus fisik hanya di-log (job pembersih berkala boleh menyapu yatim).
- `emptyTrash`: proses per batch; satu file gagal tidak membatalkan seluruhnya.
- Retensi: job `trash-cleanup.service.ts` menghapus permanen item di Sampah > 30 hari (env `TRASH_RETENTION_DAYS`, default 30); berjalan sekali saat start lalu tiap jam, anti-tumpang-tindih, error ditangkap (ikuti pola `upload-cleanup.service.ts`).
- Kuota: pemakaian = file aktif **dan** file di Sampah sampai dihapus permanen. Perbarui `checkUserQuotaAndStatus`, `GET /auth/me.usedBytes`, dan dashboard admin agar konsisten.
- Teks UI: konfirmasi hapus di galeri dan viewer menjadi "Pindahkan N file ke Sampah? Kamu bisa memulihkannya dalam 30 hari." Halaman Sampah menampilkan sisa hari per item.
- Tes: unit + e2e termasuk A-vs-B untuk restore/permanent.

### RF-02 Hotfix unduhan, ZIP64, fallback video (5 SP) — B8, B9, B10

- Util `contentDisposition(filename)` bersama (RFC 6266: `filename` fallback ASCII bersih + `filename*=UTF-8''...`) dipakai rute pemilik, publik, dan ZIP. Hapus pemakaian `encodeURIComponent` di dalam `filename=`.
- `zip-stream.ts`: dukung ZIP64 (extra field, Zip64 EOCD + locator) otomatis bila offset/ukuran/jumlah entri melewati batas 32/16 bit. Tes dengan aliran sintetis (mis. entri berulang berukuran besar tanpa menulis ke disk) membuktikan offset > 4 GiB menghasilkan ZIP valid; tetap tanpa kompresi dan tanpa file sementara (US-28). Kegagalan di tengah stream harus mengakhiri koneksi dengan jelas, bukan mengirim ZIP seolah utuh.
- Komponen bersama `MediaThumb` (frontend): gambar thumbnail dengan fallback ikon + nama file saat 404/`onError` atau `thumbKey` null; dipakai grid galeri, detail album, halaman publik, picker album. Video tanpa poster tampil ikon film + pil durasi bila ada.
- Kriteria: tes unit util, tes ZIP64, cek 360x800 untuk video di album dan halaman publik.

### RF-03 Hotfix link publik: unlock, hitungan view, link yatim, album service (5 SP) — B6 (sebagian), B7, B17

- Cookie unlock dibaca **tepat** `galeriku_unlock_<share.id>` (butuh `share.id` dari token; ubah helper). Header `x-unlock-token` tetap didukung.
- Unlock token baru: HMAC(`shareId` + sidik jari `passwordHash` + waktu kedaluwarsa), berlaku 24 jam, diverifikasi dengan `timingSafeEqual`. Mengganti atau menghapus password link mencabut semua unlock lama. Tes e2e: dua link berpassword di satu browser; ganti password lalu cookie lama ditolak.
- `viewCount`: pisahkan `resolvePublicShare` (tanpa efek samping) dari pencatatan view. Hitungan naik paling banyak sekali per (link, `ipHash`) per 30 menit (cek `ShareAccessLog`). Endpoint `/cover` dan thumbnail tidak pernah menghitung. Frontend publik: `refetchOnWindowFocus: false`.
- `deleteAlbum`: cabut (`revokedAt`) semua share link yang menarget album itu dalam transaksi yang sama. `deleteFile`/hapus permanen: link file tunggal mengembalikan 404 ramah (sudah) dan tampil sebagai "File dihapus" di daftar link.
- `updateAlbum`: hapus `as any`; kembalikan `coverFileId` aktif dan `fileCount` sama seperti `getAlbumDetail`.

---

## Fase 1 — Fondasi metadata

### RF-10 Skema dan ekstraksi metadata saat upload (8 SP) — B11 (dimensi), B12

- Migrasi kolom `files` (lihat §4): `captured_at` (not null, backfill `COALESCE(taken_at, created_at)`), offset, sumber, GPS, kamera, orientasi, `meta_version`.
- `MetadataService` (di `uploads/`) memakai `exifr`: `DateTimeOriginal` + `OffsetTimeOriginal`, `CreateDate`, GPS, `Make`/`Model`/`LensModel`, ISO, FNumber, ExposureTime, FocalLength, Orientation, dan XMP. Rantai tanggal: EXIF `DateTimeOriginal` -> `CreateDate` -> `creation_time` video (RF-34) -> pola nama file (`IMG_YYYYMMDD_HHMMSS`, `IMG-YYYYMMDD-WA####`, `YYYY-MM-DD HH.MM.SS`) -> `lastModified` kiriman klien -> waktu upload. Catat `captured_at_source`.
- Klien (`galeri-upload-client.tsx`) menambah `lastModified` ke metadata tus; server memvalidasi (angka wajar, tidak di masa depan lebih dari 1 hari).
- `width`/`height` memperhitungkan orientasi EXIF (tukar bila orientasi 5-8) dan diisi walau thumbnail gagal.
- Kegagalan ekstraksi **tidak** menggagalkan upload; catat peringatan dan simpan fallback.
- Tes: fixture JPEG dengan EXIF lengkap, tanpa EXIF, dengan GPS, orientasi 6; tes unit rantai fallback. Fixture untuk repo publik wajib bersih dari data pribadi (buat sintetis).
- Kontrak: `FileItem` mendapat `capturedAt`, `capturedTzOffsetMin`, `capturedAtSource`, `place` (null sampai RF-16), dan `hasLocation`. **Koordinat tidak dikirim di list**; hanya di detail pemilik (RF-14).

### RF-11 Preview 2048 px dan pipeline HEIC (8 SP) — B4, B11

- Image Docker backend memuat libheif sehingga HEIC/HEIF bisa di-decode (spike kecil: pilih libvips global atau `heif-convert`; tes dengan HEIC nyata sintetis).
- Saat upload selesai (dan di backfill): buat `thumb` (400 px WebP, sudah ada) dan `preview` (sisi terpanjang 2048 px, WebP kualitas ~82, orientasi dihormati, tanpa metadata). Konkurensi gabungan tetap <= 2 lewat `ConcurrencyLimiter`. HEIC memakai jalur yang sama setelah decode.
- Endpoint baru: `GET /files/:id/preview` (pemilik) dan `GET /public/s/:token/files/:fileId/preview`; Cache-Control `private, max-age=86400` (publik: `public` hanya bila link tanpa password).
- Viewer memakai preview; file asli hanya untuk tombol "Lihat ukuran asli" dan unduhan. Video tetap streaming asli sampai RF-34.
- Kriteria: halaman viewer di jaringan lambat memuat preview < 600 KB tipikal; HEIC tampil di Chrome Android dan desktop; laporkan estimasi disk per 1.000 item.

### RF-12 Urutan dan pengelompokan berdasarkan `captured_at` (5 SP) — B12

- Cursor keyset baru `(captured_at, id)` (sandi base64url) pada `GET /files`; indeks `(owner_id, captured_at DESC, id DESC)`. Kompatibel mundur: cursor lama ditolak dengan 400 yang jelas, frontend selalu memulai ulang.
- Frontend: kunci grup dan judul tanggal dihitung dari `capturedAt` **dalam offset zona foto** bila ada (bukan zona pemirsa); tanpa offset, tampilkan apa adanya. Item di grup terurut sesuai `captured_at`.
- `PATCH /files/:id/captured-at` ("Ubah tanggal"): menerima tanggal+jam (+offset), set `captured_at_source=manual`; pemilik saja; A-vs-B; Zod.
- Tes: dua foto beda zona di hari yang sama; foto tanpa EXIF jatuh ke `lastModified`.

### RF-13 `MediaViewer` terpadu (8 SP) — B16

- Satu komponen `MediaViewer` menggantikan `full-viewer.tsx` dan `public-viewer.tsx` melalui adapter data (pemilik: favorit, bagikan, hapus; publik: unduh sesuai izin, bagikan).
- Pinch-zoom dua jari dan pan saat diperbesar (tanpa memblokir scroll sistem di luar viewer), double-tap zoom ke titik ketuk, swipe horizontal dengan transisi geser, swipe turun untuk menutup, preload item sebelum/sesudah, fokus terjebak di dialog dan Esc menutup. `prefers-reduced-motion`: transisi menjadi fade.
- Kontrol otomatis hilang 3 detik (sesuai DESIGN §6), tidak hilang saat panel Info terbuka.
- Kriteria: 360x800 dan desktop; tes manual di HP asli (pinch, swipe, rotasi layar). Tidak ada regresi: swipe-turun-tutup, penghitung "n / total", konfirmasi hapus.

### RF-14 Panel Info (5 SP)

- Tombol Info (ikon `Info`, `aria-label` "Lihat info") di viewer membuka bottom sheet (DESIGN §6): judul nama file; tanggal dan jam lokal foto (+ sumber bila `manual`/`upload` dengan keterangan kecil "diperkirakan"); tempat (RF-16) atau "Tanpa lokasi"; kamera, lensa, ISO/f/exposure/focal; resolusi dan ukuran; "Diunggah pada ...". Pemilik: tombol "Ubah tanggal" (RF-12).
- Koordinat mentah hanya di detail pemilik (`GET /files/:id` baru, pemilik saja). Halaman publik menampilkan tanggal, kamera, resolusi; lokasi hanya bila link `show_location` aktif (RF-21).
- Tes: A-vs-B untuk `GET /files/:id`; publik tidak pernah menerima `gps_*` bila `show_location=false` (tes e2e eksplisit).

### RF-15 Backfill file lama (3 SP)

- Job idempoten (`meta_version` < versi saat ini) mengekstrak ulang metadata, tanggal, dimensi, thumbnail, dan preview dari file asli. Konkurensi 1, jeda antar item, jalan malam atau lewat env `BACKFILL_ENABLED=true` (default false di dev). Progres di-log; aman dihentikan dan dilanjutkan; file fisik hilang dilewati dengan peringatan.
- Kriteria: dijalankan pada salinan data uji; tidak menaikkan RAM > anggaran; laporkan waktu per 100 item di HDD.

### RF-16 Nama tempat offline (5 SP)

- `PlaceService` memuat dataset kota sekali (lazy) dan mencari kota terdekat dari `gps_lat/gps_lng`; simpan `place_country/admin1/city`. Tidak ada panggilan jaringan keluar. Dijalankan saat upload dan di backfill.
- Tampil di panel Info sebagai "Kota, Provinsi, Negara". Tanpa peta.
- Kriteria: tambahan RAM terukur <= 150 MB; tes unit titik dikenal (mis. koordinat Jakarta, Denpasar); koordinat di laut/tak dikenal -> `null` tanpa error.

---

## Fase 2 — Berbagi yang matang

### RF-20 Halaman publik SSR dan preview OG (5 SP) — B6

- Endpoint `GET /public/s/:token/meta` (tanpa efek samping, tanpa hitungan view): judul, jumlah item, nama pemilik (nama tampilan bila ada, tanpa email), tersedia/tidaknya sampul, status (aktif/kedaluwarsa/dicabut/berpassword). Link berpassword **tidak** membocorkan judul atau sampul.
- `s/[token]/page.tsx` memanggil endpoint itu di server (JSON saja, byte file tidak lewat Vercel) dan menghasilkan `generateMetadata`: `og:title`, `og:description`, `og:image` = `/cover` (hanya bila tanpa password) + `noindex`. Komponen klien tetap menangani interaksi.
- Header halaman publik menampilkan "Dibagikan oleh {nama}" dan "berlaku sampai {tanggal}" (DESIGN §7); grid publik dikelompokkan per tanggal foto (D1).
- Kriteria: preview tampil di WhatsApp/Telegram (uji manual), `noindex` tetap, tidak ada regresi link kedaluwarsa/dicabut/berpassword.

### RF-21 `allowDownload` yang nyata, toggle lokasi, pembersihan GPS (8 SP) — B2, B3

- Migrasi `share_links.show_location` (default false); `CreateShareLinkRequest`/`UpdateShareLinkRequest` + modal Bagikan mendapat toggle "Tampilkan lokasi" (teks bantu: "Jika mati, lokasi disembunyikan dari penerima.").
- Perilaku endpoint publik:
  - Gambar inline (tanpa `?download=1`) **selalu** menyajikan preview (RF-11), tidak pernah file asli.
  - File asli hanya via `?download=1` dan hanya bila `allowDownload=true`.
  - Bila `show_location=false` dan file punya GPS: unduhan JPEG dibersihkan lokasinya. Untuk JPEG, tulis util kecil yang membuang segmen APP1 EXIF (lossless; tanggal tetap ada di database dan mtime ZIP). Format non-JPEG (HEIC/PNG/WebP/GIF) yang punya GPS diunduh sebagai JPEG kualitas tinggi tanpa metadata dengan keterangan di UI ("Diubah ke JPEG tanpa lokasi"). Jangan menambah dependensi penulis EXIF tanpa bertanya.
  - ZIP publik menerapkan aturan yang sama per entri **tanpa file sementara di disk** (stream melalui transform). Jika tidak memungkinkan, laporkan sebelum mengubah desain.
  - Video: streaming asli tidak bisa dicegah 100 persen; kebijakan GPS video ada di RF-34 bagian B. UI jujur: "Pemilik membatasi unduhan, tetapi video tetap bisa diputar."
- Kriteria: tes e2e: `allowDownload=false` -> `?download=1` 403 **dan** URL inline tidak mengembalikan byte asli (bandingkan hash/ukuran dengan preview); `show_location=false` -> respons tak memuat `gps_*`/`place_*`, unduhan JPEG bebas GPS (verifikasi dengan `exifr`).

### RF-22 Default kedaluwarsa album tanpa batas (2 SP) — D5

- Modal Bagikan: default `NEVER` untuk target album, `30_DAYS` untuk file; label jelas ("Tanpa batas — kamu bisa mencabutnya kapan saja"). Backend `calculateExpiresAt` default mengikuti `targetType` bila klien tidak mengirim `expiry`. Perbarui PRD US-26 (sudah di RF-00).
- Tes: default per target; opsi 1/7/30 hari tetap berfungsi.

### RF-23 Unduhan ramah HP dan "Baru ditambahkan" (5 SP) — D2

- Nama entri ZIP: `{Judul Album} - 001.ext` (nomor urut sesuai urutan album, padding sesuai jumlah), tetap menangani nama kembar dan karakter terlarang. mtime tiap entri = `captured_at`.
- Tombol "Simpan ke Galeri" di viewer (publik dan pemilik) memakai `navigator.canShare({ files })` + `navigator.share({ files })` untuk file tunggal; bila tak didukung, tombol Unduh biasa. File besar (> 50 MB) menampilkan peringatan sebelum memuat ke memori.
- Pilihan urutan "Baru ditambahkan" (urut `created_at`) di galeri; header grup memakai tanggal unggah di mode ini. (Antarmuka lengkap di RF-42; di story ini cukup parameter `sort=uploaded` dan satu kontrol minimal.)
- Kriteria: tes unit penamaan ZIP dan mtime; uji manual di Android Chrome dan iPhone Safari.

---

## Fase 3 — Live Photo, Motion Photo, dan video

### RF-30 Spike Live Photo di iPhone asli (2 SP)

- Siapkan `docs/testing/refactor-live.md` berisi panduan uji dan tabel hasil kosong. Hafiz menguji manual di iPhone: (a) pilih Live Photo lewat input file di Safari, (b) lewat aplikasi Files setelah "Export Unmodified Original" (HEIC + MOV), (c) unggah dari desktop. Catat file apa yang diterima server (jenis, ukuran, ada/tidaknya pasangan MOV).
- Hasil menentukan jalur yang didukung dan teks bantuan UI ("Untuk Live Photo, unggah dari ..."). Story ini tidak memblokir RF-31 dan RF-32.

### RF-31 Motion Photo Android (5 SP)

- Deteksi pada JPEG: XMP `GCamera:MotionPhoto=1` atau `Container:Directory` dengan `Item:Mime=video/mp4` dan `Item:Length` (format lama: `GCamera:MicroVideoOffset`). Simpan `live_kind=motion`, `live_offset`, `live_length`; validasi bahwa offset+panjang berada dalam ukuran file dan bagian itu diawali signature `ftyp` MP4.
- Endpoint `GET /files/:id/motion` dan versi publik (`/public/s/:token/files/:fileId/motion`, mengikuti aturan `allowDownload`/lokasi seperti RF-21): stream potongan byte dari **file yang sama** dengan Range (206), `Content-Type: video/mp4`. Tidak ada duplikasi di disk.
- Tes: fixture sintetis (JPEG + MP4 kecil ditempel), Range di batas potongan, A-vs-B.
- Catatan privasi: preview/unduhan dengan lokasi dibersihkan (RF-21) harus tidak merusak/ikut membuang bagian video tanpa sengaja; bila membuang EXIF memutus Motion Photo, unduhan "tanpa lokasi" memakai preview JPEG biasa dan menandai bahwa gerak dihilangkan.

### RF-32 Pairing Live Photo iOS (8 SP)

- Saat upload selesai: baca ContentIdentifier. HEIC: coba `exifr` (MakerNote Apple); MOV: `ffprobe` tag `com.apple.quicktime.content.identifier`. Bila `exifr` tidak membaca MakerNote, **lapor dan berhenti** sebelum membuat jalur cadangan; jalur cadangan yang disetujui hanya "usulkan pasangan" (nama dasar sama + MOV <= 4 detik + selisih waktu <= 2 detik) dengan konfirmasi pengguna, bukan penggabungan otomatis.
- Penggabungan: bila MOV tiba dan foto pasangan (owner sama, `live_group_id` sama) sudah ada -> isi `live_video_key` pada foto dan jangan buat baris `File` baru untuk MOV; bila foto tiba dan MOV yatim sudah ada -> gabungkan lalu hapus baris `File` MOV yatim (tanpa menghapus berkas fisik, yang menjadi `live_video_key`). Urutan kedatangan bebas. Kedua berkas dihitung kuota.
- Hapus/pulihkan/hapus permanen foto Live memperlakukan pasangan sebagai satu unit (termasuk berkas fisik MOV).
- Endpoint `GET /files/:id/motion` (pemilik) dan versi publik juga melayani `ios_pair` (stream `live_video_key` dengan Range). MOV tidak masuk daftar galeri sebagai item terpisah setelah digabung.
- Tes: dua urutan kedatangan, kuota, hapus unit, A-vs-B.

### RF-33 Tampilan Live (5 SP)

- Badge LIVE kecil di grid (pil `scrim`, caption `on-accent`, ikon konsentris Lucide) pada item `live_kind != none`, juga di album dan halaman publik.
- Di `MediaViewer`: video muted + `playsInline` ditumpuk di atas foto; tekan-tahan memutar (seperti iOS), putar sekali otomatis saat dibuka kecuali `prefers-reduced-motion` atau `navigator.connection.saveData`; tombol suara terpisah dan label `aria-label` Indonesia. Sumber video hanya diminta saat dibutuhkan (lazy).
- Kriteria: 360x800, HP asli; tidak mengganggu swipe dan zoom RF-13.

### RF-34 Metadata dan poster video (8 SP) — majukan US-35

Bagian A (Must):
- `ffprobe` saat upload selesai: `duration_s`, `width`, `height`, `creation_time` -> `captured_at` (sumber `video`), GPS ISO6709 -> `gps_lat/lng` (+ RF-16), kamera/model bila ada.
- `ffmpeg` mengambil satu frame (sekitar 10 persen durasi atau detik ke-1) sebagai poster WebP 400 px -> `thumb_key`. Antrian proses video: konkurensi 1, prioritas rendah (`nice`), timeout, tidak menahan respons upload (proses setelah file `ready`; UI tampil ikon sampai poster siap lalu `MediaThumb` memuat ulang).
- Pil durasi di grid galeri dan halaman publik/album memakai `duration_s` (format `m:ss`); backfill (RF-15) mencakup video.
- Kriteria: video MP4/MOV/WebM sintetis kecil; file rusak tidak menggagalkan upload; laporkan RAM/CPU saat memproses video 500 MB.

Bagian B (Should): GPS video pada link publik dengan `show_location=false`. Buat varian tanpa lokasi (`ffmpeg -map_metadata -1 -c copy`) saat pertama diminta, simpan sebagai cache `<storageKey>.nogps.<ext>` dengan TTL 7 hari dibersihkan job, dan sajikan di unduhan/ZIP/streaming publik. Bila tidak praktis, lapor dan dokumentasikan keterbatasan di PRD §11 sebelum menutup story.

---

## Fase 4 — Sortir, filter, dan aksi massal

### RF-40 API daftar: sortir, filter, pencarian (8 SP)

- `GET /files` menerima: `sort` (`taken` default, `uploaded`, `name`, `size`), `order` (`desc` default/`asc`), `from`/`to` (tanggal), `kind`, `live`, `hasLocation`, `favorite`, `unalbumed`, `place` (kota/provinsi/negara), `duplicates`, `q` (nama file dan tempat, tidak peka huruf besar-kecil). Zod di `packages/contracts`; parameter tak dikenal ditolak 400.
- Cursor keyset `(nilaiSort, id)` untuk semua mode; indeks pendukung seperlunya (laporkan hasil `EXPLAIN` untuk dua kueri terberat pada data uji >= 20.000 baris).
- Tes: tiap kombinasi utama, stabilitas halaman saat ada nilai sort kembar, A-vs-B.

### RF-41 Timeline dan loncat waktu (5 SP)

- `GET /files/timeline` (dengan filter yang sama) mengembalikan bucket `{ year, month, count }`. `GET /files?anchor=YYYY-MM` mengembalikan halaman yang mulai dari bulan itu lalu melanjutkan ke yang lebih lama.
- Frontend: scrubber tahun/bulan di sisi kanan (atau sheet "Lompat ke" di HP) dengan area sentuh >= 44 px; tetap berfungsi bersama infinite scroll dan IntersectionObserver.
- Kriteria: pustaka berisi >= 5.000 item uji tetap responsif; tidak ada header grup ganda saat melompat.

### RF-42 Filter bar dan sheet urutan (8 SP)

- Chip filter di bawah bilah atas (Jenis, Tanggal, Tempat, Favorit, Belum di album, Live, Duplikat) dan bottom sheet "Urutkan". State tersinkron ke URL (`?urut=&jenis=&...`) agar bisa dibagikan/refresh. Keadaan kosong khusus ("Tidak ada foto yang cocok" + tombol "Hapus filter"). Gunakan `accent-soft` untuk chip aktif sesuai DESIGN; satu aksen dominan per layar.
- Halaman Foto/Video/Favorit di bottom nav memakai komponen yang sama dengan filter bawaan.

### RF-43 Seleksi, aksi massal, picker album (8 SP) — B13, B14

- Bilah pilih menjadi: Bagikan cepat, Tambah ke album, Unduh (ZIP), Hapus. Ketuk judul grup tanggal memilih seluruh grup; "Pilih semua yang dimuat".
- "Tambah ke album": bottom sheet daftar album (dengan pencarian dan "Album baru") menggantikan modal 100 file. Picker "Tambah Foto" di detail album memakai daftar `GET /files` berpaginasi + filter + pencarian dengan infinite scroll (tidak ada batas 100).
- "Bagikan cepat": membuat album baru dari pilihan (judul default "Bagikan {tanggal}", bisa diubah) dan link tanpa batas, lalu membuka sheet salin/bagikan.
- Detail album: mode pilih (tekan lama atau tombol "Pilih") dengan aksi "Keluarkan dari album"; tombol keluarkan per item selalu terlihat di mode pilih, **bukan hover-only**.
- Kriteria: target sentuh >= 44 px, tidak ada aksi hover-only, tes manual di HP.

### RF-44 ZIP milik pemilik (5 SP) — B15

- `POST /files/zip` (body: daftar `ids`, batas jumlah/ukuran yang jelas, rate limit) dan `GET /albums/:id/zip` (struktur datar sebelum RF-52), memakai `createZipStream` (ZIP64 dari RF-02), nama entri dan mtime sesuai RF-23. Autentikasi + kepemilikan; id milik orang lain = 404 identik; hanya file `ready` dan tidak di Sampah.
- Frontend: tombol Unduh pilihan memanggil endpoint ini lewat navigasi/`<a>` ke URL aliran (byte tidak lewat Next.js); tombol "Unduh album" di detail album. Hapus loop `<a download>` lama.
- Tes: A-vs-B, id campuran milik sendiri dan orang lain, ZIP valid dibuka dengan pustaka uji.

### RF-45 Deteksi duplikat (5 SP)

- Hitung SHA-256 secara stream saat upload selesai -> `content_hash`; bila ada file aktif milik pengguna yang sama dengan hash sama, set `duplicate_of_id`. Tidak menghapus apa pun otomatis.
- UI: filter "Duplikat" (RF-42) dan aksi "Bersihkan duplikat" yang menampilkan pasangan dan meminta konfirmasi memindahkan salinan ke Sampah; salinan yang menjadi anggota album dipertahankan sampai pengguna memilih. Backfill hash masuk RF-15 (idempoten).
- Tes: dua upload isi sama, upload isi beda, file di Sampah tidak dihitung sebagai asli.

---

## Fase 5 — Album bersarang

### RF-50 Skema dan API album bersarang (8 SP) — D6

- Migrasi `albums.parent_id` (self FK, `Restrict`, nullable) + indeks `(owner_id, parent_id)`. Judul unik per induk (tidak peka huruf besar-kecil) -> 409 `ALBUM_TITLE_EXISTS` dengan pesan ramah.
- Endpoint: `GET /albums?parentId=` (null = akar), `POST /albums` (`title`, `parentId?`), `PATCH /albums/:id` (judul), `POST /albums/:id/move` (`parentId | null`), `GET /albums/:id` (breadcrumb, anak langsung, file), `DELETE /albums/:id?mode=only|subtree`.
- Aturan: kedalaman maks 4; cegah siklus dan memindah ke keturunan sendiri dengan recursive CTE di dalam transaksi (Serializable atau penguncian baris induk); hitung tinggi subtree saat memindah agar total kedalaman tetap <= 4. `mode=only`: sub-album dan file langsung naik ke induk (jika bentrok judul, tolak dengan 409 dan daftar bentrok); `mode=subtree`: hapus album dan keturunannya. **Foto tidak pernah ikut terhapus.** Link yang menarget album yang dihapus dicabut (pola RF-03).
- Kartu sub-album memakai sampul turunan (sampul sendiri atau foto pertama keturunan); `fileCount` untuk album mengikuti definisi tetap (hanya file langsung) dan tambahkan `childCount`.
- Tes: A-vs-B untuk setiap endpoint baru, siklus, kedalaman 5 ditolak, hapus kedua mode, judul kembar, `move` ke album milik orang lain = 404 identik.

### RF-51 UI album bersarang (8 SP)

- Daftar album menampilkan album akar. Detail album menampilkan breadcrumb (target >= 44 px, elipsis di tengah untuk jalur panjang), baris "Sub-album" (kartu album bergaya foto cetak dari DESIGN §6) di atas grid foto, dan aksi "Album baru di sini".
- "Pindahkan": bottom sheet pohon album dengan kedalaman terbatas dan penanda tingkat yang melebihi batas dinonaktifkan beserta alasannya. Dialog hapus dua pilihan ("Hapus album ini saja" / "Hapus album beserta isinya" + penjelasan "Foto tetap aman di galeri").
- Kriteria: 360x800; ketika kedalaman maks tercapai, "Album baru di sini" nonaktif dengan penjelasan satu kalimat.

### RF-52 Berbagi subtree, halaman publik, dan ZIP berstruktur (8 SP)

- Migrasi `share_links.include_children` (default true); toggle "Sertakan sub-album" di modal Bagikan untuk album yang punya anak.
- API publik: `GET /public/s/:token?path=<albumId>` hanya menerima album yang merupakan keturunan target (CTE); selain itu 404 identik. Aturan akses file (`getPublicFileContentInfo`, thumbnail, preview, motion) memeriksa bahwa file berada di subtree target bila `include_children=true`, dan hanya di album target bila false. Tes e2e: file di sub-album saat `include_children=false` -> 404; album saudara tak bisa diakses lewat `path`.
- ZIP publik dan pemilik mempertahankan struktur folder (`Induk/Anak/nama.jpg`), nama jalur disanitasi, ZIP64 aktif, aturan `allowDownload`/lokasi RF-21 berlaku.
- Halaman publik: breadcrumb dan navigasi sub-album (SSR-friendly lewat query `?a=<albumId>` bukan hash path), jumlah item per sub-album, OG tetap dari album akar.
- Kriteria: link ke album induk membuka sub-album; link lama yang dibuat sebelum fitur tetap berfungsi (default `include_children=true` hanya berpengaruh bila album punya anak).

---

## 5. Urutan dan ketergantungan

```text
RF-00 -> RF-01, RF-02, RF-03 (bebas satu sama lain)
RF-10 -> RF-11 -> RF-12 -> RF-13 -> RF-14 -> RF-16
RF-10/11/12 -> RF-15 (backfill) (ulangi untuk RF-34, RF-45, RF-16)
RF-11 + RF-03 -> RF-20 -> RF-21 -> RF-22 -> RF-23
RF-11/13 -> RF-31, RF-32 (RF-30 paralel) -> RF-33
RF-10 -> RF-34 (A) -> RF-34 (B)
RF-12 -> RF-40 -> RF-41 -> RF-42 -> RF-43 -> RF-44 -> RF-45
RF-02 + RF-40 -> RF-50 -> RF-51 -> RF-52
```

Urutan eksekusi yang disarankan: RF-00, RF-01, RF-02, RF-03, RF-10, RF-11, RF-12, RF-13, RF-14, RF-15, RF-16, RF-20, RF-21, RF-22, RF-23, RF-34, RF-30, RF-31, RF-32, RF-33, RF-40, RF-41, RF-42, RF-43, RF-44, RF-45, RF-50, RF-51, RF-52.

Estimasi total sekitar 150 SP (kapasitas awal 13-16 SP per sprint; sekitar 10 sprint satu minggu). Antigravity tidak perlu mengejar estimasi; urutan dan kriteria penerimaan yang mengikat.

## 6. Definition of Done per story

1. Kriteria penerimaan story terpenuhi dan terdokumentasi di PR/laporan (apa yang dijalankan, apa yang tidak).
2. Backend: lint, unit, e2e lolos (termasuk A-vs-B untuk resource baru dan tes bahwa endpoint publik tidak membocorkan `gps_*`/`place_*` saat `show_location=false`). Frontend: lint dan build lolos; 360x800 dicek, tanpa scroll horizontal.
3. Migrasi terversi, aditif, dan diuji naik pada salinan data uji; tidak ada rahasia di commit.
4. `docs/PROGRESS.md` dicentang pada commit terakhir; PRD/DESIGN diperbarui bila ada perubahan perilaku.
5. Story fitur: berhenti sebelum merge untuk tes manual Hafiz di HP asli (Android Chrome dan iPhone Safari bila relevan). Hal yang belum diverifikasi ditulis eksplisit di laporan.

## 7. Risiko dan hal yang belum diverifikasi

| Risiko | Mitigasi |
| --- | --- |
| Live Photo iPhone lewat browser kemungkinan hanya mengirim foto diam | RF-30 menguji dulu; UI memberi petunjuk jalur unggah yang benar; jangan menjanjikan fitur sebelum hasil uji. |
| `exifr` mungkin tidak membaca ContentIdentifier di MakerNote Apple | RF-32 berhenti dan lapor; jalur cadangan hanya dengan konfirmasi pengguna. |
| HEIC butuh libheif di image; ukuran image dan build time naik | RF-11 melaporkan pilihan, ukuran image, dan waktu build. |
| Beban CPU/RAM i3-7020U saat memproses preview, poster video, dan backfill | Konkurensi <= 2 (gambar) dan 1 (video, backfill), `nice`, jalan malam; RAM total < 3 GB. |
| Geocoder offline menambah RAM | Batas <= 150 MB; lazy load; laporkan hasil ukur. |
| Pembersihan GPS non-JPEG mengubah format unduhan | Dinyatakan jelas di UI (RF-21); pemilik bisa mengaktifkan "Tampilkan lokasi" bila ingin file asli utuh. |
| Migrasi `captured_at` not null pada tabel berisi | Backfill dalam migrasi yang sama dengan `COALESCE`; diuji pada salinan data. |
| Kuota menghitung Sampah dapat mengejutkan pengguna | Teks jelas di halaman Sampah dan Pengaturan ("Sampah ikut menghitung kuota sampai dihapus permanen"). |
| Cache publik atas thumbnail/preview setelah link dicabut | `public` cache hanya untuk link tanpa password; untuk lainnya `private`; dokumentasikan sisa risiko. |
| Dugaan bug B1-B17 belum dijalankan | Setiap story dimulai dengan tes merah; laporkan bila tidak terbukti. |

## 8. Pertanyaan terbuka

Tidak ada yang memblokir RF-00 sampai RF-16. Hasil RF-30 (uji iPhone) menentukan teks dan jalur dukungan Live Photo di UI.

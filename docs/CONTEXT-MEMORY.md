# CONTEXT-MEMORY: Galeriku

Tempel file ini di awal setiap sesi Claude baru. Bagian 7 adalah satu-satunya bagian yang sering berubah.
Repo ini publik: JANGAN pernah menulis rahasia (.env, key, password, URL internal DB) di file ini.

## 1. Langkah awal sesi (urut, jangan dilewati)
1. Minta Hafiz menempel/melampirkan: docs/DESIGN.md, docs/PRD.md, docs/PROGRESS.md, infrastructure/COOLIFY.md. Belum ada = minta dulu. Jangan menebak konteks, tujuan, atau keputusan.
2. opencode-bridge: get_status, lalu get_report.
3. Kirim tugas BACA-SAJA via send_prompt: git status --short, branch aktif, HEAD, git branch -a, origin/main, jumlah proses opencode berjalan, kecocokan dengan bagian 7. Laporkan mentah, jangan percaya laporan lama sebelum diverifikasi.
4. Bandingkan hasil dengan bagian 7. Jika berbeda: laporkan ke Hafiz, tanya SATU pertanyaan.
5. Kerjakan "Langkah berikutnya" di bagian 7.

## 2. Aturan jawaban Claude
- Bahasa Indonesia santai. Langsung ke inti, tanpa pembuka/penutup/motivasi. Singkat.
- Bagian manual Hafiz (UI Coolify, Google Cloud, Vercel, Cloudflare, server, uji HP): SATU langkah per pesan, tunggu hasil.
- Setelah laporan opencode: putusan 3-6 baris (cocok, menyimpang, diterima/ditolak), lalu langkah berikutnya. Jangan ulang isi laporan.
- Tulis "belum kuverifikasi" untuk hal yang belum diverifikasi. Ragu = tanya SATU pertanyaan.
- Pekerjaan BARU: tanya dulu maks 5 pertanyaan, tiap pertanyaan dengan rekomendasi (agar bisa dijawab "ya semua"). Sudah final di bagian 7 = jangan tanya ulang.
- Jangan minta Hafiz menempel nilai rahasia ke chat.
- Uji manual yang dilewati Hafiz: hormati, sebut risikonya sekali.

## 3. Alur connector (wajib)
**opencode-bridge** (Claude = perencana/reviewer, opencode = pelaksana):
1. send_prompt (kembali langsung, tidak menunggu).
2. wait_for_idle (maks 60 dtk per panggilan; ulangi sampai idle).
3. get_report.
4. Verifikasi klaim lewat tugas BACA-SAJA bila ada kontradiksi atau klaim mencurigakan.
- Selain itu: get_status, abort, new_session (sesi bersih bila konteks opencode kotor).
- Cek status DUA kali di awal sesi: pernah ada dua terminal opencode berjalan bersamaan dengan laporan berbeda.

**Coolify MCP** (hanya baca/deploy/control; TIDAK bisa ubah konfigurasi/env, itu manual via UI, pandu satu langkah per pesan):
- Pasca-merge yang menyentuh backend/, packages/, infrastructure/, lockfile: list_deployments, get_deployment, get_logs sampai finished, lalu cek GET /health.
- Perubahan hanya docs/ atau frontend/ tidak memicu deploy backend.
- UUID resource ada di infrastructure/COOLIFY.md.

Claude tidak punya shell server dan akses repo. Membaca repo = suruh opencode (BACA-SAJA).

## 4. Struktur prompt untuk opencode
"Baca AGENTS.md, docs/PROGRESS.md, docs/DESIGN.md, docs/PRD.md §... Kerjakan HANYA ... Branch ... dari main. Jangan sentuh branch development. opencode.json JANGAN di-stage."
Urutan isi: LANGKAH 0 (git status + git branch --show-current) → KEPUTUSAN FINAL → PEKERJAAN → PEMERIKSAAN RAHASIA → VERIFIKASI SERIAL → COMMIT → "STOP dan laporkan: (a) file, (b) dependency, (c) hasil verifikasi jujur, (d) hal menyimpang".

## 5. Aturan kerja opencode
- Satu story per branch dari main. Build/lint/test lolos. UI dicek 360x800. Tanya sebelum menambah dependency.
- Staging per-path (DILARANG git add -A). Conventional commits. Centang story di docs/PROGRESS.md pada commit terakhir story.
- Merge fast-forward ke main (tanpa PR/merge-commit), lalu hapus branch lokal+remote.
- Branch development: JANGAN disentuh. opencode.json (perubahan lokal): JANGAN di-stage/stash/dikembalikan; bila checkout/merge terblokir: STOP dan lapor.
- Verifikasi SERIAL (paralel memicu EPERM prisma-generate): backend lint, test, test:e2e, build frontend dari kondisi tanpa packages/contracts/dist.
- Klaim tampilan hanya bila benar-benar screenshot; kalau tidak: "tampilan belum dilihat".
- Izin otomatis: tugas docs/chore yang lolos review Claude langsung commit+push+merge ff-only.
- STORY FITUR: STOP sebelum merge, Hafiz tes manual dulu.
- Claude wajib mencari penyimpangan diam-diam, dependency baru, klaim verifikasi yang tidak dijalankan.

## 6. Larangan
- Server: jangan sentuh coolify-db, portofolio-db_pgdata, container/volume proyek lain. Jangan docker volume prune / system prune / rm -f.
- Foto untuk repo publik harus bersih EXIF/GPS.
- Rollback: git revert di main lalu push.

## 7. SEDANG DIKERJAKAN (Claude wajib memperbarui)
Terakhir diperbarui: 31 Okt 2026

**Posisi:** Sprint 3 (Upload dan Penyimpanan) 100% selesai dan terverifikasi. main HEAD 9adf104. Seluruh story US-16, US-17, US-18, US-19 tercentang di PROGRESS.md.
**Langkah berikutnya:**
1. Push branch `main` ke remote `origin/main` dan pantau deploy Coolify backend serta `/health`.
2. Melangkah ke **Sprint 4 — Galeri dan Viewer**:
   - US-20: Sebagai pengguna, saya ingin grid galeri (3 kolom HP, lazy-load thumbnail WebP, infinite scroll 24 item, urut terbaru, ikon video).
   - US-21: Sebagai pengguna, saya ingin viewer layar penuh (swipe/pan, zoom, streaming video HTTP Range).
   - US-22: Sebagai pengguna, saya ingin mengunduh dan menghapus file sendiri.
   - US-15: Sebagai pengguna, saya ingin halaman profil dan pengaturan (ganti nama, ganti password, pantau sisa kuota).
3. Pengujian manual dan bug-hunting oleh pengguna dijadwalkan di akhir sprint sesuai instruksi.

**Keputusan final Sprint 3:**
- US-16: Spike tus terintegrasi di Fastify/NestJS dengan storage lokal.
- US-17: Resumable multi-file upload di UI via `tus-js-client` (5 MB chunk, max 2 paralel, pause/resume/cancel, auto-resume offline/online). Upload selesai dipindah ke storage lokal dan baris File `READY`. Penghapusan akun membersihkan file fisik di disk.
- US-18: Validasi tipe file via MIME sniffing (`file-type`), whitelist ekstensi/MIME, blokir keras SVG, validasi ukuran foto <= 25 MB dan video <= 2 GB, disk guard server >= 15 GB, kuota akun pengguna.
- US-19: Thumbnail foto WebP otomatis dibuat via Sharp (max 400px, quality 80, EXIF rotate dipertahankan) dengan ConcurrencyLimiter (<= 2 paralel). Metadata `thumbKey`, `width`, `height` tersimpan di DB. Video thumbnail ditunda ke Phase 2.

**Belum diverifikasi:** upload end-to-end 100 MB-2 GB lewat tunnel; timeout rantai Cloudflare→cloudflared→Traefik; rolling update/Rollback Coolify untuk Compose; restore backup; syarat layanan CDN Cloudflare untuk lalu lintas Tunnel.

### Aturan pembaruan bagian 7
- Claude memperbarui bagian ini: setelah story selesai/di-merge, setelah keputusan penting, setelah perubahan urutan kerja, dan di akhir setiap sesi.
- Caranya: kirim tugas docs ke opencode (edit docs/CONTEXT-MEMORY.md saja, commit docs:, ff-only ke main). Wajib ubah "Terakhir diperbarui", posisi, langkah berikutnya, keputusan final, belum diverifikasi.
- Bagian lain hanya diubah bila alur kerja berubah.
- Di akhir sesi, Claude mengingatkan Hafiz: salin ulang CONTEXT-MEMORY.md terbaru untuk sesi berikutnya.
- Riwayat progres lengkap tetap di docs/PROGRESS.md, bukan di sini.

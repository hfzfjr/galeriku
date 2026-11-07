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
Terakhir diperbarui: 7 Nov 2026

**Posisi:** Sprint 0-7 (v1.0) 100% selesai dan terverifikasi di main. Mulai Refactor v1.1 (Fase 0 — Dokumen dan hotfix, RF-00).
**Langkah berikutnya:**
1. Eksekusi RF-00: Amandemen dokumen (PRD, DESIGN, AGENTS, PROGRESS, CONTEXT-MEMORY).
2. Lanjut ke RF-01 (Hotfix hapus permanen, sampul album, retensi sampah), RF-02, RF-03.
3. Lanjut ke Fase 1 (Fondasi metadata RF-10 s/d RF-16).

**Keputusan final Refactor v1.1:**
- D1: Urutan galeri default berdasarkan tanggal foto diambil (`captured_at`).
- D2: File asli diunduh tanpa merusak EXIF/tanggal asli (kecuali pembersihan lokasi link publik).
- D3: Dependensi disetujui: `exifr`, ffmpeg/ffprobe, libheif di Docker, geocoder offline.
- D4: Lokasi hanya nama tempat offline, disembunyikan di link publik secara default.
- D5: Link album default kedaluwarsa tanpa batas.
- D6: Album bersarang maksimal 4 tingkat.

**Belum diverifikasi:** Pengujian HP fisik atas fitur-fitur baru v1.1.

### Aturan pembaruan bagian 7
- Claude memperbarui bagian ini: setelah story selesai/di-merge, setelah keputusan penting, setelah perubahan urutan kerja, dan di akhir setiap sesi.
- Caranya: kirim tugas docs ke opencode (edit docs/CONTEXT-MEMORY.md saja, commit docs:, ff-only ke main). Wajib ubah "Terakhir diperbarui", posisi, langkah berikutnya, keputusan final, belum diverifikasi.
- Bagian lain hanya diubah bila alur kerja berubah.
- Di akhir sesi, Claude mengingatkan Hafiz: salin ulang CONTEXT-MEMORY.md terbaru untuk sesi berikutnya.
- Riwayat progres lengkap tetap di docs/PROGRESS.md, bukan di sini.

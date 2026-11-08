# Catatan Bug & Isu Teknis — Galeriku (Refactor v1.1)

Dokumen ini mencatat temuan bug, status perbaikan, dan edge case teknis yang teridentifikasi selama eksekusi `docs/REFACTOR.md` (RF-00 s/d RF-52).

---

## 1. Status Bug dari REFACTOR.md (B1 - B17)

| ID | Tingkat | Deskripsi & Lokasi | Status | RF Penyelesai |
| --- | --- | --- | --- | --- |
| **B1** | Kritis | Hapus album tidak mencabut link publik terkait (`revokedAt`). Link menjadi yatim. | **Selesai** | RF-03 |
| **B2** | Kritis | `allowDownload=false` bocor: viewer memuat file asli langsung. | *Dalam antrean* | RF-21 |
| **B3** | Tinggi | Unduhan publik membocorkan koordinat GPS privat saat lokasi dinonaktifkan. | *Dalam antrean* | RF-21 |
| **B4** | Tinggi | Viewer memuat file asli (hingga 25 MB) pada setiap slide/geser; boros bandwidth uplink. | **Selesai** | RF-11 |
| **B5** | Tinggi | `Content-Disposition` tidak compliant RFC 6266; nama file berkarakter khusus terpotong. | **Selesai** | RF-02 |
| **B6** | Tinggi | Halaman publik render client-side; preview OG/WhatsApp tidak muncul. | *Dalam antrean* | RF-20 |
| **B7** | Sedang | View count tautan publik naik terus-menerus pada setiap refresh/thumbnail. | **Selesai** | RF-03 |
| **B8** | Sedang | Token unlock tautan publik tidak kedaluwarsa setelah password diubah. | **Selesai** | RF-03 |
| **B9** | Sedang | ZIP album membuat file sementara di disk dan berisiko OOM pada file > 4 GiB. | **Selesai** | RF-02 |
| **B10** | Sedang | Hapus permanen foto sampul album menyisakan pointer null/rusak. | **Selesai** | RF-01 |
| **B11** | Sedang | Thumbnail & preview HEIC gagal di-decode di browser non-Safari. | **Selesai** | RF-11 |
| **B12** | Sedang | Urutan galeri mengabaikan zona waktu EXIF dan tanggal foto asli (`captured_at`). | *Dalam antrean* | RF-12 |
| **B13** | Sedang | Seleksi foto di album memiliki aksi hapus yang hanya muncul pada hover (sulit di HP). | *Dalam antrean* | RF-43 |
| **B14** | Rendah | Modal pemilih album membatasi maksimal 100 foto tanpa pagination. | *Dalam antrean* | RF-43 |
| **B15** | Rendah | Unduhan multi-select galeri memicu multiple download popups bukan ZIP. | *Dalam antrean* | RF-44 |
| **B16** | Rendah | Viewer terpisah antara galeri pemilik dan publik; pemeliharaan ganda. | *Dalam antrean* | RF-13 |
| **B17** | Rendah | Kuota tidak memperhitungkan file di Sampah sebelum 30 hari. | **Selesai** | RF-01 |

---

## 2. Temuan Khusus & Edge Cases

### 1. MIME Sniffing File SVG yang Dinamai `.png` (Sesuai Desain Keamanan)
- **Gejala:** Pengguna mengunggah berkas `Infografik Integritas Antikorupsi Modern.png` dan muncul pesan kesalahan `"Format SVG tidak diizinkan."`.
- **Penyebab:** Berkas tersebut berisi markup SVG (`<svg` / XML SVG) yang diekspor atau dinamai dengan ekstensi `.png`. Pemeriksaan `sniffAndValidateFile` pada backend membaca magic bytes dan header berkas. Karena format SVG dilarang keras di PRD §11 & §12.4 untuk mencegah serangan Stored XSS, backend secara ketat menolak berkas tersebut.
- **Tindakan:** Berkas berformat SVG asli harus diekspor sebagai raster PNG atau WebP murni dari editor desain grafis sebelum diunggah.

### 2. Decode HEIC di Server Linux (Docker Debian)
- **Solusi RF-11:** Dockerfile backend ditambahkan paket runtime `libheif-examples` dan `libheif-plugin-libde265`. Pemrosesan di `ThumbnailService` mencoba decode sharp terlebih dahulu, lalu otomatis menggunakan `heif-convert` jika sharp belum memiliki codec HEVC/libde265 bawaan.

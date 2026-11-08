# Panduan Pengujian Manual Browser — Galeriku (Refactor v1.1)

Panduan ini disiapkan untuk pengujian manual antarmuka dan fungsi melalui browser setelah rangkaian story selesai dieksekusi (atau per RF bila dibutuhkan).

---

## RF-01: Hapus Permanen, Sampul Album, & Retensi Sampah
1. Masuk ke halaman **Galeri**. Pilih satu foto yang dijadikan sampul album, lalu pindahkan ke **Sampah**.
2. Buka menu **Sampah**, lakukan "Hapus permanen" pada foto tersebut.
3. Buka halaman **Album**: pastikan album tetap terbuka rapi tanpa error 500, dan kartu album menampilkan sampul fallback atau foto berikutnya.
4. Periksa widget **Penyimpanan**: pastikan sisa kuota berkurang secara akurat ketika file berada di Sampah dan baru bertambah kembali setelah file dihapus permanen.

---

## RF-02: Unduhan, ZIP64, & Fallback Video
1. Unggah berkas dengan nama khusus berbahasa Indonesia atau spasi (contoh: `Foto Liburan Pantai & Gunung 2026.jpg`).
2. Unduh berkas dari viewer: pastikan nama berkas yang terunduh utuh sesuai nama aslinya (RFC 6266).
3. Buka album dengan banyak foto/video lalu klik "Unduh Album (ZIP)": pastikan unduhan ter-stream langsung tanpa menunggu pembuatan file sementara di server.

---

## RF-03: Hotfix Link Publik (Unlock, Hitungan View, & Pencabutan)
1. Buat tautan publik dengan proteksi kata sandi.
2. Buka link di jendela Incognito browser. Masukkan kata sandi: pastikan halaman galeri publik terbuka.
3. Ubah kata sandi link di menu Berbagi: buka kembali link di incognito dan verifikasi bahwa sesi unlock sebelumnya otomatis tidak berlaku (wajib memasukkan sandi baru).
4. Refresh halaman beberapa kali: periksa view count di dashboard bahwa hitungan hanya bertambah 1x per 30 menit dari IP yang sama.

---

## RF-10: Ekstraksi Metadata Saat Upload
1. Unggah foto JPEG asli dari kamera HP yang memiliki EXIF (tanggal dan kamera).
2. Periksa detail response upload bahwa tanggal foto (`capturedAt`), pembuat kamera (`cameraMake`), model (`cameraModel`), dan ISO/exposure berhasil terekstraksi.

---

## RF-11: Preview 2048 px & Pipeline HEIC
1. **Verifikasi Viewer Cepat (B4):**
   - Unggah foto beresolusi tinggi (> 2048 px atau foto kamera resolusi 12 MP/48 MP berukuran > 5 MB).
   - Buka foto di galeri. Buka **Network Tab** pada browser DevTools (`F12`), filter bagian `Img`.
   - Geser/buka foto: pastikan URL yang dimuat adalah `/files/:id/preview` (tipe `image/webp` dengan ukuran umumnya < 600 KB), bukan `/files/:id/content` (file asli yang berukuran puluhan MB).
   - Di bagian bawah viewer, klik tombol **"Lihat ukuran asli"**: pastikan gambar beralih memuat file asli dan tombol berubah menjadi **"Pratinjau cepat"**.
2. **Verifikasi Link Publik:**
   - Buka tautan publik `/s/:token` di browser.
   - Buka foto: pastikan gambar dimuat dari `/public/s/:token/files/:id/preview` dengan header `Cache-Control: public, max-age=86400` (atau `private` jika tautan berpassword).
3. **Verifikasi HEIC/HEIF (B11):**
   - Unggah berkas `.heic` dari iPhone atau berkas HEIC sampel.
   - Pastikan thumbnail di grid galeri muncul dan viewer dapat menampilkan preview WebP secara sempurna di browser desktop / Chrome Android.

---

## RF-12: Urutan dan Pengelompokan berdasarkan Captured_At
1. **Verifikasi Pengelompokan Tanggal Lokal Foto (B12):**
   - Unggah foto dengan offset zona waktu tertentu (misal EXIF OffsetTime +09:00).
   - Periksa grid galeri: foto harus terkelompok di header tanggal lokal aslinya, bukan tanggal UTC perangkat.
2. **Verifikasi Keyset Pagination:**
   - Gulir ke bawah pada galeri yang memiliki banyak foto: pastikan infinite scroll / pagination berikutnya termuat mulus dengan urutan `captured_at DESC, id DESC`.
3. **Verifikasi Ubah Tanggal Manual:**
   - Lakukan patch tanggal (`PATCH /files/:id/captured-at`) dengan payload tanggal baru.
   - Periksa galeri: pastikan foto berpindah grup ke tanggal yang baru diperbarui dan sumber tanggal ditandai sebagai `manual`.

---

## RF-13: MediaViewer Terpadu (Pinch-Zoom, Swipe, & Navigasi)
1. **Verifikasi Gestur Sentuh HP (Mobile 360x800):**
   - Buka viewer foto di HP atau responsive mode browser (F12, set viewport 360x800).
   - **Pinch-to-zoom:** lakukan cubit dua jari untuk memperbesar foto (skala 1x s/d 4x). Saat posisi diperbesar, geser satu/dua jari untuk pan gambar.
   - **Double-tap:** ketuk ganda pada area tertentu foto: pastikan foto langsung memperbesar (zoom in 2.5x) ke arah titik yang diketuk, ketuk ganda lagi untuk kembali ke ukuran normal.
   - **Swipe horizontal:** saat foto ukuran normal (1x), geser jari ke kiri/kanan: pastikan transisi slide berjalan mulus berpindah antar-foto.
   - **Drag-down to close:** geser foto ke arah bawah (> 90px): pastikan viewer mengecil/transparan dan tertutup otomatis.
2. **Verifikasi Otomatis Hilang Kontrol (3 Detik):**
   - Buka foto: pastikan bilah atas dan bawah hilang otomatis setelah 3 detik tanpa sentuhan/gerakan mouse.
   - Ketuk sekali pada layar: kontrol harus muncul kembali.
3. **Verifikasi Mode Pemilik vs Publik:**
   - Di Galeri pemilik: pastikan tersedia tombol Bintang (Favorit), Bagikan (membuka ShareModal), Unduh, dan Sampah (konfirmasi dialog hapus).
   - Di Tautan publik (`/s/:token`): pastikan tidak ada tombol Bintang atau Hapus, dan tombol Unduh hanya tampil bila link mengizinkan unduhan.
4. **Verifikasi Navigasi Keyboard & Aksesibilitas:**
   - Gunakan tombol `ArrowLeft` / `ArrowRight` di keyboard desktop untuk berpindah foto.
   - Tekan tombol `Esc` untuk menutup viewer.
   - Tekan `Tab`: pastikan fokus tetap berputar di dalam elemen kontrol viewer (focus trap).

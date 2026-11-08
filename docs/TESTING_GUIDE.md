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

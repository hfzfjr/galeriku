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

---

## RF-14: Panel Info (Bottom Sheet EXIF, Kamera, Lokasi, & Ubah Tanggal)
1. **Verifikasi Membuka Panel Info:**
   - Buka foto di viewer layar penuh, lalu klik tombol **Info** (ikon `Info`) di bilah atas.
   - Pastikan bottom sheet muncul dari bawah dengan judul nama file (huruf Fraunces serif italic).
   - Pastikan kontrol viewer tidak menghilang otomatis (timer 3 detik dijeda) saat panel Info sedang terbuka.
2. **Verifikasi Tampilan Metadata Lengkap:**
   - Periksa bagian **Waktu Pengambilan**: menampilkan tanggal dan jam dalam zona waktu lokal foto beserta label sumbernya (mis. "EXIF kamera", "Waktu modifikasi berkas", atau "Diubah manual").
   - Periksa bagian **Lokasi**: jika foto memiliki metadata GPS, koordinat lintang/bujur dan tautan "Buka peta" muncul (khusus pemilik); jika tidak ada, tampil "Tanpa lokasi".
   - Periksa bagian **Kamera**: menampilkan nama perangkat/kamera, model lensa, panjang fokus (mm), bukaan (`f/...`), kecepatan rana (`1/...s`), dan ISO.
   - Periksa bagian **Spesifikasi Berkas**: dimensi piksel (mis. `4032 × 3024 · 12.2 MP`), ukuran berkas dalam KB/MB, dan tanggal diunggah ke server.
3. **Verifikasi Aksi Ubah Tanggal:**
   - Di dalam panel Info (sebagai pemilik), klik tombol **"Ubah tanggal"**.
   - Masukkan tanggal dan waktu baru pada input datetime-local, lalu klik **"Simpan"**.
   - Pastikan tanggal yang tampil di panel Info langsung berubah, dan saat viewer ditutup, foto telah berpindah grup tanggal yang sesuai di grid galeri.
4. **Verifikasi Privasi pada Link Publik:**
   - Buka foto yang sama melalui tautan publik (`/s/:token`).
   - Buka panel Info: pastikan koordinat mentah GPS (`gpsLat`/`gpsLng`) tidak pernah ditampilkan atau dikirim dalam data response JSON.

---

## RF-15: Backfill File Lama (Idempoten, Preview, & EXIF)
1. **Verifikasi Job Backfill (CLI / Env):**
   - Jalankan backend dengan environment variable `BACKFILL_ENABLED=true`.
   - Periksa log konsol server saat inisialisasi: pastikan log mencatat `[BackfillService] Backfill: ditemukan X item untuk diproses.` dan mencatat setiap item yang diperbarui.
2. **Verifikasi Idempotensi & Ketahanan File Hilang:**
   - Pastikan file yang sudah diperbarui ditandai dengan `metaVersion = 1` dan tidak diproses ulang saat job dijalankan kembali.
   - Bila terdapat file di database yang fisiknya terhapus dari disk: pastikan server mencatat peringatan `File fisik tidak ditemukan` dan melanjutkan proses ke file berikutnya tanpa crash.

---

## RF-16: Nama Tempat Offline (Reverse Geocoding Tanpa Internet)
1. **Verifikasi Nama Tempat Otomatis (Saat Upload):**
   - Unggah foto yang memiliki metadata GPS (misal foto kamera HP di Jakarta atau Bali).
   - Buka panel Info pada viewer foto: pastikan baris Lokasi menampilkan nama tempat berformat `"Kota, Provinsi, Negara"` (contoh: `"Jakarta Pusat, DKI Jakarta, Indonesia"` atau `"Denpasar, Bali, Indonesia"`).
2. **Verifikasi Offline Penuh:**
   - Putuskan koneksi internet server (atau amati network tab / firewall): resolusi nama tempat tetap berjalan lancar dan instan (< 1 ms) tanpa ada request HTTP ke layanan peta luar.
3. **Verifikasi Koordinat di Laut / Tanpa GPS:**
   - Unggah foto tanpa GPS atau foto dengan koordinat di tengah laut lepas: pastikan baris Lokasi menampilkan `"Tanpa lokasi"` tanpa menimbulkan kesalahan pada aplikasi.

---

## RF-20: Halaman Publik SSR & Preview Open Graph (OG)
1. **Verifikasi Open Graph & SSR Metadata:**
   - Salin tautan publik (`/s/:token`) dari album atau file aktif.
   - Periksa metadata halaman menggunakan curl / view-source browser atau simulator WhatsApp / Telegram / OpenGraph checker:
     - Tag `<title>` memuat nama album/file (`"{Judul} — Galeriku"`).
     - Tag `<meta property="og:title">` dan `<meta property="og:description">` memuat nama pemilik dan jumlah item (`"Dibagikan oleh {nama} · {N} item"`).
     - Tag `<meta property="og:image">` mengarah ke `${API_URL}/public/s/${token}/cover` (bila memiliki sampul dan tidak berpassword).
     - Tag robots memuat `noindex, nofollow`.
2. **Verifikasi Keamanan Link Berpassword:**
   - Buka tautan publik berpassword:
     - Pastikan metadata tidak membocorkan judul, nama pemilik, atau gambar sampul (judul tampil sebagai `"Tautan Dilindungi Sandi — Galeriku"`).
     - Pastikan endpoint `GET /public/s/:token/meta` menjawab status `PASSWORD_PROTECTED` tanpa menaikkan view count.
3. **Verifikasi Header & Pengelompokan Tanggal Publik:**
   - Buka tautan album publik di browser:
     - Di bagian atas, pastikan teks subtitle menampilkan `"Dibagikan oleh {nama}"` serta `"Berlaku sampai {tanggal}"` jika memiliki batas kedaluwarsa.
     - Di grid foto album, pastikan foto-foto terkelompok rapi berdasarkan header tanggal pengambilan foto asli (`captured_at` / D1), bukan tercampur aduk.

---

## RF-21: allowDownload Nyata, Toggle Lokasi, & Pembersihan GPS
1. **Verifikasi Toggle Tampilkan Lokasi (Modal Bagikan):**
   - Buka foto atau album, klik tombol **Bagikan**.
   - Periksa keberadaan toggle baru: **"Tampilkan Lokasi"** dengan teks bantuan *"Jika mati, lokasi disembunyikan dari penerima."* (default tidak aktif / mati).
   - Buat link dengan toggle lokasi mati: buka link di tab baru / incognito, pastikan nama tempat dan GPS tidak muncul sama sekali di tampilan penerima.
2. **Verifikasi `allowDownload=false` Nyata (B2):**
   - Buat link dengan toggle "Izinkan Unduhan" dimatikan.
   - Buka link: gambar inline tetap memuat preview WebP 2048px dengan mulus tanpa memuat berkas asli.
   - Coba akses URL unduh langsung (`/public/s/:token/files/:id?download=1`): pastikan ditolak 403 `DOWNLOAD_FORBIDDEN`.
   - Coba unduh ZIP album (`/public/s/:token/zip`): pastikan ditolak 403 `DOWNLOAD_FORBIDDEN`.
   - Untuk video tunggal: pastikan video tetap dapat diputar streaming (Range), dengan catatan *"Pemilik membatasi unduhan, tetapi video tetap bisa diputar."*
3. **Verifikasi Pembersihan EXIF/GPS JPEG Lossless (B3):**
   - Buat link dengan "Tampilkan Lokasi" mati dan "Izinkan Unduhan" aktif pada foto JPEG yang memiliki koordinat GPS.
   - Unduh foto tersebut dari tautan publik.
   - Buka berkas yang diunduh dengan aplikasi penampil EXIF (atau `exifr`): pastikan koordinat GPS dan segmen APP1 telah terhapus bersih tanpa penurunan kualitas gambar.

---

## RF-22: Default Kedaluwarsa Album Tanpa Batas (D5)
1. **Verifikasi Default Target Album:**
   - Masuk ke halaman **Album**, buka salah satu album, lalu klik tombol **Bagikan**.
   - Periksa opsi Masa Berlaku: pastikan opsi **"Tanpa batas (Disarankan)"** otomatis terpilih secara default.
   - Periksa teks bantu di bawah pilihan: menampilkan *"Tanpa batas — kamu bisa mencabutnya kapan saja."*
   - Buat link tanpa mengubah pilihan: pastikan link berhasil terbuat dan detail tautan menyatakan berlaku selamanya (`expiresAt: null`).
2. **Verifikasi Default Target Foto/Video Tunggal:**
   - Buka satu foto dari galeri, lalu klik **Bagikan**.
   - Periksa opsi Masa Berlaku: pastikan default untuk file tunggal tetap **30 Hari**.
3. **Verifikasi Pilihan Eksplisit:**
   - Coba ubah masa berlaku album ke 1 Hari atau 7 Hari: pastikan opsi tetap dihormati dan tanggal kedaluwarsa terhitung tepat.

---

### RF-23: Unduhan Ramah HP dan "Baru Ditambahkan"

1. **Format Nama dan Timestamp Berkas ZIP Album:**
   - Masuk ke salah satu album yang memiliki beberapa foto/video, atau buka link publik album yang memiliki izin unduh aktif.
   - Klik tombol **Unduh Album (ZIP)**.
   - Buka file ZIP yang berhasil diunduh.
   - Pastikan nama-nama berkas di dalam ZIP berurutan dengan format `{Judul Album} - 001.ext`, `{Judul Album} - 002.ext`, dst. (padding minimal 3 digit, menyesuaikan jumlah file).
   - Periksa tanggal modifikasi (mtime) berkas di dalam ZIP: pastikan mencerminkan tanggal pengambilan foto (`captured_at`), bukan timestamp saat ZIP di-generate.

2. **Aksi "Simpan ke Galeri" di HP vs "Unduh Biasa" di Desktop:**
   - Buka foto di `MediaViewer` menggunakan smartphone (Android Chrome / iPhone Safari):
     - Pastikan tombol unduh memicu aksi Web Share API bawaan sistem HP untuk menyimpan foto langsung ke Galeri perangkat.
   - Buka foto di `MediaViewer` menggunakan browser desktop:
     - Pastikan tombol mengunduh berkas secara langsung ke folder Downloads komputer.
   - Pengujian berkas > 50 MB:
     - Pastikan muncul dialog konfirmasi memori sebelum berkas dimuat, dengan opsi "Tetap Simpan ke Galeri" dan "Unduh Biasa".

3. **Urutan Galeri "Baru Ditambahkan" (`sort=uploaded`):**
   - Di halaman Galeri (`/galeri`), perhatikan kontrol pemilih urutan di samping tombol "Pilih".
   - Ubah pilihan dari **Tanggal foto** menjadi **Baru ditambahkan**.
   - Pastikan grid seketika memuat ulang dan mengurutkan item berdasarkan waktu unggah (`createdAt` terbaru lebih dulu).
   - Pastikan header grup tanggal menampilkan tanggal foto diunggah ke server.

---

### RF-34: Metadata dan Poster Video

1. **Unggah Berkas Video dan Ekstraksi Metadata:**
   - Unggah video (MP4/MOV/WebM) dari HP atau komputer.
   - Perhatikan bahwa respons upload selesai instan tanpa tertahan konversi video.
   - Buka video di Galeri:
     - Pastikan pil durasi (badge) tampil di pojok kiri bawah thumbnail dengan format `m:ss` (contoh `0:42`, `2:15`).
     - Pastikan ikon Play tampil di pojok kanan atas thumbnail.
   - Buka viewer (`MediaViewer`) lalu buka panel Info (`Info`):
     - Pastikan durasi, resolusi (lebar x tinggi dengan rotasi yang benar), tanggal perekaman (`creation_time`), model kamera (jika ada di metadata MP4), dan lokasi GPS (jika ada) terbaca dengan tepat.

2. **Pembuatan Poster WebP Otomatis di Background:**
   - Setelah upload selesai, antrian background dengan konkurensi 1 memproses satu frame video di ~10% durasi menjadi poster WebP 400px (`<storageKey>.thumb.webp`).
   - Refresh atau tunggu beberapa saat: pastikan placeholder film berganti menjadi thumbnail frame gambar asli video tersebut.

3. **Link Publik Berbagi Video Tanpa Lokasi (`show_location = false`):**
   - Buat tautan berbagi untuk video yang memiliki koordinat GPS, matikan toggle "Tampilkan Lokasi".
   - Buka tautan publik tersebut dalam mode penyamaran (incognito).
   - Pastikan video dapat diputar secara lancar melalui HTTP Range streaming.
   - Unduh video melalui tombol unduh:
     - Periksa metadata video yang diunduh: pastikan tag lokasi ISO 6709 telah dibersihkan secara lossless (`ffmpeg -map_metadata -1 -c copy`).
   - Unduh album berisi video sebagai file ZIP: pastikan berkas video di dalam ZIP juga telah dibersihkan dari metadata lokasi.

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

---

### RF-30: Spike Live Photo di iPhone Asli

1. **Pengujian Skenario Unggah Live Photo:**
   - Buka panduan pengujian di `docs/testing/refactor-live.md`.
   - Lakukan 3 skenario unggah dengan iPhone asli:
     1. **Skenario A:** Unggah langsung dari Safari iOS via Photo Library.
     2. **Skenario B:** Ekspor asli tanpa modifikasi (*Export Unmodified Original*) ke aplikasi Files, lalu unggah pasangan HEIC + MOV.
     3. **Skenario C:** Ekspor ke komputer, lalu unggah berkas pasangan dari browser desktop.
   - Catat hasil pengamatan pada tabel di `docs/testing/refactor-live.md`.


---

### RF-31: Motion Photo Android

1. **Unggah Foto Motion Photo dari HP Android (Google Camera / Samsung):**
   - Ambil foto dengan fitur Motion Photo / Foto Bergerak aktif di Google Pixel atau HP Samsung.
   - Unggah foto tersebut ke Galeriku.
   - Periksa respons API bahwa file terdeteksi sebagai `liveKind: "motion"`.

2. **Pengujian Streaming Potongan Byte Video (`/motion`):**
   - Buka DevTools Network Tab.
   - Panggil endpoint `GET /files/:id/motion` dengan session cookie yang aktif.
   - Pastikan server mengembalikan stream `video/mp4` dari berkas JPEG yang sama menggunakan HTTP 206 (Range) tanpa duplikasi berkas di disk.

3. **Pengujian Link Publik Motion Video:**
   - Bagikan foto Motion Photo melalui tautan publik.
   - Buka `GET /public/s/:token/files/:fileId/motion`.
   - Pastikan video potongan Motion Photo dapat diputar secara lancar melalui browser incognito.
   - Uji foto normal tanpa Motion Photo: pastikan mengembalikan 404 identik.


---

### RF-32: Pairing Live Photo iOS

1. **Unggah Pasangan Live Photo (HEIC + MOV) dari iOS / Files:**
   - Ekspor foto Live Photo dari iPhone melalui menu "Export Unmodified Original" ke aplikasi Files sehingga menghasilkan 2 berkas: `IMG_xxxx.HEIC` dan `IMG_xxxx.MOV`.
   - Unggah kedua berkas tersebut ke Galeriku (coba baik HEIC lebih dulu maupun MOV lebih dulu).
   - Pastikan server berhasil membaca Apple `ContentIdentifier` dari kedua berkas dan menggabungkannya secara otomatis.

2. **Verifikasi Tampilan Galeri & Kuota:**
   - Buka Galeri: pastikan hanya muncul 1 item (foto HEIC dengan `liveKind: "ios_pair"`), dan berkas video MOV tidak muncul sebagai item terpisah.
   - Periksa ukuran berkas: ukuran item di galeri mencakup akumulasi ukuran foto + video (`photoBytes + movBytes`).
   - Periksa widget penyimpanan / kuota: kuota berkurang sesuai akumulasi kedua berkas.

3. **Verifikasi Penghapusan:**
   - Pindahkan foto Live Photo ke Sampah: pastikan foto dipindahkan ke Sampah sebagai satu unit.
   - Hapus permanen dari Sampah: pastikan kedua berkas fisik di server (`.heic` dan `.mov`) terhapus dari disk.

---

### RF-33: Tampilan Live (Badge Grid, MediaViewer, Tekan-Tahan, Suara)

1. **Badge LIVE di Grid (Galeri, Album, Publik, Favorit):**
   - Periksa grid foto: item dengan `liveKind` (`ios_pair` atau `motion`) harus menampilkan badge pil `LIVE` kecil dengan ikon konsentris di pojok kiri atas.
   - Item foto biasa atau video tidak boleh menampilkan badge LIVE.

2. **Pemutaran di MediaViewer:**
   - Klik/ketuk foto Live Photo: viewer membuka foto dan memuat klip video terkait di background.
   - Pastikan klip video otomatis berputar sekali saat dibuka (kecuali browser disetel `prefers-reduced-motion` atau Data Saver).
   - Pastikan tombol status `LIVE` di header menunjukkan indikator aktif saat video berputar.
   - Klik tombol `LIVE` di header untuk memutar ulang klip.

3. **Interaksi Tekan-Tahan (Hold-to-play) di Layar Sentuh & Mouse:**
   - Pada perangkat sentuh atau mouse: tekan dan tahan foto (hold) untuk memutar klip gerak terus-menerus.
   - Lepaskan sentuhan/klik untuk menghentikan pemutaran dan kembali ke foto diam.
   - Geser jari saat pinch-zoom atau swipe untuk memastikan gesture tidak memicu pemutaran yang tidak disengaja.

4. **Kontrol Suara (Mute / Unmute):**
   - Secara default video dimainkan dalam kondisi senyap (muted).
   - Klik tombol speaker / suara di header viewer untuk menyalakan suara klip Live Photo.
   - Pastikan suara terdengar pada klip yang memiliki audio stream.

---

### RF-40: API Daftar: Sortir, Filter, Pencarian

1. **Sortir dan Order:**
   - Buka `/files` dengan berbagai parameter sortir:
     - `sort=taken&order=desc` (default: urut waktu pengambilan foto terbaru).
     - `sort=taken&order=asc` (foto terlama lebih dulu).
     - `sort=uploaded&order=desc` (foto baru diunggah).
     - `sort=name&order=asc` (nama file A-Z).
     - `sort=size&order=desc` (file ukuran terbesar).
   - Pastikan pagination cursor stabil dan konsisten melangkah tanpa melewatkan item kembar.

2. **Filter Multi-Kombinasi:**
   - Filter `kind=image` vs `kind=video`.
   - Filter `live=true` (hanya foto gerak Live/Motion Photo).
   - Filter `hasLocation=true` (hanya file yang memiliki koordinat GPS).
   - Filter `favorite=true` (hanya file yang dibintangi).
   - Filter `unalbumed=true` (hanya file yang belum dimasukkan ke album manapun).
   - Filter rentang tanggal: `from=YYYY-MM-DD` dan `to=YYYY-MM-DD`.
   - Filter tempat: `place=Jakarta` atau `place=Bali`.

3. **Pencarian (`q`):**
   - Uji parameter `q=nama_file` dan `q=nama_tempat` (tidak peka huruf besar-kecil).
   - Pastikan hasil pencarian hanya menampilkan file milik pemilik yang sedang login.

4. **Validasi Strict Boundary:**
   - Uji mengirimkan parameter tidak dikenal (misal `/files?unknown=123`).
   - Pastikan API mengembalikan 400 `VALIDATION_ERROR` (strictness Zod).
   - Uji cursor dengan opsi sort berbeda: pastikan ditolak 400 `INVALID_CURSOR`.

---

### RF-41: Timeline dan Loncat Waktu

1. **Tombol "Lompat waktu" di Galeri (Mobile & Desktop):**
   - Buka halaman Galeri (`/galeri`).
   - Klik tombol "Lompat waktu" di bilah atas galeri:
     - Modal / bottom sheet "Lompat ke Waktu" muncul.
     - Linimasa foto dikelompokkan rapi per tahun dan bulan beserta jumlah fotonya.
   - Pilih salah satu bulan (misal Mei 2026):
     - Sheet tertutup, galeri melompat langsung memuat foto mulai dari bulan tersebut.
     - Tampil indikator filter aktif (misal "Mei 2026") beserta tombol "Terbaru" untuk me-reset.
     - Gulir ke bawah (infinite scroll): pastikan foto bulan-bulan sebelumnya terus dimuat secara mulus tanpa duplikasi header tanggal.

2. **Scrubber Vertikal Desktop:**
   - Pada layar desktop lebar (`>= 768px`), periksa bilah scrubber melayang di sisi kanan layar.
   - Klik salah satu tahun di scrubber: galeri otomatis melompat ke foto pada tahun tersebut.

3. **Kembali ke Foto Terbaru:**
   - Klik tombol "Terbaru" pada pil filter atau pilih "Kembali ke Foto Terbaru" di dalam sheet.
   - Pastikan galeri kembali menampilkan foto-foto paling baru.

---

### RF-42: Filter Bar dan Sheet Urutan

1. **Bilah Chip Filter Horisontal (`FilterBar`):**
   - Buka `/galeri` di perangkat mobile (360x800) atau desktop.
   - Periksa deretan chip filter yang dapat digeser horisontal secara mulus:
     - **Urutkan:** Menampilkan bottom sheet dengan 7 opsi pengurutan (Tanggal foto terbaru/terlama, Baru ditambahkan, Nama file A-Z/Z-A, Ukuran terbesar/terkecil). Memilih opsi memperbarui urutan galeri seketika dan mencantumkan query `?urut=...` pada URL browser.
     - **Jenis:** Menampilkan bottom sheet pilihan "Semua", "Foto", atau "Video".
     - **Favorit:** Chip toggle instan dengan ikon bintang. Menampilkan hanya file bertanda bintang.
     - **Live:** Chip toggle untuk foto bergerak (Motion Photo / iOS Live Photo).
     - **Belum di album:** Chip toggle untuk menampilkan file yang belum masuk ke album manapun.
     - **Tempat:** Menampilkan bottom sheet pencarian/input nama kota atau tempat.
     - **Tanggal:** Menampilkan bottom sheet rentang tanggal (dari - sampai).
     - **Duplikat:** Chip toggle untuk menampilkan file yang terdeteksi sebagai duplikat.
   - Setiap chip yang sedang aktif memiliki gaya `bg-accent-soft text-accent border-accent/40 font-medium`.

2. **Sinkronisasi State ke URL:**
   - Aktifkan salah satu atau kombinasi filter (misal jenis "video" dan urut "ukuran").
   - Periksa URL browser berubah menjadi `/galeri?urut=size_desc&jenis=video`.
   - Lakukan refresh halaman di browser: pastikan filter tetap aktif sesuai parameter URL.

3. **Keadaan Kosong Khusus (Empty State Filter):**
   - Terapkan filter yang tidak menghasilkan file apapun (misal tempat "Antartika" atau tanggal masa depan).
   - Pastikan muncul keadaan kosong khusus: ikon putar kembali, judul "Tidak ada foto yang cocok", deskripsi instruktif, dan tombol "Hapus filter".
   - Klik tombol "Hapus filter": pastikan semua filter terhapus dan galeri kembali menampilkan seluruh foto.





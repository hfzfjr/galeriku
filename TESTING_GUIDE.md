# Panduan Pengujian Manual — Galeriku (Desktop & iOS)

Dokumen ini berisi panduan pengujian manual melalui browser (Desktop Chrome/Safari & iOS Safari) untuk memverifikasi 5 perbaikan bug yang telah diimplementasikan:

---

### Ringkasan Perbaikan yang Diterapkan

1. **Bug 1 — Foto lama tidak bisa dibuka (broken preview / 404):**
   - **Penyebab:** Foto yang diunggah sebelum refactor belum memiliki varian `previewKey` (2048px WebP) di basis data, sehingga endpoint `/files/:id/preview` melempar 404.
   - **Solusi:** Endpoint `GET /files/:id/preview` dan `GET /public/s/:token/files/:id/preview` kini memiliki fallback transparan bertingkat. Jika `previewKey` belum terbuat, sistem otomatis menyajikan berkas fisik asli (`storageKey`) dengan MIME type aslinya, atau thumbnail (`thumbKey`). Berkas lama tidak akan pernah lagi melempar 404.
   - **Bonus:** `BackfillService` kini berjalan otomatis di latar belakang saat server menyala untuk men-generate `previewKey`, mengekstrak metadata EXIF lengkap, dan lokasi GPS secara mandiri.

2. **Bug 2 — Foto baru berada di urutan paling bawah:**
   - **Penyebab:** Saat migrasi penambahan kolom `captured_at`, nilai default `CURRENT_TIMESTAMP` mengisi seluruh berkas lama dengan waktu saat migrasi dieksekusi (malam hari, 22:xx), sedangkan foto baru motor Vespa memiliki tanggal EXIF pagi hari (04:08 AM). Akibatnya, pada `ORDER BY captured_at DESC`, berkas lama dianggap lebih baru daripada foto pagi hari.
   - **Solusi:** Dijalankan migrasi Prisma `20261108220000_fix_legacy_captured_at` yang menyelaraskan `captured_at = COALESCE(taken_at, created_at)`. Seluruh foto lama otomatis kembali ke garis waktu historis aslinya, sehingga foto yang baru diambil/diunggah hari ini berada di posisi paling atas galeri.

3. **Bug 3 — Tombol kontrol MediaViewer tidak terlihat di Desktop:**
   - **Penyebab:** Timer auto-hide menyembunyikan kontrol setelah 3 detik dan tidak merespons gerakan mouse di desktop, serta kontras latar yang tipis.
   - **Solusi:**
     - Bilah atas (Header) dan bilah bawah kini menggunakan `bg-black/80 backdrop-blur-md border-white/10` dengan kontras tinggi.
     - Kontrol langsung muncul saat kursor mouse digerakkan (`onMouseMove`).
     - Kontrol **tidak akan hilang** selama kursor melayang (hover) di atas bilah tombol atas atau bilah slider bawah.
     - Semua tombol aksi lengkap: Tutup (X), Counter (`145 / 146`), Nama file, Tanggal & Jam, Pin Lokasi (jika ada data GPS), Bintang Favorit, Info, Bagikan, Unduh/Simpan ke Galeri, dan Tempat Sampah.
     - Panah navigasi samping kiri dan kanan (lingkaran transparan kontras tinggi di tengah layar desktop).

4. **Bug 4 — Zoom klik 2x, Drag/Pan, dan Klik di Luar untuk Tutup di Desktop:**
   - **Solusi:**
     - **Klik 2x (Double-click):** Klik dua kali pada foto untuk memperbesar (zoom 2.5x) ke titik kursor. Klik dua kali lagi saat zoom untuk kembali ke ukuran normal (1x).
     - **Geser/Pan dengan Mouse:** Saat posisi zoom > 1x, tahan tombol kiri mouse dan geser untuk melihat bagian foto lainnya (`cursor-grab` dan `cursor-grabbing`).
     - **Klik di Luar (Backdrop Click):** Klik pada area gelap di luar foto:
       - Jika sedang dalam kondisi zoom, klik di luar akan mengembalikan zoom ke 1x.
       - Jika dalam kondisi ukuran normal (1x), klik di luar akan langsung menutup viewer preview.

5. **Bug 5 — Filmstrip Thumbnail Slider ala WhatsApp Desktop:**
   - **Solusi:**
     - Pada bagian bawah viewer desktop (dan layar mobile), terdapat slider horizontal yang menampilkan deretan thumbnail foto di galeri.
     - Foto yang sedang dibuka ditandai dengan outline/ring kuning amber tebal.
     - Mengklik thumbnail langsung berpindah ke foto tersebut secara instan.
     - Slider thumbnail otomatis melakukan *smooth-scroll* ke tengah layar mengikuti foto yang sedang aktif saat berpindah menggunakan panah atau keyboard.

---

### Skenario Pengujian Manual di Browser

#### A. Pengujian Desktop (Chrome / Safari / Firefox)
1. Buka `https://galeriku.hafizfajar.com/galeri` (atau `localhost:3000/galeri`).
2. **Cek Urutan Galeri:**
   - Pastikan foto yang baru diunggah (misal motor Vespa hijau) berada di deretan **paling atas** galeri.
   - Pastikan foto-foto lama tersusun rapi sesuai tanggal pengambilan/unggah historisnya.
3. **Buka Foto Lama:**
   - Klik salah satu foto lama yang sebelumnya gagal dimuat (`IMG_5583.jpeg`).
   - Pastikan foto langsung terbuka dengan tajam tanpa ada ikon gambar rusak atau teks patah.
4. **Cek Tombol & Info Atas:**
   - Pastikan di bilah atas terlihat jelas:
     - Tombol **X** (Tutup) di pojok kiri atas dan counter item (misal `145 / 146`).
     - Di tengah: nama berkas, tanggal & jam pengambilan, dan nama lokasi (jika foto memiliki koordinat GPS).
     - Di pojok kanan atas: Bintang favorit, Info (i), Bagikan, Unduh, dan Tempat Sampah.
   - Gerakkan kursor ke atas tombol: pastikan kontrol tetap terlihat dan tidak menghilang saat kursor berada di bilah kontrol.
5. **Cek Panah Kiri & Kanan:**
   - Klik tombol panah kanan (`>`) di sisi kanan layar untuk beralih ke foto berikutnya.
   - Klik tombol panah kiri (`<`) di sisi kiri layar untuk beralih ke foto sebelumnya.
   - Navigasi keyboard (tombol panah kanan/kiri dan Escape) juga tetap berfungsi.
6. **Cek Filmstrip Thumbnail Slider:**
   - Di bagian bawah, perhatikan deretan thumbnail kecil.
   - Klik sembarang thumbnail untuk langsung loncat ke foto tersebut.
   - Perhatikan thumbnail yang aktif memiliki highlight kuning amber dan otomatis bergeser ke tengah.
7. **Cek Double-Click Zoom & Mouse Drag:**
   - Lakukan klik 2 kali (double-click) pada foto. Foto akan membesar (zoom 2.5x).
   - Kursor mouse akan berubah menjadi tangan terbuka (`grab`).
   - Tekan dan tahan tombol kiri mouse lalu geser kursor: foto akan bergeser mengikuti mouse (`grabbing`).
   - Lakukan double-click lagi pada foto: foto akan kembali ke ukuran 1x.
8. **Cek Klik di Luar (Backdrop Click):**
   - Saat foto berukuran normal (1x), klik area gelap di sisi kiri atau kanan foto. Viewer akan langsung tertutup kembali ke galeri.

---

#### B. Pengujian Mobile / iOS (iPhone Safari 360x800)
1. Buka galeri di iPhone Safari.
2. Buka salah satu foto.
3. **Ketuk Layar (Tap):**
   - Ketuk foto sekali: bilah kontrol atas dan bawah akan memudar (fullscreen murni).
   - Ketuk foto sekali lagi: bilah kontrol akan muncul kembali.
4. **Gestur Swipe Down:**
   - Tarik foto ke arah bawah dengan jari: foto akan mengecil mengikuti jari dan viewer akan tertutup (*interactive dismiss*).
5. **Gestur Swipe Kanan / Kiri:**
   - Geser foto ke kiri atau ke kanan untuk berpindah ke foto berikutnya/sebelumnya.
6. **Pinch-to-zoom & Double-tap:**
   - Cubit dengan 2 jari untuk zoom in / zoom out.
   - Ketuk 2 kali dengan cepat untuk langsung zoom ke titik yang diketuk.
7. **Filmstrip Bawah:**
   - Di layar iPhone, thumbnail strip tampil proporsional di bawah dan dapat digeser horizontal dengan jari.

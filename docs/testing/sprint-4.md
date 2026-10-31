# Panduan Pengujian Manual — Sprint 4 (Galeri dan Viewer)

Panduan ini disusun untuk memudahkan pengujian manual fitur-fitur **Sprint 4** melalui peramban (browser) di desktop maupun tampilan ponsel pintar (*mobile* 360×800 px).

---

## 1. Persiapan Awal
1. Pastikan backend dan frontend berjalan lokal:
   - Backend: `pnpm dev:backend` (port 4000)
   - Frontend: `pnpm dev:frontend` (port 3000)
2. Masuk (*login*) ke aplikasi melalui `http://localhost:3000/login` atau daftarkan akun baru.
3. Siapkan setidaknya 3–5 file media (campuran foto JPG/PNG dan video MP4/MOV) yang telah diunggah di galeri.

---

## 2. Pengujian Skenario US-20: Grid Galeri

| No | Skenario Uji | Langkah Pengujian | Hasil yang Diharapkan |
|---|---|---|---|
| 2.1 | Tampilan Responsif Mobile & Desktop | Buka `http://localhost:3000/app` pada resolusi ponsel (lebar 360 px melalui DevTools Responsive Mode), lalu coba di layar desktop. | Pada ponsel tampil 3 kolom foto/video dengan rasio 1:1 (*square*). Pada desktop lebar kolom menyesuaikan secara proporsional. |
| 2.2 | Thumbnail & Transisi Gambar | Muat ulang galeri dan amati gambar saat pertama kali muncul. | Gambar dimuat menggunakan format WebP hemat kuota dengan transisi fade-in 150 ms halus (tidak ada layout shift berkedip kasar). |
| 2.3 | Penanda/Badge Video | Unggah setidaknya 1 berkas video (misalnya MP4). Lihat tampilannya di grid. | Thumbnail video memiliki badge gelap semi-transparan di pojok kiri bawah dengan ikon *Play* dan durasi terformat (contoh: `0:42` atau `1:15`). |
| 2.4 | Pengelompokan Berdasarkan Tanggal | Unggah foto di hari yang sama, dan jika memungkinkan bandingkan dengan foto hari sebelumnya. | Terdapat label pembatas tanggal yang elegan (misal: "Hari ini", "Kemarin", atau tanggal lengkap). |
| 2.5 | Infinite Scroll / Paginasi Cursor | Jika memiliki lebih dari 24 item media, scroll halaman ke bagian paling bawah. | Aplikasi secara otomatis memuat 24 item berikutnya secara mulus tanpa tombol "Next" manual (*cursor-based pagination*). |
| 2.6 | Tampilan Galeri Kosong (*Empty State*) | Buat akun baru yang belum memiliki file sama sekali dan buka `/app`. | Ditampilkan ilustrasi/ikon ramah beserta teks ajakan bertindak (CTA) untuk mulai mengunggah foto/video pertama. |

---

## 3. Pengujian Skenario US-21: Viewer Layar Penuh

| No | Skenario Uji | Langkah Pengujian | Hasil yang Diharapkan |
|---|---|---|---|
| 3.1 | Pembukaan Viewer & Latar Gelap | Klik salah satu item foto/video di grid galeri. | Viewer layar penuh terbuka seketika dengan latar belakang gelap pekat (`#14110E`), memusatkan media di tengah layar. |
| 3.2 | Auto Fade-out Kontrol Antarmuka | Buka viewer dan diamkan mouse/layar selama 3 detik tanpa interaksi. | Header atas (nama file & tombol tutup) dan bilah bawah otomatis memudar menghilang (*fade-out*). Ketuk sekali di area layar untuk memunculkannya kembali. |
| 3.3 | Navigasi Geser (Swipe Gesture) | Pada mode sentuh ponsel (DevTools touch simulation): geser/swipe ke kiri atau ke kanan. | Viewer berpindah ke foto/video berikutnya atau sebelumnya secara responsif. Tombol panah kiri/kanan di desktop juga berfungsi sama. |
| 3.4 | Zoom Dobel-Ketuk (Double-Tap Zoom) | Pada foto: lakukan klik dua kali (atau ketuk dua kali cepat di layar sentuh). | Foto diperbesar 2.5x ke titik ketukan. Lakukan dobel-ketuk sekali lagi untuk mengembalikan ukuran normal (1x). |
| 3.5 | Tutup dengan Tarik ke Bawah (Swipe Down) | Tarik media ke arah bawah sejauh > 90 piksel lalu lepaskan. | Viewer tertutup mulus dan pengguna kembali ke posisi grid semula. Tombol silang (X) di pojok kiri atas juga dapat menutup viewer. |
| 3.6 | Pemutaran Video Streaming (HTTP Range) | Buka berkas video di viewer, tekan tombol Play, lalu geser slider waktu (*seek/scrubbing*) ke menit tengah. | Video langsung melompat (*instant seek*) dan memutar dari titik baru berkat dukungan HTTP Range `206 Partial Content` tanpa perlu mengunduh seluruh file dari awal. |

---

## 4. Pengujian Skenario US-22: Unduh dan Hapus File

| No | Skenario Uji | Langkah Pengujian | Hasil yang Diharapkan |
|---|---|---|---|
| 4.1 | Unduh Berkas Tunggal | Buka foto/video di viewer layar penuh, klik tombol ikon "Unduh". | File terunduh langsung ke peramban dengan nama asli file saat diunggah (bukan UUID storage key). |
| 4.2 | Hapus Berkas Tunggal | Buka foto/video di viewer, klik tombol ikon "Hapus" (tempat sampah merah). | Muncul dialog konfirmasi: *"Hapus foto ini? File akan dihapus permanen dari galerimu."*. Klik tombol "Hapus". File tertutup dan hilang dari galeri. |
| 4.3 | Mode Multi-Seleksi (Pilih Banyak) | Di halaman grid galeri, klik tombol "Pilih" di bilah atas (atau tahan lama/long-press pada thumbnail selama 500 ms). | Masuk ke *Selection Mode*: muncul lingkaran checkbox di pojok setiap foto, thumbnail sedikit mengecil (inset 6 px), dan muncul bilah aksi melayang di bagian bawah. |
| 4.4 | Memilih Beberapa File | Klik beberapa thumbnail untuk memilih 2 atau 3 file sekaligus. | Jumlah item di bilah bawah terupdate: misal *"3 dipilih"*, checkbox tercentang warna aksen amber. |
| 4.5 | Hapus Banyak File (Batch Delete) | Klik tombol "Hapus (N)" di bilah aksi bawah. | Muncul modal konfirmasi jumlah file yang akan dihapus. Setelah disetujui, semua file terpilih dihapus dari galeri dan penyimpanan disk. |
| 4.6 | Batal Seleksi | Klik tombol "Batal" di header atau tekan tombol Escape. | Mode seleksi keluar, checkbox hilang, dan thumbnail kembali ke ukuran normal. |

---

## 5. Pengujian Skenario US-15: Profil dan Pengaturan Akun

| No | Skenario Uji | Langkah Pengujian | Hasil yang Diharapkan |
|---|---|---|---|
| 5.1 | Tampilan Profil & Avatar | Buka menu navigasi bawah tab "Akun" (`/app/settings`). | Kartu profil menampilkan avatar (atau inisial nama berlingkaran jika belum ada avatar Google), nama pengguna, alamat email, dan lencana peran (Pengguna / Admin). |
| 5.2 | Meter Pemakaian Penyimpanan (Kuota) | Perhatikan bilah persentase kuota pada kartu "Penyimpanan". | Menampilkan teks rapi, contoh: `42.5 MB dari 10 GB` beserta progress bar visual yang terisi sesuai rasio pemakaian asli dari database. |
| 5.3 | Keamanan: Akun Biasa (Email & Password) | Masuk dengan akun email biasa yang sudah memiliki password. | Bagian "Keamanan" menampilkan status *"Kata sandi akun"* dengan badge hijau *"Aktif"*. Form pembuatan password tidak muncul karena password sudah ada. |
| 5.4 | Keamanan: Akun Google (Tambah Password) | Masuk dengan akun Google (atau pengguna tanpa password hash). | Muncul form *"Tambahkan Kata Sandi"* dengan field *Kata Sandi Baru* dan *Ulangi Kata Sandi*. Masukkan password minimal 8 karakter lalu klik *"Simpan Kata Sandi"*. |
| 5.5 | Validasi Form Password | Masukkan password kurang dari 8 karakter atau ulangi password yang berbeda. | Muncul pesan galat validasi berbahasa Indonesia yang jelas tanpa refresh halaman. |
| 5.6 | Logout / Keluar Sesi | Klik tombol merah "Keluar dari Akun". | Sesi server dihapus (cookie sesi dihapus oleh browser) dan peramban diarahkan kembali ke halaman `/login`. Mengakses `/app` setelah ini akan langsung dialihkan ke login. |

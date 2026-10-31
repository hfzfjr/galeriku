# Panduan Pengujian Manual — Sprint 5 (Album dan Link Publik Inti)

Panduan ini disusun untuk pengujian manual fitur-fitur **Sprint 5** melalui peramban (desktop dan simulasi perangkat bergerak 360×800 px).

---

## 1. Persiapan Lingkungan Uji
1. Jalankan backend: `pnpm dev:backend` (port 4000).
2. Jalankan frontend: `pnpm dev:frontend` (port 3000).
3. Siapkan satu peramban utama (dalam kondisi login) dan satu jendela *Incognito* / *Private Browsing* (sebagai penerima tanpa login).

---

## 2. Pengujian Skenario US-23: Pengelolaan Album

| No | Skenario Uji | Langkah Pengujian | Hasil yang Diharapkan |
|---|---|---|---|
| 2.1 | Buat Album Baru | Buka menu navigasi tab "Album" (`/app/albums`), klik tombol "Buat Album", masukkan nama misal *"Liburan Bali"*, lalu klik Simpan. | Modal tertutup, album baru muncul di grid album dengan jumlah *"0 item"* dan placeholder cover. |
| 2.2 | Tambah Foto ke Album | Klik kartu album untuk membuka halaman detail (`/app/albums/[id]`). Klik tombol "Tambah Foto". | Muncul modal pemilih foto dari galerimu. Pilih 2 atau 3 foto lalu klik *"Tambahkan ke Album"*. Foto langsung masuk ke grid album. |
| 2.3 | Cover Otomatis | Periksa foto sampul di halaman detail album dan di daftar album `/app/albums`. | Sampul album secara otomatis memakai foto pertama yang dimasukkan ke album. |
| 2.4 | Ubah Nama Album | Klik ikon pensil di samping judul album, ganti nama menjadi *"Liburan Bali 2026"*, klik Simpan. | Judul album langsung terbarui di header halaman detail dan daftar album. |
| 2.5 | Keluarkan Foto dari Album | Arahkan kursor atau sentuh salah satu foto di album, klik ikon *Folder Minus* (keluarkan dari album). | Foto dikeluarkan dari album. Foto asli tetap aman berada di galeri utama (`/app`). Jika foto tersebut adalah sampul, sampul otomatis beralih ke foto berikutnya. |
| 2.6 | Hapus Album | Klik tombol merah "Hapus Album" di pojok kanan atas, lalu konfirmasi. | Album terhapus dan pengguna diarahkan kembali ke `/app/albums`. Semua foto asli tetap utuh di galeri. |

---

## 3. Pengujian Skenario US-24: Membuat Link Publik

| No | Skenario Uji | Langkah Pengujian | Hasil yang Diharapkan |
|---|---|---|---|
| 3.1 | Bagikan Foto Tunggal | Buka foto apa saja di galeri dalam viewer layar penuh (`FullViewer`). Klik tombol ikon *Bagikan* (share) di bilah atas. | Muncul modal "Bagikan Tautan" berisi URL publik (`http://localhost:3000/s/<token>`) dengan tombol *"Salin Tautan"*. |
| 3.2 | Salin ke Clipboard | Klik tombol "Salin Tautan" di modal berbagi. | Tombol berubah menjadi ikon centang hijau dengan teks *"Tersalin!"*. URL link tersalin ke clipboard. |
| 3.3 | Bagikan Album | Buka halaman detail album `/app/albums/[id]`, klik tombol "Bagikan" di bilah atas. | Modal berbagi terbuka dan menghasilkan tautan publik untuk seluruh isi album tersebut. |
| 3.4 | Riwayat Tautan di Tab "Link" | Buka menu navigasi tab "Link" (`/app/shares`). | Menampilkan kartu daftar semua tautan yang pernah dibuat, lengkap dengan tipe (Foto/Album), judul, potongan token, jumlah dilihat (*view count*), dan tombol salin cepat. |

---

## 4. Pengujian Skenario US-25: Membuka dan Mengunduh Tanpa Login

| No | Skenario Uji | Langkah Pengujian | Hasil yang Diharapkan |
|---|---|---|---|
| 4.1 | Buka Link Publik Tanpa Login | Buka jendela baru *Incognito* / *Private Window* (tanpa cookie sesi), tempel URL `/s/<token>`. | Halaman publik terbuka tanpa diminta login. Menampilkan judul, jumlah media, serta grid foto/album secara mobile-first. |
| 4.2 | Tag Meta Noindex & Keamanan | Periksa inspeksi elemen `<head>` pada halaman `/s/[token]`. | Terdapat `<meta name="robots" content="noindex, nofollow">` dan header respons HTTP `X-Robots-Tag: noindex, nofollow` untuk privasi. |
| 4.3 | Putar Video Publik (Streaming Range) | Jika tautan memuat video, putar video di viewer publik dan geser slider seek ke tengah. | Video langsung melompat (*seek*) dan diputar mulus via HTTP Range RFC 7233 tanpa buffering penuh. |
| 4.4 | Unduh File Tanpa Login | Klik tombol ikon unduh pada foto/video di viewer publik. | File terunduh ke peramban dengan nama asli file. Tidak ada akses untuk mengunggah berkas baru. |
| 4.5 | Tombol Laporkan Konten | Klik tombol "Laporkan" dengan ikon bendera di header publik. | Membuka klien email (`mailto:`) dengan subjek laporan berisi token tautan ke alamat kontak admin. |
| 4.6 | Tautan Tidak Valid / Kedaluwarsa | Ubah beberapa huruf pada token di URL atau buka tautan yang tidak ada. | Menampilkan halaman ramah *"Tautan Tidak Tersedia"* dengan tombol kembali ke beranda. |
| 4.7 | Carry-over: Akun Pemilik Suspended | Jika akun pemilik di-suspend oleh admin lewat `/app/admin`, coba buka link publik miliknya. | Tautan otomatis tidak dapat diakses dan menampilkan halaman ramah tidak tersedia (404). |

# Panduan Pengujian Manual — Sprint 6: Opsi Berbagi dan Pengerasan

Panduan ini disiapkan untuk pengujian manual fitur-fitur Sprint 6 oleh pengguna, mencakup opsi link (kedaluwarsa, password, toggle unduh), kelola dan pencabutan link, streaming unduh album ZIP tanpa kompresi, rate limit & header keamanan, serta PWA dan Web Share API.

---

## Prasyarat Pengujian

1. Backend berjalan di `http://localhost:4000` (atau `galeriku-api.hafizfajar.com`).
2. Frontend berjalan di `http://localhost:3000` (atau `galeriku.hafizfajar.com`).
3. Akun pengguna aktif dengan foto dan album yang sudah tersedia (dari Sprint 3-5).
4. Browser Chrome/Safari (Desktop dan Mobile/Mode Sentuh 360x800).

---

## Skenario 1: Opsi Tautan Publik (Kedaluwarsa, Kata Sandi, Toggle Unduh) — US-26

### Langkah-langkah:
1. Masuk ke akun Anda dan buka halaman Galeri (`/app`) atau Album (`/app/albums`).
2. Buka salah satu foto atau album, lalu tekan tombol **Bagikan**.
3. Di dalam dialog **Bagikan Tautan**:
   - Perhatikan opsi **Masa Berlaku**: `1 Hari`, `7 Hari`, `30 Hari`, `Selamanya`. Pilih salah satu opsi (misal: `1 Hari`).
   - Perhatikan toggle **Izinkan Unduhan** (default aktif). Coba matikan jika ingin membuat link hanya-baca (view only).
   - Perhatikan isian **Kata Sandi (Opsional)**. Masukkan kata sandi (misal: `rahasia123`).
4. Tekan tombol **Buat Tautan Publik**.
5. Salin tautan publik yang dihasilkan.
6. Buka jendela **Penyamaran (Incognito)** atau browser lain, lalu buka tautan tersebut (`/s/[token]`).

### Hasil yang Diharapkan:
- Layar menampilkan form **Tautan Dilindungi Sandi** dengan ikon gembok terakota.
- Konten foto/video tidak ditampilkan sebelum kata sandi yang benar dimasukkan.
- Jika memasukkan sandi yang salah, muncul pesan error bahasa Indonesia yang jelas ("Kata sandi salah").
- Setelah memasukkan kata sandi `rahasia123` dan menekan **Buka Tautan**, halaman terbuka secara mulus menampilkan konten foto/album.
- Jika toggle unduh dimatikan, tombol **Unduh** tidak muncul di antarmuka publik.

---

## Skenario 2: Kelola dan Cabut Tautan Seketika — US-27

### Langkah-langkah:
1. Di akun Anda, buka menu navigasi **Tautan** (`/app/shares`).
2. Perhatikan daftar tautan berbagi yang pernah Anda buat:
   - Terlihat judul target (nama foto atau album).
   - Terlihat jumlah berapa kali tautan telah dibuka (*view count*).
   - Terlihat badge status: **Aktif** (hijau), **Kedaluwarsa** (kuning), atau **Dicabut** (merah).
   - Ikon gembok kecil muncul jika tautan dilindungi kata sandi.
3. Gunakan filter di bagian atas: pilih tab **Semua**, **Aktif**, atau **Dicabut / Kedaluwarsa**.
4. Pada salah satu tautan aktif, tekan ikon **Hapus / Cabut Tautan** (ikon tong sampah).
5. Konfirmasi pencabutan dengan menekan **Ya, Cabut**.
6. Buka kembali tautan yang baru saja dicabut di tab browser lain.

### Hasil yang Diharapkan:
- Status tautan langsung berganti menjadi badge **Dicabut** secara instan.
- Tombol salin dan buka dinonaktifkan pada tautan yang dicabut.
- Saat tautan yang dicabut dibuka oleh siapa pun, sistem merespons dengan layar **Tautan Tidak Tersedia** (HTTP 404).

---

## Skenario 3: Unduh Album sebagai ZIP — US-28

### Langkah-langkah:
1. Buat tautan publik untuk sebuah **Album** yang berisi beberapa foto/video dengan opsi unduh aktif.
2. Buka tautan publik album tersebut di tab Incognito (`/s/[token]`).
3. Perhatikan tombol **Unduh Album (ZIP)** di bagian atas grid album.
4. Klik tombol **Unduh Album (ZIP)**.
5. Periksa file ZIP yang terunduh di komputer/HP Anda, lalu ekstrak isinya.

### Hasil yang Diharapkan:
- Browser mulai mengunduh file `.zip` dengan nama sesuai judul album.
- Unduhan berjalan cepat menggunakan streaming Store (tanpa kompresi yang membebani CPU server) dan tanpa membuat file sementara di disk server.
- Setelah diekstrak, seluruh foto dan video asli di dalam album dapat dibuka dengan sempurna tanpa kerusakan.
- Jika izin unduh pada tautan dimatikan, tombol unduh ZIP tidak muncul dan request langsung ke `/zip` menghasilkan status 403 Forbidden.

---

## Skenario 4: Rate Limit dan Header Keamanan — US-29

### Langkah-langkah:
1. Pada tautan publik yang dilindungi kata sandi (`/s/[token]`), coba masukkan kata sandi yang salah secara berulang-ulang lebih dari 5 kali dalam waktu 1 menit.
2. Buka DevTools browser (F12) -> tab **Network**:
   - Periksa header respons dari server pada setiap request ke API:
     - `X-Content-Type-Options: nosniff`
     - `X-Frame-Options: DENY`
     - `Referrer-Policy: strict-origin-when-cross-origin`
     - `Content-Security-Policy` aktif di frontend
     - `X-Robots-Tag: noindex, nofollow` pada seluruh rute `/s/*` dan `/app/*`.

### Hasil yang Diharapkan:
- Setelah 5 kali percobaan gagal berturut-turut, percobaan ke-6 langsung ditolak dengan status HTTP 429 Too Many Requests ("Terlalu banyak percobaan. Coba lagi beberapa menit lagi.").
- Seluruh header keamanan terpasang dengan benar di setiap respons.

---

## Skenario 5: PWA dan Web Share API — US-30

### Langkah-langkah:
1. Buka situs Galeriku (`/app`) di browser HP (Chrome Android atau Safari iOS):
   - Periksa status bar browser: warnanya mengikuti `theme-color` kertas hangat (`#F6F0E4` di tema terang, `#1C1814` di tema gelap).
   - Buka menu browser -> pilih **Tambahkan ke Layar Utama** (*Add to Home Screen*) / **Pasang Aplikasi** (*Install App*).
   - Buka aplikasi dari ikon di layar utama HP.
2. Buka halaman tautan publik foto/album di HP:
   - Tekan tombol **Bagikan** di header atau di viewer layar penuh.

### Hasil yang Diharapkan:
- Aplikasi terbuka dalam mode standalone layar penuh (tanpa bilah URL browser), mirip aplikasi native.
- Tombol **Bagikan** memicu *Share Sheet* bawaan sistem operasi HP (WhatsApp, Telegram, Salin Tautan, dsb).
- Jika diuji di browser desktop yang tidak memiliki Web Share, sistem secara elegan menyalin URL ke clipboard secara otomatis.

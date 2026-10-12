# DESIGN — Galeriku

Versi 1.1 · 11 Oktober 2026 · Arah: **Album Foto Perjalanan**

Dokumen ini adalah acuan visual tunggal. Jika ada konflik dengan komponen bawaan (shadcn/ui, Tailwind default), dokumen ini yang menang. Teks UI berbahasa Indonesia.

## 1. Konsep

Galeriku terasa seperti album foto cetak yang dibuka di meja: kertas hangat, tulisan tangan tinta gelap, satu sentuhan warna terakota seperti cap pos atau pita perekat. Foto dan video adalah bintangnya; antarmuka mundur, tenang, dan rapi.

Tiga prinsip:

1. **Foto dulu.** Konten medsos-tebal dihindari. Kromatik UI minim supaya warna foto yang menonjol.
2. **Hangat, bukan manis.** Kertas dan tinta, bukan pastel atau gradien. Satu aksen saja.
3. **Jelas di jempol.** Dipakai satu tangan di HP, di luar ruangan, dengan sinyal pas-pasan.

## 2. Warna

Satu aksen: **terakota**. Warna status (sukses, peringatan, bahaya) hanya untuk kondisi, bukan dekorasi. Dilarang: gradien ungu/biru, warna neon, hitam murni (#000) dan putih murni (#FFF) sebagai latar.

### Token (CSS variables, terang)

```css
:root {
  --paper:        #F6F0E4; /* latar halaman */
  --surface:      #FBF7EE; /* kartu, sheet, input */
  --sunken:       #EDE5D3; /* area cekung, placeholder thumbnail */
  --ink:          #2A2420; /* teks utama */
  --ink-muted:    #6B6054; /* teks sekunder */
  --line:         #DDD2BC; /* garis dan border */
  --accent:       #A9502E; /* terakota: tombol utama, tautan, fokus */
  --accent-hover: #8F4023;
  --accent-soft:  #EBD3C4; /* latar lembut untuk chip/terpilih */
  --on-accent:    #FFF8F0; /* teks di atas aksen */
  --success:      #4F6B3A;
  --warning:      #9A6B12;
  --danger:       #A8322D;
  --scrim:        rgba(42, 36, 32, 0.55); /* lapisan di atas foto/modal */
}
```

### Token (gelap)

Aktif lewat `prefers-color-scheme: dark` dan `[data-theme="dark"]`; `[data-theme="light"]` memaksa terang. Gelap tetap hangat (cokelat arang), bukan abu-abu dingin.

```css
:root[data-theme="dark"] {
  --paper:        #1C1814;
  --surface:      #26211B;
  --sunken:       #151210;
  --ink:          #F0E8DA;
  --ink-muted:    #A89C8A;
  --line:         #3A322A;
  --accent:       #D9825C;
  --accent-hover: #E69A78;
  --accent-soft:  #3A261C;
  --on-accent:    #1C1814;
  --success:      #8FB06E;
  --warning:      #D9A441;
  --danger:       #E27A72;
  --scrim:        rgba(0, 0, 0, 0.6);
}
```

### Aturan pemakaian

- Teks utama `ink`, sekunder `ink-muted`. Jangan pakai `accent` untuk paragraf panjang.
- `accent` dipakai untuk: tombol utama, tautan, status terpilih, indikator progres, ring fokus. Maksimal satu elemen aksen dominan per layar.
- Kontras minimal 4,5:1 untuk teks biasa (nilai di atas sudah diperiksa untuk `accent` di atas `paper` dan `on-accent` di atas `accent`).
- Status tidak boleh hanya berbeda warna; selalu sertakan ikon atau teks.
- Latar halaman memakai `paper`. Boleh ditambah tekstur serat kertas sangat halus (opsional, lihat bagian 9).

## 3. Tipografi

Dua keluarga, dimuat lewat `next/font/google` (self-hosted saat build, tanpa request ke Google di runtime).

| Peran | Font | Pemakaian |
| --- | --- | --- |
| Judul (serif) | **Fraunces** (variabel, bobot 500–700) | Judul halaman, judul album, hero landing, angka besar, wordmark |
| UI (sans) | **Instrument Sans** (bobot 400, 500, 600) | Tombol, label, input, navigasi, teks isi, caption |

Cadangan: `Georgia, 'Times New Roman', serif` dan `system-ui, -apple-system, 'Segoe UI', sans-serif`.

### Skala (mobile 360 px)

| Gaya | Font | Ukuran / tinggi baris | Bobot | Catatan |
| --- | --- | --- | --- | --- |
| display | Fraunces | 36 / 40 | 600 | Hero landing saja |
| h1 | Fraunces | 28 / 34 | 600 | Judul halaman, judul album |
| h2 | Fraunces | 22 / 28 | 600 | Judul bagian |
| h3 | Fraunces | 18 / 24 | 600 | Judul kartu |
| body | Instrument Sans | 16 / 24 | 400 | Teks isi; **input minimal 16 px** agar iOS tidak zoom otomatis |
| label | Instrument Sans | 14 / 20 | 500 | Label form, tombol kecil |
| caption | Instrument Sans | 12 / 16 | 500 | Metadata (tanggal, ukuran), huruf kapital dengan letter-spacing 0.04em hanya untuk label bagian |

Aturan: judul serif tidak boleh dipakai untuk tombol atau navigasi. Keterangan foto (judul album di bawah sampul) boleh Fraunces italic. Layar ≥ 768 px: display 52/56, h1 36/42, sisanya sama.

## 4. Spasi, Bentuk, dan Elevasi

- **Basis 4 px.** Skala: 4, 8, 12, 16, 24, 32, 48, 64.
- **Gutter halaman:** 16 px (24 px di ≥ 768 px). Lebar konten maksimum 960 px, di tengah.
- **Radius:** `sm` 6 (chip, badge), `md` 10 (tombol, input), `lg` 16 (kartu, sheet atas), `full` (avatar, FAB). Grid thumbnail **tanpa radius** agar rapat seperti lembar kontak.
- **Garis:** 1 px `line`. Lebih disukai daripada bayangan untuk memisahkan elemen.
- **Bayangan** hanya untuk elemen melayang (sheet, menu, FAB, sampul album) dengan warna hangat:

```css
--shadow-float: 0 1px 2px rgba(60, 40, 20, 0.10), 0 10px 24px -12px rgba(60, 40, 20, 0.28);
```

- **Safe area:** semua elemen yang menempel di tepi (bottom nav, FAB, sheet) memakai `env(safe-area-inset-*)`. Tinggi layar penuh memakai `100dvh`, bukan `100vh`.

## 5. Ikon

- Set: Lucide (sudah bersama shadcn), stroke **1.5 px**, ukuran 20 px (24 px di bottom nav), warna `currentColor`.
- Dilarang emoji sebagai ikon.
- Setiap tombol ikon wajib punya `aria-label` berbahasa Indonesia.
- Motif khas: **sudut foto** (segitiga perekat di pojok album). Dipakai pada logo, sampul album, dan penanda pilihan (lihat bagian 6).

## 6. Komponen

### Tombol

| Varian | Tampilan | Pemakaian |
| --- | --- | --- |
| Utama | Isi `accent`, teks `on-accent`, tinggi 48, radius `md`, bobot 600 | Satu aksi utama per layar (Unggah, Buat link, Masuk) |
| Sekunder | Transparan, border 1 px `ink`, teks `ink` | Aksi pendamping |
| Ghost | Tanpa border, teks `ink`, latar `sunken` saat ditekan | Aksi ringan, bilah atas |
| Bahaya | Isi `danger`, teks `on-accent` (atau varian sekunder bertepi `danger`) | Hapus, cabut link; selalu lewat konfirmasi |

Semua tombol: area sentuh minimal 44×44 px, status `pressed` (gelapkan ke `accent-hover` / skala 0.98, 100 ms), `disabled` (opasitas 0.45, kursor default), `loading` (spinner kecil menggantikan ikon; label tetap).

### Input

Tinggi 48, latar `surface`, border 1 px `line`, radius `md`, teks 16 px. Label di atas input (bukan placeholder-sebagai-label). Fokus: ring 2 px `accent` dengan offset 2 px. Error: border `danger`, pesan di bawah dengan ikon. Pesan error login bersifat umum (tidak membocorkan keberadaan email). Pada pendaftaran, pesan "email sudah terdaftar" boleh jelas karena registrasi terbuka.

### Input kode OTP

Satu input teks sungguhan (`inputmode="numeric"`, `autocomplete="one-time-code"`, `maxlength="6"`, teks ≥ 16 px) yang ditampilkan sebagai 6 sel: tiap sel 48×56 dengan jarak 8 px (muat di lebar 360 px), latar `surface`, border 1 px `line`, radius `md`, angka Fraunces 28 bobot 600. Sel aktif memakai ring fokus 2 px `accent`. Mendukung tempel (paste) dan isian otomatis dari email. Error: border semua sel `danger` dan pesan dengan ikon di bawahnya (tanpa animasi goyang). Tombol **Kirim ulang kode** berupa ghost dengan hitung mundur ("Kirim ulang kode (60 dtk)"), nonaktif sampai hitungan habis; hitungan mundur hanya diumumkan ke pembaca layar saat selesai.

### Widget Turnstile

Cloudflare Turnstile dipasang di form daftar, login, dan lupa password, di atas tombol utama, lebar penuh, dengan tema mengikuti tema aktif (terang/gelap) dan mode ringkas agar tidak mengganggu. Bila gagal dimuat: "Pemeriksaan keamanan gagal dimuat. Muat ulang halaman." dan tombol utama nonaktif.

### Navigasi

- **Bottom navigation** (area `/app`): 4 tab, tinggi 56 px + safe-area bawah, latar `surface`, garis atas 1 px `line`. Tab: **Galeri**, **Album**, **Link**, **Akun**. Tab aktif: ikon dan label `accent`, label bobot 600; tab tidak aktif `ink-muted`. Label selalu terlihat. Item **Admin** (menuju `/app/admin`) hanya muncul di tab Akun untuk pengguna ber-peran ADMIN.
- **Tombol Unggah (FAB):** lingkaran 56 px `accent`, ikon plus, di kanan bawah, 16 px di atas bottom nav. Hanya di Galeri dan Album.
- **Bilah atas:** tinggi 56, judul halaman Fraunces h2 di kiri, aksi (cari/pilih) di kanan. Lengket di atas, latar `paper` dengan garis bawah muncul saat di-scroll.
- Di ≥ 1024 px: bottom nav berubah menjadi sidebar kiri 240 px (desktop hanya pendukung).

### Galeri (grid)

- 3 kolom, gap 2 px, sel persegi 1:1 (`object-fit: cover`), tanpa radius. Placeholder `sunken` sampai thumbnail termuat, lalu fade-in 150 ms.
- Video: pil durasi di kiri bawah (`scrim` + teks `on-accent`, caption), ikon putar kecil di kanan atas.
- Pengelompokan per tanggal dengan judul bagian: Fraunces h3 untuk "Sabtu, 10 Oktober 2026", caption `ink-muted` untuk jumlah item.
- **Mode pilih** (tekan lama): lingkaran 24 px di pojok kiri atas tiap sel; terpilih = isi `accent` dengan centang `on-accent`, sel mengecil sedikit (inset 6 px) dan diberi sudut foto. Bilah aksi pilih menggantikan bilah atas (Bagikan, Tambah ke album, Unduh, Hapus).
- Infinite scroll 24 item per halaman; indikator memuat berupa baris kecil di bawah grid.

### Kartu album (gaya foto cetak)

Sampul = foto dengan bingkai kertas putih-hangat 6 px (`surface`), `shadow-float`, radius 4, dan sudut foto terakota di pojok kiri atas. Di bawahnya: judul Fraunces italic 16, caption `ink-muted` (jumlah foto · rentang tanggal). Daftar album: grid 2 kolom, jarak 24 px. Sampul diputar acak ±1° hanya di daftar album, maks tiga variasi tetap (bukan acak setiap render), dinonaktifkan jika `prefers-reduced-motion`.

### Viewer layar penuh

Latar `#14110E` (cokelat arang gelap, selalu gelap di kedua tema). Kontrol (tutup, bagikan, unduh, hapus) di bilah atas/bawah dengan latar `scrim`, hilang otomatis setelah 3 detik tanpa sentuhan, muncul dengan ketukan. Swipe horizontal untuk berpindah, pinch/double-tap untuk zoom, swipe turun untuk menutup. Penghitung "12 / 148" caption di tengah atas.

### Bottom sheet

Dipakai untuk Bagikan, opsi link, menu aksi. Radius atas 20, handle 36×4 `line` di tengah atas, latar `surface`, `shadow-float`, backdrop `scrim`. Tombol utama sheet menempel di bawah dengan padding safe-area.

### Progres unggah

Panel melayang di atas bottom nav: satu baris ringkasan ("Mengunggah 3 dari 8 file · 42%"), bisa dibuka untuk daftar per file. Bar progres 4 px, trek `line`, isi `accent`. Per file: thumbnail kecil, nama, ukuran, status (menunggu, mengunggah, dilanjutkan otomatis, selesai, gagal) dengan tombol Batal / Coba lagi. Saat koneksi putus: teks "Koneksi terputus, akan dilanjutkan otomatis" (bukan error merah).

### Toast, badge, dan status

- Toast di atas bottom nav, latar `ink`, teks `paper`, radius `md`, durasi 3 detik, dengan tombol aksi opsional (Batalkan).
- Badge/chip: tinggi 24, radius `sm`, latar `accent-soft` teks `accent` (dasar) atau `sunken` teks `ink-muted` (netral).
- Status link: Aktif (success), Kedaluwarsa (ink-muted), Dicabut (danger), Berpassword (ikon gembok), semuanya dengan ikon + teks.

### Empty state

Judul Fraunces h2 satu kalimat, satu baris penjelasan, satu tombol utama. Hiasan: satu garis ilustrasi sederhana (sudut foto atau bingkai kosong) berukuran 64 px, stroke `line`. Tanpa ilustrasi orang atau maskot.

## 7. Layar Kunci

### Landing `/` (statis, boleh diindeks)

1. Bilah atas: wordmark "Galeriku" (Fraunces 600) kiri, tombol **Masuk** (sekunder) kanan.
2. Hero: display "Simpan foto perjalananmu. Kirim satu link ke teman." + satu kalimat pendukung + tombol utama **Masuk** dan tautan teks kecil "Belum punya akun? Daftar" (ke `/register`). Di bawahnya tumpukan 3 "foto cetak" bingkai kertas (gambar contoh milik sendiri, bukan stok generik).
3. Tiga keunggulan, masing-masing ikon + judul h3 + satu kalimat: **Unggah dari HP** (bisa dilanjutkan kalau sinyal putus), **Bagikan lewat link** (atur kedaluwarsa dan password), **Teman tanpa login** (buka dan unduh langsung).
4. Penutup: satu baris catatan ("Fotomu tetap milikmu. Hanya link yang kamu buat yang bisa dibuka orang lain.") dan footer kecil.

Tanpa carousel testimoni, tanpa harga, tanpa gradien.

### Login `/login` dan Daftar `/register`

Kartu tunggal di tengah, wordmark di atas. **Login:** h1 "Masuk", tombol **Masuk dengan Google** (sekunder, logo Google resmi), pemisah "atau", form email + password, widget Turnstile, tombol utama **Masuk**. Tautan bantuan: "Lupa password?" dan "Belum punya akun? Daftar". **Daftar:** h1 "Buat akun", tombol **Daftar dengan Google**, pemisah "atau", form nama, email, dan password (dengan tombol tampilkan/sembunyikan password dan petunjuk aturan password), widget Turnstile, tombol utama **Daftar**; setelah berhasil menuju layar verifikasi email. Tautan bantuan: "Sudah punya akun? Masuk". Login oleh akun yang belum terverifikasi mengarahkan ke layar verifikasi email. Pesan error login tetap umum; pada pendaftaran boleh jelas ("Email ini sudah terdaftar").

### Verifikasi email

Layar kartu tunggal setelah daftar. h1 "Cek email kamu", satu kalimat ("Kami mengirim kode 6 digit ke {email}. Kode berlaku 10 menit."), input kode OTP (bagian 6), tombol utama **Verifikasi**, ghost **Kirim ulang kode** dengan hitung mundur 60 detik, dan tautan teks "Salah email? Ubah". Kode benar: langsung masuk ke `/app` tanpa layar tambahan. Kode salah atau kedaluwarsa: tampilkan "Kode salah atau sudah tidak berlaku. Minta kode baru jika perlu.", kosongkan input dan fokus kembali; tombol **Kirim ulang kode** meminta kode baru.

### Lupa dan atur ulang password

Dua layar kartu tunggal. (1) "Lupa password": input email, widget Turnstile, tombol utama **Kirim kode**; setelah dikirim selalu tampilkan pesan yang sama ("Kalau email itu terdaftar, kode sudah kami kirim.") apa pun hasilnya, lalu lanjut ke layar kedua. (2) "Atur password baru": input kode OTP, password baru, tombol utama **Simpan password**. Berhasil: ajak masuk ("Password sudah diganti. Masuk dengan password barumu.") dan beri tahu dalam satu kalimat bahwa semua perangkat otomatis keluar.

### Dashboard admin `/app/admin`

Hanya untuk ADMIN; pengguna lain yang membukanya melihat halaman "Tidak ada akses" yang ramah, bukan layar kosong. Bilah atas "Pengguna" dengan kolom cari (nama atau email). Mobile: daftar kartu satu kolom; tiap kartu berisi avatar inisial lingkaran 40 px, nama, email (caption `ink-muted`), bar pemakaian 4 px dengan teks "1,2 GB dari 5 GB", dan chip status (Aktif, Ditangguhkan, Belum terverifikasi) dengan ikon + teks. Mengetuk kartu membuka bottom sheet detail dengan aksi: **Ubah kuota** (input angka dalam GB + tombol Simpan), **Tangguhkan** atau **Aktifkan** (sekunder), dan **Hapus pengguna** (bahaya; konfirmasi dengan mengetik email pengguna: "Hapus {nama}? Semua file, album, dan link miliknya ikut terhapus dan tidak bisa dikembalikan."). Konfirmasi tangguhkan: "Tangguhkan {nama}? Dia akan keluar dari semua perangkat dan link publiknya tidak aktif sampai akunnya diaktifkan lagi." Bar pemakaian berubah ke `warning` di atas 80% dan `danger` pada 100%, selalu disertai teks. Admin tidak dapat menangguhkan atau menghapus akunnya sendiri (tombol nonaktif dengan penjelasan satu kalimat). Layar ≥ 768 px: daftar menjadi tabel (nama, email, pemakaian, status, aksi).

### Galeri `/app`

Bilah atas (judul "Galeri", ikon cari, ikon pilih), grid per tanggal, FAB Unggah, bottom nav. Di atas grid, baris kuota tipis: "4,2 GB dari 5 GB terpakai" dengan bar 4 px (hanya muncul bila > 80% atau di Pengaturan).

### Halaman publik `/s/[token]` (SSR, `noindex`)

Tanpa bottom nav. Header kecil: wordmark kiri. Judul h1 album (atau nama file), caption "Dibagikan oleh {nama} · berlaku sampai {tanggal}". Grid sama dengan galeri, viewer sama. Tombol utama **Unduh semua (ZIP)** untuk album dan ikon unduh per file, hanya bila izin unduh aktif. Di footer ada tautan kecil **Laporkan konten ini** (ghost, caption) yang membuka email ke alamat kontak. Link tidak valid/kedaluwarsa/dicabut: halaman ramah dengan judul Fraunces dan satu kalimat ("Link ini sudah tidak berlaku. Minta pengirimnya membuat yang baru."). Link berpassword: kartu gerbang dengan satu input dan tombol **Buka**.

### Layanan tidak tersedia

Dipakai saat API tidak terjangkau (server rumah mati). Judul "Galeriku lagi istirahat", penjelasan satu kalimat, tombol **Coba lagi**. Jangan tampilkan stack trace atau kode HTTP.

## 8. Gaya Bahasa

- Bahasa Indonesia santai-sopan, kalimat pendek, sapaan "kamu". Hindari tanda seru berlebihan dan istilah teknis.
- Tombol berupa kata kerja: **Unggah**, **Bagikan**, **Salin link**, **Unduh**, **Hapus**, **Cabut link**.
- Pesan error menjelaskan apa yang terjadi dan langkah berikutnya.
- Hindari salinan pemasaran generik ("solusi terbaik", "revolusioner").

| Konteks | Contoh |
| --- | --- |
| Berhasil salin | Link disalin |
| Hapus (konfirmasi) | Hapus 3 file? File yang dihapus tidak bisa dikembalikan. |
| Kuota habis | Kuota penuh. Hapus beberapa file atau minta admin menambah kuota. |
| Disk server penuh | Server sedang penuh, unggahan ditunda dulu. |
| Format ditolak | Format ini belum didukung. Pakai JPEG, PNG, WebP, GIF, HEIC, MP4, MOV, atau WebM. |
| Upload terputus | Koneksi terputus, akan dilanjutkan otomatis. |
| Login gagal | Email atau password tidak cocok. |
| Email sudah terdaftar | Email ini sudah terdaftar. Masuk atau atur ulang password. |
| Kode OTP salah atau kedaluwarsa | Kode salah atau sudah tidak berlaku. Minta kode baru jika perlu. |
| Email belum diverifikasi | Email kamu belum diverifikasi. Masukkan kode yang kami kirim. |
| Lupa password terkirim | Kalau email itu terdaftar, kode sudah kami kirim. |
| Akun ditangguhkan | Akunmu sedang ditangguhkan. Hubungi admin lewat {email kontak}. |

## 9. Gerak dan Detail

- Durasi 150–200 ms, easing `cubic-bezier(0.2, 0, 0, 1)`. Transisi hanya untuk opasitas, transform, dan warna.
- Gerak yang diperbolehkan: fade-in thumbnail, sheet naik, pergantian foto di viewer, umpan balik tekan tombol.
- Hormati `prefers-reduced-motion`: matikan rotasi kartu album, transisi viewer jadi fade, hilangkan efek skala.
- Tekstur kertas (opsional, sangat halus) pada `body`, tanpa file gambar eksternal:

```css
body {
  background-color: var(--paper);
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.24  0 0 0 0 0.18  0 0 0 0 0.12  0 0 0 0.05 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");
}
```

Hilangkan tekstur di tema gelap atau bila memengaruhi performa HP lawas.

## 10. Aksesibilitas

- Area sentuh ≥ 44 px; jarak antar target ≥ 8 px.
- Fokus terlihat di semua elemen interaktif (ring 2 px `accent`, offset 2 px).
- Semua gambar punya `alt` bermakna (nama file/judul album) atau `alt=""` bila dekoratif.
- Urutan fokus dan label ARIA berbahasa Indonesia; dialog menjebak fokus dan bisa ditutup dengan Esc/swipe.
- Tidak ada interaksi yang hanya bisa lewat hover. Aksi tekan lama selalu punya alternatif tombol "Pilih".
- Dukung zoom teks sampai 200% tanpa kehilangan fungsi.

## 11. Implementasi di Tailwind

- Petakan semua token di bagian 2–4 ke tema Tailwind (`colors`, `fontFamily`, `borderRadius`, `boxShadow`, `spacing`), merujuk variabel CSS di atas agar tema terang/gelap berganti tanpa kelas duplikat. Contoh nama kelas: `bg-paper`, `bg-surface`, `text-ink`, `text-ink-muted`, `border-line`, `bg-accent`, `text-on-accent`, `font-serif`, `font-sans`.
- Font: `next/font/google` untuk Fraunces dan Instrument Sans (`display: 'swap'`, subset `latin`), diekspos sebagai variabel CSS `--font-serif` dan `--font-sans`.
- Komponen shadcn/ui boleh dipakai sebagai dasar perilaku (aksesibilitas, fokus), tetapi **seluruh tampilannya harus dioverride** mengikuti dokumen ini. Warna bawaan shadcn (slate/zinc, ring biru) tidak boleh tersisa.
- Viewport: `viewport-fit=cover`, `theme-color` mengikuti `paper` (terang) dan `#1C1814` (gelap).

## 12. Larangan

- Gradien (terutama ungu/biru), glassmorphism, neon, bayangan dingin abu-abu.
- Emoji sebagai ikon atau dekorasi UI.
- Latar putih murni atau hitam murni.
- Lebih dari satu warna aksen.
- Tampilan "default shadcn", kartu berbayang tebal bertumpuk, atau sudut membulat berlebihan (> 16 px) pada kartu.
- Hover-only interaction, tombol di bawah 44 px, input di bawah 16 px.
- Teks pemasaran generik dan gambar stok tanpa konteks.

## 13. Daftar Periksa Sebelum Menyelesaikan Story UI

1. Dicek di lebar 360×800 dan tidak ada scroll horizontal.
2. Terang dan gelap sama-sama terbaca; kontras sesuai bagian 2.
3. Target sentuh ≥ 44 px, fokus terlihat, `aria-label` terisi.
4. Hanya token dari dokumen ini yang dipakai (tanpa nilai warna/ukuran acak).
5. Teks dalam Bahasa Indonesia sesuai gaya di bagian 8.
6. Safe-area dan `100dvh` dipakai pada elemen yang menempel di tepi.
7. Layar autentikasi: login dan lupa password tidak membocorkan apakah email terdaftar; hanya pendaftaran yang boleh menyebut email sudah terdaftar.
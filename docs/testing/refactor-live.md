# Panduan Uji Spike Live Photo iPhone (RF-30)

Dokumen ini disusun untuk pengujian manual perilaku berkas Live Photo iPhone saat diunggah ke Galeriku. Hasil uji ini akan menentukan jalur unggah resmi yang didukung sistem serta teks bantuan yang ditampilkan di antarmuka (UI).

---

## 1. Latar Belakang & Tujuan

Live Photo pada ekosistem iOS terdiri dari 2 komponen berkas:
1. **Foto diam:** Berkas gambar format HEIC (atau JPEG pada model iPhone lama) yang memuat metadata `ContentIdentifier` Apple MakerNote.
2. **Klip video:** Berkas video pendek (~3 detik) format QuickTime MOV yang memiliki tag `com.apple.quicktime.content.identifier` yang identik dengan foto pasangannya.

Ketika pengguna memilih foto melalui browser web (Safari iOS), WebKit sering kali hanya mengekspor foto diam tunggal (atau menstranscode ke JPEG) tanpa mengirimkan berkas MOV. Spike ini memetakan apa yang sebenarnya diterima server dari 3 skenario unggah.

---

## 2. Skenario Pengujian

### Skenario A: Unggah Langsung via Safari iOS (Photo Library Picker)
1. Buka aplikasi web Galeriku di browser Safari iPhone (`https://galeriku.hafizfajar.com/galeri` atau `http://<ip-lokal>:3000/galeri`).
2. Ketuk tombol **Unggah**.
3. Pilih opsi **Photo Library** (Pustaka Foto).
4. Pilih 1 foto yang memiliki label *LIVE*.
5. Tunggu hingga proses upload selesai.
6. Periksa di basis data/server berkas apa yang diterima.

### Skenario B: Unggah via Aplikasi Files setelah "Export Unmodified Original"
1. Buka aplikasi **Photos** (Foto) bawaan iPhone.
2. Buka salah satu Live Photo.
3. Ketuk tombol **Share** (Bagikan) -> pilih **Export Unmodified Original** (Ekspor Asli Tanpa Modifikasi).
4. Simpan hasilnya ke folder di dalam aplikasi **Files** (File/iCloud Drive).
   *(Perhatikan apakah iPhone menghasilkan 2 berkas: satu `.HEIC` dan satu `.MOV`)*.
5. Kembali ke browser Safari di Galeriku, ketuk **Unggah** -> pilih **Choose File / Browse** (Pilih Berkas).
6. Masuk ke aplikasi Files dan pilih kedua berkas hasil ekspor tadi sekaligus.
7. Tunggu hingga proses upload selesai.

### Skenario C: Unggah dari Desktop (Airdrop / Mac / PC)
1. Transfer Live Photo dari iPhone ke komputer melalui AirDrop atau kabel USB dengan opsi *Keep Originals*.
2. Buka Galeriku di browser desktop.
3. Unggah kedua berkas (`.HEIC` + `.MOV`) secara bersamaan atau bergantian.

---

## 3. Lembar Hasil Pengujian (Tabel Kosong untuk Diisi)

| Skenario | Perangkat & iOS | Berkas Dikirim Klien | Nama & Ekstensi Diterima Server | MIME Type Terdeteksi | Ukuran Berkas | Pasangan MOV Diterima? | Catatan / Perilaku Khusus |
|---|---|---|---|---|---|---|---|
| **A. Safari Photo Library** | *Contoh: iPhone 13, iOS 17.5* | | | | | [ ] Ya / [ ] Tidak | |
| **B. Safari via Files App (Unmodified)** | *Contoh: iPhone 13, iOS 17.5* | | | | | [ ] Ya / [ ] Tidak | |
| **C. Desktop Browser** | *Contoh: Chrome di macOS/Windows* | | | | | [ ] Ya / [ ] Tidak | |

---

## 4. Analisis & Rekomendasi Alur UI

Berdasarkan hasil pengujian di atas:

1. **Jika Skenario A hanya mengirimkan foto diam tanpa MOV:**
   - Tambahkan teks petunjuk di modal upload:
     > *"Untuk mempertahankan gerak Live Photo iPhone, ekspor foto sebagai 'Asli Tanpa Modifikasi' dari aplikasi Foto, lalu unggah pasangan berkas HEIC dan MOV melalui aplikasi File."*
   - Aktifkan alur pairing RF-32 untuk menerima berkas MOV dan HEIC.

2. **Jika Skenario B berhasil mengirimkan pasangan HEIC + MOV:**
   - Jalur resmi Live Photo iOS adalah melalui aplikasi Files (Unmodified Original).
   - Backend RF-32 mencocokkan `ContentIdentifier` antara MOV dan HEIC secara otomatis.

3. **Status Ketergantungan:**
   - Pengujian manual ini dapat dilakukan kapan saja dan **tidak memblokir** implementasi RF-31 (Motion Photo Android) maupun RF-32 (Pairing Live Photo iOS).

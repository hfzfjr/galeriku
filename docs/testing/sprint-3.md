# Panduan Pengujian Manual Sprint 3 — Upload dan Penyimpanan

Daftar skenario ini disiapkan untuk pengujian manual menyeluruh (terutama di perangkat HP atau browser mobile) pada akhir sprint.

---

## 1. Persiapan Lingkungan Uji

1. Jalankan backend: `pnpm dev:backend` (port 4000).
2. Jalankan frontend: `pnpm dev:frontend` (port 3000).
3. Buka browser (atau browser HP melalui jaringan lokal / tunnel) ke `http://localhost:3000/login`.
4. Login menggunakan akun pengguna aktif.
5. Masuk ke halaman Galeri: `/app`.

---

## 2. Skenario Pengujian

### Skenario A: Unggah Foto Normal & Multi-file (US-17 & US-19)
- [ ] **Pilih Berkas:** Tekan tombol **Unggah** (+), pilih 2–3 foto (JPEG / PNG / WebP, masing-masing < 25 MB).
- [ ] **Tampilan Bottom Sheet:** Muncul panel progres unggahan dari bawah layar.
- [ ] **Konkurensi:** Maksimal 2 berkas diunggah bersamaan (yang ketiga menunggu giliran).
- [ ] **Progres Bar:** Bar persentase berjalan lancar dari 0% hingga 100%.
- [ ] **Thumbnail:** Setelah selesai, periksa di database bahwa kolom `thumb_key`, `width`, dan `height` terisi, serta berkas `.thumb.webp` terbentuk di folder penyimpanan.

### Skenario B: Jeda, Lanjut, dan Batal Unggahan (US-17)
- [ ] **Jeda (Pause):** Saat berkas sedang diunggah, tekan tombol jeda (ikon Pause). Status berubah menjadi "Dijeda" dan transfer data berhenti.
- [ ] **Lanjutkan (Resume):** Tekan tombol lanjut (ikon Play). Unggahan berlanjut dari persentase terakhir (resumable tus).
- [ ] **Batal (Cancel):** Tekan tombol silang (batal) pada salah satu unggahan. Unggahan dihentikan dan berkas sementara dihapus dari server.

### Skenario C: Simulasi Jaringan Putus / Offline (US-17)
- [ ] Saat berkas sedang diunggah, matikan Wi-Fi atau aktifkan *Airplane Mode* di HP (atau *Network Offline* di DevTools).
- [ ] Status berubah menjadi **"Menunggu jaringan..."**.
- [ ] Aktifkan kembali koneksi internet.
- [ ] Unggahan otomatis melanjutkan proses tanpa harus menekan tombol apapun.

### Skenario D: Validasi Berkas Terlarang (MIME Whitelist & SVG Blokir) (US-18)
- [ ] **Unggah File SVG:** Pilih file `.svg` (vektor). Sistem harus menolak dengan pesan jelas dalam Bahasa Indonesia (berkas tidak didukung / tipe media ditolak).
- [ ] **Ubah Ekstensi Palsu:** Ubah nama file `.exe` atau teks menjadi `.jpg`. Sistem harus mendeteksi konten aslinya via MIME sniffing dan menolak unggahan.
- [ ] **File Ukuran Melebihi Batas:** Unggah foto dengan ukuran > 25 MB. Sistem menolak berkas sebelum / saat verifikasi ukuran.

### Skenario E: Peringatan Kuota Penuh (US-18)
- [ ] Akun dengan sisa kuota yang tidak mencukupi harus menampilkan pesan bahwa kuota penyimpanan tidak cukup.
- [ ] Status akun yang disuspend/ditangguhkan tidak dapat mengunggah berkas.

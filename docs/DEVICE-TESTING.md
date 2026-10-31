# Laporan dan Matriks Pengujian di Perangkat Nyata (US-32)

Dokumen ini mendokumentasikan hasil pengujian dan matriks verifikasi Galeriku di perangkat nyata (Android Chrome dan iPhone Safari) melalui jaringan seluler nyata, sesuai kriteria penerimaan Sprint 7.

---

## 1. Spesifikasi Lingkungan Pengujian

| Perangkat | Sistem Operasi | Peramban (Browser) | Resolusi Viewport | Jaringan |
| :--- | :--- | :--- | :--- | :--- |
| **Android Phone** | Android 14 / 15 | Google Chrome (LTS) | 360 × 800 px (DPR 3.0) | Seluler (4G / 5G Telkomsel/Indosat) |
| **Apple iPhone** | iOS 17 / 18 | Apple Safari | 390 × 844 px (DPR 3.0) | Seluler (4G / 5G XL/Smartfren) |
| **Desktop Baseline** | Windows 11 / macOS | Chrome & Safari | 1920 × 1080 px | WiFi Fiber |

---

## 2. Matriks Pengujian Fitur & Hasil Verifikasi

| Skenario Pengujian | Android (Chrome) | iPhone (Safari) | Catatan UX / Teknis |
| :--- | :---: | :---: | :--- |
| **1. Autentikasi Ganda & Sesi** | ✅ Lolos | ✅ Lolos | Cookie HttpOnly; SameSite=Lax bekerja sempurna lintas subdomain; sesi 30 hari bertahan saat browser ditutup. |
| **2. Login Google OAuth** | ✅ Lolos | ✅ Lolos | Redirect flow kembali ke host API lalu frontend dengan aman tanpa membuka pop-up yang diblokir Safari. |
| **3. Registrasi & Input OTP 6 Digit** | ✅ Lolos | ✅ Lolos | `inputmode="numeric"` memicu numeric keypad di HP; auto-fill SMS/email didukung; muat di 360 px tanpa scroll horizontal. |
| **4. Upload Resumable (tus)** | ✅ Lolos | ✅ Lolos | Chunk 5 MB langsung ke API host; saat jaringan seluler diputus-sambung (mode pesawat), upload melanjutkan otomatis tanpa ulang dari 0%. |
| **5. File Picker Kamera & Galeri** | ✅ Lolos | ✅ Lolos | Memicu menu kamera / galeri HP asli; validasi MIME sniffing mendeteksi format gambar JPEG, PNG, WebP, HEIC dan video MP4/MOV. |
| **6. Grid Galeri & Sentuhan** | ✅ Lolos | ✅ Lolos | Area sentuh minimal 44×44 px; tap foto membuka viewer; bottom navigation bar ramah jempol. |
| **7. Fullscreen Viewer & Gesture** | ✅ Lolos | ✅ Lolos | Swipe horizontal berpindah foto; swipe down menutup viewer; pinch-to-zoom bekerja halus; kontrol memudar setelah 3 detik. |
| **8. Streaming Video (HTTP Range)** | ✅ Lolos | ✅ Lolos | Video MP4/MOV diputar instan tanpa menunggu unduh seluruh file; scrubber seek bekerja responsif via byte-range RFC 7233. |
| **9. PWA (Add to Home Screen)** | ✅ Lolos | ✅ Lolos | Terpasang ke homescreen; status bar menyesuaikan `theme-color` kertas hangat; membuka dalam mode standalone. |
| **10. Web Share API** | ✅ Lolos | ✅ Lolos | Tombol Bagikan memicu native share sheet sistem (WhatsApp, Telegram, Salin); fallback ke clipboard di browser non-mobile. |
| **11. Link Publik & Unduh ZIP** | ✅ Lolos | ✅ Lolos | Buka link `/s/[token]` tanpa login; form password responsif; streaming ZIP album langsung terunduh ke HP. |

---

## 3. Penyesuaian Responsivitas dan Safe Area

1. **Safe Area Insets iOS:**
   - Seluruh layout menggunakan `env(safe-area-inset-bottom)` dan `env(safe-area-inset-top)` untuk menghindari benturan dengan *Dynamic Island*, *Home Indicator*, dan notch iPhone.
2. **Dynamic Viewport Height (`100dvh`):**
   - Menggunakan `100dvh` alih-alih `100vh` sehingga saat bilah navigasi Safari/Chrome muncul atau menyusut, tidak terjadi lonjakan tata letak (*layout shift*).
3. **Pemberitahuan Jaringan Lemah:**
   - Indikator koneksi upload memberi pesan tenang Bahasa Indonesia ("Koneksi terputus, akan dilanjutkan otomatis") tanpa dialog galat yang panik atau memblokir pengguna.

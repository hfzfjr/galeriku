# Acuan visual landing page (US-08)

Dua berkas HTML statis hasil desain landing Galeriku:

- `landing-mobile.html` — tampilan HP (lebar acuan 390 px)
- `landing-desktop.html` — tampilan desktop (lebar acuan 1280 px)

Cara memakainya:

- Ini **acuan visual, bukan kode produksi**. Semua gaya masih inline. Terjemahkan ke komponen Next.js + Tailwind memakai token `docs/DESIGN.md` (jangan menyalin nilai warna/ukuran inline).
- Logo "G" di header dan footer hanyalah placeholder. Pakai logo asli dari `frontend/public/brand/` (lockup terang/gelap).
- "Foto" Bromo, Walakiri, Jatiluwih, dan pasar malam digambar dengan CSS sebagai pengganti sementara. Sediakan slot gambar yang mudah diganti foto asli (mis. `frontend/public/landing/`).
- Teks sudah disesuaikan dengan registrasi terbuka (PRD v1.2): ada tombol Daftar, kuota awal 5 GB, dan tidak ada bahasa undangan.
- Landing harus statis dan mobile-first, tampil < 2,5 detik di 4G (AC US-08). Jangan pakai gradien, emoji, atau gambar stok.

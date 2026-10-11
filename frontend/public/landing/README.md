# Foto landing (US-08, penutupan Sprint 1)

Taruh foto asli untuk tumpukan kartu di hero di folder ini. Slot tanpa
`src` memakai ilustrasi SVG sementara
(`src/components/landing/illustrations.tsx`).

## Berkas yang dipakai

| Slot | Berkas | Ukuran | Rasio bingkai |
| --- | --- | --- | --- |
| Pangalengan, Sep 2025 (potret) | `pangalengan-jalur.jpg` | 1200×1800, 329.408 byte, tanpa EXIF | 3:4 (object-cover) |
| Pangalengan, Sep 2025 (persegi) | `pangalengan-bebatuan.jpg` | 1200×1800, 375.652 byte, tanpa EXIF | 1:1 persegi (object-cover) |

## Ukuran dan format yang disarankan

- Sisi panjang 1200–1600 px (cukup untuk layar HP dan desktop acuan).
- JPEG kualitas ~80 atau WebP; usahakan tiap berkas di bawah 300 KB
  agar landing tetap cepat (< 2,5 detik di 4G).
- Bersihkan EXIF/GPS sebelum commit (repo ini publik).
- Bukan foto stok: pakai foto perjalanan sendiri.

## Cara memasang

Isi kolom `src` slot yang sesuai di
`src/components/landing/landing-photos.tsx`
(mis. `src: "/landing/pangalengan-jalur.jpg"`). Tidak perlu mengubah
komponen: `PhotoCard` otomatis memakai `next/image` dengan `alt` yang
sudah terdaftar bila `src` terisi. Kolom `frameAspect` menjaga rasio
bingkai kartu (foto dipotong object-cover).

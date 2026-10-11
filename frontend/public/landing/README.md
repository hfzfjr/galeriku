# Foto landing (US-08)

Taruh foto asli untuk tumpukan kartu di hero di folder ini. Selama
berkasnya belum ada, slot memakai ilustrasi SVG sementara
(`src/components/landing/illustrations.tsx`).

## Nama berkas yang dipakai

| Slot | Berkas | Rasio |
| --- | --- | --- |
| Bromo, 04.30 | `bromo.jpg` | 4:3 landscape |
| Pantai Walakiri | `walakiri.jpg` | 3:4 portrait |
| Sawah Jatiluwih | `jatiluwih.jpg` | 1:1 persegi |
| Pasar malam, Malang | `pasar-malam.jpg` | 3:2 landscape |

## Ukuran dan format yang disarankan

- Sisi panjang 1200–1600 px (cukup untuk layar HP dan desktop acuan).
- JPEG kualitas ~80 atau WebP; usahakan tiap berkas di bawah 300 KB
  agar landing tetap cepat (< 2,5 detik di 4G).
- Bukan foto stok: pakai foto perjalanan sendiri.

## Cara memasang

Isi kolom `src` slot yang sesuai di
`src/components/landing/landing-photos.tsx`
(mis. `src: "/landing/bromo.jpg"`). Tidak perlu mengubah komponen:
`PhotoCard` otomatis memakai `next/image` dengan `alt` yang sudah
terdaftar bila `src` terisi.

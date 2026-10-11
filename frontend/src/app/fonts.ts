import { Fraunces, Instrument_Sans } from "next/font/google";

// Judul (serif): Fraunces variabel, bobot 500–700, normal + italic
// (italic dipakai judul hero, keterangan foto, kartu Catatan — US-08).
export const serifFont = Fraunces({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-serif",
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
  fallback: ["Georgia", "'Times New Roman'", "serif"],
});

// UI (sans): Instrument Sans 400, 500, 600 (DESIGN.md §3).
export const sansFont = Instrument_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
  weight: ["400", "500", "600"],
  fallback: ["system-ui", "-apple-system", "'Segoe UI'", "sans-serif"],
});

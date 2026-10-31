import type { ReactNode } from "react";
import {
  BromoArt,
  JatiluwihArt,
  PasarMalamArt,
  WalakiriArt,
} from "./illustrations";

export type LandingPhotoSlot = {
  id: string;
  /** Keterangan di bawah kartu (Fraunces italic). */
  caption: string;
  /** Alt bila memakai foto asli; ilustrasi memakai aria-label sendiri. */
  alt: string;
  kind: "photo" | "video";
  /** Durasi untuk slot video (pil di kiri bawah). */
  duration?: string;
  /**
   * Foto asli (opsional). Isi dengan path di frontend/public/landing/
   * untuk menggantikan ilustrasi tanpa mengubah komponen.
   * Lihat public/landing/README.md.
   */
  src?: string;
  width: number;
  height: number;
  /**
   * Rasio bingkai kartu (sama dengan ilustrasi slot ini). Foto asli
   * dipotong object-cover mengikuti rasio ini agar komposisi tumpukan
   * tidak berubah.
   */
  frameAspect?: string;
  illustration: ReactNode;
};

export const LANDING_PHOTOS: LandingPhotoSlot[] = [
  {
    id: "bromo",
    caption: "Bromo, 04.30",
    alt: "Contoh foto: matahari terbit di atas gunung",
    kind: "photo",
    width: 800,
    height: 600,
    illustration: <BromoArt className="block h-auto w-full" />,
  },
  {
    id: "walakiri",
    caption: "Lembah Senja, 2025",
    alt: "Sekelompok sahabat tertawa bersama menikmati momen perjalanan saat senja",
    kind: "photo",
    src: "/landing/travel-friends.jpg",
    width: 1200,
    height: 800,
    frameAspect: "aspect-[3/4]",
    illustration: <WalakiriArt className="block h-auto w-full" />,
  },
  {
    id: "jatiluwih",
    caption: "Petualangan Baru, 2025",
    alt: "Seorang pelancong tersenyum menikmati momen perjalanan",
    kind: "photo",
    src: "/landing/travel-moment.jpg",
    width: 1200,
    height: 800,
    frameAspect: "aspect-square",
    illustration: <JatiluwihArt className="block h-auto w-full" />,
  },
  {
    id: "pasar-malam",
    caption: "Pasar malam, Malang",
    alt: "Contoh video: pasar malam",
    kind: "video",
    duration: "0:48",
    width: 600,
    height: 400,
    illustration: <PasarMalamArt className="block h-auto w-full" />,
  },
];

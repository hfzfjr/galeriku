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
    caption: "Pangalengan, Sep 2025",
    alt: "Rombongan berjalan mendaki jalur tanah di hutan berkabut, Pangalengan",
    kind: "photo",
    src: "/landing/pangalengan-jalur.jpg",
    width: 1200,
    height: 1800,
    frameAspect: "aspect-[3/4]",
    illustration: <WalakiriArt className="block h-auto w-full" />,
  },
  {
    id: "jatiluwih",
    caption: "Pangalengan, Sep 2025",
    alt: "Seorang pengunjung berdiri di atas batu besar di lereng berbatu, Pangalengan",
    kind: "photo",
    src: "/landing/pangalengan-bebatuan.jpg",
    width: 1200,
    height: 1800,
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

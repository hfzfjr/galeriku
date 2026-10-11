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
   * (mis. "/landing/bromo.jpg") untuk menggantikan ilustrasi tanpa
   * mengubah komponen. Lihat public/landing/README.md.
   */
  src?: string;
  width: number;
  height: number;
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
    caption: "Pantai Walakiri",
    alt: "Contoh foto: pantai saat senja",
    kind: "photo",
    width: 600,
    height: 800,
    illustration: <WalakiriArt className="block h-auto w-full" />,
  },
  {
    id: "jatiluwih",
    caption: "Sawah Jatiluwih",
    alt: "Contoh foto: sawah berundak",
    kind: "photo",
    width: 600,
    height: 600,
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

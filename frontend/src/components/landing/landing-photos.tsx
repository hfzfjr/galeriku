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
    caption: "Sahabat Perjalanan, 2025",
    alt: "Sekelompok teman tertawa bersama menikmati perjalanan liburan",
    kind: "photo",
    src: "/landing/travel-people-group.jpg",
    width: 1200,
    height: 800,
    frameAspect: "aspect-[4/3]",
    illustration: <BromoArt className="block h-auto w-full" />,
  },
  {
    id: "walakiri",
    caption: "Lembah Kabut, Sep 2025",
    alt: "Pemandangan kabut pagi menyelimuti pepohonan di lereng gunung",
    kind: "photo",
    src: "/landing/travel-scenery-forest.jpg",
    width: 1200,
    height: 800,
    frameAspect: "aspect-[3/4]",
    illustration: <WalakiriArt className="block h-auto w-full" />,
  },
  {
    id: "jatiluwih",
    caption: "Puncak Pegunungan, 2025",
    alt: "Pemandangan puncak gunung berbatu yang megah",
    kind: "photo",
    src: "/landing/travel-scenery-mountain.jpg",
    width: 1200,
    height: 800,
    frameAspect: "aspect-square",
    illustration: <JatiluwihArt className="block h-auto w-full" />,
  },
  {
    id: "pasar-malam",
    caption: "Malam Kota, 2025",
    alt: "Orang-orang menikmati festival perjalanan malam yang hangat",
    kind: "video",
    duration: "0:48",
    src: "/landing/travel-people-night.jpg",
    width: 1200,
    height: 800,
    frameAspect: "aspect-[3/2]",
    illustration: <PasarMalamArt className="block h-auto w-full" />,
  },
];

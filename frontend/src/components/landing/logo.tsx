import Image from "next/image";
import { cn } from "@/lib/cn";

type LogoProps = {
  /** Varian kecil untuk footer (mark 24px, teks 16px). */
  small?: boolean;
};

/**
 * Logo Galeriku: SATU ikon mark (tile mandiri, tampil sama di tema
 * terang dan gelap) + teks "Galeriku" sungguhan (Fraunces 600).
 * Pembaca layar membaca teksnya; ikon dekoratif disembunyikan.
 * Server Component, tanpa JS.
 */
export function Logo({ small = false }: LogoProps) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center",
        small ? "gap-2" : "gap-2.5",
      )}
    >
      <Image
        src="/brand/logo-mark.svg"
        alt=""
        aria-hidden="true"
        width={68}
        height={68}
        className={small ? "h-6 w-6" : "h-[34px] w-[34px]"}
      />
      <span
        className={cn(
          "font-serif font-semibold leading-none text-ink",
          small ? "text-base" : "text-[22px]",
        )}
      >
        Galeriku
      </span>
    </span>
  );
}

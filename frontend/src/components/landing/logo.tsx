import { cn } from "@/lib/cn";

type LogoProps = {
  /** Kelas tinggi untuk kedua gambar (lebar mengikuti aspek lockup). */
  className?: string;
};

/**
 * Logo Galeriku dari frontend/public/brand (lockup terang/gelap).
 * Server Component tanpa JS: varian yang tampil dipilih lewat CSS
 * (.brand-lockup-light/.brand-lockup-dark di globals.css) mengikuti
 * data-theme dan prefers-color-scheme. Pembaca layar mendapat satu
 * label "Galeriku"; gambar yang tersembunyi display:none.
 */
export function Logo({ className }: LogoProps) {
  const imgClass = cn("w-auto", className ?? "h-9");
  return (
    <span role="img" aria-label="Galeriku" className="inline-flex shrink-0">
      {/* eslint-disable-next-line @next/next/no-img-element -- SVG lockup diganti via CSS tanpa JS; next/image membungkus span sehingga display:none bocor */}
      <img
        src="/brand/logo-lockup-light.svg"
        alt=""
        aria-hidden="true"
        width={143}
        height={36}
        className={cn("brand-lockup-light", imgClass)}
      />
      {/* eslint-disable-next-line @next/next/no-img-element -- alasan sama seperti di atas */}
      <img
        src="/brand/logo-lockup-dark.svg"
        alt=""
        aria-hidden="true"
        width={143}
        height={36}
        className={cn("brand-lockup-dark", imgClass)}
      />
    </span>
  );
}

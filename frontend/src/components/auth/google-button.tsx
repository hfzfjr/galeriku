import { getButtonClassName } from "@/components/ui/button-styles";
import { cn } from "@/lib/cn";

/**
 * Logo "G" Google multiwarna resmi sebagai SVG inline (bukan emoji,
 * bukan paket baru). 20px mengikuti ikon Lucide.
 */
export function GoogleMark({ className }: { className?: string }) {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      className={cn("shrink-0", className)}
    >
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z"
      />
    </svg>
  );
}

/**
 * Tombol Google (DESIGN.md §6-§7): varian sekunder, navigasi penuh (<a>)
 * ke endpoint OAuth di host API (BUKAN fetch). Label dan aria-label
 * Bahasa Indonesia, tinggi 48 via gaya tombol.
 */
export function GoogleButton({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  return (
    <a
      href={href}
      aria-label={label}
      className={getButtonClassName("secondary", "w-full")}
    >
      <GoogleMark />
      <span>{label}</span>
    </a>
  );
}

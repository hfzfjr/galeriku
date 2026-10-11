/**
 * Ilustrasi SVG sementara untuk slot foto landing (US-08).
 * Ini SATU-SATUNYA berkas komponen yang boleh berisi nilai warna
 * (selain globals.css): ilustrasi diperlakukan seperti "foto", boleh
 * berwarna tetap di kedua tema. Setelah foto asli tersedia di
 * frontend/public/landing/, slot memakai next/image (lihat
 * landing-photos.ts) dan ilustrasi ini tidak dipakai lagi.
 */

type ArtProps = {
  className?: string;
};

export function BromoArt({ className }: ArtProps) {
  return (
    <svg
      viewBox="0 0 400 300"
      role="img"
      aria-label="Contoh foto: matahari terbit di atas gunung"
      className={className}
    >
      <rect width="400" height="300" fill="#E8B48A" />
      <circle cx="292" cy="118" r="34" fill="#F4DDB0" />
      <rect y="150" width="400" height="40" fill="#EBC49F" />
      <polygon
        points="0,205 70,155 130,192 200,146 280,196 340,164 400,204 400,300 0,300"
        fill="#B27E64"
      />
      <polygon points="140,300 222,152 308,300" fill="#7A5443" />
      <ellipse cx="226" cy="140" rx="26" ry="9" fill="#D9A98A" />
      <polygon
        points="0,262 90,238 200,264 320,240 400,260 400,300 0,300"
        fill="#3F2F27"
      />
    </svg>
  );
}

export function WalakiriArt({ className }: ArtProps) {
  return (
    <svg
      viewBox="0 0 300 400"
      role="img"
      aria-label="Contoh foto: pantai saat senja"
      className={className}
    >
      <rect width="300" height="400" fill="#DCCFB5" />
      <circle cx="214" cy="146" r="26" fill="#F1D9A6" />
      <rect y="172" width="300" height="124" fill="#6E8D8A" />
      <rect y="196" width="300" height="3" fill="#8FAAA4" />
      <rect x="40" y="226" width="220" height="3" fill="#8FAAA4" />
      <rect x="90" y="256" width="150" height="3" fill="#8FAAA4" />
      <path
        d="M0 292 Q38 274 75 292 T150 292 T225 292 T300 292 V312 H0 Z"
        fill="#F2EBDD"
      />
      <rect y="312" width="300" height="88" fill="#D4B98E" />
      <rect y="312" width="300" height="26" fill="#BFA37A" />
    </svg>
  );
}

export function JatiluwihArt({ className }: ArtProps) {
  return (
    <svg
      viewBox="0 0 300 300"
      role="img"
      aria-label="Contoh foto: sawah berundak"
      className={className}
    >
      <rect width="300" height="300" fill="#E7D9B8" />
      <polygon
        points="0,112 80,86 170,106 260,80 300,98 300,150 0,150"
        fill="#8C9A6A"
      />
      <path d="M0 118 Q150 88 300 126 V168 Q150 130 0 160 Z" fill="#7C8B4F" />
      <path d="M0 160 Q150 130 300 168 V214 Q150 176 0 206 Z" fill="#98A55F" />
      <path d="M0 206 Q150 176 300 214 V260 Q150 222 0 252 Z" fill="#6B7A41" />
      <path d="M0 252 Q150 222 300 260 V300 H0 Z" fill="#A9B36E" />
      <rect x="206" y="124" width="26" height="18" fill="#6B4A38" />
      <polygon points="200,124 219,108 238,124" fill="#4A3329" />
    </svg>
  );
}

export function PasarMalamArt({ className }: ArtProps) {
  return (
    <svg
      viewBox="0 0 300 200"
      role="img"
      aria-label="Contoh video: pasar malam"
      className={className}
    >
      <rect width="300" height="200" fill="#2F2823" />
      <path
        d="M0 40 Q150 84 300 40"
        fill="none"
        stroke="#6B6054"
        strokeWidth="2"
      />
      <circle cx="30" cy="54" r="6" fill="#F4D58F" />
      <circle cx="90" cy="64" r="6" fill="#F4D58F" />
      <circle cx="150" cy="68" r="6" fill="#F4D58F" />
      <circle cx="210" cy="64" r="6" fill="#F4D58F" />
      <circle cx="270" cy="54" r="6" fill="#F4D58F" />
      <rect x="38" y="92" width="28" height="28" fill="#D9825C" />
      <rect x="66" y="92" width="28" height="28" fill="#F0E8DA" />
      <rect x="94" y="92" width="28" height="28" fill="#D9825C" />
      <rect x="122" y="92" width="28" height="28" fill="#F0E8DA" />
      <rect x="150" y="92" width="28" height="28" fill="#D9825C" />
      <rect x="178" y="92" width="28" height="28" fill="#F0E8DA" />
      <rect x="206" y="92" width="28" height="28" fill="#D9825C" />
      <rect x="234" y="92" width="28" height="28" fill="#F0E8DA" />
      <rect x="46" y="120" width="208" height="64" fill="#3A322A" />
      <circle cx="90" cy="140" r="10" fill="#A9502E" />
      <circle cx="130" cy="140" r="10" fill="#F4D58F" />
      <circle cx="170" cy="140" r="10" fill="#A9502E" />
      <circle cx="210" cy="140" r="10" fill="#F4D58F" />
      <rect y="184" width="300" height="16" fill="#1F1A17" />
    </svg>
  );
}

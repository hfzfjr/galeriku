"use client";

import { useState } from "react";
import { FileImage, Film, Play } from "lucide-react";

export interface MediaThumbProps {
  src?: string | null;
  alt: string;
  kind?: "image" | "video";
  durationS?: number | null;
  className?: string;
  crossOrigin?: "use-credentials" | "anonymous";
  showDuration?: boolean;
  showVideoBadge?: boolean;
}

function formatDuration(seconds?: number | null): string {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return "";
  const s = Math.round(seconds);
  const m = Math.floor(s / 60);
  const remS = s % 60;
  return `${m}:${remS.toString().padStart(2, "0")}`;
}

/**
 * Komponen bersama MediaThumb (RF-02 / B10).
 * Menampilkan thumbnail foto/video dengan fallback ikon + nama berkas
 * jika thumbnail 404, gagal muat, atau belum memiliki poster/thumbKey.
 */
export function MediaThumb({
  src,
  alt,
  kind = "image",
  durationS,
  className = "",
  crossOrigin = "use-credentials",
  showDuration = true,
  showVideoBadge = true,
}: MediaThumbProps) {
  const [hasError, setHasError] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const isVideo = kind === "video";
  const durationText = showDuration ? formatDuration(durationS) : "";
  const canShowImage = Boolean(src) && !hasError;

  return (
    <div
      className={`relative h-full w-full overflow-hidden bg-sunken select-none ${className}`}
    >
      {canShowImage ? (
        /* eslint-disable-next-line @next/next/no-img-element -- Gambar langsung dari host API (AD-3) */
        <img
          src={src!}
          alt={alt}
          crossOrigin={crossOrigin}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={() => setHasError(true)}
          className={`h-full w-full object-cover transition-opacity duration-150 ${
            loaded ? "opacity-100" : "opacity-0"
          }`}
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center p-2 text-ink-muted">
          {isVideo ? (
            <Film size={28} strokeWidth={1.5} className="shrink-0 text-ink-muted" />
          ) : (
            <FileImage
              size={28}
              strokeWidth={1.5}
              className="shrink-0 text-ink-muted"
            />
          )}
          <span className="line-clamp-2 max-w-full text-center text-[10px] text-ink-muted mt-1 px-1 break-all leading-tight">
            {alt}
          </span>
        </div>
      )}

      {/* Indikator Video: Ikon putar di kanan atas & pil durasi di kiri bawah */}
      {isVideo && (
        <>
          {showVideoBadge && (
            <div
              className="pointer-events-none absolute top-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-scrim text-on-accent"
              aria-hidden="true"
            >
              <Play size={10} className="fill-current" />
            </div>
          )}
          {durationText ? (
            <div
              className="pointer-events-none absolute bottom-1.5 left-1.5 rounded-[4px] bg-scrim px-1.5 py-0.5 text-caption text-on-accent font-medium backdrop-blur-xs"
              aria-hidden="true"
            >
              {durationText}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}


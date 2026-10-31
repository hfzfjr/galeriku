"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Download,
  Film,
  Flag,
  Maximize2,
  ShieldAlert,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { PublicViewer } from "@/components/public/public-viewer";
import {
  fetchPublicShare,
  getPublicFileContentUrl,
  getPublicThumbnailUrl,
} from "@/lib/api";

const CONTACT_EMAIL =
  process.env.NEXT_PUBLIC_CONTACT_EMAIL || "admin@hafizfajar.com";

export function PublicShareClient({ token }: { token: string }) {
  const [activeViewerIndex, setActiveViewerIndex] = useState<number | null>(
    null,
  );

  const { data, isLoading, error } = useQuery({
    queryKey: ["public-share", token],
    queryFn: () => fetchPublicShare(token),
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-bg p-4 sm:p-8 flex flex-col gap-6 animate-pulse">
        <div className="h-8 w-40 rounded bg-sunken" />
        <div className="h-10 w-72 rounded bg-sunken" />
        <div className="grid grid-cols-3 gap-1 sm:grid-cols-4 md:grid-cols-6 sm:gap-2">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="aspect-square rounded bg-sunken" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-2xl border border-line bg-surface p-8 text-center shadow-xs">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-danger/10 text-danger">
            <ShieldAlert size={28} strokeWidth={1.5} />
          </div>
          <h1 className="text-h2 font-serif text-ink">Tautan Tidak Tersedia</h1>
          <p className="mt-2 text-body text-ink-muted">
            Tautan berbagi ini mungkin telah kedaluwarsa, dicabut oleh
            pemiliknya, atau alamat tautan tidak valid.
          </p>
          <div className="mt-6">
            <Link href="/">
              <Button variant="primary">Kunjungi Galeriku</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const reportMailto = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
    `Laporan Konten Galeriku — ${token}`,
  )}&body=${encodeURIComponent(
    `Halo Admin Galeriku,\n\nSaya ingin melaporkan konten pada tautan berikut:\n${
      typeof window !== "undefined" ? window.location.href : token
    }\n\nAlasan pelaporan:\n`,
  )}`;

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      {/* Header Publik */}
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-line bg-surface/90 px-4 sm:px-8 backdrop-blur-md">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-white font-serif font-bold text-lg">
            G
          </div>
          <span className="font-serif font-semibold text-ink tracking-tight text-lg">
            Galeriku
          </span>
        </Link>

        <a
          href={reportMailto}
          className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink-muted hover:bg-sunken hover:text-danger transition"
          title="Laporkan konten bermasalah"
        >
          <Flag size={14} />
          <span>Laporkan</span>
        </a>
      </header>

      {/* Konten Halaman */}
      <main className="flex-1 p-4 sm:p-8 max-w-6xl mx-auto w-full flex flex-col gap-6">
        <div>
          <h1 className="text-h1 font-serif text-ink">{data.title}</h1>
          <p className="text-caption text-ink-muted mt-1">
            Dibagikan lewat tautan publik &bull;{" "}
            {data.files.length}{" "}
            {data.files.length === 1 ? "foto/video" : "foto/video"}
          </p>
        </div>

        {/* Jika File Tunggal */}
        {data.targetType === "FILE" && data.files.length === 1 ? (
          <div className="flex flex-col items-center gap-4">
            <div className="relative aspect-auto max-h-[70vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-line bg-surface shadow-xs">
              {data.files[0].kind === "video" ? (
                <video
                  controls
                  playsInline
                  src={getPublicFileContentUrl(token, data.files[0].id)}
                  className="max-h-[70vh] w-full object-contain bg-black"
                />
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={getPublicFileContentUrl(token, data.files[0].id)}
                  alt={data.files[0].originalName}
                  className="max-h-[70vh] w-full object-contain mx-auto"
                />
              )}
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                onClick={() => setActiveViewerIndex(0)}
                className="gap-1.5"
              >
                <Maximize2 size={16} />
                <span>Layar Penuh</span>
              </Button>
              {data.allowDownload && (
                <a
                  href={getPublicFileContentUrl(token, data.files[0].id, true)}
                  download={data.files[0].originalName}
                >
                  <Button variant="primary" className="gap-1.5">
                    <Download size={16} />
                    <span>Unduh Berkas</span>
                  </Button>
                </a>
              )}
            </div>
          </div>
        ) : (
          /* Jika Album: Grid Foto/Video */
          <div className="grid grid-cols-3 gap-1 sm:grid-cols-4 md:grid-cols-6 sm:gap-2">
            {data.files.map((file, idx) => (
              <div
                key={file.id}
                className="group relative aspect-square overflow-hidden rounded bg-sunken"
              >
                <button
                  type="button"
                  onClick={() => setActiveViewerIndex(idx)}
                  className="h-full w-full focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <Image
                    src={getPublicThumbnailUrl(token, file.id)}
                    alt={file.originalName}
                    fill
                    sizes="(max-width: 640px) 33vw, (max-width: 1024px) 25vw, 16vw"
                    className="object-cover transition-transform duration-200 group-hover:scale-105"
                    unoptimized
                  />
                </button>

                {file.kind === "video" && (
                  <div className="pointer-events-none absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded bg-black/70 px-1.5 py-0.5 text-[11px] font-medium text-white backdrop-blur-xs">
                    <Film size={12} />
                    <span>
                      {file.durationS
                        ? `${Math.round(file.durationS)}s`
                        : "Video"}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Viewer Layar Penuh */}
      {activeViewerIndex !== null && (
        <PublicViewer
          token={token}
          files={data.files}
          initialIndex={activeViewerIndex}
          allowDownload={data.allowDownload}
          onClose={() => setActiveViewerIndex(null)}
        />
      )}
    </div>
  );
}


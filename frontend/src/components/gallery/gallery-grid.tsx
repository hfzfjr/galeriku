"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import type { FileItem } from "@galeriku/contracts";
import { Film, Image as ImageIcon, Play, RefreshCw, Upload } from "lucide-react";
import { fetchFiles, getThumbnailUrl } from "@/lib/api";
import { Button } from "@/components/ui/button";

function formatDuration(seconds: number | null): string | null {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) {
    return null;
  }
  const total = Math.max(0, Math.round(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatDateHeader(isoString: string): string {
  try {
    const d = new Date(isoString);
    return new Intl.DateTimeFormat("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(d);
  } catch {
    return isoString;
  }
}

function toDateKey(isoString: string): string {
  try {
    const d = new Date(isoString);
    const y = d.getFullYear();
    const m = (d.getMonth() + 1).toString().padStart(2, "0");
    const day = d.getDate().toString().padStart(2, "0");
    return `${y}-${m}-${day}`;
  } catch {
    return "lainnya";
  }
}

type GroupedFiles = {
  dateKey: string;
  displayDate: string;
  items: FileItem[];
};

interface GalleryGridProps {
  onTriggerUpload?: () => void;
}

export function GalleryGrid({ onTriggerUpload }: GalleryGridProps) {
  const observerRef = useRef<HTMLDivElement | null>(null);

  const {
    data,
    isLoading,
    isError,
    error,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    refetch,
  } = useInfiniteQuery({
    queryKey: ["files"],
    queryFn: ({ pageParam }) => fetchFiles({ cursor: pageParam, limit: 24 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  // IntersectionObserver untuk infinite scroll otomatis
  useEffect(() => {
    const target = observerRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: "300px" },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Gabungkan semua item dari seluruh halaman
  const allFiles = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap((page) => page.items);
  }, [data]);

  // Kelompokkan per tanggal
  const groups = useMemo(() => {
    const map = new Map<string, GroupedFiles>();
    for (const item of allFiles) {
      const refDate = item.takenAt || item.createdAt;
      const key = toDateKey(refDate);
      const existing = map.get(key);
      if (existing) {
        existing.items.push(item);
      } else {
        map.set(key, {
          dateKey: key,
          displayDate: formatDateHeader(refDate),
          items: [item],
        });
      }
    }
    return Array.from(map.values());
  }, [allFiles]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6" aria-busy="true" aria-label="Memuat galeri">
        <div className="space-y-2">
          <div className="h-6 w-48 animate-pulse rounded bg-sunken" />
          <div className="grid grid-cols-3 gap-[2px] md:grid-cols-4 lg:grid-cols-6">
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="aspect-square animate-pulse bg-sunken"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex min-h-[300px] flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-body text-danger">
          Gagal memuat foto: {error instanceof Error ? error.message : "Terjadi kesalahan"}
        </p>
        <Button
          type="button"
          variant="secondary"
          onClick={() => refetch()}
          className="flex items-center gap-2"
        >
          <RefreshCw size={16} />
          Coba lagi
        </Button>
      </div>
    );
  }

  if (allFiles.length === 0) {
    return (
      <div className="flex min-h-[360px] flex-col items-center justify-center gap-4 px-4 py-12 text-center">
        <div
          className="flex h-16 w-16 items-center justify-center rounded-lg border border-line bg-surface"
          aria-hidden="true"
        >
          <ImageIcon size={32} className="text-ink-muted" strokeWidth={1.5} />
        </div>
        <div className="space-y-1">
          <h2 className="text-h2 font-serif text-ink">Belum ada foto atau video</h2>
          <p className="text-body text-ink-muted">
            Foto dan video yang kamu unggah dari HP akan tersimpan rapi di sini.
          </p>
        </div>
        {onTriggerUpload ? (
          <Button
            type="button"
            variant="primary"
            onClick={onTriggerUpload}
            className="mt-2 flex items-center gap-2"
          >
            <Upload size={18} />
            Unggah sekarang
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 pb-24">
      {groups.map((group) => (
        <section key={group.dateKey} className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between px-1">
            <h3 className="text-h3 font-serif text-ink">{group.displayDate}</h3>
            <span className="text-caption text-ink-muted">
              {group.items.length} {group.items.length === 1 ? "item" : "item"}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-[2px] md:grid-cols-4 lg:grid-cols-6">
            {group.items.map((file) => (
              <GalleryItem key={file.id} file={file} />
            ))}
          </div>
        </section>
      ))}

      {/* Sentinel observer untuk infinite scroll */}
      <div ref={observerRef} className="h-4 w-full py-2 text-center">
        {isFetchingNextPage ? (
          <p className="text-caption text-ink-muted animate-pulse">
            Memuat foto lainnya...
          </p>
        ) : null}
      </div>
    </div>
  );
}

function GalleryItem({ file }: { file: FileItem }) {
  const [loaded, setLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  const isVideo = file.kind === "video";
  const duration = formatDuration(file.durationS);
  const hasThumb = Boolean(file.thumbKey);
  const thumbUrl = getThumbnailUrl(file.id);

  return (
    <div
      className="group relative aspect-square overflow-hidden bg-sunken select-none"
      tabIndex={0}
      role="button"
      aria-label={`${isVideo ? "Video" : "Foto"} ${file.originalName}`}
    >
      {hasThumb && !hasError ? (
        /* eslint-disable-next-line @next/next/no-img-element -- Thumbnail langsung dari API host, byte file dilarang lewat Vercel (AD-3) */
        <img
          src={thumbUrl}
          crossOrigin="use-credentials"
          loading="lazy"
          alt={file.originalName}
          onLoad={() => setLoaded(true)}
          onError={() => setHasError(true)}
          className={`h-full w-full object-cover transition-opacity duration-150 ${
            loaded ? "opacity-100" : "opacity-0"
          }`}
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-2 text-ink-muted">
          {isVideo ? (
            <Film size={28} strokeWidth={1.5} className="text-ink-muted" />
          ) : (
            <ImageIcon size={28} strokeWidth={1.5} className="text-ink-muted" />
          )}
          <span className="line-clamp-1 max-w-full text-center text-[10px]">
            {file.originalName}
          </span>
        </div>
      )}

      {/* Indikator Video: Ikon putar di kanan atas & pil durasi di kiri bawah */}
      {isVideo ? (
        <>
          <div
            className="absolute top-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-scrim text-on-accent"
            aria-hidden="true"
          >
            <Play size={10} className="fill-current" />
          </div>
          {duration ? (
            <div
              className="absolute bottom-1.5 left-1.5 rounded-[4px] bg-scrim px-1 py-0.5 text-caption text-on-accent"
              aria-hidden="true"
            >
              {duration}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}


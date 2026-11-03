"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import type { FileItem } from "@galeriku/contracts";
import {
  Check,
  CheckSquare,
  Download,
  Film,
  Image as ImageIcon,
  Play,
  RefreshCw,
  Star,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  batchDeleteFiles,
  fetchFiles,
  getFileContentUrl,
  getThumbnailUrl,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { FullViewer } from "./full-viewer";

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
  kind?: "image" | "video";
  favoriteOnly?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
}

export function GalleryGrid({
  onTriggerUpload,
  kind,
  favoriteOnly,
  emptyTitle = "Belum ada foto atau video",
  emptyDescription = "Foto dan video yang kamu unggah dari HP akan tersimpan rapi di sini.",
}: GalleryGridProps) {
  const queryClient = useQueryClient();
  const observerRef = useRef<HTMLDivElement | null>(null);
  const [activeViewerIndex, setActiveViewerIndex] = useState<number | null>(null);

  // Selection mode
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBatchDeleteModal, setShowBatchDeleteModal] = useState(false);
  const [isDeletingBatch, setIsDeletingBatch] = useState(false);

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
    queryKey: ["files", { kind, favoriteOnly }],
    queryFn: ({ pageParam }) =>
      fetchFiles({
        cursor: pageParam,
        limit: 24,
        kind,
        favorite: favoriteOnly,
      }),
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

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const startSelectionWith = (id: string) => {
    setIsSelectionMode(true);
    setSelectedIds(new Set([id]));
  };

  const cancelSelection = () => {
    setIsSelectionMode(false);
    setSelectedIds(new Set());
  };

  const handleBatchDownload = () => {
    for (const id of selectedIds) {
      const file = allFiles.find((f) => f.id === id);
      if (!file) continue;
      const link = document.createElement("a");
      link.href = getFileContentUrl(id, true);
      link.download = file.originalName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleConfirmBatchDelete = async () => {
    if (selectedIds.size === 0 || isDeletingBatch) return;
    setIsDeletingBatch(true);
    try {
      await batchDeleteFiles(Array.from(selectedIds));
      queryClient.invalidateQueries({ queryKey: ["files"] });
      cancelSelection();
      setShowBatchDeleteModal(false);
    } catch {
      // Galat ditangani
    } finally {
      setIsDeletingBatch(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6" aria-busy="true" aria-label="Memuat galeri">
        <div className="space-y-2">
          <div className="h-6 w-48 animate-pulse rounded bg-sunken" />
          <div className="grid grid-cols-3 gap-[2px] sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8">
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
          <h2 className="text-h2 font-serif text-ink">{emptyTitle}</h2>
          <p className="text-body text-ink-muted">
            {emptyDescription}
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
      {/* Bilah Aksi Pemilihan (Selection Bar) */}
      {isSelectionMode ? (
        <div className="sticky top-0 z-30 flex min-h-12 items-center justify-between rounded-lg border border-line bg-surface px-3 py-2 shadow-float">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={cancelSelection}
              aria-label="Batalkan pemilihan"
              className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-ink active:bg-sunken"
            >
              <X size={20} strokeWidth={1.5} />
            </button>
            <span className="text-label font-medium text-ink">
              {selectedIds.size} dipilih
            </span>
          </div>

          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              disabled={selectedIds.size === 0}
              onClick={handleBatchDownload}
              className="flex items-center gap-1.5 text-label"
              aria-label="Unduh file terpilih"
            >
              <Download size={18} />
              <span className="hidden sm:inline">Unduh</span>
            </Button>
            <Button
              type="button"
              variant="danger"
              disabled={selectedIds.size === 0}
              onClick={() => setShowBatchDeleteModal(true)}
              className="flex items-center gap-1.5 text-label"
              aria-label="Hapus file terpilih"
            >
              <Trash2 size={18} />
              <span className="hidden sm:inline">Hapus</span>
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between px-1">
          <span className="text-caption text-ink-muted">
            Tekan lama foto untuk memilih
          </span>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setIsSelectionMode(true)}
            className="flex items-center gap-1 text-label text-ink-muted"
          >
            <CheckSquare size={16} />
            Pilih
          </Button>
        </div>
      )}

      {groups.map((group) => (
        <section key={group.dateKey} className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between px-1">
            <h3 className="text-h3 font-serif text-ink">{group.displayDate}</h3>
            <span className="text-caption text-ink-muted">
              {group.items.length} {group.items.length === 1 ? "item" : "item"}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-[2px] sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8">
            {group.items.map((file) => {
              const isSelected = selectedIds.has(file.id);
              return (
                <GalleryItem
                  key={file.id}
                  file={file}
                  isSelectionMode={isSelectionMode}
                  isSelected={isSelected}
                  onToggleSelect={() => toggleSelect(file.id)}
                  onLongPress={() => startSelectionWith(file.id)}
                  onClick={() => {
                    if (isSelectionMode) {
                      toggleSelect(file.id);
                    } else {
                      const idx = allFiles.findIndex((f) => f.id === file.id);
                      if (idx >= 0) setActiveViewerIndex(idx);
                    }
                  }}
                />
              );
            })}
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

      {activeViewerIndex !== null ? (
        <FullViewer
          files={allFiles}
          initialIndex={activeViewerIndex}
          onClose={() => setActiveViewerIndex(null)}
        />
      ) : null}

      {/* Modal Konfirmasi Hapus Banyak */}
      {showBatchDeleteModal ? (
        <div
          role="alertdialog"
          aria-labelledby="dialog-batch-hapus-judul"
          aria-describedby="dialog-batch-hapus-pesan"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        >
          <div className="w-full max-w-sm space-y-4 rounded-xl border border-line bg-surface p-6 text-ink shadow-float">
            <h3 id="dialog-batch-hapus-judul" className="text-h3 font-serif">
              Hapus {selectedIds.size} file?
            </h3>
            <p id="dialog-batch-hapus-pesan" className="text-body text-ink-muted">
              {selectedIds.size} file dan thumbnail-nya akan dihapus permanen dari server. Tindakan ini tidak dapat dibatalkan.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="ghost"
                disabled={isDeletingBatch}
                onClick={() => setShowBatchDeleteModal(false)}
              >
                Batal
              </Button>
              <Button
                type="button"
                variant="danger"
                disabled={isDeletingBatch}
                onClick={handleConfirmBatchDelete}
              >
                {isDeletingBatch ? "Menghapus..." : `Hapus (${selectedIds.size})`}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function GalleryItem({
  file,
  isSelectionMode,
  isSelected,
  onToggleSelect,
  onLongPress,
  onClick,
}: {
  file: FileItem;
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
  onLongPress?: () => void;
  onClick?: () => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const longPressTimerRef = useRef<number | null>(null);

  const isVideo = file.kind === "video";
  const duration = formatDuration(file.durationS);
  const hasThumb = Boolean(file.thumbKey);
  const thumbUrl = getThumbnailUrl(file.id);

  function handleTouchStart() {
    if (isSelectionMode) return;
    longPressTimerRef.current = window.setTimeout(() => {
      onLongPress?.();
    }, 500);
  }

  function handleTouchEnd() {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }

  return (
    <div
      className={`group relative aspect-square overflow-hidden bg-sunken select-none cursor-pointer transition-all duration-150 ${
        isSelected ? "p-1.5 ring-2 ring-accent" : ""
      }`}
      tabIndex={0}
      role="button"
      onClick={onClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchEnd}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.();
        }
      }}
      aria-label={`${isVideo ? "Video" : "Foto"} ${file.originalName}${
        isSelected ? " (terpilih)" : ""
      }`}
    >
      {/* Lingkaran Mode Pilih */}
      {isSelectionMode ? (
        <button
          type="button"
          aria-label={isSelected ? "Batal pilih" : "Pilih"}
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect?.();
          }}
          className={`absolute top-1.5 left-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-full transition-colors ${
            isSelected
              ? "bg-accent text-on-accent"
              : "border-2 border-white/80 bg-black/30 text-transparent"
          }`}
        >
          <Check size={14} strokeWidth={2.5} />
        </button>
      ) : null}

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

      {/* Indikator Favorit */}
      {file.isFavorite && !isSelectionMode ? (
        <div
          className={`absolute ${isVideo ? "top-1.5 left-1.5" : "top-1.5 right-1.5"} flex h-5 w-5 items-center justify-center rounded-full bg-scrim text-amber-400`}
          title="Item favorit"
          aria-label="Item favorit"
        >
          <Star size={11} className="fill-amber-400" />
        </div>
      ) : null}

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


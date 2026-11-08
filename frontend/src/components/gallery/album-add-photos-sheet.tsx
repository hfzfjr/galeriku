"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Film, Image as ImageIcon, Loader2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MediaThumb } from "@/components/ui/media-thumb";
import { addFilesToAlbum, fetchFiles, getThumbnailUrl } from "@/lib/api";
import { toIndonesianMessage } from "@/lib/auth-errors";

interface AlbumAddPhotosSheetProps {
  isOpen: boolean;
  onClose: () => void;
  albumId: string;
  existingFileIds: string[];
}

export function AlbumAddPhotosSheet({
  isOpen,
  onClose,
  albumId,
  existingFileIds,
}: AlbumAddPhotosSheetProps) {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<"image" | "video" | undefined>(undefined);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const observerRef = useRef<HTMLDivElement | null>(null);

  const existingSet = useMemo(() => new Set(existingFileIds), [existingFileIds]);

  // Infinite query tanpa batas 100 dengan pencarian & filter (B13)
  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteQuery({
    queryKey: ["files", "album-picker", { q: searchQuery, kind: kindFilter }],
    queryFn: ({ pageParam }) =>
      fetchFiles({
        cursor: pageParam,
        limit: 24,
        q: searchQuery.trim() || undefined,
        kind: kindFilter,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: isOpen,
  });

  // Infinite scroll IntersectionObserver
  useEffect(() => {
    const target = observerRef.current;
    if (!target || !isOpen) return;

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
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, isOpen]);

  const allFiles = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap((p) => p.items);
  }, [data]);

  const toggleSelect = (id: string) => {
    if (existingSet.has(id)) return;
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

  const addMutation = useMutation({
    mutationFn: () => addFilesToAlbum(albumId, { fileIds: Array.from(selectedIds) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["album", albumId] });
      queryClient.invalidateQueries({ queryKey: ["albums"] });
      handleClose();
    },
    onError: (err) => {
      setErrorMessage(toIndonesianMessage(err));
    },
  });

  const handleClose = () => {
    setSelectedIds(new Set());
    setSearchQuery("");
    setKindFilter(undefined);
    setErrorMessage(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Pilih foto untuk album"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200"
    >
      <div className="flex h-[90vh] sm:h-[85vh] w-full max-w-3xl flex-col rounded-t-2xl sm:rounded-2xl border border-line bg-surface p-4 sm:p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-line">
          <div>
            <h3 className="text-h3 font-serif text-ink">Tambah Foto ke Album</h3>
            <p className="text-caption text-ink-muted">
              Pilih foto atau video dari galerimu tanpa batasan.
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-ink-muted hover:bg-sunken hover:text-ink active:bg-sunken"
            aria-label="Tutup"
          >
            <X size={20} />
          </button>
        </div>

        {errorMessage && (
          <div className="mt-3 rounded-lg bg-danger/10 p-2.5 text-caption font-medium text-danger">
            {errorMessage}
          </div>
        )}

        {/* Bilah Cari dan Filter Jenis */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
            />
            <input
              type="search"
              placeholder="Cari nama file..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full min-h-11 rounded-xl border border-line bg-sunken/30 pl-9 pr-3 text-caption text-ink placeholder:text-ink-muted outline-none focus:border-accent"
            />
          </div>

          <div className="flex items-center gap-1 rounded-xl border border-line bg-surface p-1">
            <button
              type="button"
              onClick={() => setKindFilter(undefined)}
              className={`min-h-9 px-3 rounded-lg text-caption font-medium transition ${
                kindFilter === undefined
                  ? "bg-accent-soft text-accent"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              Semua
            </button>
            <button
              type="button"
              onClick={() => setKindFilter("image")}
              className={`flex min-h-9 items-center gap-1 px-3 rounded-lg text-caption font-medium transition ${
                kindFilter === "image"
                  ? "bg-accent-soft text-accent"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              <ImageIcon size={14} />
              <span>Foto</span>
            </button>
            <button
              type="button"
              onClick={() => setKindFilter("video")}
              className={`flex min-h-9 items-center gap-1 px-3 rounded-lg text-caption font-medium transition ${
                kindFilter === "video"
                  ? "bg-accent-soft text-accent"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              <Film size={14} />
              <span>Video</span>
            </button>
          </div>
        </div>

        {/* Grid Foto Berpaginasi */}
        <div className="my-3 flex-1 overflow-y-auto pr-1">
          {isLoading ? (
            <div className="grid grid-cols-3 gap-1 sm:grid-cols-4 md:grid-cols-6 py-4">
              {Array.from({ length: 18 }).map((_, i) => (
                <div key={i} className="aspect-square animate-pulse rounded bg-sunken" />
              ))}
            </div>
          ) : allFiles.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center text-center text-caption text-ink-muted">
              Tidak ada foto atau video yang ditemukan.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-1 sm:grid-cols-4 md:grid-cols-6">
                {allFiles.map((file) => {
                  const alreadyInAlbum = existingSet.has(file.id);
                  const isSelected = selectedIds.has(file.id);

                  return (
                    <button
                      key={file.id}
                      type="button"
                      disabled={alreadyInAlbum}
                      onClick={() => toggleSelect(file.id)}
                      className={`relative aspect-square overflow-hidden rounded border-2 transition text-left ${
                        alreadyInAlbum
                          ? "cursor-not-allowed opacity-45 border-transparent"
                          : isSelected
                            ? "border-accent ring-2 ring-accent"
                            : "border-transparent hover:opacity-90"
                      }`}
                      aria-label={`${file.originalName}${alreadyInAlbum ? " (sudah di album)" : ""}`}
                    >
                      <MediaThumb
                        src={file.thumbKey ? getThumbnailUrl(file.id) : null}
                        alt={file.originalName}
                        kind={file.kind}
                        durationS={file.durationS}
                        liveKind={file.liveKind}
                      />

                      {/* Status Centang atau Sudah di Album */}
                      {alreadyInAlbum ? (
                        <div className="absolute top-1 right-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
                          Di album
                        </div>
                      ) : isSelected ? (
                        <div className="absolute top-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-accent text-white shadow">
                          <Check size={14} strokeWidth={2.5} />
                        </div>
                      ) : null}
                    </button>
                  );
                })}
              </div>

              {/* Infinite scroll loader anchor */}
              <div ref={observerRef} className="py-4 text-center">
                {isFetchingNextPage ? (
                  <div className="flex items-center justify-center gap-2 text-caption text-ink-muted">
                    <Loader2 size={16} className="animate-spin text-accent" />
                    <span>Memuat foto lainnya...</span>
                  </div>
                ) : hasNextPage ? (
                  <span className="text-caption text-ink-muted">Gulir untuk melihat lebih banyak</span>
                ) : null}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-line pt-3">
          <span className="text-label font-medium text-ink">
            {selectedIds.size} dipilih
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={handleClose}
              disabled={addMutation.isPending}
              className="min-h-11 px-4 text-caption"
            >
              Batal
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={selectedIds.size === 0 || addMutation.isPending}
              loading={addMutation.isPending}
              onClick={() => addMutation.mutate()}
              className="min-h-11 px-5 text-caption font-medium"
            >
              Tambahkan ke Album
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

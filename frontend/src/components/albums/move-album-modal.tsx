"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Folder, FolderTree, Home, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchAlbums, fetchAlbumDetail } from "@/lib/api";

interface MoveAlbumModalProps {
  isOpen: boolean;
  onClose: () => void;
  albumId: string;
  albumTitle: string;
  currentParentId: string | null;
  onConfirm: (targetParentId: string | null) => Promise<void>;
}

export function MoveAlbumModal({
  isOpen,
  onClose,
  albumId,
  albumTitle,
  currentParentId,
  onConfirm,
}: MoveAlbumModalProps) {
  const [selectedParentId, setSelectedParentId] = useState<string | null>(
    currentParentId ?? null,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Ambil detail album saat ini untuk mengetahui anak-anaknya (agar tidak bisa dipindah ke keturunan)
  const { data: currentDetail } = useQuery({
    queryKey: ["album", albumId],
    queryFn: () => fetchAlbumDetail(albumId),
    enabled: isOpen,
  });

  // Ambil daftar seluruh album akar
  const { data: rootAlbumsData, isLoading: isLoadingRoots } = useQuery({
    queryKey: ["albums"],
    queryFn: () => fetchAlbums(),
    enabled: isOpen,
  });

  // Kumpulkan seluruh ID keturunan langsung dari currentDetail
  const descendantIds = useMemo(() => {
    const set = new Set<string>();
    set.add(albumId);
    if (currentDetail?.subAlbums) {
      for (const sub of currentDetail.subAlbums) {
        set.add(sub.id);
      }
    }
    return set;
  }, [albumId, currentDetail]);

  const rootAlbums = rootAlbumsData?.items ?? [];

  if (!isOpen) return null;

  const handleMove = async () => {
    if (selectedParentId === currentParentId) {
      onClose();
      return;
    }
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await onConfirm(selectedParentId);
      onClose();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Gagal memindahkan album.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="move-album-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="flex max-h-[85vh] w-full max-w-md flex-col rounded-t-2xl sm:rounded-2xl border border-line bg-surface p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft text-accent">
              <FolderTree size={18} />
            </div>
            <div>
              <h3 id="move-album-title" className="text-h3 font-serif text-ink">
                Pindahkan Album
              </h3>
              <p className="text-caption text-ink-muted">
                Pilih lokasi tujuan untuk <strong>{albumTitle}</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-ink-muted hover:bg-sunken hover:text-ink"
            aria-label="Tutup"
          >
            <X size={20} />
          </button>
        </div>

        {errorMsg && (
          <div className="mt-3 rounded-lg bg-danger/10 p-3 text-caption font-medium text-danger">
            {errorMsg}
          </div>
        )}

        <div className="mt-4 flex-1 overflow-y-auto space-y-2 pr-1">
          {/* Pilihan 1: Tingkat Teratas (Root) */}
          <button
            type="button"
            onClick={() => setSelectedParentId(null)}
            className={`flex w-full items-center justify-between rounded-xl border p-3.5 text-left transition ${
              selectedParentId === null
                ? "border-accent bg-accent-soft text-ink"
                : "border-line bg-surface hover:border-ink-muted"
            }`}
          >
            <div className="flex items-center gap-3">
              <Home size={18} className="text-accent" />
              <div>
                <p className="text-label font-medium text-ink">
                  Tingkat Teratas (Root)
                </p>
                <p className="text-caption text-ink-muted">
                  Album berada di daftar utama tanpa induk
                </p>
              </div>
            </div>
            {selectedParentId === null && (
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-white">
                <Check size={14} strokeWidth={2.5} />
              </span>
            )}
          </button>

          {/* Daftar Album Tujuan Lainnya */}
          <div className="pt-2">
            <p className="px-1 text-caption font-medium text-ink-muted">
              Pilih Album Induk:
            </p>
          </div>

          {isLoadingRoots ? (
            <div className="space-y-2 py-3 animate-pulse">
              <div className="h-12 w-full rounded-lg bg-sunken" />
              <div className="h-12 w-full rounded-lg bg-sunken" />
            </div>
          ) : rootAlbums.length === 0 ? (
            <p className="py-4 text-center text-caption text-ink-muted">
              Belum ada album lain yang tersedia.
            </p>
          ) : (
            <div className="space-y-1.5">
              {rootAlbums.map((target) => {
                const isCurrentSelf = target.id === albumId;
                const isDescendant = descendantIds.has(target.id);
                const isDisabled = isCurrentSelf || isDescendant;
                const isSelected = selectedParentId === target.id;

                let disabledReason = "";
                if (isCurrentSelf) disabledReason = "Album ini";
                else if (isDescendant) disabledReason = "Keturunan album ini";

                return (
                  <button
                    key={target.id}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => setSelectedParentId(target.id)}
                    className={`flex w-full items-center justify-between rounded-xl border p-3 text-left transition ${
                      isDisabled
                        ? "border-line/40 bg-sunken/40 opacity-50 cursor-not-allowed"
                        : isSelected
                        ? "border-accent bg-accent-soft text-ink"
                        : "border-line bg-surface hover:border-ink-muted"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Folder size={18} className="text-ink-muted shrink-0" />
                      <div className="min-w-0">
                        <p className="truncate text-label font-medium text-ink">
                          {target.title}
                        </p>
                        <p className="text-caption text-ink-muted">
                          {target.fileCount} item
                          {target.childCount > 0 ? ` · ${target.childCount} sub-album` : ""}
                          {disabledReason ? ` (${disabledReason})` : ""}
                        </p>
                      </div>
                    </div>
                    {isSelected && (
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-white shrink-0">
                        <Check size={14} strokeWidth={2.5} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-5 flex items-center justify-end gap-2 border-t border-line pt-3">
          <Button
            type="button"
            variant="ghost"
            disabled={isSubmitting}
            onClick={onClose}
            className="min-h-11 px-4 text-caption"
          >
            Batal
          </Button>
          <Button
            type="button"
            variant="primary"
            loading={isSubmitting}
            onClick={handleMove}
            className="min-h-11 px-5 text-caption font-medium"
          >
            Pindahkan ke Sini
          </Button>
        </div>
      </div>
    </div>
  );
}

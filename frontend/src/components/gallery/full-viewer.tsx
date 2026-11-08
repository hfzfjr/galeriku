"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { FileItem } from "@galeriku/contracts";
import { ChevronLeft, ChevronRight, Download, Share2, Star, Trash2, X } from "lucide-react";
import { deleteFile, getFileContentUrl, getFilePreviewUrl, toggleFavoriteFile } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { ShareModal } from "@/components/shares/share-modal";
import { getPhotoDateGroup } from "@/lib/date-group";

interface FullViewerProps {
  files: FileItem[];
  initialIndex: number;
  onClose: () => void;
}

export function FullViewer({ files, initialIndex, onClose }: FullViewerProps) {
  const queryClient = useQueryClient();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [scale, setScale] = useState(1);
  const [viewOriginalId, setViewOriginalId] = useState<string | null>(null);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const hideTimerRef = useRef<number | null>(null);

  // Touch tracking untuk swipe dan drag-to-close
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const [offsetY, setOffsetY] = useState(0);

  const total = files.length;
  const currentFile = files[currentIndex];
  const [favOverrides, setFavOverrides] = useState<Record<string, boolean>>({});
  const isFavorite = currentFile
    ? (favOverrides[currentFile.id] ?? Boolean(currentFile.isFavorite))
    : false;

  const handleToggleFavorite = async () => {
    if (!currentFile) return;
    const nextFav = !isFavorite;
    setFavOverrides((prev) => ({ ...prev, [currentFile.id]: nextFav }));
    try {
      await toggleFavoriteFile(currentFile.id, nextFav);
      queryClient.invalidateQueries({ queryKey: ["files"] });
    } catch {
      setFavOverrides((prev) => ({ ...prev, [currentFile.id]: !nextFav }));
    }
  };

  const showControlsTemporarily = useCallback(() => {
    setControlsVisible(true);
    if (hideTimerRef.current) {
      window.clearTimeout(hideTimerRef.current);
    }
    hideTimerRef.current = window.setTimeout(() => {
      setControlsVisible(false);
    }, 3000);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setControlsVisible(false);
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [currentIndex]);

  const goToNext = useCallback(() => {
    if (currentIndex < total - 1) {
      setCurrentIndex((i) => i + 1);
      setScale(1);
      setOffsetY(0);
      setControlsVisible(true);
    }
  }, [currentIndex, total]);

  const goToPrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
      setScale(1);
      setOffsetY(0);
      setControlsVisible(true);
    }
  }, [currentIndex]);

  const handleDelete = async () => {
    if (!currentFile || isDeleting) return;
    setIsDeleting(true);
    try {
      await deleteFile(currentFile.id);
      queryClient.invalidateQueries({ queryKey: ["files"] });
      setShowConfirmDelete(false);
      if (total <= 1) {
        onClose();
      } else if (currentIndex >= total - 1) {
        setCurrentIndex((i) => i - 1);
      }
    } catch {
      // Jika gagal
    } finally {
      setIsDeleting(false);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowRight") {
        goToNext();
      } else if (e.key === "ArrowLeft") {
        goToPrev();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, goToNext, goToPrev]);

  // Double tap untuk zoom
  const lastTapRef = useRef<number>(0);
  function handleDoubleTap() {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      setScale((s) => (s > 1 ? 1 : 2.5));
    }
    lastTapRef.current = now;
    showControlsTemporarily();
  }

  // Touch handlers
  function handleTouchStart(e: React.TouchEvent) {
    if (e.touches.length === 1) {
      touchStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        time: Date.now(),
      };
    }
    showControlsTemporarily();
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (!touchStartRef.current || scale > 1 || e.touches.length !== 1) return;
    const dy = e.touches[0].clientY - touchStartRef.current.y;
    // Drag down to close (hanya jika digeser ke bawah)
    if (dy > 0) {
      setOffsetY(dy);
    }
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (!touchStartRef.current) return;
    const dx = e.changedTouches[0].clientX - touchStartRef.current.x;
    const dy = e.changedTouches[0].clientY - touchStartRef.current.y;
    const dt = Date.now() - touchStartRef.current.time;

    // Jika digeser ke bawah lebih dari 90px -> tutup
    if (offsetY > 90) {
      onClose();
      return;
    }
    setOffsetY(0);

    // Swipe horizontal untuk berpindah antar file
    if (scale === 1 && Math.abs(dx) > 50 && Math.abs(dy) < 60 && dt < 400) {
      if (dx < 0) {
        goToNext();
      } else {
        goToPrev();
      }
    }

    touchStartRef.current = null;
  }

  if (!currentFile) return null;

  const isVideo = currentFile.kind === "video";
  const showOriginal = viewOriginalId === currentFile.id;
  const contentUrl = getFileContentUrl(currentFile.id);
  const previewUrl = getFilePreviewUrl(currentFile.id);
  const downloadUrl = getFileContentUrl(currentFile.id, true);
  const imageSrc = showOriginal ? contentUrl : previewUrl;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Viewer layar penuh"
      className="fixed inset-0 z-50 flex flex-col justify-between overflow-hidden bg-[#14110E] select-none touch-none"
      onClick={handleDoubleTap}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        transform: offsetY > 0 ? `translateY(${offsetY}px)` : undefined,
        transition: offsetY === 0 ? "transform 0.15s ease-out" : "none",
      }}
    >
      {/* Bilah Atas */}
      <header
        className={`fixed top-0 inset-x-0 z-20 flex min-h-14 items-center justify-between bg-scrim px-4 py-2 text-on-accent backdrop-blur-sm transition-opacity duration-300 ${
          controlsVisible ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup viewer"
          className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-on-accent active:bg-white/10"
        >
          <X size={24} strokeWidth={1.5} />
        </button>

        <span className="text-caption font-medium tracking-wider text-on-accent" aria-live="polite">
          {currentIndex + 1} / {total}
        </span>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleToggleFavorite}
            aria-label={
              isFavorite
                ? `Hapus ${currentFile.originalName} dari favorit`
                : `Jadikan ${currentFile.originalName} favorit`
            }
            className={`flex min-h-11 min-w-11 items-center justify-center rounded-full transition-colors active:bg-white/10 ${
              isFavorite ? "text-amber-400" : "text-on-accent hover:text-amber-300"
            }`}
            title={isFavorite ? "Hapus dari favorit" : "Jadikan favorit"}
          >
            <Star
              size={20}
              strokeWidth={1.5}
              className={isFavorite ? "fill-amber-400" : ""}
            />
          </button>

          <button
            type="button"
            onClick={() => setShareModalOpen(true)}
            aria-label={`Bagikan ${currentFile.originalName}`}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-on-accent hover:text-accent active:bg-white/10"
            title="Bagikan"
          >
            <Share2 size={20} strokeWidth={1.5} />
          </button>

          <a
            href={downloadUrl}
            download={currentFile.originalName}
            aria-label={`Unduh ${currentFile.originalName}`}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-on-accent active:bg-white/10"
          >
            <Download size={20} strokeWidth={1.5} />
          </a>

          <button
            type="button"
            onClick={() => setShowConfirmDelete(true)}
            aria-label={`Hapus ${currentFile.originalName}`}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-on-accent hover:text-danger active:bg-white/10"
          >
            <Trash2 size={20} strokeWidth={1.5} />
          </button>
        </div>
      </header>

      {/* Konten Utama (Foto / Video) */}
      <div className="relative flex flex-1 items-center justify-center p-2">
        {isVideo ? (
          <video
            key={currentFile.id}
            controls
            autoPlay
            playsInline
            crossOrigin="use-credentials"
            src={contentUrl}
            className="max-h-[calc(100dvh-120px)] max-w-full rounded object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element -- Stream langsung dari API host (AD-3) */
          <img
            key={`${currentFile.id}-${showOriginal ? 'orig' : 'prev'}`}
            src={imageSrc}
            crossOrigin="use-credentials"
            alt={currentFile.originalName}
            className="max-h-[calc(100dvh-120px)] max-w-full object-contain transition-transform duration-200"
            style={{
              transform: `scale(${scale})`,
              cursor: scale > 1 ? "zoom-out" : "zoom-in",
            }}
          />
        )}

        {/* Tombol Navigasi Desktop / Layar Lebar */}
        {currentIndex > 0 ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              goToPrev();
            }}
            aria-label="File sebelumnya"
            className={`absolute left-4 top-1/2 -translate-y-1/2 hidden md:flex h-11 w-11 items-center justify-center rounded-full bg-scrim text-on-accent backdrop-blur-sm transition-opacity duration-300 ${
              controlsVisible ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
          >
            <ChevronLeft size={24} strokeWidth={1.5} />
          </button>
        ) : null}

        {currentIndex < total - 1 ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              goToNext();
            }}
            aria-label="File berikutnya"
            className={`absolute right-4 top-1/2 -translate-y-1/2 hidden md:flex h-11 w-11 items-center justify-center rounded-full bg-scrim text-on-accent backdrop-blur-sm transition-opacity duration-300 ${
              controlsVisible ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
          >
            <ChevronRight size={24} strokeWidth={1.5} />
          </button>
        ) : null}
      </div>

      {/* Bilah Bawah (Metadata) */}
      <footer
        className={`fixed bottom-0 inset-x-0 z-20 flex flex-col gap-0.5 bg-scrim px-4 py-3 text-center text-on-accent backdrop-blur-sm transition-opacity duration-300 pb-[calc(12px+env(safe-area-inset-bottom))] ${
          controlsVisible ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="line-clamp-1 text-label font-medium text-on-accent">
          {currentFile.originalName}
        </p>
        <p className="text-caption text-on-accent/70">
          {(() => {
            const dateInfo = getPhotoDateGroup(
              currentFile.capturedAt || currentFile.createdAt,
              currentFile.capturedTzOffsetMin,
            );
            return `${dateInfo.displayDate} · ${dateInfo.formattedTime}`;
          })()}
        </p>
        {!isVideo && (
          <div className="flex items-center justify-center mt-1">
            <button
              type="button"
              onClick={() =>
                setViewOriginalId((prev) =>
                  prev === currentFile.id ? null : currentFile.id,
                )
              }
              aria-label={showOriginal ? "Gunakan pratinjau cepat" : "Lihat ukuran asli"}
              className="text-caption px-2.5 py-0.5 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 text-on-accent transition-colors"
            >
              {showOriginal ? "Pratinjau cepat" : "Lihat ukuran asli"}
            </button>
          </div>
        )}
      </footer>

      {/* Dialog Konfirmasi Hapus */}
      {showConfirmDelete ? (
        <div
          role="alertdialog"
          aria-labelledby="dialog-hapus-judul"
          aria-describedby="dialog-hapus-pesan"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-full max-w-sm space-y-4 rounded-xl border border-line bg-surface p-6 text-ink shadow-float">
            <h3 id="dialog-hapus-judul" className="text-h3 font-serif">
              Pindahkan ke Sampah?
            </h3>
            <p id="dialog-hapus-pesan" className="text-body text-ink-muted">
              Pindahkan 1 file ke Sampah? Kamu bisa memulihkannya dalam 30 hari.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="ghost"
                disabled={isDeleting}
                onClick={() => setShowConfirmDelete(false)}
              >
                Batal
              </Button>
              <Button
                type="button"
                variant="danger"
                disabled={isDeleting}
                onClick={handleDelete}
              >
                {isDeleting ? "Memindahkan..." : "Pindahkan"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
      {/* Modal Bagikan */}
      <ShareModal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        targetType="FILE"
        targetId={currentFile.id}
        targetTitle={currentFile.originalName}
      />
    </div>
  );
}


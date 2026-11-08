"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FileItem } from "@galeriku/contracts";
import { ChevronLeft, ChevronRight, Download, Share2, X } from "lucide-react";
import { getPublicFileContentUrl, getPublicFilePreviewUrl } from "@/lib/api";

interface PublicViewerProps {
  token: string;
  files: FileItem[];
  initialIndex: number;
  allowDownload: boolean;
  onClose: () => void;
}

export function PublicViewer({
  token,
  files,
  initialIndex,
  allowDownload,
  onClose,
}: PublicViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [scale, setScale] = useState(1);
  const [viewOriginalId, setViewOriginalId] = useState<string | null>(null);
  const hideTimerRef = useRef<number | null>(null);

  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(
    null,
  );
  const [offsetY, setOffsetY] = useState(0);

  const total = files.length;
  const currentFile = files[currentIndex];

  const handleShare = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: `Galeriku — ${currentFile.originalName}`,
          text: `Lihat file "${currentFile.originalName}" di Galeriku:`,
          url,
        });
      } catch {
        // dibatalkan pengguna
      }
    } else if (typeof navigator !== "undefined" && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(url);
      } catch {
        // clipboard diblokir
      }
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

  const goToNext = useCallback(() => {
    if (currentIndex < total - 1) {
      setCurrentIndex((prev) => prev + 1);
      setScale(1);
      showControlsTemporarily();
    }
  }, [currentIndex, total, showControlsTemporarily]);

  const goToPrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      setScale(1);
      showControlsTemporarily();
    }
  }, [currentIndex, showControlsTemporarily]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      showControlsTemporarily();
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") goToNext();
      if (e.key === "ArrowLeft") goToPrev();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, goToNext, goToPrev, showControlsTemporarily]);

  // Touch handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    showControlsTemporarily();
    if (e.touches.length === 1 && scale === 1) {
      touchStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        time: Date.now(),
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current || scale > 1) return;
    const dy = e.touches[0].clientY - touchStartRef.current.y;
    if (dy > 0) {
      setOffsetY(dy);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current || scale > 1) {
      touchStartRef.current = null;
      setOffsetY(0);
      return;
    }

    const dx = e.changedTouches[0].clientX - touchStartRef.current.x;
    const dy = e.changedTouches[0].clientY - touchStartRef.current.y;
    const dt = Date.now() - touchStartRef.current.time;

    if (dy > 90) {
      onClose();
      return;
    }

    if (Math.abs(dx) > 50 && dt < 400 && Math.abs(dy) < 50) {
      if (dx < 0) goToNext();
      else goToPrev();
    }

    touchStartRef.current = null;
    setOffsetY(0);
  };

  const handleDoubleTap = () => {
    setScale((prev) => (prev === 1 ? 2.5 : 1));
    showControlsTemporarily();
  };

  if (!currentFile) return null;

  const isVideo = currentFile.kind === "video";
  const showOriginal = viewOriginalId === currentFile.id;
  const contentUrl = getPublicFileContentUrl(token, currentFile.id);
  const previewUrl = getPublicFilePreviewUrl(token, currentFile.id);
  const downloadUrl = getPublicFileContentUrl(token, currentFile.id, true);
  const imageSrc = showOriginal ? contentUrl : previewUrl;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Viewer media publik"
      className="fixed inset-0 z-50 flex flex-col bg-[#14110E] select-none touch-none transition-transform duration-150"
      style={{
        transform: offsetY > 0 ? `translateY(${offsetY}px)` : undefined,
        opacity: offsetY > 0 ? Math.max(0.4, 1 - offsetY / 300) : 1,
      }}
      onClick={() => showControlsTemporarily()}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onDoubleClick={handleDoubleTap}
    >
      {/* Header */}
      <header
        className={`fixed top-0 inset-x-0 z-20 flex h-14 items-center justify-between bg-scrim px-4 text-on-accent backdrop-blur-sm transition-opacity duration-300 pt-[env(safe-area-inset-top)] ${
          controlsVisible ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup viewer"
            className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-on-accent active:bg-white/10"
          >
            <X size={22} strokeWidth={1.5} />
          </button>
          <span className="text-caption text-on-accent/80 font-mono">
            {currentIndex + 1} / {total}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleShare}
            aria-label="Bagikan"
            className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-on-accent active:bg-white/10"
            title="Bagikan"
          >
            <Share2 size={20} strokeWidth={1.5} />
          </button>

          {allowDownload && (
            <a
              href={downloadUrl}
              download={currentFile.originalName}
              aria-label={`Unduh ${currentFile.originalName}`}
              className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-on-accent active:bg-white/10"
              title="Unduh"
            >
              <Download size={20} strokeWidth={1.5} />
            </a>
          )}
        </div>
      </header>

      {/* Konten Utama */}
      <div className="relative flex flex-1 items-center justify-center p-2">
        {isVideo ? (
          <video
            key={currentFile.id}
            controls
            autoPlay
            playsInline
            src={contentUrl}
            className="max-h-[calc(100dvh-120px)] max-w-full rounded object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element -- Stream langsung dari API host (AD-3) */
          <img
            key={`${currentFile.id}-${showOriginal ? 'orig' : 'prev'}`}
            src={imageSrc}
            alt={currentFile.originalName}
            className="max-h-[calc(100dvh-120px)] max-w-full object-contain transition-transform duration-200"
            style={{
              transform: `scale(${scale})`,
              cursor: scale > 1 ? "zoom-out" : "zoom-in",
            }}
          />
        )}

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

      {/* Bilah Bawah */}
      <footer
        className={`fixed bottom-0 inset-x-0 z-20 flex flex-col gap-0.5 bg-scrim px-4 py-3 text-center text-on-accent backdrop-blur-sm transition-opacity duration-300 pb-[calc(12px+env(safe-area-inset-bottom))] ${
          controlsVisible ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="line-clamp-1 text-label font-medium text-on-accent">
          {currentFile.originalName}
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
    </div>
  );
}


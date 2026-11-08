"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { FileItem } from "@galeriku/contracts";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Info,
  Share2,
  Star,
  Trash2,
  X,
} from "lucide-react";
import {
  deleteFile,
  getFileContentUrl,
  getFilePreviewUrl,
  getPublicFileContentUrl,
  getPublicFilePreviewUrl,
  toggleFavoriteFile,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { ShareModal } from "@/components/shares/share-modal";
import { getPhotoDateGroup } from "@/lib/date-group";

export type MediaViewerAdapter =
  | {
      mode: "owner";
      onToggleFavorite?: (file: FileItem, nextFav: boolean) => Promise<void>;
      onDelete?: (file: FileItem) => Promise<void>;
    }
  | {
      mode: "public";
      token: string;
      allowDownload?: boolean;
    };

export interface MediaViewerProps {
  files: FileItem[];
  initialIndex: number;
  adapter: MediaViewerAdapter;
  onClose: () => void;
  onOpenInfo?: (file: FileItem) => void;
  isInfoOpen?: boolean;
  extraFooter?: ReactNode;
}

export function MediaViewer({
  files,
  initialIndex,
  adapter,
  onClose,
  onOpenInfo,
  isInfoOpen = false,
  extraFooter,
}: MediaViewerProps) {
  const queryClient = useQueryClient();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [viewOriginalId, setViewOriginalId] = useState<string | null>(null);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Gesture tracking states
  const [offsetY, setOffsetY] = useState(0);
  const [swipeOffsetX, setSwipeOffsetX] = useState(0);
  const [isGesturing, setIsGesturing] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<number | null>(null);
  const lastTapRef = useRef<{ time: number; x: number; y: number }>({
    time: 0,
    x: 0,
    y: 0,
  });

  // Touch state references
  const touchStateRef = useRef<{
    startX: number;
    startY: number;
    startTime: number;
    startPanX: number;
    startPanY: number;
    initialDistance: number;
    initialScale: number;
    mode: "idle" | "swipe-h" | "drag-down" | "pan" | "pinch";
  }>({
    startX: 0,
    startY: 0,
    startTime: 0,
    startPanX: 0,
    startPanY: 0,
    initialDistance: 0,
    initialScale: 1,
    mode: "idle",
  });

  const total = files.length;
  const currentFile = files[currentIndex];

  // Owner favorite optimistic tracking
  const [favOverrides, setFavOverrides] = useState<Record<string, boolean>>({});
  const isFavorite =
    currentFile && adapter.mode === "owner"
      ? (favOverrides[currentFile.id] ?? Boolean(currentFile.isFavorite))
      : false;

  // Preload adjacent items
  useEffect(() => {
    if (!files.length) return;
    const preload = (file?: FileItem) => {
      if (!file || file.kind === "video") return;
      const url =
        adapter.mode === "owner"
          ? getFilePreviewUrl(file.id)
          : getPublicFilePreviewUrl(adapter.token, file.id);
      const img = new Image();
      if (adapter.mode === "owner") {
        img.crossOrigin = "use-credentials";
      }
      img.src = url;
    };

    if (currentIndex > 0) preload(files[currentIndex - 1]);
    if (currentIndex < total - 1) preload(files[currentIndex + 1]);
  }, [currentIndex, files, adapter, total]);

  // Controls visibility management (3s auto-hide)
  const showControlsTemporarily = useCallback(() => {
    setControlsVisible(true);
    if (hideTimerRef.current) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    if (!isInfoOpen && !showConfirmDelete && !shareModalOpen) {
      hideTimerRef.current = window.setTimeout(() => {
        setControlsVisible(false);
      }, 3000);
    }
  }, [isInfoOpen, showConfirmDelete, shareModalOpen]);

  useEffect(() => {
    if (!isInfoOpen && !showConfirmDelete && !shareModalOpen) {
      const timer = window.setTimeout(() => {
        setControlsVisible(false);
      }, 3000);
      return () => window.clearTimeout(timer);
    }
  }, [currentIndex, isInfoOpen, showConfirmDelete, shareModalOpen]);

  // Navigation handlers
  const goToNext = useCallback(() => {
    if (currentIndex < total - 1) {
      setCurrentIndex((i) => i + 1);
      setScale(1);
      setPan({ x: 0, y: 0 });
      setOffsetY(0);
      setSwipeOffsetX(0);
      showControlsTemporarily();
    }
  }, [currentIndex, total, showControlsTemporarily]);

  const goToPrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
      setScale(1);
      setPan({ x: 0, y: 0 });
      setOffsetY(0);
      setSwipeOffsetX(0);
      showControlsTemporarily();
    }
  }, [currentIndex, showControlsTemporarily]);

  // Keyboard navigation & Focus trap
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      showControlsTemporarily();
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goToNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        goToPrev();
      } else if (e.key === "Tab") {
        // Focus trap inside viewer dialog
        if (!containerRef.current) return;
        const focusable = containerRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, goToNext, goToPrev, showControlsTemporarily]);

  // Initial focus trap setup
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.focus();
    }
  }, []);

  // Action handlers
  const handleToggleFavorite = async () => {
    if (!currentFile || adapter.mode !== "owner") return;
    const nextFav = !isFavorite;
    setFavOverrides((prev) => ({ ...prev, [currentFile.id]: nextFav }));
    try {
      if (adapter.onToggleFavorite) {
        await adapter.onToggleFavorite(currentFile, nextFav);
      } else {
        await toggleFavoriteFile(currentFile.id, nextFav);
        queryClient.invalidateQueries({ queryKey: ["files"] });
      }
    } catch {
      setFavOverrides((prev) => ({ ...prev, [currentFile.id]: !nextFav }));
    }
  };

  const handleDelete = async () => {
    if (!currentFile || isDeleting || adapter.mode !== "owner") return;
    setIsDeleting(true);
    try {
      if (adapter.onDelete) {
        await adapter.onDelete(currentFile);
      } else {
        await deleteFile(currentFile.id);
        queryClient.invalidateQueries({ queryKey: ["files"] });
      }
      setShowConfirmDelete(false);
      if (total <= 1) {
        onClose();
      } else if (currentIndex >= total - 1) {
        setCurrentIndex((i) => i - 1);
      }
    } catch {
      // Keep open on error
    } finally {
      setIsDeleting(false);
    }
  };

  const handleShare = async () => {
    if (!currentFile) return;
    if (adapter.mode === "owner") {
      setShareModalOpen(true);
      return;
    }

    const url = typeof window !== "undefined" ? window.location.href : "";
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: `Galeriku — ${currentFile.originalName}`,
          text: `Lihat file "${currentFile.originalName}" di Galeriku:`,
          url,
        });
      } catch {
        // user cancelled
      }
    } else if (typeof navigator !== "undefined" && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(url);
      } catch {
        // clipboard denied
      }
    }
  };

  // Double tap to zoom with point targeting
  const handleDoubleTap = (clientX: number, clientY: number) => {
    showControlsTemporarily();
    if (scale > 1) {
      setScale(1);
      setPan({ x: 0, y: 0 });
    } else {
      const targetScale = 2.5;
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        // Pan offset so tapped point stays under finger
        const panX = (cx - clientX) * (targetScale - 1);
        const panY = (cy - clientY) * (targetScale - 1);
        setScale(targetScale);
        setPan({ x: panX, y: panY });
      } else {
        setScale(targetScale);
      }
    }
  };

  // Touch event handlers: Pinch, Pan, Swipe, Drag-to-close
  const handleTouchStart = (e: React.TouchEvent) => {
    showControlsTemporarily();
    const now = Date.now();

    if (e.touches.length === 2) {
      // Pinch to zoom start
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      touchStateRef.current = {
        startX: (t1.clientX + t2.clientX) / 2,
        startY: (t1.clientY + t2.clientY) / 2,
        startTime: now,
        startPanX: pan.x,
        startPanY: pan.y,
        initialDistance: dist,
        initialScale: scale,
        mode: "pinch",
      };
      setIsGesturing(true);
      return;
    }

    if (e.touches.length === 1) {
      const touch = e.touches[0];

      // Check double tap
      if (
        now - lastTapRef.current.time < 300 &&
        Math.hypot(
          touch.clientX - lastTapRef.current.x,
          touch.clientY - lastTapRef.current.y,
        ) < 30
      ) {
        handleDoubleTap(touch.clientX, touch.clientY);
        lastTapRef.current = { time: 0, x: 0, y: 0 };
        return;
      }
      lastTapRef.current = { time: now, x: touch.clientX, y: touch.clientY };

      touchStateRef.current = {
        startX: touch.clientX,
        startY: touch.clientY,
        startTime: now,
        startPanX: pan.x,
        startPanY: pan.y,
        initialDistance: 0,
        initialScale: scale,
        mode: scale > 1 ? "pan" : "idle",
      };
      setIsGesturing(true);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const state = touchStateRef.current;

    if (e.touches.length === 2 && state.mode === "pinch") {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      if (state.initialDistance > 0) {
        const nextScale = Math.min(
          Math.max(state.initialScale * (dist / state.initialDistance), 1),
          4,
        );
        setScale(nextScale);
      }
      return;
    }

    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const dx = touch.clientX - state.startX;
      const dy = touch.clientY - state.startY;

      if (scale > 1) {
        // Pan zoomed image
        setPan({
          x: state.startPanX + dx,
          y: state.startPanY + dy,
        });
        return;
      }

      // scale === 1 gestures
      if (state.mode === "idle") {
        if (Math.abs(dy) > Math.abs(dx) && dy > 10) {
          state.mode = "drag-down";
        } else if (Math.abs(dx) > 10) {
          state.mode = "swipe-h";
        }
      }

      if (state.mode === "drag-down") {
        if (dy > 0) {
          setOffsetY(dy);
        }
      } else if (state.mode === "swipe-h") {
        setSwipeOffsetX(dx);
      }
    }
  };

  const handleTouchEnd = () => {
    const state = touchStateRef.current;
    setIsGesturing(false);

    if (state.mode === "pinch") {
      if (scale < 1.05) {
        setScale(1);
        setPan({ x: 0, y: 0 });
      }
      state.mode = "idle";
      return;
    }

    if (scale > 1) {
      state.mode = "idle";
      return;
    }

    if (state.mode === "drag-down") {
      if (offsetY > 90) {
        onClose();
        return;
      }
      setOffsetY(0);
      state.mode = "idle";
      return;
    }

    if (state.mode === "swipe-h") {
      const dt = Date.now() - state.startTime;
      const dx = swipeOffsetX;

      // Threshold: 50px or fast flick
      if (Math.abs(dx) > 50 || (Math.abs(dx) > 25 && dt < 250)) {
        if (dx < 0 && currentIndex < total - 1) {
          goToNext();
        } else if (dx > 0 && currentIndex > 0) {
          goToPrev();
        }
      }
      setSwipeOffsetX(0);
      state.mode = "idle";
      return;
    }

    // Tap without drag: toggle controls
    const dt = Date.now() - state.startTime;
    if (dt < 250 && Math.abs(offsetY) < 5 && Math.abs(swipeOffsetX) < 5) {
      setControlsVisible((prev) => !prev);
    }

    setOffsetY(0);
    setSwipeOffsetX(0);
    state.mode = "idle";
  };

  if (!currentFile) return null;

  const isVideo = currentFile.kind === "video";
  const showOriginal = viewOriginalId === currentFile.id;

  const contentUrl =
    adapter.mode === "owner"
      ? getFileContentUrl(currentFile.id)
      : getPublicFileContentUrl(adapter.token, currentFile.id);

  const previewUrl =
    adapter.mode === "owner"
      ? getFilePreviewUrl(currentFile.id)
      : getPublicFilePreviewUrl(adapter.token, currentFile.id);

  const downloadUrl =
    adapter.mode === "owner"
      ? getFileContentUrl(currentFile.id, true)
      : getPublicFileContentUrl(adapter.token, currentFile.id, true);

  const imageSrc = showOriginal ? contentUrl : previewUrl;
  const allowDownload =
    adapter.mode === "owner" || (adapter.mode === "public" && adapter.allowDownload !== false);

  const dateInfo = getPhotoDateGroup(
    currentFile.capturedAt || currentFile.createdAt,
    currentFile.capturedTzOffsetMin,
  );

  return (
    <div
      ref={containerRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label="Viewer layar penuh"
      className="fixed inset-0 z-50 flex flex-col justify-between overflow-hidden bg-[#14110E] select-none touch-none outline-none"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        transform: offsetY > 0 ? `translateY(${offsetY}px)` : undefined,
        opacity: offsetY > 0 ? Math.max(0.3, 1 - offsetY / 300) : 1,
        transition: isGesturing ? "none" : "transform 0.2s ease-out, opacity 0.2s ease-out",
      }}
    >
      {/* Bilah Atas */}
      <header
        className={`fixed top-0 inset-x-0 z-20 flex min-h-14 items-center justify-between bg-scrim px-4 py-2 text-on-accent backdrop-blur-sm transition-opacity duration-300 pt-[calc(8px+env(safe-area-inset-top))] ${
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
            <X size={24} strokeWidth={1.5} />
          </button>
          <span
            className="text-caption font-medium tracking-wider text-on-accent font-mono"
            aria-live="polite"
          >
            {currentIndex + 1} / {total}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {/* Owner: Tombol Favorit */}
          {adapter.mode === "owner" && (
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
          )}

          {/* Tombol Info (RF-14 siap dipakai) */}
          {onOpenInfo && (
            <button
              type="button"
              onClick={() => onOpenInfo(currentFile)}
              aria-label="Lihat info"
              className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-on-accent hover:text-accent active:bg-white/10"
              title="Lihat info"
            >
              <Info size={20} strokeWidth={1.5} />
            </button>
          )}

          {/* Tombol Bagikan */}
          <button
            type="button"
            onClick={handleShare}
            aria-label={`Bagikan ${currentFile.originalName}`}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-on-accent hover:text-accent active:bg-white/10"
            title="Bagikan"
          >
            <Share2 size={20} strokeWidth={1.5} />
          </button>

          {/* Tombol Unduh */}
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

          {/* Owner: Tombol Hapus */}
          {adapter.mode === "owner" && (
            <button
              type="button"
              onClick={() => setShowConfirmDelete(true)}
              aria-label={`Hapus ${currentFile.originalName}`}
              className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-on-accent hover:text-danger active:bg-white/10"
              title="Hapus"
            >
              <Trash2 size={20} strokeWidth={1.5} />
            </button>
          )}
        </div>
      </header>

      {/* Konten Utama (Media Image / Video) */}
      <div className="relative flex flex-1 items-center justify-center p-2 overflow-hidden">
        <div
          className="relative flex items-center justify-center w-full h-full"
          style={{
            transform: `translate3d(${swipeOffsetX + pan.x}px, ${pan.y}px, 0) scale(${scale})`,
            transition: isGesturing ? "none" : "transform 0.25s cubic-bezier(0.2, 0, 0, 1)",
            cursor: scale > 1 ? "grab" : "default",
          }}
        >
          {isVideo ? (
            <video
              key={currentFile.id}
              controls
              autoPlay
              playsInline
              crossOrigin={adapter.mode === "owner" ? "use-credentials" : undefined}
              src={contentUrl}
              className="max-h-[calc(100dvh-130px)] max-w-full rounded object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element -- Stream langsung dari API host (AD-3) */
            <img
              key={`${currentFile.id}-${showOriginal ? "orig" : "prev"}`}
              src={imageSrc}
              crossOrigin={adapter.mode === "owner" ? "use-credentials" : undefined}
              alt={currentFile.originalName}
              className="max-h-[calc(100dvh-130px)] max-w-full object-contain pointer-events-none select-none"
              draggable={false}
            />
          )}
        </div>

        {/* Tombol Navigasi Desktop / Layar Lebar */}
        {currentIndex > 0 && (
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
        )}

        {currentIndex < total - 1 && (
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
        )}
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
          {`${dateInfo.displayDate} · ${dateInfo.formattedTime}`}
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

        {extraFooter}
      </footer>

      {/* Owner: Dialog Konfirmasi Hapus */}
      {adapter.mode === "owner" && showConfirmDelete && (
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
      )}

      {/* Owner: Modal Bagikan */}
      {adapter.mode === "owner" && (
        <ShareModal
          isOpen={shareModalOpen}
          onClose={() => setShareModalOpen(false)}
          targetType="FILE"
          targetId={currentFile.id}
          targetTitle={currentFile.originalName}
        />
      )}
    </div>
  );
}

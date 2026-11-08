"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { FileItem } from "@galeriku/contracts";
import {
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Download,
  Info,
  MapPin,
  Share2,
  Star,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import {
  deleteFile,
  getFileContentUrl,
  getFileMotionUrl,
  getFilePreviewUrl,
  getThumbnailUrl,
  getPublicFileContentUrl,
  getPublicFileMotionUrl,
  getPublicFilePreviewUrl,
  getPublicThumbnailUrl,
  toggleFavoriteFile,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { ShareModal } from "@/components/shares/share-modal";
import { getPhotoDateGroup } from "@/lib/date-group";
import { FileInfoSheet } from "./file-info-sheet";

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

const emptySubscribe = () => () => {};

function checkCanShareFiles(): boolean {
  if (
    typeof navigator !== "undefined" &&
    typeof navigator.canShare === "function"
  ) {
    try {
      const testFile = new File([""], "test.jpg", { type: "image/jpeg" });
      return navigator.canShare({ files: [testFile] });
    } catch {
      return false;
    }
  }
  return false;
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
  const [infoSheetOpen, setInfoSheetOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const effectiveInfoOpen = isInfoOpen || infoSheetOpen;

  // Gesture tracking states
  const [offsetY, setOffsetY] = useState(0);
  const [swipeOffsetX, setSwipeOffsetX] = useState(0);
  const [isGesturing, setIsGesturing] = useState(false);

  // Filmstrip refs & controls hover
  const filmstripContainerRef = useRef<HTMLDivElement>(null);
  const activeThumbRef = useRef<HTMLButtonElement>(null);
  const isHoveringControlsRef = useRef(false);

  // Desktop Mouse Drag / Pan states
  const [isMouseDown, setIsMouseDown] = useState(false);
  const isDraggingMouseRef = useRef(false);
  const mouseDragRef = useRef<{
    startX: number;
    startY: number;
    startPanX: number;
    startPanY: number;
  }>({ startX: 0, startY: 0, startPanX: 0, startPanY: 0 });

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

  // Deteksi kemampuan navigator.canShare dengan berkas (RF-23: Simpan ke Galeri)
  const canShareFiles = useSyncExternalStore(
    emptySubscribe,
    checkCanShareFiles,
    () => false,
  );
  const [showLargeFileWarning, setShowLargeFileWarning] = useState(false);
  const [isSavingToGallery, setIsSavingToGallery] = useState(false);

  // State untuk Live Photo / Motion Photo (RF-33)
  const isVideo = currentFile?.kind === "video";
  const isLive =
    !isVideo &&
    Boolean(currentFile?.liveKind) &&
    currentFile.liveKind !== "none";

  const [isLiveActive, setIsLiveActive] = useState(false);
  const [isLivePlaying, setIsLivePlaying] = useState(false);
  const [isLiveMuted, setIsLiveMuted] = useState(true);
  const liveVideoRef = useRef<HTMLVideoElement>(null);
  const holdTimerRef = useRef<number | null>(null);
  const isHoldingRef = useRef(false);

  // Auto-play sekali saat Live Photo dibuka (kecuali prefers-reduced-motion atau saveData)
  useEffect(() => {
    isHoldingRef.current = false;
    if (holdTimerRef.current) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }

    if (!isLive) {
      return;
    }

    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isSaveData =
      typeof navigator !== "undefined" &&
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (navigator as any).connection?.saveData === true;

    if (!prefersReducedMotion && !isSaveData) {
      const timer = window.setTimeout(() => {
        setIsLiveActive(true);
        setIsLivePlaying(true);
      }, 50);
      return () => window.clearTimeout(timer);
    }
  }, [currentIndex, isLive]);

  const startHoldToPlay = useCallback(() => {
    if (!isLive) return;
    setIsLiveActive(true);
    setIsLivePlaying(true);
    isHoldingRef.current = true;
    if (liveVideoRef.current) {
      liveVideoRef.current.currentTime = 0;
      liveVideoRef.current.play().catch(() => {});
    }
  }, [isLive]);

  const endHoldToPlay = useCallback(() => {
    if (!isLive) return;
    if (isHoldingRef.current) {
      isHoldingRef.current = false;
      setIsLivePlaying(false);
      if (liveVideoRef.current) {
        liveVideoRef.current.pause();
      }
    }
  }, [isLive]);

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

  // Auto-scroll thumbnail aktif pada filmstrip
  useEffect(() => {
    if (activeThumbRef.current) {
      activeThumbRef.current.scrollIntoView({
        behavior: "smooth",
        inline: "center",
        block: "nearest",
      });
    }
  }, [currentIndex]);

  // Controls visibility management (3.5s auto-hide)
  const showControlsTemporarily = useCallback(() => {
    setControlsVisible(true);
    if (hideTimerRef.current) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    if (
      !effectiveInfoOpen &&
      !showConfirmDelete &&
      !shareModalOpen &&
      !isHoveringControlsRef.current
    ) {
      hideTimerRef.current = window.setTimeout(() => {
        setControlsVisible(false);
      }, 3500);
    }
  }, [effectiveInfoOpen, showConfirmDelete, shareModalOpen]);

  const handleControlsMouseEnter = useCallback(() => {
    isHoveringControlsRef.current = true;
    setControlsVisible(true);
    if (hideTimerRef.current) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const handleControlsMouseLeave = useCallback(() => {
    isHoveringControlsRef.current = false;
    showControlsTemporarily();
  }, [showControlsTemporarily]);

  useEffect(() => {
    if (
      !effectiveInfoOpen &&
      !showConfirmDelete &&
      !shareModalOpen &&
      !isHoveringControlsRef.current
    ) {
      const timer = window.setTimeout(() => {
        setControlsVisible(false);
      }, 3500);
      return () => window.clearTimeout(timer);
    }
  }, [currentIndex, effectiveInfoOpen, showConfirmDelete, shareModalOpen]);

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

  const triggerDirectDownload = () => {
    if (!currentFile) return;
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = currentFile.originalName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Simpan ke Galeri via navigator.share({ files }) (RF-23)
  const handleSaveToGallery = async (bypassWarning = false) => {
    if (!currentFile || !allowDownload) return;
    const size = BigInt(currentFile.sizeBytes || "0");
    const FIFTY_MB = BigInt(50 * 1024 * 1024);

    if (!bypassWarning && size > FIFTY_MB) {
      setShowLargeFileWarning(true);
      return;
    }

    setShowLargeFileWarning(false);
    setIsSavingToGallery(true);
    try {
      const res = await fetch(downloadUrl, {
        credentials: adapter.mode === "owner" ? "include" : "same-origin",
      });
      if (!res.ok) throw new Error("Gagal mengunduh berkas");
      const blob = await res.blob();
      const file = new File([blob], currentFile.originalName, {
        type: currentFile.mimeType || "application/octet-stream",
      });
      if (
        typeof navigator !== "undefined" &&
        navigator.canShare &&
        navigator.canShare({ files: [file] })
      ) {
        await navigator.share({
          files: [file],
          title: currentFile.originalName,
        });
      } else {
        triggerDirectDownload();
      }
    } catch (err: unknown) {
      if ((err as Error)?.name !== "AbortError") {
        console.error("Gagal simpan ke galeri:", err);
        triggerDirectDownload();
      }
    } finally {
      setIsSavingToGallery(false);
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

  // Mouse drag & double click handlers (Desktop WhatsApp Web style)
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if (scale > 1) {
      e.preventDefault();
      setIsMouseDown(true);
      isDraggingMouseRef.current = false;
      mouseDragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        startPanX: pan.x,
        startPanY: pan.y,
      };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    showControlsTemporarily();

    if (isMouseDown && scale > 1) {
      const dx = e.clientX - mouseDragRef.current.startX;
      const dy = e.clientY - mouseDragRef.current.startY;
      if (Math.hypot(dx, dy) > 4) {
        isDraggingMouseRef.current = true;
      }
      setPan({
        x: mouseDragRef.current.startPanX + dx,
        y: mouseDragRef.current.startPanY + dy,
      });
    }
  };

  const handleMouseUp = () => {
    setIsMouseDown(false);
    setTimeout(() => {
      isDraggingMouseRef.current = false;
    }, 50);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    handleDoubleTap(e.clientX, e.clientY);
  };

  const handleBackdropClick = () => {
    if (isDraggingMouseRef.current) return;
    if (scale > 1) {
      setScale(1);
      setPan({ x: 0, y: 0 });
      return;
    }
    onClose();
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

      // Mulai deteksi tekan-tahan untuk memutar Live Photo (RF-33)
      if (isLive && scale === 1) {
        if (holdTimerRef.current) {
          window.clearTimeout(holdTimerRef.current);
        }
        holdTimerRef.current = window.setTimeout(startHoldToPlay, 200);
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const state = touchStateRef.current;

    if (e.touches.length === 2 && state.mode === "pinch") {
      if (holdTimerRef.current) {
        window.clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }
      endHoldToPlay();

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

      // Jika jari bergeser > 10px, batalkan tekan-tahan Live Photo
      if (holdTimerRef.current && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
        window.clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
        endHoldToPlay();
      }

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
    if (holdTimerRef.current) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    endHoldToPlay();

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
      className="fixed inset-0 z-50 flex flex-col justify-between overflow-hidden bg-[#14110E] select-none outline-none"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onClick={handleBackdropClick}
      style={{
        transform: offsetY > 0 ? `translateY(${offsetY}px)` : undefined,
        opacity: offsetY > 0 ? Math.max(0.3, 1 - offsetY / 300) : 1,
        transition: isGesturing ? "none" : "transform 0.2s ease-out, opacity 0.2s ease-out",
      }}
    >
      {/* Bilah Atas */}
      <header
        className={`fixed top-0 inset-x-0 z-30 flex min-h-14 items-center justify-between bg-black/80 px-4 py-2 text-white backdrop-blur-md border-b border-white/10 transition-opacity duration-300 pt-[calc(8px+env(safe-area-inset-top))] ${
          controlsVisible ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => {
          e.stopPropagation();
          showControlsTemporarily();
        }}
        onTouchMove={(e) => e.stopPropagation()}
        onTouchEnd={(e) => e.stopPropagation()}
        onMouseEnter={handleControlsMouseEnter}
        onMouseLeave={handleControlsMouseLeave}
      >
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup viewer"
            className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-white hover:bg-white/15 active:bg-white/20 transition-colors touch-manipulation cursor-pointer"
          >
            <X size={24} strokeWidth={1.5} className="pointer-events-none" />
          </button>
          <span
            className="text-caption font-medium tracking-wider text-white/80 font-mono select-none"
            aria-live="polite"
          >
            {currentIndex + 1} / {total}
          </span>
          {isLive && (
            <button
              type="button"
              onClick={() => {
                setIsLiveActive(true);
                if (isLivePlaying) {
                  setIsLivePlaying(false);
                  liveVideoRef.current?.pause();
                } else {
                  setIsLivePlaying(true);
                  if (liveVideoRef.current) {
                    liveVideoRef.current.currentTime = 0;
                    liveVideoRef.current.play().catch(() => {});
                  }
                }
              }}
              onPointerDown={startHoldToPlay}
              onPointerUp={endHoldToPlay}
              onPointerLeave={endHoldToPlay}
              aria-label={isLivePlaying ? "Hentikan gerak Live Photo" : "Putar gerak Live Photo"}
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold backdrop-blur-xs transition-colors touch-manipulation cursor-pointer ${
                isLivePlaying
                  ? "bg-amber-500 text-black shadow-md ring-1 ring-amber-300"
                  : "bg-white/15 text-white hover:bg-white/25"
              }`}
              title="Tekan dan tahan untuk memutar"
            >
              <CircleDot
                size={14}
                strokeWidth={2.5}
                className={`shrink-0 pointer-events-none ${isLivePlaying ? "animate-pulse text-black" : "text-amber-300"}`}
              />
              <span className="pointer-events-none">LIVE</span>
            </button>
          )}
        </div>

        {/* Info Tengah Desktop: Nama File, Tanggal, dan Lokasi */}
        <div className="hidden sm:flex flex-col items-center justify-center flex-1 px-4 min-w-0 text-center">
          <h2 className="text-sm md:text-base font-medium text-white truncate max-w-xs md:max-w-md lg:max-w-xl">
            {currentFile.originalName}
          </h2>
          <div className="flex items-center gap-2 text-xs text-white/70">
            <span>{dateInfo.displayDate} · {dateInfo.formattedTime}</span>
            {currentFile.place && (
              <span className="inline-flex items-center gap-1 text-white/90">
                <MapPin size={12} className="text-amber-400 shrink-0 pointer-events-none" />
                <span className="truncate max-w-[160px] md:max-w-[240px]">{currentFile.place}</span>
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Tombol Audio Mute/Unmute untuk Live Photo (RF-33) */}
          {isLive && (
            <button
              type="button"
              onClick={() => {
                const next = !isLiveMuted;
                setIsLiveMuted(next);
                if (liveVideoRef.current) {
                  liveVideoRef.current.muted = next;
                }
              }}
              aria-label={isLiveMuted ? "Aktifkan suara Live Photo" : "Bisukan suara Live Photo"}
              className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-white hover:text-amber-300 active:bg-white/15 transition-colors touch-manipulation cursor-pointer"
              title={isLiveMuted ? "Aktifkan suara" : "Bisukan suara"}
            >
              {isLiveMuted ? (
                <VolumeX size={20} strokeWidth={1.5} className="pointer-events-none" />
              ) : (
                <Volume2 size={20} strokeWidth={1.5} className="text-amber-400 pointer-events-none" />
              )}
            </button>
          )}
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
              className={`flex min-h-11 min-w-11 items-center justify-center rounded-full transition-colors active:bg-white/15 touch-manipulation cursor-pointer ${
                isFavorite ? "text-amber-400" : "text-white hover:text-amber-300"
              }`}
              title={isFavorite ? "Hapus dari favorit" : "Jadikan favorit"}
            >
              <Star
                size={20}
                strokeWidth={1.5}
                className={`pointer-events-none ${isFavorite ? "fill-amber-400" : ""}`}
              />
            </button>
          )}

          {/* Tombol Info (RF-14) */}
          <button
            type="button"
            onClick={() => {
              setInfoSheetOpen(true);
              if (onOpenInfo) onOpenInfo(currentFile);
            }}
            aria-label="Lihat info"
            className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-white hover:text-amber-300 active:bg-white/15 transition-colors touch-manipulation cursor-pointer"
            title="Lihat info"
          >
            <Info size={20} strokeWidth={1.5} className="pointer-events-none" />
          </button>

          {/* Tombol Bagikan */}
          <button
            type="button"
            onClick={handleShare}
            aria-label={`Bagikan ${currentFile.originalName}`}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-white hover:text-amber-300 active:bg-white/15 transition-colors touch-manipulation cursor-pointer"
            title="Bagikan"
          >
            <Share2 size={20} strokeWidth={1.5} className="pointer-events-none" />
          </button>

          {/* Tombol Unduh / Simpan ke Galeri (RF-23) */}
          {allowDownload &&
            (canShareFiles ? (
              <button
                type="button"
                onClick={() => handleSaveToGallery(false)}
                disabled={isSavingToGallery}
                aria-label={`Simpan ke Galeri ${currentFile.originalName}`}
                className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-white hover:text-amber-300 active:bg-white/15 disabled:opacity-50 transition-colors touch-manipulation cursor-pointer"
                title="Simpan ke Galeri"
              >
                {isSavingToGallery ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent pointer-events-none" />
                ) : (
                  <Download size={20} strokeWidth={1.5} className="pointer-events-none" />
                )}
              </button>
            ) : (
              <a
                href={downloadUrl}
                download={currentFile.originalName}
                aria-label={`Unduh ${currentFile.originalName}`}
                className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-white hover:text-amber-300 active:bg-white/15 transition-colors touch-manipulation cursor-pointer"
                title="Unduh"
              >
                <Download size={20} strokeWidth={1.5} className="pointer-events-none" />
              </a>
            ))}

          {/* Owner: Tombol Hapus */}
          {adapter.mode === "owner" && (
            <button
              type="button"
              onClick={() => setShowConfirmDelete(true)}
              aria-label={`Hapus ${currentFile.originalName}`}
              className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-white hover:text-danger active:bg-white/15 transition-colors touch-manipulation cursor-pointer"
              title="Hapus"
            >
              <Trash2 size={20} strokeWidth={1.5} className="pointer-events-none" />
            </button>
          )}
        </div>
      </header>

      {/* Konten Utama (Media Image / Video) */}
      <div
        className="relative flex flex-1 items-center justify-center p-2 sm:p-4 overflow-hidden"
        onClick={handleBackdropClick}
      >
        <div
          className="relative flex items-center justify-center max-h-full max-w-full"
          style={{
            transform: `translate3d(${swipeOffsetX + pan.x}px, ${pan.y}px, 0) scale(${scale})`,
            transition: isGesturing || isMouseDown ? "none" : "transform 0.25s cubic-bezier(0.2, 0, 0, 1)",
            cursor: scale > 1 ? (isMouseDown ? "grabbing" : "grab") : "default",
          }}
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={handleDoubleClick}
          onMouseDown={handleMouseDown}
        >
          {isVideo ? (
            <video
              key={currentFile.id}
              controls
              autoPlay
              playsInline
              crossOrigin={adapter.mode === "owner" ? "use-credentials" : undefined}
              src={contentUrl}
              className="max-h-[calc(100dvh-170px)] sm:max-h-[calc(100dvh-180px)] max-w-full rounded object-contain shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <div
              className="relative flex items-center justify-center max-h-[calc(100dvh-170px)] sm:max-h-[calc(100dvh-180px)] max-w-full"
              onPointerDown={() => {
                if (isLive && scale === 1) {
                  holdTimerRef.current = window.setTimeout(startHoldToPlay, 180);
                }
              }}
              onPointerUp={() => {
                if (holdTimerRef.current) {
                  window.clearTimeout(holdTimerRef.current);
                  holdTimerRef.current = null;
                }
                endHoldToPlay();
              }}
              onPointerCancel={() => {
                if (holdTimerRef.current) {
                  window.clearTimeout(holdTimerRef.current);
                  holdTimerRef.current = null;
                }
                endHoldToPlay();
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- Stream langsung dari API host (AD-3) */}
              <img
                key={`${currentFile.id}-${showOriginal ? "orig" : "prev"}`}
                src={imageSrc}
                crossOrigin={adapter.mode === "owner" ? "use-credentials" : undefined}
                alt={currentFile.originalName}
                className="max-h-[calc(100dvh-170px)] sm:max-h-[calc(100dvh-180px)] max-w-full object-contain pointer-events-none select-none shadow-2xl"
                draggable={false}
              />
              {isLive && isLiveActive && (
                <video
                  ref={liveVideoRef}
                  key={`motion-${currentFile.id}`}
                  src={
                    adapter.mode === "owner"
                      ? getFileMotionUrl(currentFile.id)
                      : getPublicFileMotionUrl(adapter.token, currentFile.id)
                  }
                  muted={isLiveMuted}
                  playsInline
                  autoPlay={isLivePlaying}
                  crossOrigin={adapter.mode === "owner" ? "use-credentials" : undefined}
                  onEnded={() => setIsLivePlaying(false)}
                  className={`absolute inset-0 max-h-[calc(100dvh-170px)] sm:max-h-[calc(100dvh-180px)] max-w-full m-auto object-contain transition-opacity duration-150 ${
                    isLivePlaying ? "opacity-100 z-10" : "opacity-0 pointer-events-none"
                  }`}
                />
              )}
            </div>
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
            onTouchStart={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
            aria-label="File sebelumnya"
            className={`absolute left-4 top-1/2 -translate-y-1/2 z-30 hidden md:flex h-12 w-12 items-center justify-center rounded-full bg-black/60 hover:bg-black/85 text-white border border-white/20 shadow-lg backdrop-blur-md transition-all hover:scale-105 active:scale-95 touch-manipulation cursor-pointer ${
              controlsVisible ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
          >
            <ChevronLeft size={28} strokeWidth={2} className="pointer-events-none" />
          </button>
        )}

        {currentIndex < total - 1 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              goToNext();
            }}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
            aria-label="File berikutnya"
            className={`absolute right-4 top-1/2 -translate-y-1/2 z-30 hidden md:flex h-12 w-12 items-center justify-center rounded-full bg-black/60 hover:bg-black/85 text-white border border-white/20 shadow-lg backdrop-blur-md transition-all hover:scale-105 active:scale-95 touch-manipulation cursor-pointer ${
              controlsVisible ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
          >
            <ChevronRight size={28} strokeWidth={2} className="pointer-events-none" />
          </button>
        )}
      </div>

      {/* Bilah Bawah & Slider Thumbnail (WhatsApp Desktop & iOS) */}
      <footer
        className={`fixed bottom-0 inset-x-0 z-30 flex flex-col items-center gap-1.5 bg-black/80 px-4 py-2 text-center text-white backdrop-blur-md border-t border-white/10 transition-opacity duration-300 pb-[calc(10px+env(safe-area-inset-bottom))] ${
          controlsVisible ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => {
          e.stopPropagation();
          showControlsTemporarily();
        }}
        onTouchMove={(e) => e.stopPropagation()}
        onTouchEnd={(e) => e.stopPropagation()}
        onMouseEnter={handleControlsMouseEnter}
        onMouseLeave={handleControlsMouseLeave}
      >
        {/* Info Mobile (< sm): Nama file, tanggal, dan lokasi */}
        <div className="sm:hidden flex flex-col items-center gap-0.5">
          <p className="line-clamp-1 text-sm font-medium text-white">
            {currentFile.originalName}
          </p>
          <div className="flex items-center gap-1.5 text-xs text-white/70">
            <span>{dateInfo.displayDate} · {dateInfo.formattedTime}</span>
            {currentFile.place && (
              <span className="inline-flex items-center gap-0.5 text-amber-400">
                <MapPin size={11} className="shrink-0 pointer-events-none" />
                <span className="truncate max-w-[130px]">{currentFile.place}</span>
              </span>
            )}
          </div>
        </div>

        {/* Tombol Lihat Ukuran Asli */}
        {!isVideo && (
          <div className="flex items-center justify-center">
            <button
              type="button"
              onClick={() =>
                setViewOriginalId((prev) =>
                  prev === currentFile.id ? null : currentFile.id,
                )
              }
              aria-label={showOriginal ? "Gunakan pratinjau cepat" : "Lihat ukuran asli"}
              className="text-xs px-3 py-1.5 rounded-full bg-white/15 hover:bg-white/25 active:bg-white/35 text-white transition-colors border border-white/10 touch-manipulation cursor-pointer"
            >
              {showOriginal ? "Pratinjau cepat" : "Lihat ukuran asli"}
            </button>
          </div>
        )}

        {/* Filmstrip Thumbnail Slider ala WhatsApp Desktop / Web */}
        {total > 1 && (
          <div
            ref={filmstripContainerRef}
            className="w-full max-w-4xl mx-auto flex items-center justify-start sm:justify-center gap-2 overflow-x-auto py-1 px-2 no-scrollbar touch-pan-x"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
          >
            {files.map((file, idx) => {
              const isActive = idx === currentIndex;
              const thumbUrl =
                adapter.mode === "owner"
                  ? getThumbnailUrl(file.id)
                  : getPublicThumbnailUrl(adapter.token, file.id);

              return (
                <button
                  key={file.id}
                  ref={isActive ? activeThumbRef : null}
                  type="button"
                  onClick={() => {
                    setCurrentIndex(idx);
                    setScale(1);
                    setPan({ x: 0, y: 0 });
                    setOffsetY(0);
                    setSwipeOffsetX(0);
                    showControlsTemporarily();
                  }}
                  aria-label={`Buka ${file.originalName} (${idx + 1} dari ${total})`}
                  className={`relative h-12 w-12 sm:h-14 sm:w-14 shrink-0 rounded-md overflow-hidden transition-all duration-150 touch-manipulation cursor-pointer ${
                    isActive
                      ? "ring-2 ring-amber-400 ring-offset-2 ring-offset-black scale-105 opacity-100 shadow-md"
                      : "opacity-50 hover:opacity-90 hover:scale-100 border border-white/10"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={thumbUrl}
                    alt={file.originalName}
                    crossOrigin={adapter.mode === "owner" ? "use-credentials" : undefined}
                    className="w-full h-full object-cover select-none pointer-events-none"
                    loading="lazy"
                  />
                  {file.kind === "video" && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 pointer-events-none">
                      <span className="h-0 w-0 border-y-[4px] border-y-transparent border-l-[6px] border-l-white" />
                    </div>
                  )}
                </button>
              );
            })}
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
          onTouchStart={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
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

      {/* Dialog Peringatan Berkas Besar > 50 MB (RF-23) */}
      {showLargeFileWarning && (
        <div
          role="alertdialog"
          aria-labelledby="large-file-dialog-title"
          aria-describedby="large-file-dialog-desc"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
        >
          <div className="w-full max-w-sm space-y-4 rounded-xl border border-line bg-surface p-6 text-ink shadow-float">
            <h3 id="large-file-dialog-title" className="text-h3 font-serif">
              Berkas Berukuran Besar
            </h3>
            <p id="large-file-dialog-desc" className="text-body text-ink-muted">
              Ukuran berkas melebihi 50 MB. Memuat ke memori HP dapat memperlambat perangkat. Tetap simpan atau unduh langsung?
            </p>
            <div className="flex flex-col gap-2 pt-2">
              <Button
                type="button"
                variant="primary"
                onClick={() => handleSaveToGallery(true)}
              >
                Tetap Simpan ke Galeri
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setShowLargeFileWarning(false);
                  triggerDirectDownload();
                }}
              >
                Unduh Biasa
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowLargeFileWarning(false)}
              >
                Batal
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

      {/* Panel Info (RF-14) */}
      <FileInfoSheet
        open={effectiveInfoOpen}
        onClose={() => setInfoSheetOpen(false)}
        file={currentFile}
        isOwner={adapter.mode === "owner"}
        onDateUpdated={(updated) => {
          Object.assign(currentFile, updated);
        }}
      />
    </div>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import type { FileItem, TimelineBucket } from "@galeriku/contracts";
import {
  Calendar,
  Check,
  CheckSquare,
  Download,
  FolderPlus,
  Image as ImageIcon,
  RefreshCw,
  RotateCcw,
  Share2,
  Star,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  batchDeleteFiles,
  downloadFilesZip,
  fetchFiles,
  fetchTimeline,
  getThumbnailUrl,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { MediaThumb } from "@/components/ui/media-thumb";
import { getPhotoDateGroup } from "@/lib/date-group";
import { AddToAlbumSheet } from "./add-to-album-sheet";
import { FilterBar, type FilterState, type SortOption } from "./filter-bar";
import { FullViewer } from "./full-viewer";
import { QuickShareModal } from "./quick-share-modal";

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
  initialSort?: "taken" | "uploaded";
}

const NAMA_BULAN = [
  "",
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];

function formatAnchorDisplay(anchorStr: string): string {
  const [y, m] = anchorStr.split("-");
  const monthIdx = parseInt(m, 10);
  return `${NAMA_BULAN[monthIdx] || m} ${y}`;
}

function parseSortOption(sortOpt: SortOption): {
  sort: "taken" | "uploaded" | "name" | "size";
  order: "desc" | "asc";
} {
  switch (sortOpt) {
    case "taken_asc":
      return { sort: "taken", order: "asc" };
    case "uploaded_desc":
      return { sort: "uploaded", order: "desc" };
    case "name_asc":
      return { sort: "name", order: "asc" };
    case "name_desc":
      return { sort: "name", order: "desc" };
    case "size_desc":
      return { sort: "size", order: "desc" };
    case "size_asc":
      return { sort: "size", order: "asc" };
    case "taken_desc":
    default:
      return { sort: "taken", order: "desc" };
  }
}

export function GalleryGrid({
  onTriggerUpload,
  kind,
  favoriteOnly,
  emptyTitle = "Belum ada foto atau video",
  emptyDescription = "Foto dan video yang kamu unggah dari HP akan tersimpan rapi di sini.",
  initialSort = "taken",
}: GalleryGridProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const observerRef = useRef<HTMLDivElement | null>(null);
  const [activeViewerIndex, setActiveViewerIndex] = useState<number | null>(null);

  // Filter state tersinkron ke URL (RF-42)
  const sortOption: SortOption =
    (searchParams.get("urut") as SortOption) ||
    (initialSort === "uploaded" ? "uploaded_desc" : "taken_desc");
  const { sort: activeSort, order: activeOrder } = parseSortOption(sortOption);

  const filterParam = searchParams.get("filter");
  const jenisParam = searchParams.get("jenis");
  const activeKind: "image" | "video" | undefined =
    kind ||
    (jenisParam === "image" || jenisParam === "video"
      ? (jenisParam as "image" | "video")
      : filterParam === "foto"
        ? "image"
        : filterParam === "video"
          ? "video"
          : undefined);

  const activeFavorite =
    favoriteOnly || searchParams.get("favorit") === "true" ? true : undefined;
  const activeUnalbumed =
    searchParams.get("unalbumed") === "true" ? true : undefined;
  const activeLive = searchParams.get("live") === "true" ? true : undefined;
  const activeDuplicates =
    searchParams.get("duplikat") === "true" ? true : undefined;
  const activePlace = searchParams.get("tempat") || undefined;
  const activeFrom = searchParams.get("dari") || undefined;
  const activeTo = searchParams.get("sampai") || undefined;
  const activeQ = searchParams.get("q") || undefined;

  const currentFilters: FilterState = {
    sort: sortOption,
    kind: activeKind,
    favorite: activeFavorite,
    unalbumed: activeUnalbumed,
    live: activeLive,
    duplicates: activeDuplicates,
    place: activePlace,
    from: activeFrom,
    to: activeTo,
  };

  const handleFilterChange = (updated: Partial<FilterState>) => {
    const params = new URLSearchParams(searchParams.toString());
    if (updated.sort !== undefined) {
      if (updated.sort === "taken_desc") {
        params.delete("urut");
      } else {
        params.set("urut", updated.sort);
      }
    }
    if (updated.kind !== undefined) {
      if (!updated.kind) {
        params.delete("jenis");
        params.delete("filter");
      } else {
        params.set("jenis", updated.kind);
      }
    }
    if (updated.favorite !== undefined) {
      if (updated.favorite) {
        params.set("favorit", "true");
      } else {
        params.delete("favorit");
      }
    }
    if (updated.unalbumed !== undefined) {
      if (updated.unalbumed) {
        params.set("unalbumed", "true");
      } else {
        params.delete("unalbumed");
      }
    }
    if (updated.live !== undefined) {
      if (updated.live) {
        params.set("live", "true");
      } else {
        params.delete("live");
      }
    }
    if (updated.duplicates !== undefined) {
      if (updated.duplicates) {
        params.set("duplikat", "true");
      } else {
        params.delete("duplikat");
      }
    }
    if (updated.place !== undefined) {
      if (updated.place) {
        params.set("tempat", updated.place);
      } else {
        params.delete("tempat");
      }
    }
    if (updated.from !== undefined) {
      if (updated.from) {
        params.set("dari", updated.from);
      } else {
        params.delete("dari");
      }
    }
    if (updated.to !== undefined) {
      if (updated.to) {
        params.set("sampai", updated.to);
      } else {
        params.delete("sampai");
      }
    }
    const queryStr = params.toString();
    router.replace(`${pathname}${queryStr ? `?${queryStr}` : ""}`, {
      scroll: false,
    });
  };

  // Loncat Waktu Anchor YYYY-MM (RF-41)
  const [anchor, setAnchor] = useState<string | null>(null);
  const [showTimelineSheet, setShowTimelineSheet] = useState(false);

  const handleResetFilters = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("urut");
    params.delete("jenis");
    params.delete("filter");
    if (!favoriteOnly) params.delete("favorit");
    params.delete("unalbumed");
    params.delete("live");
    params.delete("duplikat");
    params.delete("tempat");
    params.delete("dari");
    params.delete("sampai");
    params.delete("q");
    setAnchor(null);
    const queryStr = params.toString();
    router.replace(`${pathname}${queryStr ? `?${queryStr}` : ""}`, {
      scroll: false,
    });
  };

  const hasActiveFilters = Boolean(
    (!kind && activeKind) ||
      (!favoriteOnly && activeFavorite) ||
      activeUnalbumed ||
      activeLive ||
      activeDuplicates ||
      activePlace ||
      activeFrom ||
      activeTo ||
      activeQ ||
      anchor ||
      sortOption !== "taken_desc"
  );

  // Ambil timeline bucket { year, month, count }
  const { data: timelineData } = useQuery({
    queryKey: [
      "timeline",
      {
        kind: activeKind,
        favoriteOnly: activeFavorite,
        live: activeLive,
        unalbumed: activeUnalbumed,
        duplicates: activeDuplicates,
        place: activePlace,
        from: activeFrom,
        to: activeTo,
      },
    ],
    queryFn: () =>
      fetchTimeline({
        kind: activeKind,
        favorite: activeFavorite,
        live: activeLive,
        unalbumed: activeUnalbumed,
        duplicates: activeDuplicates,
        place: activePlace,
        from: activeFrom,
        to: activeTo,
      }),
    staleTime: 60_000,
  });

  const timelineByYear = useMemo(() => {
    if (!timelineData?.buckets) return [];
    const map = new Map<number, TimelineBucket[]>();
    for (const b of timelineData.buckets) {
      const arr = map.get(b.year) ?? [];
      arr.push(b);
      map.set(b.year, arr);
    }
    return Array.from(map.entries()).map(([year, buckets]) => ({
      year,
      totalCount: buckets.reduce((acc, b) => acc + b.count, 0),
      buckets: buckets.sort((a, b) => b.month - a.month),
    }));
  }, [timelineData]);

  // Selection mode
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBatchDeleteModal, setShowBatchDeleteModal] = useState(false);
  const [isDeletingBatch, setIsDeletingBatch] = useState(false);
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);
  const [showAddToAlbumSheet, setShowAddToAlbumSheet] = useState(false);
  const [showQuickShareModal, setShowQuickShareModal] = useState(false);

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
    queryKey: [
      "files",
      {
        sort: activeSort,
        order: activeOrder,
        kind: activeKind,
        favoriteOnly: activeFavorite,
        unalbumed: activeUnalbumed,
        live: activeLive,
        duplicates: activeDuplicates,
        place: activePlace,
        from: activeFrom,
        to: activeTo,
        anchor,
      },
    ],
    queryFn: ({ pageParam }) =>
      fetchFiles({
        cursor: pageParam,
        anchor: anchor ?? undefined,
        limit: 24,
        sort: activeSort,
        order: activeOrder,
        kind: activeKind,
        favorite: activeFavorite,
        unalbumed: activeUnalbumed,
        live: activeLive,
        duplicates: activeDuplicates,
        place: activePlace,
        from: activeFrom,
        to: activeTo,
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

  // Kelompokkan per tanggal dalam zona waktu foto (RF-12), atau tanggal unggah untuk sort=uploaded (RF-23)
  const groups = useMemo(() => {
    const map = new Map<string, GroupedFiles>();
    for (const item of allFiles) {
      const refDate =
        activeSort === "uploaded"
          ? item.createdAt
          : item.capturedAt || item.takenAt || item.createdAt;
      const { dateKey, displayDate } = getPhotoDateGroup(
        refDate,
        activeSort === "uploaded" ? undefined : item.capturedTzOffsetMin,
      );
      const existing = map.get(dateKey);
      if (existing) {
        existing.items.push(item);
      } else {
        map.set(dateKey, {
          dateKey,
          displayDate,
          items: [item],
        });
      }
    }
    return Array.from(map.values());
  }, [allFiles, activeSort]);

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

  const isAllLoadedSelected =
    allFiles.length > 0 && selectedIds.size === allFiles.length;

  const handleToggleSelectAllLoaded = () => {
    if (isAllLoadedSelected) {
      setSelectedIds(new Set());
      setIsSelectionMode(false);
    } else {
      setSelectedIds(new Set(allFiles.map((f) => f.id)));
      setIsSelectionMode(true);
    }
  };

  const handleBatchDownload = async () => {
    if (selectedIds.size === 0 || isDownloadingZip) return;
    setIsDownloadingZip(true);
    try {
      await downloadFilesZip(Array.from(selectedIds));
    } catch {
      // Abaikan jika batal
    } finally {
      setIsDownloadingZip(false);
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
    if (hasActiveFilters) {
      return (
        <div className="flex flex-col gap-4">
          <FilterBar
            filters={currentFilters}
            onChange={handleFilterChange}
            onReset={handleResetFilters}
            hideKind={Boolean(kind)}
            hideFavorite={Boolean(favoriteOnly)}
          />
          <div className="flex min-h-[300px] flex-col items-center justify-center gap-3 px-4 py-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-sunken text-ink-muted">
              <RotateCcw size={24} />
            </div>
            <h3 className="text-h3 font-serif text-ink">Tidak ada foto yang cocok</h3>
            <p className="max-w-xs text-body text-ink-muted">
              Coba sesuaikan atau bersihkan filter untuk melihat foto lainnya.
            </p>
            <Button
              type="button"
              variant="secondary"
              onClick={handleResetFilters}
              className="mt-2 min-h-11 px-5"
            >
              Hapus filter
            </Button>
          </div>
        </div>
      );
    }

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
      <FilterBar
        filters={currentFilters}
        onChange={handleFilterChange}
        onReset={handleResetFilters}
        hideKind={Boolean(kind)}
        hideFavorite={Boolean(favoriteOnly)}
      />

      {/* Bilah Aksi Pemilihan (Selection Bar RF-43) */}
      {isSelectionMode ? (
        <div className="sticky top-0 z-30 flex min-h-12 flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-surface px-3 py-2 shadow-float">
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
            <Button
              type="button"
              variant="ghost"
              onClick={handleToggleSelectAllLoaded}
              className="min-h-11 px-2.5 text-caption text-ink-muted hover:text-ink"
            >
              {isAllLoadedSelected ? "Batal Semua" : "Pilih Semua"}
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              type="button"
              variant="secondary"
              disabled={selectedIds.size === 0}
              onClick={() => setShowQuickShareModal(true)}
              className="flex min-h-11 items-center gap-1.5 text-caption font-medium"
              aria-label="Bagikan cepat foto terpilih"
            >
              <Share2 size={16} />
              <span className="hidden sm:inline">Bagikan</span>
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={selectedIds.size === 0}
              onClick={() => setShowAddToAlbumSheet(true)}
              className="flex min-h-11 items-center gap-1.5 text-caption font-medium"
              aria-label="Tambah foto terpilih ke album"
            >
              <FolderPlus size={16} />
              <span className="hidden sm:inline">Album</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={selectedIds.size === 0 || isDownloadingZip}
              loading={isDownloadingZip}
              onClick={handleBatchDownload}
              className="flex min-h-11 items-center gap-1.5 text-caption font-medium"
              aria-label="Unduh file terpilih sebagai ZIP"
            >
              <Download size={16} />
              <span className="hidden sm:inline">Unduh ZIP</span>
            </Button>
            <Button
              type="button"
              variant="danger"
              disabled={selectedIds.size === 0}
              onClick={() => setShowBatchDeleteModal(true)}
              className="flex min-h-11 items-center gap-1.5 text-caption font-medium"
              aria-label="Hapus file terpilih"
            >
              <Trash2 size={16} />
              <span className="hidden sm:inline">Hapus</span>
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <span className="text-caption text-ink-muted">
            Tekan lama foto untuk memilih
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {/* Tombol Lompat Waktu (RF-41) */}
            <button
              type="button"
              onClick={() => setShowTimelineSheet(true)}
              className="flex min-h-11 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-caption font-medium text-ink transition-colors hover:border-ink-muted focus:border-accent"
              aria-label="Lompat ke waktu"
              title="Lompat ke tahun atau bulan tertentu"
            >
              <Calendar size={15} className="text-accent shrink-0" />
              <span>{anchor ? formatAnchorDisplay(anchor) : "Lompat waktu"}</span>
            </button>

            {/* Indikator Filter Anchor Aktif */}
            {anchor && (
              <button
                type="button"
                onClick={() => setAnchor(null)}
                className="flex min-h-11 items-center gap-1 rounded-lg bg-accent-soft px-2.5 text-caption font-medium text-accent hover:bg-accent-soft/80"
                title="Hapus filter waktu dan kembali ke foto terbaru"
                aria-label="Hapus filter waktu"
              >
                <span>Terbaru</span>
                <X size={14} />
              </button>
            )}

            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsSelectionMode(true)}
              className="flex min-h-11 items-center gap-1 text-label text-ink-muted"
            >
              <CheckSquare size={16} />
              Pilih
            </Button>
          </div>
        </div>
      )}

      {groups.map((group) => {
        const isGroupAllSelected =
          group.items.length > 0 &&
          group.items.every((f) => selectedIds.has(f.id));

        const handleToggleGroup = () => {
          setSelectedIds((prev) => {
            const next = new Set(prev);
            if (isGroupAllSelected) {
              for (const f of group.items) next.delete(f.id);
              if (next.size === 0) setIsSelectionMode(false);
            } else {
              for (const f of group.items) next.add(f.id);
              setIsSelectionMode(true);
            }
            return next;
          });
        };

        return (
          <section key={group.dateKey} className="flex flex-col gap-2">
            <div className="flex items-center justify-between px-1">
              <button
                type="button"
                onClick={handleToggleGroup}
                className="group/grp flex min-h-11 items-center gap-2 text-left transition-colors hover:text-accent"
                title={
                  isGroupAllSelected
                    ? "Batalkan pilihan tanggal ini"
                    : "Pilih seluruh foto pada tanggal ini"
                }
              >
                <h3 className="text-h3 font-serif text-ink group-hover/grp:text-accent">
                  {group.displayDate}
                </h3>
                {isSelectionMode && (
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full border transition ${
                      isGroupAllSelected
                        ? "border-accent bg-accent text-white"
                        : "border-line bg-surface text-transparent group-hover/grp:border-accent"
                    }`}
                  >
                    <Check size={12} strokeWidth={2.5} />
                  </span>
                )}
              </button>
              <span className="text-caption text-ink-muted">
                {group.items.length} item
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
        );
      })}

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
              Pindahkan {selectedIds.size} file ke Sampah?
            </h3>
            <p id="dialog-batch-hapus-pesan" className="text-body text-ink-muted">
              Pindahkan {selectedIds.size} file ke Sampah? Kamu bisa memulihkannya dalam 30 hari.
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
                {isDeletingBatch ? "Memindahkan..." : `Pindahkan (${selectedIds.size})`}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Scrubber Vertikal Layar Lebar (Desktop RF-41) */}
      {timelineByYear.length > 0 && !isSelectionMode && (
        <aside
          aria-label="Scrubber garis waktu tahun"
          className="fixed right-3 top-1/2 -translate-y-1/2 z-20 hidden md:flex flex-col gap-1 rounded-full border border-line/60 bg-surface/80 p-1.5 shadow-float backdrop-blur-md"
        >
          {timelineByYear.map(({ year, buckets }) => {
            const isYearActive = anchor?.startsWith(String(year));
            return (
              <button
                key={year}
                type="button"
                onClick={() => {
                  const latestMonth = buckets[0]?.month;
                  if (latestMonth) {
                    setAnchor(`${year}-${String(latestMonth).padStart(2, "0")}`);
                  }
                }}
                className={`flex h-9 w-11 items-center justify-center rounded-full text-[11px] font-mono font-semibold transition-colors ${
                  isYearActive
                    ? "bg-accent text-on-accent shadow-xs"
                    : "text-ink-muted hover:bg-sunken hover:text-ink"
                }`}
                title={`Lompat ke tahun ${year}`}
              >
                {String(year).slice(-2)}
              </button>
            );
          })}
        </aside>
      )}

      {/* Modal Bottom Sheet: Lompat ke Waktu (Mobile & Desktop RF-41) */}
      {showTimelineSheet && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Pilih waktu lompat"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-scrim p-0 sm:p-4 backdrop-blur-xs"
          onClick={() => setShowTimelineSheet(false)}
        >
          <div
            className="flex max-h-[85dvh] w-full max-w-lg flex-col rounded-t-2xl sm:rounded-2xl border border-line bg-surface p-5 shadow-float animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <div className="flex items-center gap-2">
                <Calendar size={20} className="text-accent" />
                <h3 className="text-h3 font-serif text-ink">Lompat ke Waktu</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowTimelineSheet(false)}
                aria-label="Tutup pemilih waktu"
                className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-ink hover:bg-sunken"
              >
                <X size={20} strokeWidth={1.5} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-5">
              {timelineByYear.length === 0 ? (
                <p className="py-6 text-center text-body text-ink-muted">
                  Belum ada linimasa foto yang tersedia.
                </p>
              ) : (
                timelineByYear.map(({ year, totalCount, buckets }) => (
                  <div key={year} className="space-y-2">
                    <div className="flex items-baseline justify-between px-1">
                      <h4 className="text-label font-bold text-ink">{year}</h4>
                      <span className="text-caption text-ink-muted font-mono">
                        {totalCount} item
                      </span>
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {buckets.map(({ month, count }) => {
                        const monthKey = `${year}-${String(month).padStart(2, "0")}`;
                        const isCurrent = anchor === monthKey;
                        return (
                          <button
                            key={monthKey}
                            type="button"
                            onClick={() => {
                              setAnchor(monthKey);
                              setShowTimelineSheet(false);
                            }}
                            className={`flex min-h-11 flex-col items-center justify-center rounded-lg border px-2 py-1.5 transition-all ${
                              isCurrent
                                ? "border-accent bg-accent-soft text-accent ring-1 ring-accent"
                                : "border-line bg-sunken/40 text-ink hover:border-ink-muted hover:bg-sunken"
                            }`}
                          >
                            <span className="text-caption font-semibold">
                              {NAMA_BULAN[month]}
                            </span>
                            <span className="text-[10px] text-ink-muted font-mono">
                              {count}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>

            {anchor && (
              <div className="pt-3 border-t border-line flex justify-end">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setAnchor(null);
                    setShowTimelineSheet(false);
                  }}
                  className="min-h-11 w-full text-label"
                >
                  Kembali ke Foto Terbaru
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sheet Tambah ke Album (RF-43) */}
      <AddToAlbumSheet
        isOpen={showAddToAlbumSheet}
        onClose={() => setShowAddToAlbumSheet(false)}
        fileIds={Array.from(selectedIds)}
        onSuccess={() => {
          cancelSelection();
        }}
      />

      {/* Modal Bagikan Cepat (RF-43) */}
      <QuickShareModal
        isOpen={showQuickShareModal}
        onClose={() => setShowQuickShareModal(false)}
        fileIds={Array.from(selectedIds)}
        onSuccess={() => {
          cancelSelection();
        }}
      />
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
  const longPressTimerRef = useRef<number | null>(null);
  const isVideo = file.kind === "video";

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
      {/* Lingkaran Mode Pilih (Target Sentuh >= 44 px RF-43) */}
      {isSelectionMode ? (
        <button
          type="button"
          aria-label={isSelected ? "Batal pilih" : "Pilih"}
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect?.();
          }}
          className="absolute -top-1 -left-1 z-20 flex min-h-11 min-w-11 items-center justify-center p-2"
        >
          <div
            className={`flex h-6 w-6 items-center justify-center rounded-full transition-colors shadow ${
              isSelected
                ? "bg-accent text-on-accent"
                : "border-2 border-white/90 bg-black/40 text-transparent"
            }`}
          >
            <Check size={14} strokeWidth={2.5} />
          </div>
        </button>
      ) : null}

      <MediaThumb
        src={file.thumbKey ? getThumbnailUrl(file.id) : null}
        alt={file.originalName}
        kind={file.kind}
        durationS={file.durationS}
        liveKind={file.liveKind}
      />

      {/* Indikator Favorit */}
      {file.isFavorite && !isSelectionMode ? (
        <div
          className={`absolute ${isVideo ? "top-1.5 left-1.5" : "top-1.5 right-1.5"} z-10 flex h-5 w-5 items-center justify-center rounded-full bg-scrim text-amber-400`}
          title="Item favorit"
          aria-label="Item favorit"
        >
          <Star size={11} className="fill-amber-400" />
        </div>
      ) : null}
    </div>
  );
}


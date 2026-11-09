"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowUpDown,
  Check,
  ChevronRight,
  Download,
  Flag,
  Folder,
  KeyRound,
  Lock,
  Maximize2,
  Share2,
  ShieldAlert,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { MediaThumb } from "@/components/ui/media-thumb";
import { getPhotoDateGroup } from "@/lib/date-group";
import { PublicViewer } from "@/components/public/public-viewer";
import {
  fetchPublicShare,
  getPublicAlbumZipUrl,
  getPublicFileContentUrl,
  getPublicThumbnailUrl,
  unlockPublicShare,
} from "@/lib/api";
import { toIndonesianMessage } from "@/lib/auth-errors";

const CONTACT_EMAIL =
  process.env.NEXT_PUBLIC_CONTACT_EMAIL || "admin@hafizfajar.com";

export type PublicSortOption =
  | "taken_desc"
  | "taken_asc"
  | "uploaded_desc"
  | "name_asc"
  | "name_desc";

export const PUBLIC_SORT_LABELS: Record<PublicSortOption, string> = {
  taken_desc: "Tanggal foto (terbaru)",
  taken_asc: "Tanggal foto (terlama)",
  uploaded_desc: "Baru diunggah",
  name_asc: "Nama file (A-Z)",
  name_desc: "Nama file (Z-A)",
};

export function PublicShareClient({ token }: { token: string }) {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const activeSubAlbumId =
    searchParams.get("a") || searchParams.get("path") || null;
  const [activeViewerIndex, setActiveViewerIndex] = useState<number | null>(
    null,
  );
  const [passwordInput, setPasswordInput] = useState("");
  const [sortOption, setSortOption] = useState<PublicSortOption>("taken_desc");
  const [showSortSheet, setShowSortSheet] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["public-share", token, activeSubAlbumId],
    queryFn: () => fetchPublicShare(token, activeSubAlbumId),
    retry: false,
    refetchOnWindowFocus: false,
  });

  const unlockMutation = useMutation({
    mutationFn: () =>
      unlockPublicShare(token, {
        password: passwordInput,
      }),
    onSuccess: () => {
      setPasswordInput("");
      queryClient.invalidateQueries({ queryKey: ["public-share", token] });
    },
  });

  // Sortir foto sebelum dikelompokkan
  const sortedFiles = useMemo(() => {
    if (!data?.files) return [];
    const files = [...data.files];
    switch (sortOption) {
      case "taken_desc":
        return files.sort((a, b) => {
          const dateA = new Date(a.capturedAt || a.takenAt || a.createdAt).getTime();
          const dateB = new Date(b.capturedAt || b.takenAt || b.createdAt).getTime();
          return dateB - dateA;
        });
      case "taken_asc":
        return files.sort((a, b) => {
          const dateA = new Date(a.capturedAt || a.takenAt || a.createdAt).getTime();
          const dateB = new Date(b.capturedAt || b.takenAt || b.createdAt).getTime();
          return dateA - dateB;
        });
      case "uploaded_desc":
        return files.sort((a, b) => {
          const dateA = new Date(a.createdAt).getTime();
          const dateB = new Date(b.createdAt).getTime();
          return dateB - dateA;
        });
      case "name_asc":
        return files.sort((a, b) =>
          a.originalName.localeCompare(b.originalName, undefined, { numeric: true }),
        );
      case "name_desc":
        return files.sort((a, b) =>
          b.originalName.localeCompare(a.originalName, undefined, { numeric: true }),
        );
      default:
        return files;
    }
  }, [data, sortOption]);

  // Kelompokkan per tanggal foto secara default (kecuali sortir alfabetis)
  const groupedFiles = useMemo(() => {
    if (data?.targetType !== "ALBUM" || !sortedFiles.length) return null;
    if (sortOption === "name_asc" || sortOption === "name_desc") {
      return null;
    }
    const groups: Map<
      string,
      { dateKey: string; displayDate: string; items: typeof sortedFiles }
    > = new Map();

    for (const file of sortedFiles) {
      const dateToUse =
        sortOption === "uploaded_desc"
          ? file.createdAt
          : file.capturedAt || file.takenAt || file.createdAt;
      const { dateKey, displayDate } = getPhotoDateGroup(
        dateToUse,
        sortOption === "uploaded_desc" ? undefined : file.capturedTzOffsetMin,
      );

      if (!groups.has(dateKey)) {
        groups.set(dateKey, {
          dateKey,
          displayDate,
          items: [],
        });
      }
      groups.get(dateKey)!.items.push(file);
    }

    return Array.from(groups.values());
  }, [data, sortedFiles, sortOption]);

  const expiryFormatted = data?.expiresAt
    ? new Intl.DateTimeFormat("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(new Date(data.expiresAt))
    : null;

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

  // Jika tautan dilindungi kata sandi dan belum di-unlock
  if (data.hasPassword && !data.isUnlocked) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-2xl border border-line bg-surface p-6 sm:p-8 text-center shadow-xs">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent/10 text-accent">
            <Lock size={28} strokeWidth={1.5} />
          </div>
          <h1 className="text-h2 font-serif text-ink">Tautan Dilindungi Sandi</h1>
          <p className="mt-2 text-caption text-ink-muted">
            Masukkan kata sandi yang diberikan pemilik untuk membuka isi tautan ini.
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (passwordInput.trim()) {
                unlockMutation.mutate();
              }
            }}
            className="mt-6 space-y-4 text-left"
          >
            <div className="relative">
              <KeyRound
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
              />
              <input
                type="password"
                required
                autoFocus
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Masukkan kata sandi..."
                className="w-full rounded-xl border border-line bg-surface py-2.5 pl-9 pr-3 text-sm text-ink placeholder:text-ink-muted focus:border-accent focus:outline-hidden"
              />
            </div>

            {unlockMutation.error && (
              <p className="text-xs text-danger font-medium text-center">
                {toIndonesianMessage(unlockMutation.error)}
              </p>
            )}

            <Button
              type="submit"
              variant="primary"
              className="w-full"
              disabled={unlockMutation.isPending || !passwordInput.trim()}
            >
              {unlockMutation.isPending ? "Membuka..." : "Buka Tautan"}
            </Button>
          </form>
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
      <header className="sticky top-0 z-30 flex min-h-16 items-center justify-between border-b border-line bg-surface/90 px-4 pt-[calc(env(safe-area-inset-top,0px)+0.5rem)] pb-2.5 sm:px-8 sm:py-0 backdrop-blur-md">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-white font-serif font-bold text-lg">
            G
          </div>
          <span className="font-serif font-semibold text-ink tracking-tight text-lg">
            Galeriku
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={async () => {
              const url = typeof window !== "undefined" ? window.location.href : "";
              if (typeof navigator !== "undefined" && navigator.share) {
                try {
                  await navigator.share({
                    title: `Galeriku — ${data.title}`,
                    text: `Buka "${data.title}" di Galeriku:`,
                    url,
                  });
                } catch {
                  // dibatalkan pengguna
                }
              } else if (typeof navigator !== "undefined" && navigator.clipboard) {
                try {
                  await navigator.clipboard.writeText(url);
                } catch {
                  // fallback
                }
              }
            }}
            className="h-8 gap-1.5 px-2.5 text-xs"
            title="Bagikan tautan ini"
          >
            <Share2 size={14} />
            <span className="hidden sm:inline">Bagikan</span>
          </Button>

          <a
            href={reportMailto}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line px-3 text-xs font-medium text-ink-muted hover:bg-sunken hover:text-danger transition"
            title="Laporkan konten bermasalah"
          >
            <Flag size={14} />
            <span>Laporkan</span>
          </a>
        </div>
      </header>

      {/* Konten Halaman */}
      <main className="flex-1 p-4 sm:p-8 max-w-6xl mx-auto w-full flex flex-col gap-6">
        {/* Breadcrumb Album Publik (RF-52) */}
        {data.targetType === "ALBUM" &&
          data.breadcrumb &&
          data.breadcrumb.length > 1 && (
            <nav aria-label="Navigasi album" className="overflow-x-auto py-1">
              <ol className="flex items-center gap-1.5 whitespace-nowrap text-caption">
                {data.breadcrumb.map((step, idx) => {
                  const isLast = idx === data.breadcrumb.length - 1;
                  const href =
                    idx === 0
                      ? `/s/${token}`
                      : `/s/${token}?a=${encodeURIComponent(step.id)}`;
                  return (
                    <li key={step.id} className="flex items-center gap-1.5">
                      {idx > 0 && (
                        <ChevronRight
                          size={14}
                          className="text-ink-muted/60 shrink-0"
                          aria-hidden="true"
                        />
                      )}
                      {isLast ? (
                        <span
                          aria-current="page"
                          className="flex min-h-11 items-center px-1.5 font-semibold text-ink"
                        >
                          <span className="max-w-[140px] truncate sm:max-w-[240px]">
                            {step.title}
                          </span>
                        </span>
                      ) : (
                        <Link
                          href={href}
                          className="flex min-h-11 items-center rounded-md px-1.5 font-medium text-ink-muted transition hover:text-ink focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent"
                        >
                          <span className="max-w-[120px] truncate sm:max-w-[180px]">
                            {step.title}
                          </span>
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ol>
            </nav>
          )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-h1 font-serif text-ink">{data.title}</h1>
            <p className="text-caption text-ink-muted mt-1">
              {data.ownerName
                ? `Dibagikan oleh ${data.ownerName}`
                : "Dibagikan lewat tautan publik"}
              {expiryFormatted ? ` · Berlaku sampai ${expiryFormatted}` : ""}
              {" · "}
              {data.files.length} foto/video
            </p>
          </div>

          {data.targetType === "ALBUM" && data.allowDownload && data.files.length > 0 && (
            <a href={getPublicAlbumZipUrl(token)} download={`${data.title}.zip`}>
              <Button variant="primary" className="gap-1.5 self-start sm:self-auto">
                <Download size={16} />
                <span>Unduh Album (ZIP)</span>
              </Button>
            </a>
          )}
        </div>

        {/* Sub-album publik (RF-52) */}
        {data.targetType === "ALBUM" &&
          data.subAlbums &&
          data.subAlbums.length > 0 && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h2 className="text-body font-semibold text-ink">Sub-album</h2>
                <span className="text-caption text-ink-muted">
                  {data.subAlbums.length} sub-album
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {data.subAlbums.map((sub) => (
                  <Link
                    key={sub.id}
                    href={`/s/${token}?a=${encodeURIComponent(sub.id)}`}
                    className="group flex flex-col rounded-xl border border-line bg-surface p-2 transition hover:border-accent/40 hover:shadow-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent min-h-11"
                  >
                    <div className="relative aspect-4/3 w-full overflow-hidden rounded-lg bg-sunken mb-2">
                      {sub.coverFileId ? (
                        <MediaThumb
                          src={getPublicThumbnailUrl(token, sub.coverFileId)}
                          alt={sub.title}
                          kind="image"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-ink-muted">
                          <Folder size={32} strokeWidth={1.5} />
                        </div>
                      )}
                    </div>
                    <h3 className="truncate text-caption font-semibold text-ink group-hover:text-accent">
                      {sub.title}
                    </h3>
                    <p className="text-[11px] text-ink-muted mt-0.5">
                      {sub.fileCount} foto/video
                      {sub.childCount ? ` · ${sub.childCount} sub-album` : ""}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          )}

        {/* Bilah Kontrol Sortir Album Publik */}
        {data.targetType === "ALBUM" && sortedFiles.length > 0 && (
          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={() => setShowSortSheet(true)}
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-surface px-4 py-1.5 text-caption font-medium text-ink hover:border-ink-muted active:bg-sunken transition"
            >
              <ArrowUpDown size={15} className="text-accent shrink-0" />
              <span>{PUBLIC_SORT_LABELS[sortOption]}</span>
            </button>
            <span className="text-caption text-ink-muted">
              {sortedFiles.length} foto/video
            </span>
          </div>
        )}

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
              {!data.allowDownload && data.files[0].kind === "video" && (
                <p className="text-[12px] text-ink-muted">
                  Pemilik membatasi unduhan, tetapi video tetap bisa diputar.
                </p>
              )}
            </div>
          </div>
        ) : groupedFiles ? (
          /* Jika Album: Grid Foto/Video dikelompokkan per tanggal */
          <div className="flex flex-col gap-6">
            {groupedFiles.map((group) => (
              <div key={group.dateKey} className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <h2 className="text-body font-semibold text-ink">
                    {group.displayDate}
                  </h2>
                  <span className="text-caption text-ink-muted">
                    {group.items.length} item
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1 sm:grid-cols-4 md:grid-cols-6 sm:gap-2">
                  {group.items.map((file) => {
                    const sortedIdx = sortedFiles.findIndex((f) => f.id === file.id);
                    return (
                      <div
                        key={file.id}
                        className="group relative aspect-square overflow-hidden rounded bg-sunken"
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setActiveViewerIndex(sortedIdx >= 0 ? sortedIdx : 0)
                          }
                          className="h-full w-full focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent"
                        >
                          <MediaThumb
                            src={
                              file.thumbKey
                                ? getPublicThumbnailUrl(token, file.id)
                                : null
                            }
                            alt={file.originalName}
                            kind={file.kind}
                            durationS={file.durationS}
                            liveKind={file.liveKind}
                            crossOrigin="anonymous"
                          />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Flat Grid jika urutan alfabetis */
          <div className="grid grid-cols-3 gap-1 sm:grid-cols-4 md:grid-cols-6 sm:gap-2">
            {sortedFiles.map((file, idx) => (
              <div
                key={file.id}
                className="group relative aspect-square overflow-hidden rounded bg-sunken"
              >
                <button
                  type="button"
                  onClick={() => setActiveViewerIndex(idx)}
                  className="h-full w-full focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <MediaThumb
                    src={
                      file.thumbKey
                        ? getPublicThumbnailUrl(token, file.id)
                        : null
                    }
                    alt={file.originalName}
                    kind={file.kind}
                    durationS={file.durationS}
                    liveKind={file.liveKind}
                    crossOrigin="anonymous"
                  />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Kosong (RF-52) */}
        {data.targetType === "ALBUM" &&
          data.files.length === 0 &&
          (!data.subAlbums || data.subAlbums.length === 0) && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-sunken text-ink-muted">
                <Folder size={24} strokeWidth={1.5} />
              </div>
              <p className="font-serif text-body font-medium text-ink">
                Belum ada foto atau video
              </p>
              <p className="text-caption text-ink-muted mt-1">
                Album ini masih kosong.
              </p>
            </div>
          )}
      </main>

      {/* Sheet Pemilihan Urutan Foto Album Publik */}
      <Sheet
        open={showSortSheet}
        onClose={() => setShowSortSheet(false)}
        title="Urutkan Foto Album"
      >
        <div className="flex flex-col gap-1 p-2">
          {(
            [
              "taken_desc",
              "taken_asc",
              "uploaded_desc",
              "name_asc",
              "name_desc",
            ] as PublicSortOption[]
          ).map((opt) => {
            const isSelected = sortOption === opt;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  setSortOption(opt);
                  setShowSortSheet(false);
                }}
                className={`flex min-h-12 w-full items-center justify-between rounded-xl px-4 py-3 text-left text-body transition ${
                  isSelected
                    ? "bg-accent/10 font-semibold text-accent"
                    : "text-ink hover:bg-sunken active:bg-sunken"
                }`}
              >
                <span>{PUBLIC_SORT_LABELS[opt]}</span>
                {isSelected && <Check size={18} className="text-accent shrink-0" />}
              </button>
            );
          })}
        </div>
      </Sheet>

      {/* Viewer Layar Penuh */}
      {activeViewerIndex !== null && (
        <PublicViewer
          token={token}
          files={sortedFiles}
          initialIndex={activeViewerIndex}
          allowDownload={data.allowDownload}
          onClose={() => setActiveViewerIndex(null)}
        />
      )}
    </div>
  );
}


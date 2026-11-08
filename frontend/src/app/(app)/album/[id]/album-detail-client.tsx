"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  CheckSquare,
  Download,
  Edit2,
  FolderMinus,
  FolderPlus,
  FolderTree,
  Images,
  Plus,
  Share2,
  Trash2,
  X,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MediaThumb } from "@/components/ui/media-thumb";
import { FullViewer } from "@/components/gallery/full-viewer";
import { ShareModal } from "@/components/shares/share-modal";
import { AlbumAddPhotosSheet } from "@/components/gallery/album-add-photos-sheet";
import { AlbumBreadcrumb } from "@/components/albums/album-breadcrumb";
import { DeleteAlbumModal } from "@/components/albums/delete-album-modal";
import { MoveAlbumModal } from "@/components/albums/move-album-modal";
import {
  createAlbum,
  deleteAlbum,
  fetchAlbumDetail,
  getAlbumZipUrl,
  getThumbnailUrl,
  moveAlbum,
  removeFileFromAlbum,
  updateAlbum,
} from "@/lib/api";
import { toIndonesianMessage } from "@/lib/auth-errors";

export function AlbumDetailClient({ albumId }: { albumId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  // State dialog & viewer
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [addFilesModalOpen, setAddFilesModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [createSubAlbumModalOpen, setCreateSubAlbumModalOpen] = useState(false);
  const [subAlbumTitle, setSubAlbumTitle] = useState("");
  const [activeViewerIndex, setActiveViewerIndex] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // State Seleksi Massal di Album (RF-43, B14)
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isRemovingBatch, setIsRemovingBatch] = useState(false);

  // Ambil detail album
  const { data: album, isLoading } = useQuery({
    queryKey: ["album", albumId],
    queryFn: () => fetchAlbumDetail(albumId),
  });

  // Mutasi Ubah Nama
  const updateMutation = useMutation({
    mutationFn: (newTitle: string) =>
      updateAlbum(albumId, { title: newTitle }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["album", albumId] });
      queryClient.invalidateQueries({ queryKey: ["albums"] });
      setEditModalOpen(false);
      setErrorMsg(null);
    },
    onError: (err) => setErrorMsg(toIndonesianMessage(err)),
  });

  // Mutasi Buat Sub-album (RF-51)
  const createSubAlbumMutation = useMutation({
    mutationFn: (newTitle: string) =>
      createAlbum({ title: newTitle, parentId: albumId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["album", albumId] });
      queryClient.invalidateQueries({ queryKey: ["albums"] });
      setCreateSubAlbumModalOpen(false);
      setSubAlbumTitle("");
      setErrorMsg(null);
    },
    onError: (err) => setErrorMsg(toIndonesianMessage(err)),
  });

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (!album) return;
    if (selectedIds.size === album.files.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(album.files.map((f) => f.id)));
    }
  };

  const cancelSelection = () => {
    setIsSelectionMode(false);
    setSelectedIds(new Set());
  };

  // Keluarkan massal (RF-43, B14)
  const handleBatchRemove = async () => {
    if (selectedIds.size === 0 || isRemovingBatch) return;
    setIsRemovingBatch(true);
    try {
      await Promise.all(
        Array.from(selectedIds).map((fileId) =>
          removeFileFromAlbum(albumId, fileId)
        )
      );
      queryClient.invalidateQueries({ queryKey: ["album", albumId] });
      queryClient.invalidateQueries({ queryKey: ["albums"] });
      cancelSelection();
    } catch (err) {
      setErrorMsg(toIndonesianMessage(err));
    } finally {
      setIsRemovingBatch(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 animate-pulse pb-24">
        <div className="h-6 w-32 rounded bg-sunken" />
        <div className="h-10 w-64 rounded bg-sunken" />
        <div className="grid grid-cols-3 gap-1 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="aspect-square rounded bg-sunken" />
          ))}
        </div>
      </div>
    );
  }

  if (!album) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <h2 className="text-h2 font-serif text-ink">Album Tidak Ditemukan</h2>
        <p className="mt-2 text-body text-ink-muted">
          Album ini mungkin telah dihapus atau tautan salah.
        </p>
        <Link href="/album" className="mt-4">
          <Button variant="secondary">Kembali ke Daftar Album</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 pb-24">
      {/* Bilah Aksi Pemilihan Massal (RF-43, B14) */}
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
            <Button
              type="button"
              variant="ghost"
              onClick={handleSelectAll}
              className="min-h-11 px-2.5 text-caption text-ink-muted hover:text-ink"
            >
              {selectedIds.size === album.files.length ? "Batal Semua" : "Pilih Semua"}
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="danger"
              disabled={selectedIds.size === 0 || isRemovingBatch}
              loading={isRemovingBatch}
              onClick={handleBatchRemove}
              className="flex min-h-11 items-center gap-1.5 text-caption font-medium"
              aria-label="Keluarkan file terpilih dari album"
            >
              <FolderMinus size={16} />
              <span>Keluarkan ({selectedIds.size})</span>
            </Button>
          </div>
        </div>
      ) : (
        /* Navigasi & Aksi Atas Normal */
        <div className="flex flex-col gap-3">
          <AlbumBreadcrumb
            items={album.breadcrumb ?? []}
            currentTitle={album.title}
          />

          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-h1 font-serif text-ink">{album.title}</h1>
                <button
                  type="button"
                  onClick={() => {
                    setEditTitle(album.title);
                    setErrorMsg(null);
                    setEditModalOpen(true);
                  }}
                  className="rounded-full p-1.5 text-ink-muted hover:bg-sunken hover:text-ink transition"
                  title="Ubah nama album"
                  aria-label="Ubah nama album"
                >
                  <Edit2 size={16} />
                </button>
              </div>
              <p className="text-caption text-ink-muted">
                {album.files.length} item
                {album.subAlbums && album.subAlbums.length > 0
                  ? ` · ${album.subAlbums.length} sub-album`
                  : ""}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="ghost"
                onClick={() => setIsSelectionMode(true)}
                className="flex min-h-11 items-center gap-1.5 text-caption font-medium text-ink"
              >
                <CheckSquare size={16} />
                <span>Pilih</span>
              </Button>
              {album.files.length > 0 && (
                <a
                  href={getAlbumZipUrl(albumId)}
                  download
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-caption font-medium text-ink transition hover:border-ink-muted active:bg-sunken"
                  title="Unduh seluruh album sebagai ZIP"
                  aria-label="Unduh seluruh album sebagai ZIP"
                >
                  <Download size={16} />
                  <span className="hidden sm:inline">Unduh ZIP</span>
                </a>
              )}
              <Button
                variant="secondary"
                onClick={() => setShareModalOpen(true)}
                className="min-h-11 gap-1.5 text-caption"
              >
                <Share2 size={16} />
                <span>Bagikan</span>
              </Button>
              <Button
                variant="secondary"
                onClick={() => setMoveModalOpen(true)}
                className="min-h-11 gap-1.5 text-caption"
                title="Pindahkan album ke folder lain"
              >
                <FolderTree size={16} />
                <span className="hidden sm:inline">Pindahkan</span>
              </Button>
              <Button
                variant="secondary"
                onClick={() => setAddFilesModalOpen(true)}
                className="min-h-11 gap-1.5 text-caption"
              >
                <Plus size={18} strokeWidth={2} />
                <span>Tambah Foto</span>
              </Button>
              <Button
                variant="danger"
                onClick={() => setDeleteConfirmOpen(true)}
                className="min-h-11 gap-1.5 text-caption"
              >
                <Trash2 size={16} />
                <span className="hidden sm:inline">Hapus Album</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Bagian Sub-album (RF-51) */}
      <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-h3 font-serif text-ink">Sub-album</h2>
            <span className="rounded-full bg-sunken px-2 py-0.5 text-caption font-medium text-ink-muted">
              {album.subAlbums?.length ?? 0}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {(album.breadcrumb?.length ?? 1) >= 4 ? (
              <span className="text-caption text-ink-muted italic">
                Maksimal 4 tingkat kedalaman tercapai
              </span>
            ) : (
              <Button
                variant="secondary"
                onClick={() => {
                  setErrorMsg(null);
                  setSubAlbumTitle("");
                  setCreateSubAlbumModalOpen(true);
                }}
                className="min-h-11 gap-1.5 text-caption"
              >
                <FolderPlus size={16} />
                <span>Album baru di sini</span>
              </Button>
            )}
          </div>
        </div>

        {album.subAlbums && album.subAlbums.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 pt-1">
            {album.subAlbums.map((sub) => (
              <Link
                key={sub.id}
                href={`/album/${encodeURIComponent(sub.id)}`}
                className="group flex flex-col gap-2 rounded-xl border border-line bg-surface p-2.5 transition hover:border-accent hover:shadow-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent"
              >
                <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-sunken">
                  <MediaThumb
                    src={sub.coverFileId ? getThumbnailUrl(sub.coverFileId) : null}
                    alt={sub.title}
                    showDuration={false}
                    showVideoBadge={false}
                  />
                </div>
                <div className="min-w-0">
                  <h4 className="truncate text-body font-medium text-ink group-hover:text-accent">
                    {sub.title}
                  </h4>
                  <p className="text-caption text-ink-muted">
                    {sub.fileCount} item
                    {sub.childCount > 0 ? ` · ${sub.childCount} sub-album` : ""}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="py-1 text-caption text-ink-muted">
            Belum ada sub-album di dalam album ini.
          </p>
        )}
      </div>

      {/* Grid Foto Album */}
      {album.files.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-surface py-16 px-4 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-sunken text-ink-muted">
            <Images size={28} strokeWidth={1.5} />
          </div>
          <h2 className="text-h3 font-serif text-ink">Album Masih Kosong</h2>
          <p className="mt-1 max-w-sm text-caption text-ink-muted">
            Belum ada foto atau video di album ini. Tambahkan beberapa momen
            dari galerimu.
          </p>
          <Button
            variant="secondary"
            className="mt-5 min-h-11"
            onClick={() => setAddFilesModalOpen(true)}
          >
            Pilih Foto untuk Ditambahkan
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-1 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8 sm:gap-2">
          {album.files.map((file, idx) => {
            const isSelected = selectedIds.has(file.id);
            return (
              <div
                key={file.id}
                className={`relative aspect-square overflow-hidden rounded bg-sunken transition ${
                  isSelected ? "ring-2 ring-accent" : ""
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    if (isSelectionMode) {
                      toggleSelect(file.id);
                    } else {
                      setActiveViewerIndex(idx);
                    }
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    if (!isSelectionMode) {
                      setIsSelectionMode(true);
                      setSelectedIds(new Set([file.id]));
                    }
                  }}
                  className="h-full w-full focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <MediaThumb
                    src={file.thumbKey ? getThumbnailUrl(file.id) : null}
                    alt={file.originalName}
                    kind={file.kind}
                    durationS={file.durationS}
                    liveKind={file.liveKind}
                  />
                </button>

                {/* Mode Pilih: Indikator Centang Selalu Terlihat (B14, BUKAN hover-only!) */}
                {isSelectionMode && (
                  <button
                    type="button"
                    onClick={() => toggleSelect(file.id)}
                    className="absolute top-1.5 right-1.5 flex min-h-11 min-w-11 items-center justify-center rounded-full"
                    aria-label={isSelected ? `Batal pilih ${file.originalName}` : `Pilih ${file.originalName}`}
                  >
                    <div
                      className={`flex h-6 w-6 items-center justify-center rounded-full border-2 transition shadow ${
                        isSelected
                          ? "border-accent bg-accent text-white"
                          : "border-white/80 bg-black/40 text-transparent"
                      }`}
                    >
                      <Check size={14} strokeWidth={2.5} />
                    </div>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Viewer Layar Penuh */}
      {activeViewerIndex !== null && (
        <FullViewer
          files={album.files}
          initialIndex={activeViewerIndex}
          onClose={() => setActiveViewerIndex(null)}
        />
      )}

      {/* Modal Ubah Nama Album */}
      {editModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-xl">
            <h3 className="text-h3 font-serif text-ink">Ubah Nama Album</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (editTitle.trim()) {
                  updateMutation.mutate(editTitle.trim());
                }
              }}
              className="mt-4 space-y-4"
            >
              <Input
                id="edit-album-title"
                label="Nama Album"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                autoFocus
                required
              />
              {errorMsg && (
                <p className="text-sm font-medium text-danger">{errorMsg}</p>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setEditModalOpen(false)}
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  loading={updateMutation.isPending}
                >
                  Simpan Perubahan
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Hapus Album (RF-51: Pilihan only vs subtree) */}
      <DeleteAlbumModal
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        albumTitle={album.title}
        hasChildren={(album.subAlbums?.length ?? 0) > 0}
        childCount={album.subAlbums?.length ?? 0}
        onConfirm={async (mode) => {
          await deleteAlbum(albumId, mode);
          queryClient.invalidateQueries({ queryKey: ["albums"] });
          router.push(
            album.parentId
              ? `/album/${encodeURIComponent(album.parentId)}`
              : "/album",
          );
        }}
      />

      {/* Modal Pindahkan Album (RF-51) */}
      <MoveAlbumModal
        isOpen={moveModalOpen}
        onClose={() => setMoveModalOpen(false)}
        albumId={albumId}
        albumTitle={album.title}
        currentParentId={album.parentId ?? null}
        onConfirm={async (targetParentId) => {
          await moveAlbum(albumId, targetParentId);
          queryClient.invalidateQueries({ queryKey: ["album", albumId] });
          queryClient.invalidateQueries({ queryKey: ["albums"] });
        }}
      />

      {/* Modal Buat Sub-album (RF-51) */}
      {createSubAlbumModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h3 className="text-h3 font-serif text-ink">Album Baru di Sini</h3>
              <button
                type="button"
                onClick={() => setCreateSubAlbumModalOpen(false)}
                className="rounded-full p-1 text-ink-muted hover:bg-sunken hover:text-ink"
                aria-label="Tutup"
              >
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const trimmed = subAlbumTitle.trim();
                if (!trimmed) {
                  setErrorMsg("Nama album tidak boleh kosong.");
                  return;
                }
                createSubAlbumMutation.mutate(trimmed);
              }}
              className="mt-4 space-y-4"
            >
              <Input
                id="sub-album-title"
                label="Nama Sub-album"
                placeholder="Misal: Pantai Kuta"
                value={subAlbumTitle}
                onChange={(e) => setSubAlbumTitle(e.target.value)}
                autoFocus
                required
              />

              {errorMsg && (
                <p className="text-sm font-medium text-danger">{errorMsg}</p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setCreateSubAlbumModalOpen(false)}
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  loading={createSubAlbumMutation.isPending}
                >
                  Buat Sub-album
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sheet Tambah Foto dari Galeri (RF-43, B13) */}
      <AlbumAddPhotosSheet
        isOpen={addFilesModalOpen}
        onClose={() => setAddFilesModalOpen(false)}
        albumId={albumId}
        existingFileIds={album.files.map((f) => f.id)}
      />

      {/* Modal Berbagi */}
      <ShareModal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        targetType="ALBUM"
        targetId={albumId}
        targetTitle={album.title}
      />
    </div>
  );
}

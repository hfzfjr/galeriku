"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  Edit2,
  FolderMinus,
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
import {
  addFilesToAlbum,
  deleteAlbum,
  fetchAlbumDetail,
  fetchFiles,
  getThumbnailUrl,
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
  const [activeViewerIndex, setActiveViewerIndex] = useState<number | null>(
    null,
  );
  const [editTitle, setEditTitle] = useState("");
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Ambil detail album
  const { data: album, isLoading } = useQuery({
    queryKey: ["album", albumId],
    queryFn: () => fetchAlbumDetail(albumId),
  });

  // Ambil file galeri untuk opsi tambah
  const { data: galleryFiles } = useQuery({
    queryKey: ["files", "all-for-album"],
    queryFn: () => fetchFiles({ limit: 100 }),
    enabled: addFilesModalOpen,
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

  // Mutasi Hapus Album
  const deleteMutation = useMutation({
    mutationFn: () => deleteAlbum(albumId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["albums"] });
      router.push("/album");
    },
    onError: (err) => setErrorMsg(toIndonesianMessage(err)),
  });

  // Mutasi Tambah File
  const addFilesMutation = useMutation({
    mutationFn: (ids: string[]) =>
      addFilesToAlbum(albumId, { fileIds: ids }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["album", albumId] });
      queryClient.invalidateQueries({ queryKey: ["albums"] });
      setAddFilesModalOpen(false);
      setSelectedFileIds([]);
      setErrorMsg(null);
    },
    onError: (err) => setErrorMsg(toIndonesianMessage(err)),
  });

  // Mutasi Keluarkan File
  const removeFileMutation = useMutation({
    mutationFn: (fileId: string) => removeFileFromAlbum(albumId, fileId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["album", albumId] });
      queryClient.invalidateQueries({ queryKey: ["albums"] });
    },
  });

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

  const existingFileIdSet = new Set(album.files.map((f) => f.id));
  const availableToAdd =
    galleryFiles?.items.filter((f) => !existingFileIdSet.has(f.id)) ?? [];

  const toggleSelectForAdd = (id: string) => {
    setSelectedFileIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  return (
    <div className="flex flex-col gap-6 pb-24">
      {/* Navigasi & Aksi Atas */}
      <div className="flex flex-col gap-3">
        <Link
          href="/album"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink transition"
        >
          <ArrowLeft size={16} />
          <span>Semua Album</span>
        </Link>

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
              {album.files.length} {album.files.length === 1 ? "item" : "item"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => setShareModalOpen(true)}
              className="gap-1.5"
            >
              <Share2 size={16} />
              <span>Bagikan</span>
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setSelectedFileIds([]);
                setErrorMsg(null);
                setAddFilesModalOpen(true);
              }}
              className="gap-1.5"
            >
              <Plus size={18} strokeWidth={2} />
              <span>Tambah Foto</span>
            </Button>
            <Button
              variant="danger"
              onClick={() => setDeleteConfirmOpen(true)}
              className="gap-1.5"
            >
              <Trash2 size={16} />
              <span className="hidden sm:inline">Hapus Album</span>
            </Button>
          </div>
        </div>
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
            className="mt-5"
            onClick={() => {
              setSelectedFileIds([]);
              setErrorMsg(null);
              setAddFilesModalOpen(true);
            }}
          >
            Pilih Foto untuk Ditambahkan
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-1 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8 sm:gap-2">
          {album.files.map((file, idx) => (
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
                  src={file.thumbKey ? getThumbnailUrl(file.id) : null}
                  alt={file.originalName}
                  kind={file.kind}
                  durationS={file.durationS}
                />
              </button>

              {/* Tombol Keluarkan File dari Album */}
              <button
                type="button"
                onClick={() => removeFileMutation.mutate(file.id)}
                className="absolute top-1.5 right-1.5 rounded-full bg-black/60 p-1 text-white opacity-0 transition hover:bg-black/90 group-hover:opacity-100 focus:opacity-100"
                title="Keluarkan dari album"
                aria-label={`Keluarkan ${file.originalName} dari album`}
              >
                <FolderMinus size={14} />
              </button>
            </div>
          ))}
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

      {/* Modal Konfirmasi Hapus Album */}
      {deleteConfirmOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-xl">
            <h3 className="text-h3 font-serif text-ink">Hapus Album?</h3>
            <p className="mt-2 text-body text-ink-muted">
              Album <strong>{album.title}</strong> akan dihapus. Foto dan video
              di dalamnya tidak akan dihapus dari galerimu.
            </p>
            {errorMsg && (
              <p className="mt-2 text-sm font-medium text-danger">{errorMsg}</p>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setDeleteConfirmOpen(false)}
              >
                Batal
              </Button>
              <Button
                type="button"
                variant="danger"
                loading={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate()}
              >
                Hapus Album
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Tambah Foto dari Galeri */}
      {addFilesModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
        >
          <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl border border-line bg-surface p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <h3 className="text-h3 font-serif text-ink">Tambah ke Album</h3>
                <p className="text-caption text-ink-muted">
                  Pilih foto dan video dari galerimu.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAddFilesModalOpen(false)}
                className="rounded-full p-1 text-ink-muted hover:bg-sunken hover:text-ink"
                aria-label="Tutup"
              >
                <X size={20} />
              </button>
            </div>

            <div className="my-4 flex-1 overflow-y-auto">
              {availableToAdd.length === 0 ? (
                <div className="py-12 text-center text-ink-muted">
                  Semua file di galerimu sudah ada di album ini.
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
                  {availableToAdd.map((file) => {
                    const isSelected = selectedFileIds.includes(file.id);
                    return (
                      <button
                        key={file.id}
                        type="button"
                        onClick={() => toggleSelectForAdd(file.id)}
                        className={`relative aspect-square overflow-hidden rounded border-2 transition ${
                          isSelected
                            ? "border-accent ring-2 ring-accent"
                            : "border-transparent hover:opacity-90"
                        }`}
                      >
                        <MediaThumb
                          src={file.thumbKey ? getThumbnailUrl(file.id) : null}
                          alt={file.originalName}
                          kind={file.kind}
                          durationS={file.durationS}
                        />
                        {isSelected && (
                          <div className="absolute top-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-accent text-white shadow">
                            <Check size={14} strokeWidth={2.5} />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-line pt-3">
              <span className="text-sm font-medium text-ink">
                {selectedFileIds.length} dipilih
              </span>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setAddFilesModalOpen(false)}
                >
                  Batal
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  disabled={selectedFileIds.length === 0}
                  loading={addFilesMutation.isPending}
                  onClick={() => addFilesMutation.mutate(selectedFileIds)}
                >
                  Tambahkan ke Album
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
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


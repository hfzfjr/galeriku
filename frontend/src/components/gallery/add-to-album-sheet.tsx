"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderPlus, Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MediaThumb } from "@/components/ui/media-thumb";
import {
  addFilesToAlbum,
  createAlbum,
  fetchAlbums,
  getThumbnailUrl,
} from "@/lib/api";
import { toIndonesianMessage } from "@/lib/auth-errors";

interface AddToAlbumSheetProps {
  isOpen: boolean;
  onClose: () => void;
  fileIds: string[];
  onSuccess: (albumTitle: string) => void;
}

export function AddToAlbumSheet({
  isOpen,
  onClose,
  fileIds,
  onSuccess,
}: AddToAlbumSheetProps) {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newAlbumTitle, setNewAlbumTitle] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["albums"],
    queryFn: fetchAlbums,
    enabled: isOpen,
  });

  const albums = useMemo(() => data?.items ?? [], [data?.items]);

  const filteredAlbums = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return albums;
    return albums.filter((a) => a.title.toLowerCase().includes(q));
  }, [albums, searchQuery]);

  // Mutasi: Tambah ke album yang ada
  const addToExistingMutation = useMutation({
    mutationFn: async (albumId: string) => {
      await addFilesToAlbum(albumId, { fileIds });
      const album = albums.find((a) => a.id === albumId);
      return album?.title || "Album";
    },
    onSuccess: (title) => {
      queryClient.invalidateQueries({ queryKey: ["albums"] });
      queryClient.invalidateQueries({ queryKey: ["album"] });
      onSuccess(title);
      handleClose();
    },
    onError: (err) => {
      setErrorMessage(toIndonesianMessage(err));
    },
  });

  // Mutasi: Buat album baru dan langsung tambahkan file
  const createAndAddMutation = useMutation({
    mutationFn: async (title: string) => {
      const created = await createAlbum({ title });
      await addFilesToAlbum(created.id, { fileIds });
      return created.title;
    },
    onSuccess: (title) => {
      queryClient.invalidateQueries({ queryKey: ["albums"] });
      queryClient.invalidateQueries({ queryKey: ["album"] });
      onSuccess(title);
      handleClose();
    },
    onError: (err) => {
      setErrorMessage(toIndonesianMessage(err));
    },
  });

  const handleClose = () => {
    setSearchQuery("");
    setIsCreatingNew(false);
    setNewAlbumTitle("");
    setErrorMessage(null);
    onClose();
  };

  if (!isOpen) return null;

  const isPending =
    addToExistingMutation.isPending || createAndAddMutation.isPending;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Tambah ke album"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200"
    >
      <div className="flex max-h-[85vh] w-full max-w-md flex-col rounded-t-2xl sm:rounded-2xl border border-line bg-surface p-5 shadow-2xl">
        {/* Header Sheet */}
        <div className="flex items-center justify-between pb-3 border-b border-line">
          <div>
            <h3 className="text-h3 font-serif text-ink">Tambah ke Album</h3>
            <p className="text-caption text-ink-muted">
              {fileIds.length} foto/video akan ditambahkan
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isPending}
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

        {/* Form Album Baru (Inline) */}
        {isCreatingNew ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const trimmed = newAlbumTitle.trim();
              if (trimmed && !isPending) {
                createAndAddMutation.mutate(trimmed);
              }
            }}
            className="mt-4 flex flex-col gap-3 rounded-xl border border-line bg-sunken/40 p-3.5"
          >
            <span className="text-caption font-medium text-ink">
              Buat Album Baru
            </span>
            <Input
              id="new-album-sheet-title"
              label="Nama Album Baru"
              placeholder="Contoh: Liburan Akhir Pekan"
              value={newAlbumTitle}
              onChange={(e) => setNewAlbumTitle(e.target.value)}
              autoFocus
              required
              disabled={isPending}
            />
            <div className="flex items-center justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setIsCreatingNew(false);
                  setNewAlbumTitle("");
                }}
                disabled={isPending}
                className="min-h-11 px-4 text-caption"
              >
                Batal
              </Button>
              <Button
                type="submit"
                variant="primary"
                loading={createAndAddMutation.isPending}
                disabled={!newAlbumTitle.trim() || isPending}
                className="min-h-11 px-4 text-caption"
              >
                Buat & Tambahkan
              </Button>
            </div>
          </form>
        ) : (
          <div className="mt-3 flex items-center gap-2">
            {/* Tombol Buat Album Baru */}
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsCreatingNew(true)}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl text-caption font-medium"
            >
              <Plus size={16} strokeWidth={2} />
              Buat Album Baru
            </Button>
          </div>
        )}

        {/* Input Pencarian Album */}
        {!isCreatingNew && (
          <div className="relative mt-3">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
            />
            <input
              type="search"
              placeholder="Cari album..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full min-h-11 rounded-xl border border-line bg-sunken/30 pl-9 pr-3 text-caption text-ink placeholder:text-ink-muted outline-none focus:border-accent"
            />
          </div>
        )}

        {/* Daftar Album */}
        <div className="my-3 flex-1 overflow-y-auto space-y-1 pr-1">
          {isLoading ? (
            <div className="space-y-2 py-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 p-2 animate-pulse"
                >
                  <div className="h-12 w-12 rounded-lg bg-sunken" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-4 w-32 rounded bg-sunken" />
                    <div className="h-3 w-16 rounded bg-sunken" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredAlbums.length === 0 ? (
            <div className="py-8 text-center text-caption text-ink-muted">
              {searchQuery ? "Tidak ada album yang cocok" : "Belum ada album"}
            </div>
          ) : (
            filteredAlbums.map((album) => (
              <button
                key={album.id}
                type="button"
                onClick={() => {
                  if (!isPending) {
                    addToExistingMutation.mutate(album.id);
                  }
                }}
                disabled={isPending}
                className="flex w-full min-h-12 items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-sunken/60 active:bg-sunken focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent"
              >
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-sunken border border-line flex items-center justify-center">
                  {album.coverFileId ? (
                    <MediaThumb
                      src={getThumbnailUrl(album.coverFileId)}
                      alt={album.title}
                      kind="image"
                    />
                  ) : (
                    <FolderPlus size={20} className="text-ink-muted" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-label font-medium text-ink">
                    {album.title}
                  </p>
                  <p className="text-caption text-ink-muted">
                    {album.fileCount} item
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

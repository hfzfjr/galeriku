"use client";

import { useState } from "react";
import Link from "next/link";
import { FolderPlus, Plus, X } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AlbumItem } from "@galeriku/contracts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MediaThumb } from "@/components/ui/media-thumb";
import { createAlbum, fetchAlbums, getThumbnailUrl } from "@/lib/api";
import { toIndonesianMessage } from "@/lib/auth-errors";

export function AlbumsClient() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["albums"],
    queryFn: fetchAlbums,
  });

  const createMutation = useMutation({
    mutationFn: (newTitle: string) => createAlbum({ title: newTitle }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["albums"] });
      setModalOpen(false);
      setTitle("");
      setErrorMsg(null);
    },
    onError: (err) => {
      setErrorMsg(toIndonesianMessage(err));
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      setErrorMsg("Nama album tidak boleh kosong.");
      return;
    }
    setErrorMsg(null);
    createMutation.mutate(trimmed);
  };

  const albums = data?.items ?? [];

  return (
    <div className="flex flex-col gap-6 pb-24">
      {/* Header Halaman */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h1 font-serif text-ink">Album</h1>
          <p className="text-body text-ink-muted">
            Kelompokkan momen dan bagikan dengan mudah.
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => {
            setErrorMsg(null);
            setTitle("");
            setModalOpen(true);
          }}
          className="gap-1.5"
        >
          <Plus size={18} strokeWidth={2} />
          <span>Buat Album</span>
        </Button>
      </div>

      {/* Konten Grid / Loading / Kosong */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="flex flex-col gap-2 animate-pulse">
              <div className="aspect-square w-full rounded-lg bg-sunken" />
              <div className="h-4 w-3/4 rounded bg-sunken" />
              <div className="h-3 w-1/2 rounded bg-sunken" />
            </div>
          ))}
        </div>
      ) : albums.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-surface py-16 px-4 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-sunken text-ink-muted">
            <FolderPlus size={28} strokeWidth={1.5} />
          </div>
          <h2 className="text-h3 font-serif text-ink">Belum Ada Album</h2>
          <p className="mt-1 max-w-sm text-caption text-ink-muted">
            Kumpulkan foto dan video favoritmu ke dalam album agar rapi dan mudah
            dibagikan.
          </p>
          <Button
            variant="secondary"
            className="mt-5"
            onClick={() => setModalOpen(true)}
          >
            Buat Album Pertama
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
          {albums.map((album) => (
            <AlbumCard key={album.id} album={album} />
          ))}
        </div>
      )}

      {/* Modal Buat Album */}
      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h3 className="text-h3 font-serif text-ink">Buat Album Baru</h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-full p-1 text-ink-muted hover:bg-sunken hover:text-ink"
                aria-label="Tutup"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="mt-4 space-y-4">
              <Input
                id="album-title"
                label="Nama Album"
                placeholder="Misal: Liburan Akhir Tahun"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
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
                  onClick={() => setModalOpen(false)}
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  loading={createMutation.isPending}
                >
                  Simpan
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function AlbumCard({ album }: { album: AlbumItem }) {
  return (
    <Link
      href={`/album/${encodeURIComponent(album.id)}`}
      className="group flex flex-col gap-2 rounded-xl border border-line bg-surface p-2.5 transition hover:border-accent hover:shadow-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent"
    >
      <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-sunken">
        <MediaThumb
          src={album.coverFileId ? getThumbnailUrl(album.coverFileId) : null}
          alt={album.title}
          showDuration={false}
          showVideoBadge={false}
        />
      </div>
      <div className="min-w-0">
        <h4 className="truncate text-body font-medium text-ink group-hover:text-accent">
          {album.title}
        </h4>
        <p className="text-caption text-ink-muted">
          {album.fileCount} {album.fileCount === 1 ? "item" : "item"}
        </p>
      </div>
    </Link>
  );
}


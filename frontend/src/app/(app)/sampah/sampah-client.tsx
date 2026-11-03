"use client";

import { useState } from "react";
import Image from "next/image";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Film,
  Image as ImageIcon,
  RotateCcw,
  Trash2,
} from "lucide-react";
import {
  deletePermanentFile,
  emptyTrash,
  fetchTrashFiles,
  getThumbnailUrl,
} from "@/lib/api";
import { restoreFile } from "@/lib/api";
import { toIndonesianMessage } from "@/lib/auth-errors";
import { Button } from "@/components/ui/button";

function formatBytes(bytesStr: string): string {
  try {
    const bytes = Number(BigInt(bytesStr));
    if (bytes <= 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const val = bytes / Math.pow(k, i);
    return `${val < 10 && i > 0 ? val.toFixed(1) : Math.round(val)} ${sizes[i]}`;
  } catch {
    return "0 B";
  }
}

export function SampahClient() {
  const queryClient = useQueryClient();
  const [showEmptyModal, setShowEmptyModal] = useState(false);
  const [targetDeletePermanent, setTargetDeletePermanent] = useState<string | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["trash"],
    queryFn: fetchTrashFiles,
  });

  const restoreMutation = useMutation({
    mutationFn: (id: string) => restoreFile(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trash"] });
      queryClient.invalidateQueries({ queryKey: ["files"] });
    },
  });

  const permanentDeleteMutation = useMutation({
    mutationFn: (id: string) => deletePermanentFile(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trash"] });
      setTargetDeletePermanent(null);
    },
  });

  const emptyTrashMutation = useMutation({
    mutationFn: emptyTrash,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trash"] });
      setShowEmptyModal(false);
    },
  });

  const items = data?.items ?? [];

  return (
    <div className="flex flex-col gap-6 pb-24">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-h1 text-ink">Sampah</h1>
          <p className="text-body text-ink-muted">
            File di sini dapat dipulihkan atau dihapus secara permanen.
          </p>
        </div>

        {items.length > 0 ? (
          <Button
            type="button"
            variant="danger"
            onClick={() => setShowEmptyModal(true)}
            className="flex items-center gap-1.5"
          >
            <Trash2 size={16} />
            <span>Kosongkan Sampah</span>
          </Button>
        ) : null}
      </div>

      {/* Konten */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 animate-pulse">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="aspect-square rounded-xl bg-sunken" />
          ))}
        </div>
      ) : isError ? (
        <div className="flex min-h-[300px] flex-col items-center justify-center gap-3 p-6 text-center">
          <p className="text-body text-danger">
            Gagal memuat sampah: {toIndonesianMessage(error)}
          </p>
          <Button variant="secondary" onClick={() => refetch()}>
            Coba lagi
          </Button>
        </div>
      ) : items.length === 0 ? (
        <div className="flex min-h-[360px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-line bg-surface p-8 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-sunken text-ink-muted">
            <Trash2 size={28} strokeWidth={1.5} />
          </div>
          <h2 className="text-h3 font-serif text-ink">Tempat Sampah Kosong</h2>
          <p className="max-w-sm text-caption text-ink-muted">
            Tidak ada foto atau video yang sedang berada di tempat sampah.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {items.map((file) => {
            const isVideo = file.kind === "video";
            return (
              <div
                key={file.id}
                className="group relative flex flex-col overflow-hidden rounded-xl border border-line bg-surface p-2 transition hover:border-ink-muted"
              >
                <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-sunken">
                  {file.thumbKey ? (
                    <Image
                      src={getThumbnailUrl(file.id)}
                      alt={file.originalName}
                      fill
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 16vw"
                      className="object-cover opacity-85 group-hover:opacity-100 transition-opacity"
                      unoptimized
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-ink-muted">
                      {isVideo ? <Film size={32} /> : <ImageIcon size={32} />}
                    </div>
                  )}
                </div>

                <div className="mt-2 min-w-0">
                  <p className="truncate text-caption font-medium text-ink">
                    {file.originalName}
                  </p>
                  <p className="text-[11px] text-ink-muted">
                    {formatBytes(file.sizeBytes)}
                  </p>
                </div>

                {/* Tombol Pulihkan & Hapus Permanen */}
                <div className="mt-2 flex items-center justify-between gap-1 border-t border-line/60 pt-2">
                  <button
                    type="button"
                    onClick={() => restoreMutation.mutate(file.id)}
                    disabled={restoreMutation.isPending}
                    aria-label={`Pulihkan ${file.originalName}`}
                    className="flex flex-1 items-center justify-center gap-1 rounded-md py-1 text-[12px] font-medium text-accent hover:bg-accent-soft/40 transition active:scale-95 cursor-pointer"
                  >
                    <RotateCcw size={14} />
                    <span>Pulihkan</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetDeletePermanent(file.id)}
                    disabled={permanentDeleteMutation.isPending}
                    aria-label={`Hapus permanen ${file.originalName}`}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-ink-muted hover:text-danger hover:bg-danger/10 transition active:scale-95 cursor-pointer"
                    title="Hapus permanen"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Konfirmasi Kosongkan Sampah */}
      {showEmptyModal ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-6 shadow-xl">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-danger/10 text-danger">
              <AlertTriangle size={24} />
            </div>
            <h3 className="text-h3 font-serif text-ink">Kosongkan Sampah?</h3>
            <p className="mt-2 text-caption text-ink-muted">
              Semua {items.length} file di tempat sampah akan dihapus secara
              permanen dari disk server dan tidak dapat dipulihkan lagi.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => setShowEmptyModal(false)}
                disabled={emptyTrashMutation.isPending}
              >
                Batal
              </Button>
              <Button
                variant="danger"
                onClick={() => emptyTrashMutation.mutate()}
                disabled={emptyTrashMutation.isPending}
              >
                {emptyTrashMutation.isPending ? "Menghapus..." : "Ya, Kosongkan"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Modal Konfirmasi Hapus Permanen Tunggal */}
      {targetDeletePermanent ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-6 shadow-xl">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-danger/10 text-danger">
              <AlertTriangle size={24} />
            </div>
            <h3 className="text-h3 font-serif text-ink">Hapus Permanen?</h3>
            <p className="mt-2 text-caption text-ink-muted">
              File ini akan dihapus selamanya dari penyimpanan cloud dan tidak
              dapat dipulihkan.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => setTargetDeletePermanent(null)}
                disabled={permanentDeleteMutation.isPending}
              >
                Batal
              </Button>
              <Button
                variant="danger"
                onClick={() =>
                  permanentDeleteMutation.mutate(targetDeletePermanent)
                }
                disabled={permanentDeleteMutation.isPending}
              >
                {permanentDeleteMutation.isPending
                  ? "Menghapus..."
                  : "Hapus Permanen"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

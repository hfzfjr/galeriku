"use client";

import { useState } from "react";
import { AlertTriangle, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DeleteAlbumModalProps {
  isOpen: boolean;
  onClose: () => void;
  albumTitle: string;
  hasChildren: boolean;
  childCount?: number;
  onConfirm: (mode: "only" | "subtree") => Promise<void>;
}

export function DeleteAlbumModal({
  isOpen,
  onClose,
  albumTitle,
  hasChildren,
  childCount = 0,
  onConfirm,
}: DeleteAlbumModalProps) {
  const [mode, setMode] = useState<"only" | "subtree">("only");
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleDelete = async () => {
    setIsDeleting(true);
    setErrorMsg(null);
    try {
      await onConfirm(hasChildren ? mode : "only");
      onClose();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Gagal menghapus album. Coba lagi.",
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-album-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="flex max-h-[85vh] w-full max-w-md flex-col rounded-t-2xl sm:rounded-2xl border border-line bg-surface p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-danger/10 text-danger">
              <AlertTriangle size={18} />
            </div>
            <h3 id="delete-album-title" className="text-h3 font-serif text-ink">
              Hapus Album?
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-ink-muted hover:bg-sunken hover:text-ink"
            aria-label="Tutup"
          >
            <X size={20} />
          </button>
        </div>

        {errorMsg && (
          <div className="mt-3 rounded-lg bg-danger/10 p-3 text-caption font-medium text-danger">
            {errorMsg}
          </div>
        )}

        <div className="mt-4 flex flex-col gap-4 text-body text-ink-muted">
          <p>
            Kamu akan menghapus album <strong className="text-ink">{albumTitle}</strong>.
          </p>

          {hasChildren ? (
            <div className="space-y-3 rounded-xl border border-line bg-sunken/40 p-3.5">
              <p className="text-caption font-medium text-ink">
                Album ini memiliki {childCount} sub-album. Pilih cara penghapusan:
              </p>

              <label className="flex items-start gap-3 rounded-lg border border-line bg-surface p-3 cursor-pointer transition hover:border-accent">
                <input
                  type="radio"
                  name="delete-mode"
                  value="only"
                  checked={mode === "only"}
                  onChange={() => setMode("only")}
                  className="mt-1 h-4 w-4 text-accent focus:ring-accent"
                />
                <div>
                  <p className="text-label font-medium text-ink">
                    Hapus album ini saja
                  </p>
                  <p className="text-caption text-ink-muted">
                    Sub-album akan dinaikkan ke folder induk di atasnya.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-3 rounded-lg border border-line bg-surface p-3 cursor-pointer transition hover:border-danger">
                <input
                  type="radio"
                  name="delete-mode"
                  value="subtree"
                  checked={mode === "subtree"}
                  onChange={() => setMode("subtree")}
                  className="mt-1 h-4 w-4 text-danger focus:ring-danger"
                />
                <div>
                  <p className="text-label font-medium text-ink">
                    Hapus album beserta isinya
                  </p>
                  <p className="text-caption text-ink-muted">
                    Seluruh {childCount} sub-album di dalamnya akan ikut dihapus.
                  </p>
                </div>
              </label>
            </div>
          ) : null}

          <div className="rounded-lg bg-accent-soft p-3 text-caption text-ink">
            <strong>Catatan:</strong> Foto dan video di dalam album{" "}
            <strong>tetap aman tersimpan di galerimu</strong> dan tidak akan pernah ikut terhapus.
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2 border-t border-line pt-3">
          <Button
            type="button"
            variant="ghost"
            disabled={isDeleting}
            onClick={onClose}
            className="min-h-11 px-4 text-caption"
          >
            Batal
          </Button>
          <Button
            type="button"
            variant="danger"
            loading={isDeleting}
            onClick={handleDelete}
            className="min-h-11 px-5 text-caption font-medium flex items-center gap-1.5"
          >
            <Trash2 size={16} />
            <span>Hapus Album</span>
          </Button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { Sparkles, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/format-bytes";
import { batchDeleteFiles } from "@/lib/api";

interface CleanDuplicatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  duplicateFiles: Array<{ id: string; sizeBytes: string | bigint }>;
  onSuccess: () => void;
}

export function CleanDuplicatesModal({
  isOpen,
  onClose,
  duplicateFiles,
  onSuccess,
}: CleanDuplicatesModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const totalBytes = duplicateFiles.reduce(
    (acc, f) => acc + BigInt(f.sizeBytes || 0),
    BigInt(0),
  );
  const formattedSavedSpace = formatBytes(totalBytes);

  const handleClean = async () => {
    if (duplicateFiles.length === 0 || isDeleting) return;
    setIsDeleting(true);
    setErrorMessage(null);
    try {
      const ids = duplicateFiles.map((f) => f.id);
      await batchDeleteFiles(ids);
      onSuccess();
      onClose();
    } catch {
      setErrorMessage("Gagal memindahkan file duplikat ke Sampah.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="clean-duplicates-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200"
    >
      <div className="flex max-h-[85vh] w-full max-w-md flex-col rounded-t-2xl sm:rounded-2xl border border-line bg-surface p-5 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-line">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft text-accent">
              <Sparkles size={18} />
            </div>
            <div>
              <h3 id="clean-duplicates-title" className="text-h3 font-serif text-ink">
                Bersihkan Duplikat
              </h3>
              <p className="text-caption text-ink-muted">
                Hemat ruang penyimpanan galerimu
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
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

        {/* Detail Ruang yang Dihemat */}
        <div className="mt-4 flex flex-col gap-3">
          <div className="rounded-xl border border-line bg-sunken/40 p-4 text-center">
            <p className="text-caption text-ink-muted">Ruang yang akan dihemat</p>
            <p className="mt-1 text-h1 font-serif text-accent">
              {formattedSavedSpace}
            </p>
            <p className="mt-1 text-caption text-ink-muted">
              dari {duplicateFiles.length} file duplikat
            </p>
          </div>

          <p className="text-body text-ink-muted">
            File duplikat yang dipilih akan dipindahkan ke <strong>Sampah</strong>. File asli yang diunggah pertama kali tetap tersimpan aman di galerimu.
          </p>
          <p className="text-caption text-ink-muted">
            Kamu masih bisa memulihkan file dari Sampah dalam waktu 30 hari sebelum dihapus permanen.
          </p>
        </div>

        {/* Tombol Aksi */}
        <div className="mt-5 flex items-center justify-end gap-2 border-t border-line pt-3">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={isDeleting}
            className="min-h-11 px-4 text-caption"
          >
            Batal
          </Button>
          <Button
            type="button"
            variant="danger"
            loading={isDeleting}
            disabled={isDeleting || duplicateFiles.length === 0}
            onClick={handleClean}
            className="min-h-11 px-5 text-caption font-medium flex items-center gap-1.5"
          >
            <Trash2 size={16} />
            <span>Pindahkan ke Sampah ({duplicateFiles.length})</span>
          </Button>
        </div>
      </div>
    </div>
  );
}

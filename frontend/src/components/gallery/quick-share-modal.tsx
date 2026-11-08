"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Link2, Share2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addFilesToAlbum, createAlbum, createShareLink } from "@/lib/api";
import { toIndonesianMessage } from "@/lib/auth-errors";

interface QuickShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileIds: string[];
  onSuccess: () => void;
}

export function QuickShareModal({
  isOpen,
  onClose,
  fileIds,
  onSuccess,
}: QuickShareModalProps) {
  const queryClient = useQueryClient();
  const todayFormatted = new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date());

  const [title, setTitle] = useState(`Bagikan ${todayFormatted}`);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createdShareUrl, setCreatedShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const quickShareMutation = useMutation({
    mutationFn: async () => {
      // 1. Buat album
      const album = await createAlbum({ title: title.trim() || `Bagikan ${todayFormatted}` });
      // 2. Tambahkan foto ke album
      await addFilesToAlbum(album.id, { fileIds });
      // 3. Buat share link tanpa batas (RF-22)
      const link = await createShareLink({
        targetType: "ALBUM",
        targetId: album.id,
        allowDownload: true,
        showLocation: false,
        expiry: "NEVER",
      });

      const url = `${window.location.origin}/s/${link.token}`;
      return url;
    },
    onSuccess: (url) => {
      queryClient.invalidateQueries({ queryKey: ["albums"] });
      queryClient.invalidateQueries({ queryKey: ["shares"] });
      setCreatedShareUrl(url);
      onSuccess();
    },
    onError: (err) => {
      setErrorMessage(toIndonesianMessage(err));
    },
  });

  const handleCopy = async () => {
    if (!createdShareUrl) return;
    try {
      await navigator.clipboard.writeText(createdShareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Abaikan galat salin
    }
  };

  const handleNativeShare = async () => {
    if (!createdShareUrl) return;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: title,
          text: `Lihat album "${title}" di Galeriku:`,
          url: createdShareUrl,
        });
      } catch {
        // User cancel share dialog
      }
    } else {
      handleCopy();
    }
  };

  const handleClose = () => {
    setTitle(`Bagikan ${todayFormatted}`);
    setErrorMessage(null);
    setCreatedShareUrl(null);
    setCopied(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Bagikan cepat"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200"
    >
      <div className="flex max-h-[85vh] w-full max-w-md flex-col rounded-t-2xl sm:rounded-2xl border border-line bg-surface p-5 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-line">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft text-accent">
              <Share2 size={18} />
            </div>
            <div>
              <h3 className="text-h3 font-serif text-ink">Bagikan Cepat</h3>
              <p className="text-caption text-ink-muted">
                {fileIds.length} foto/video terpilih
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
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

        {createdShareUrl ? (
          /* Tampilan Sukses Tautan Terbuat */
          <div className="mt-4 flex flex-col gap-4">
            <div className="rounded-xl border border-line bg-sunken/40 p-4 text-center">
              <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-accent">
                <Link2 size={20} />
              </div>
              <p className="text-label font-medium text-ink">Tautan Siap Dibagikan</p>
              <p className="mt-0.5 text-caption text-ink-muted">
                Siapa saja yang memiliki tautan ini dapat melihat dan mengunduh album.
              </p>

              <div className="mt-3 flex items-center gap-2 rounded-lg border border-line bg-surface p-2 text-left">
                <span className="flex-1 truncate font-mono text-caption text-ink select-all">
                  {createdShareUrl}
                </span>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex min-h-9 items-center gap-1 rounded-md bg-accent px-2.5 py-1 text-caption font-medium text-white transition hover:bg-accent/90"
                  aria-label="Salin tautan"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copied ? "Tersalin" : "Salin"}</span>
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              {typeof navigator !== "undefined" && "share" in navigator && (
                <Button
                  type="button"
                  variant="primary"
                  onClick={handleNativeShare}
                  className="flex min-h-11 w-full items-center justify-center gap-2 text-caption font-medium"
                >
                  <Share2 size={16} />
                  Kirim ke Aplikasi Lain
                </Button>
              )}
              <Button
                type="button"
                variant="secondary"
                onClick={handleClose}
                className="min-h-11 w-full text-caption"
              >
                Selesai
              </Button>
            </div>
          </div>
        ) : (
          /* Form Persiapan Bagikan */
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!quickShareMutation.isPending) {
                quickShareMutation.mutate();
              }
            }}
            className="mt-4 flex flex-col gap-4"
          >
            <p className="text-body text-ink-muted">
              Galeriku akan mengelompokkan {fileIds.length} foto/video ini ke dalam satu album otomatis dan membuatkan tautan publik tanpa batas waktu.
            </p>

            <Input
              id="quick-share-title"
              label="Judul Album Berbagi"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Judul album..."
              required
              disabled={quickShareMutation.isPending}
            />

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={handleClose}
                disabled={quickShareMutation.isPending}
                className="min-h-11 px-4 text-caption"
              >
                Batal
              </Button>
              <Button
                type="submit"
                variant="primary"
                loading={quickShareMutation.isPending}
                className="min-h-11 px-5 text-caption font-medium"
              >
                Buat Tautan Berbagi
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

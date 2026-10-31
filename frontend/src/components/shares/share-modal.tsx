"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink, Link2, Share2, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { ShareTarget } from "@galeriku/contracts";
import { Button } from "@/components/ui/button";
import { createShareLink } from "@/lib/api";
import { toIndonesianMessage } from "@/lib/auth-errors";

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetType: ShareTarget;
  targetId: string;
  targetTitle: string;
}

export function ShareModal({
  isOpen,
  onClose,
  targetType,
  targetId,
  targetTitle,
}: ShareModalProps) {
  const [copied, setCopied] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["share", targetType, targetId],
    queryFn: () =>
      createShareLink({
        targetType,
        targetId,
        allowDownload: true,
      }),
    enabled: isOpen,
    staleTime: 60_000,
  });

  if (!isOpen) return null;

  const shareUrl =
    data && typeof window !== "undefined"
      ? `${window.location.origin}/s/${data.token}`
      : "";

  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback bila clipboard api diblokir
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share && shareUrl) {
      try {
        await navigator.share({
          title: `Galeriku — ${targetTitle}`,
          text: `Buka ${targetType === "FILE" ? "foto/video" : "album"} "${targetTitle}" di Galeriku:`,
          url: shareUrl,
        });
      } catch {
        // Pengguna membatalkan dialog bawaan
      }
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
    >
      <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/15 text-accent">
              <Share2 size={16} />
            </div>
            <div>
              <h3 className="text-h3 font-serif text-ink">Bagikan Tautan</h3>
              <p className="truncate text-caption text-ink-muted max-w-[240px]">
                {targetTitle}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-ink-muted hover:bg-sunken hover:text-ink"
            aria-label="Tutup"
          >
            <X size={20} />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <p className="text-caption text-ink-muted">
            Siapa saja yang memiliki tautan ini dapat melihat dan mengunduh
            konten tanpa perlu masuk ke akun.
          </p>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-6 gap-2">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
              <span className="text-caption text-ink-muted">
                Membuat tautan publik...
              </span>
            </div>
          ) : error ? (
            <p className="text-sm font-medium text-danger">
              {toIndonesianMessage(error)}
            </p>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 rounded-lg border border-line bg-sunken p-2">
                <Link2 size={16} className="text-ink-muted shrink-0 ml-1" />
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  className="w-full bg-transparent text-sm text-ink outline-hidden"
                  onFocus={(e) => e.target.select()}
                />
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  type="button"
                  variant="primary"
                  className="flex-1 gap-1.5"
                  onClick={handleCopy}
                >
                  {copied ? (
                    <>
                      <Check size={16} className="text-white" />
                      <span>Tersalin!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={16} />
                      <span>Salin Tautan</span>
                    </>
                  )}
                </Button>

                {typeof navigator !== "undefined" && "share" in navigator && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleNativeShare}
                    className="gap-1.5"
                    title="Bagikan lewat aplikasi lain"
                  >
                    <Share2 size={16} />
                    <span className="hidden sm:inline">Bagikan</span>
                  </Button>
                )}

                <a
                  href={shareUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center rounded-lg border border-line px-3 py-2 text-ink-muted hover:bg-sunken hover:text-ink transition"
                  title="Buka tautan"
                >
                  <ExternalLink size={16} />
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

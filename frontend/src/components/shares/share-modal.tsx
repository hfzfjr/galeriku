"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink, KeyRound, Link2, Lock, Share2, Timer, X } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ShareExpiryOption, ShareLinkItem, ShareTarget } from "@galeriku/contracts";
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
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [expiry, setExpiry] = useState<ShareExpiryOption>(
    targetType === "ALBUM" ? "NEVER" : "30_DAYS",
  );
  const [allowDownload, setAllowDownload] = useState(true);
  const [showLocation, setShowLocation] = useState(false);
  const [includeChildren, setIncludeChildren] = useState(true);
  const [password, setPassword] = useState("");
  const [createdShare, setCreatedShare] = useState<ShareLinkItem | null>(null);

  const createMutation = useMutation({
    mutationFn: () =>
      createShareLink({
        targetType,
        targetId,
        allowDownload,
        showLocation,
        includeChildren: targetType === "ALBUM" ? includeChildren : undefined,
        expiry,
        password: password.trim() ? password.trim() : undefined,
      }),
    onSuccess: (data) => {
      setCreatedShare(data);
      queryClient.invalidateQueries({ queryKey: ["shares"] });
    },
  });

  if (!isOpen) return null;

  const shareUrl =
    createdShare && typeof window !== "undefined"
      ? `${window.location.origin}/s/${createdShare.token}`
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

  const handleReset = () => {
    setCreatedShare(null);
    setPassword("");
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
          {!createdShare ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createMutation.mutate();
              }}
              className="space-y-4"
            >
              {/* Masa Berlaku */}
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-xs font-medium text-ink">
                  <Timer size={14} className="text-ink-muted" />
                  <span>Masa Berlaku</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "1 Hari", val: "1_DAY" },
                    { label: "7 Hari", val: "7_DAYS" },
                    { label: "30 Hari", val: "30_DAYS" },
                    {
                      label:
                        targetType === "ALBUM"
                          ? "Tanpa batas (Disarankan)"
                          : "Tanpa batas",
                      val: "NEVER",
                    },
                  ].map((opt) => (
                    <button
                      type="button"
                      key={opt.val}
                      onClick={() => setExpiry(opt.val as ShareExpiryOption)}
                      className={`rounded-lg border px-3 py-2 text-xs font-medium transition text-left ${
                        expiry === opt.val
                          ? "border-accent bg-accent/10 text-accent font-semibold"
                          : "border-line bg-surface text-ink hover:bg-sunken"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {expiry === "NEVER" && (
                  <p className="text-[11px] text-ink-muted">
                    Tanpa batas — kamu bisa mencabutnya kapan saja.
                  </p>
                )}
              </div>

              {/* Toggle Izinkan Unduh */}
              <div className="flex items-center justify-between rounded-xl border border-line bg-sunken/50 p-3">
                <div>
                  <p className="text-xs font-medium text-ink">Izinkan Unduhan</p>
                  <p className="text-[11px] text-ink-muted">
                    Pengunjung dapat mengunduh berkas asli
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={allowDownload}
                  onChange={(e) => setAllowDownload(e.target.checked)}
                  className="h-4 w-4 accent-accent rounded cursor-pointer"
                />
              </div>

              {/* Toggle Tampilkan Lokasi (RF-21) */}
              <div className="flex items-center justify-between rounded-xl border border-line bg-sunken/50 p-3">
                <div>
                  <p className="text-xs font-medium text-ink">Tampilkan Lokasi</p>
                  <p className="text-[11px] text-ink-muted">
                    Jika mati, lokasi disembunyikan dari penerima.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={showLocation}
                  onChange={(e) => setShowLocation(e.target.checked)}
                  className="h-4 w-4 accent-accent rounded cursor-pointer"
                />
              </div>

              {/* Toggle Sertakan Sub-album (RF-52) */}
              {targetType === "ALBUM" && (
                <div className="flex items-center justify-between rounded-xl border border-line bg-sunken/50 p-3">
                  <div>
                    <p className="text-xs font-medium text-ink">Sertakan Sub-album</p>
                    <p className="text-[11px] text-ink-muted">
                      Pengunjung dapat membuka seluruh sub-album di dalamnya
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={includeChildren}
                    onChange={(e) => setIncludeChildren(e.target.checked)}
                    className="h-4 w-4 accent-accent rounded cursor-pointer"
                  />
                </div>
              )}

              {/* Kata Sandi Opsional */}
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-xs font-medium text-ink">
                  <Lock size={14} className="text-ink-muted" />
                  <span>Kata Sandi (Opsional)</span>
                </label>
                <div className="relative">
                  <KeyRound
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
                  />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Kosongkan jika tanpa sandi"
                    className="w-full rounded-lg border border-line bg-surface py-2 pl-9 pr-3 text-xs text-ink placeholder:text-ink-muted focus:border-accent focus:outline-hidden"
                  />
                </div>
                <p className="text-[11px] text-ink-muted">
                  Bila diisi, pengunjung wajib memasukkan sandi sebelum melihat berkas.
                </p>
              </div>

              {createMutation.error && (
                <p className="text-xs text-danger font-medium">
                  {toIndonesianMessage(createMutation.error)}
                </p>
              )}

              <Button
                type="submit"
                variant="primary"
                className="w-full mt-2"
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? "Membuat tautan..." : "Buat Tautan Publik"}
              </Button>
            </form>
          ) : (
            <div className="space-y-3">
              <div className="rounded-xl bg-accent/10 p-3 border border-accent/20">
                <p className="text-xs font-semibold text-accent">
                  Tautan Publik Berhasil Dibuat
                </p>
                <p className="text-[11px] text-ink-muted mt-0.5">
                  {createdShare.expiresAt
                    ? `Kedaluwarsa pada: ${new Date(createdShare.expiresAt).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}`
                    : "Berlaku selamanya"}
                  {createdShare.hasPassword ? " • Dilindungi sandi" : ""}
                  {createdShare.allowDownload ? " • Unduhan diizinkan" : " • Unduhan dinonaktifkan"}
                </p>
              </div>

              <div className="flex items-center gap-2 rounded-lg border border-line bg-sunken p-2">
                <Link2 size={16} className="text-ink-muted shrink-0 ml-1" />
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  className="w-full bg-transparent text-xs text-ink outline-hidden"
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

              <button
                type="button"
                onClick={handleReset}
                className="w-full text-center text-xs text-ink-muted hover:text-ink mt-2 py-1 underline underline-offset-2"
              >
                Buat tautan lain dengan opsi berbeda
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Ban,
  Check,
  Clock,
  Copy,
  ExternalLink,
  Eye,
  Folder,
  Image as ImageIcon,
  Link2,
  Lock,
  Share2,
  Trash2,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ShareLinkItem } from "@galeriku/contracts";
import { Button } from "@/components/ui/button";
import { fetchShares, revokeShareLink } from "@/lib/api";
import { toIndonesianMessage } from "@/lib/auth-errors";

type FilterTab = "ALL" | "ACTIVE" | "REVOKED";

export function SharesClient() {
  const queryClient = useQueryClient();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterTab>("ALL");
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokeError, setRevokeError] = useState<string | null>(null);
  const [nowTimestamp] = useState(() => Date.now());

  const { data, isLoading } = useQuery({
    queryKey: ["shares"],
    queryFn: fetchShares,
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => revokeShareLink(id),
    onSuccess: () => {
      setRevokingId(null);
      setRevokeError(null);
      queryClient.invalidateQueries({ queryKey: ["shares"] });
    },
    onError: (err) => {
      setRevokeError(toIndonesianMessage(err));
    },
  });

  const items = data?.items;

  const filteredShares = useMemo(() => {
    const list = items ?? [];
    return list.filter((s) => {
      const isExpired =
        s.expiresAt && new Date(s.expiresAt).getTime() <= nowTimestamp;
      const isActive = !s.isRevoked && !isExpired;

      if (filter === "ACTIVE") return isActive;
      if (filter === "REVOKED") return s.isRevoked || isExpired;
      return true;
    });
  }, [items, filter, nowTimestamp]);

  const handleCopy = async (id: string, token: string) => {
    const url = `${window.location.origin}/s/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2500);
    } catch {
      // Abaikan jika tidak didukung
    }
  };

  return (
    <div className="flex flex-col gap-6 pb-24">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-h1 font-serif text-ink">Tautan Berbagi</h1>
          <p className="text-body text-ink-muted">
            Kelola tautan publik foto, video, dan album yang pernah kamu bagikan.
          </p>
        </div>

        {/* Tab Filter */}
        <div className="flex items-center gap-1 rounded-xl border border-line bg-sunken/40 p-1 self-start sm:self-auto">
          {[
            { id: "ALL", label: "Semua" },
            { id: "ACTIVE", label: "Aktif" },
            { id: "REVOKED", label: "Dicabut / Kedaluwarsa" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id as FilterTab)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                filter === tab.id
                  ? "bg-surface text-ink shadow-xs"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {revokeError && (
        <div className="rounded-xl border border-danger/30 bg-danger/10 p-3 text-xs text-danger">
          {revokeError}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-24 rounded-xl bg-sunken" />
          ))}
        </div>
      ) : filteredShares.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-surface py-16 px-4 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-sunken text-ink-muted">
            <Share2 size={28} strokeWidth={1.5} />
          </div>
          <h2 className="text-h3 font-serif text-ink">
            {filter === "ALL"
              ? "Belum Ada Tautan Berbagi"
              : filter === "ACTIVE"
              ? "Tidak Ada Tautan Aktif"
              : "Tidak Ada Tautan Dicabut"}
          </h2>
          <p className="mt-1 max-w-sm text-caption text-ink-muted">
            Buka foto, video, atau album apa saja di galerimu, lalu tekan tombol
            &ldquo;Bagikan&rdquo; untuk membuat tautan publik baru.
          </p>
          <Link href="/app" className="mt-5">
            <Button variant="secondary">Buka Galeri</Button>
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredShares.map((share) => (
            <ShareCard
              key={share.id}
              share={share}
              nowTimestamp={nowTimestamp}
              isCopied={copiedId === share.id}
              isRevoking={revokingId === share.id}
              isPendingRevoke={revokeMutation.isPending && revokingId === share.id}
              onCopy={() => handleCopy(share.id, share.token)}
              onConfirmRevoke={() => {
                setRevokingId(share.id);
                revokeMutation.mutate(share.id);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ShareCard({
  share,
  nowTimestamp,
  isCopied,
  isRevoking,
  isPendingRevoke,
  onCopy,
  onConfirmRevoke,
}: {
  share: ShareLinkItem;
  nowTimestamp: number;
  isCopied: boolean;
  isRevoking: boolean;
  isPendingRevoke: boolean;
  onCopy: () => void;
  onConfirmRevoke: () => void;
}) {
  const [showConfirm, setShowConfirm] = useState(false);
  const shareUrl = `/s/${share.token}`;
  const isExpired =
    share.expiresAt && new Date(share.expiresAt).getTime() <= nowTimestamp;
  const isActive = !share.isRevoked && !isExpired;

  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border p-4 transition shadow-xs ${
        !isActive
          ? "border-line bg-surface/50 opacity-80"
          : "border-line bg-surface hover:border-accent/40"
      }`}
    >
      <div className="flex items-start gap-3 min-w-0">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
            !isActive
              ? "bg-sunken text-ink-muted"
              : "bg-accent/10 text-accent"
          }`}
        >
          {share.targetType === "ALBUM" ? (
            <Folder size={20} strokeWidth={1.5} />
          ) : (
            <ImageIcon size={20} strokeWidth={1.5} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h4 className="truncate text-body font-medium text-ink">
              {share.targetTitle}
            </h4>
            {share.isRevoked ? (
              <span className="inline-flex items-center gap-1 rounded bg-danger/10 px-2 py-0.5 text-[10px] font-semibold text-danger">
                <Ban size={10} />
                Dicabut
              </span>
            ) : isExpired ? (
              <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                <Clock size={10} />
                Kedaluwarsa
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                Aktif
              </span>
            )}
            {share.hasPassword && (
              <span
                className="text-ink-muted"
                title="Dilindungi dengan kata sandi"
              >
                <Lock size={12} />
              </span>
            )}
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-3 text-caption text-ink-muted">
            <span className="flex items-center gap-1 font-mono text-[12px]">
              <Link2 size={12} />
              {share.token.slice(0, 10)}...
            </span>
            <span className="flex items-center gap-1">
              <Eye size={12} />
              {share.viewCount} kali dibuka
            </span>
            <span>
              {share.expiresAt
                ? `Kedaluwarsa: ${new Intl.DateTimeFormat("id-ID", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  }).format(new Date(share.expiresAt))}`
                : "Berlaku selamanya"}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
        {isActive ? (
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={onCopy}
              className="gap-1.5"
            >
              {isCopied ? (
                <>
                  <Check size={14} className="text-success" />
                  <span>Tersalin</span>
                </>
              ) : (
                <>
                  <Copy size={14} />
                  <span>Salin</span>
                </>
              )}
            </Button>
            <Link
              href={shareUrl}
              target="_blank"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line text-ink-muted hover:bg-sunken hover:text-ink transition"
              title="Buka halaman publik"
            >
              <ExternalLink size={16} />
            </Link>

            {showConfirm ? (
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="danger"
                  className="text-xs px-2.5 py-1 min-h-[36px]"
                  disabled={isPendingRevoke}
                  onClick={onConfirmRevoke}
                >
                  {isRevoking ? "Mencabut..." : "Ya, Cabut"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="text-xs px-2.5 py-1 min-h-[36px]"
                  onClick={() => setShowConfirm(false)}
                >
                  Batal
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowConfirm(true)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line text-ink-muted hover:border-danger hover:bg-danger/10 hover:text-danger transition"
                title="Cabut tautan ini sekarang"
              >
                <Trash2 size={16} />
              </button>
            )}
          </>
        ) : (
          <span className="text-caption text-ink-muted italic">
            {share.isRevoked ? "Telah dicabut" : "Masa berlaku habis"}
          </span>
        )}
      </div>
    </div>
  );
}


"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Copy, ExternalLink, Eye, Folder, Image as ImageIcon, Link2, Share2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { ShareLinkItem } from "@galeriku/contracts";
import { Button } from "@/components/ui/button";
import { fetchShares } from "@/lib/api";

export function SharesClient() {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["shares"],
    queryFn: fetchShares,
  });

  const shares = data?.items ?? [];

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
      <div>
        <h1 className="text-h1 font-serif text-ink">Tautan Berbagi</h1>
        <p className="text-body text-ink-muted">
          Kelola tautan publik foto, video, dan album yang pernah kamu bagikan.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-20 rounded-xl bg-sunken" />
          ))}
        </div>
      ) : shares.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-surface py-16 px-4 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-sunken text-ink-muted">
            <Share2 size={28} strokeWidth={1.5} />
          </div>
          <h2 className="text-h3 font-serif text-ink">Belum Ada Tautan Berbagi</h2>
          <p className="mt-1 max-w-sm text-caption text-ink-muted">
            Buka foto, video, atau album apa saja di galerimu, lalu tekan tombol
            &ldquo;Bagikan&rdquo; untuk membuat tautan publik pertama.
          </p>
          <Link href="/app" className="mt-5">
            <Button variant="secondary">Buka Galeri</Button>
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {shares.map((share) => (
            <ShareCard
              key={share.id}
              share={share}
              isCopied={copiedId === share.id}
              onCopy={() => handleCopy(share.id, share.token)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ShareCard({
  share,
  isCopied,
  onCopy,
}: {
  share: ShareLinkItem;
  isCopied: boolean;
  onCopy: () => void;
}) {
  const shareUrl = `/s/${share.token}`;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-line bg-surface p-4 transition hover:border-accent/40 shadow-xs">
      <div className="flex items-start gap-3 min-w-0">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sunken text-ink-muted">
          {share.targetType === "ALBUM" ? (
            <Folder size={20} strokeWidth={1.5} />
          ) : (
            <ImageIcon size={20} strokeWidth={1.5} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="truncate text-body font-medium text-ink">
            {share.targetTitle}
          </h4>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-caption text-ink-muted">
            <span className="flex items-center gap-1 font-mono text-[12px]">
              <Link2 size={12} />
              {share.token.slice(0, 10)}...
            </span>
            <span className="flex items-center gap-1">
              <Eye size={12} />
              {share.viewCount} kali dibuka
            </span>
            <span>
              Dibuat{" "}
              {new Intl.DateTimeFormat("id-ID", {
                day: "numeric",
                month: "short",
                year: "numeric",
              }).format(new Date(share.createdAt))}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
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
      </div>
    </div>
  );
}


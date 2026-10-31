import { Check, Download, Image as ImageIcon, Film } from "lucide-react";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";

/**
 * Mock ilustrasi "Cara kerjanya": panel progres, kotak link, kartu album.
 * Hanyalah ilustrasi — BUKAN elemen interaktif (div/span saja, tanpa
 * button/fokus) dan disembunyikan dari pembaca layar (aria-hidden);
 * paragraf langkahnya yang dibaca.
 */

export function UploadMock() {
  return (
    <div
      aria-hidden="true"
      className="rounded-lg border border-line bg-surface p-4 shadow-sm"
    >
      <div className="flex items-center justify-between text-[13px] font-medium leading-[18px] text-ink">
        <span>Menyimpan 12 momen perjalanan</span>
        <span className="font-semibold text-accent">65%</span>
      </div>
      <div className="mt-2.5 h-1.5 rounded-full bg-line overflow-hidden">
        <div className="h-full w-[65%] rounded-full bg-accent" />
      </div>
      <div className="mt-3.5 space-y-2.5">
        <div className="flex items-center gap-3 rounded-md bg-paper/60 p-2 border border-line/40">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-accent-soft text-accent">
            <Film size={18} strokeWidth={1.5} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-label font-medium text-ink truncate">
              Matahari Terbit di Puncak Bromo
            </div>
            <div className="text-caption text-ink-muted">
              Otomatis melanjutkan saat sinyal pulih
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-md bg-paper/60 p-2 border border-line/40">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-accent-soft text-accent">
            <ImageIcon size={18} strokeWidth={1.5} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-label font-medium text-ink truncate">
              Pemandangan Kebun Teh Pangalengan
            </div>
            <div className="flex items-center gap-1 text-caption text-success font-medium">
              <Check size={14} strokeWidth={2} aria-hidden="true" />
              <span>Tersimpan dengan kualitas penuh</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function LinkMock() {
  return (
    <div
      aria-hidden="true"
      className="rounded-lg border border-line bg-surface p-4 shadow-sm"
    >
      <div className="flex items-center gap-2.5">
        <div className="min-w-0 flex-1 truncate rounded-md border border-line bg-sunken/40 px-3 py-2 font-sans text-xs font-medium text-ink">
          galeriku.me/s/liburan-jawa-timur
        </div>
        <div className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-md bg-accent px-4 text-xs font-semibold text-on-accent shadow-xs">
          Salin Tautan
        </div>
      </div>
      <div className="mt-3.5 flex flex-wrap gap-2">
        <Badge variant="accent">Aktif 30 Hari</Badge>
        <Badge variant="neutral">Bebas Unduh</Badge>
        <Badge variant="neutral">Dilindungi Sandi</Badge>
      </div>
    </div>
  );
}

export function AlbumMock() {
  return (
    <div
      aria-hidden="true"
      className="rounded-lg border border-line bg-surface p-4 shadow-sm"
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="font-serif text-[16px] font-semibold text-ink">
            Eksplorasi Jawa Timur
          </div>
          <div className="text-caption text-ink-muted">
            18 Foto & Video · Dibagikan oleh Fajar
          </div>
        </div>
        <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-[11px] font-medium text-accent">
          Album Publik
        </span>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-1.5 overflow-hidden rounded-md">
        <div className="relative aspect-square overflow-hidden bg-sunken">
          <Image
            src="/landing/travel-friends.jpg"
            alt="Foto album"
            fill
            sizes="80px"
            className="object-cover"
          />
        </div>
        <div className="relative aspect-square overflow-hidden bg-sunken">
          <Image
            src="/landing/travel-moment.jpg"
            alt="Foto album"
            fill
            sizes="80px"
            className="object-cover"
          />
        </div>
        <div className="relative aspect-square overflow-hidden bg-accent/20 flex items-center justify-center text-accent font-serif font-semibold text-xs">
          +8
        </div>
        <div className="relative aspect-square overflow-hidden bg-accent-soft/40 flex items-center justify-center text-accent-hover font-serif font-semibold text-xs">
          +4
        </div>
      </div>
      <div className="mt-3.5 flex items-center justify-between gap-3">
        <div className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-accent px-4 text-xs font-semibold text-on-accent shadow-xs">
          <Download size={15} strokeWidth={2} aria-hidden="true" />
          <span>Simpan Seluruh Album</span>
        </div>
        <span className="text-caption text-ink-muted hidden sm:inline">
          Tanpa perlu akun
        </span>
      </div>
    </div>
  );
}

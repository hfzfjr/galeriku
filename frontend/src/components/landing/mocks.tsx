import { Check, Download } from "lucide-react";
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
      className="rounded-md border border-line bg-surface p-3.5"
    >
      <div className="flex items-center justify-between text-[13px] font-medium leading-[18px] text-ink">
        <span>Mengunggah 3 dari 8 file</span>
        <span className="text-ink-muted">42%</span>
      </div>
      <div className="mt-2 h-1 rounded-full bg-line">
        <div className="h-1 w-[42%] rounded-full bg-accent" />
      </div>
      <div className="mt-3.5 flex items-center gap-2.5">
        <div className="h-9 w-9 shrink-0 rounded bg-sunken" />
        <div className="min-w-0">
          <div className="text-label text-ink">IMG_2041.MOV · 412 MB</div>
          <div className="text-caption text-ink-muted">
            Koneksi terputus, akan dilanjutkan otomatis
          </div>
        </div>
      </div>
      <div className="mt-2.5 flex items-center gap-2.5">
        <div className="h-9 w-9 shrink-0 rounded bg-sunken" />
        <div className="min-w-0">
          <div className="text-label text-ink">IMG_2038.HEIC · 3,1 MB</div>
          <div className="flex items-center gap-1 text-caption text-success">
            <Check size={14} strokeWidth={1.5} aria-hidden="true" />
            <span>Selesai</span>
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
      className="rounded-md border border-line bg-surface p-3.5"
    >
      <div className="flex items-center gap-2.5">
        <div className="min-w-0 flex-1 truncate rounded-sm bg-sunken px-2.5 py-2.5 font-mono text-xs leading-[18px] text-ink">
          galeriku.hafizfajar.com/s/Qk3x7mPa
        </div>
        <div className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-md bg-accent px-4 text-sm font-semibold text-on-accent">
          Salin link
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Badge variant="accent">Berlaku 30 hari</Badge>
        <Badge variant="neutral">Boleh diunduh</Badge>
        <Badge variant="neutral">Tanpa password</Badge>
      </div>
    </div>
  );
}

export function AlbumMock() {
  return (
    <div
      aria-hidden="true"
      className="rounded-md border border-line bg-surface p-3.5"
    >
      <div className="font-serif text-[16px] font-medium italic leading-[22px] text-ink">
        Jawa Timur, Mei 2026
      </div>
      <div className="mt-0.5 text-caption text-ink-muted">
        Dibagikan oleh Hafiz · berlaku sampai 9 Nov 2026
      </div>
      <div className="mt-3 grid grid-cols-4 gap-0.5">
        <div className="aspect-square bg-sunken" />
        <div className="aspect-square bg-sunken" />
        <div className="aspect-square bg-sunken" />
        <div className="aspect-square bg-sunken" />
      </div>
      <div className="mt-3 inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-ink px-4 text-sm font-semibold text-ink">
        <Download size={18} strokeWidth={1.5} aria-hidden="true" />
        <span>Unduh semua (ZIP)</span>
      </div>
    </div>
  );
}

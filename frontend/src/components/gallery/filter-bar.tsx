"use client";

import { useState } from "react";
import {
  Album,
  ArrowUpDown,
  Calendar,
  Check,
  CircleDot,
  Copy,
  Film,
  Image as ImageIcon,
  MapPin,
  RotateCcw,
  Star,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export type SortOption =
  | "taken_desc"
  | "taken_asc"
  | "uploaded_desc"
  | "name_asc"
  | "name_desc"
  | "size_desc"
  | "size_asc";

export interface FilterState {
  sort: SortOption;
  kind?: "image" | "video";
  favorite?: boolean;
  unalbumed?: boolean;
  live?: boolean;
  duplicates?: boolean;
  place?: string;
  from?: string;
  to?: string;
}

export const SORT_LABELS: Record<SortOption, string> = {
  taken_desc: "Tanggal foto (terbaru)",
  taken_asc: "Tanggal foto (terlama)",
  uploaded_desc: "Baru ditambahkan",
  name_asc: "Nama file (A-Z)",
  name_desc: "Nama file (Z-A)",
  size_desc: "Ukuran (terbesar)",
  size_asc: "Ukuran (terkecil)",
};

interface FilterBarProps {
  filters: FilterState;
  onChange: (updated: Partial<FilterState>) => void;
  onReset: () => void;
  hideKind?: boolean;
  hideFavorite?: boolean;
}

export function FilterBar({
  filters,
  onChange,
  onReset,
  hideKind = false,
  hideFavorite = false,
}: FilterBarProps) {
  const [showSortSheet, setShowSortSheet] = useState(false);
  const [showPlaceSheet, setShowPlaceSheet] = useState(false);
  const [showDateSheet, setShowDateSheet] = useState(false);
  const [showKindSheet, setShowKindSheet] = useState(false);
  const [tempPlace, setTempPlace] = useState(filters.place || "");
  const [tempFrom, setTempFrom] = useState(filters.from || "");
  const [tempTo, setTempTo] = useState(filters.to || "");

  const hasActiveFilters = Boolean(
    (!hideKind && filters.kind) ||
    (!hideFavorite && filters.favorite) ||
    filters.unalbumed ||
    filters.live ||
    filters.duplicates ||
    filters.place ||
    filters.from ||
    filters.to ||
    filters.sort !== "taken_desc"
  );

  return (
    <div className="flex flex-col gap-2">
      {/* Horizontal Scroll Bar of Chips */}
      <div
        role="toolbar"
        aria-label="Filter galeri"
        className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 px-1 touch-pan-x"
      >
        {/* Chip Urutkan */}
        <button
          type="button"
          onClick={() => setShowSortSheet(true)}
          className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-caption font-medium transition-colors ${
            filters.sort !== "taken_desc"
              ? "border border-accent/40 bg-accent-soft text-accent"
              : "border border-line bg-surface text-ink-muted hover:border-ink-muted hover:text-ink"
          }`}
          aria-label={`Urutan saat ini: ${SORT_LABELS[filters.sort]}. Buka sheet urutan`}
        >
          <ArrowUpDown size={14} className="shrink-0" />
          <span>{SORT_LABELS[filters.sort]}</span>
        </button>

        {/* Chip Jenis */}
        {!hideKind && (
          <button
            type="button"
            onClick={() => setShowKindSheet(true)}
            className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-caption font-medium transition-colors ${
              filters.kind
                ? "border border-accent/40 bg-accent-soft text-accent"
                : "border border-line bg-surface text-ink-muted hover:border-ink-muted hover:text-ink"
            }`}
            aria-label="Filter jenis media"
          >
            {filters.kind === "video" ? (
              <Film size={14} className="shrink-0" />
            ) : filters.kind === "image" ? (
              <ImageIcon size={14} className="shrink-0" />
            ) : (
              <ImageIcon size={14} className="shrink-0" />
            )}
            <span>
              {filters.kind === "video"
                ? "Video"
                : filters.kind === "image"
                  ? "Foto"
                  : "Jenis"}
            </span>
          </button>
        )}

        {/* Chip Favorit */}
        {!hideFavorite && (
          <button
            type="button"
            onClick={() => onChange({ favorite: !filters.favorite || undefined })}
            className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-caption font-medium transition-colors ${
              filters.favorite
                ? "border border-accent/40 bg-accent-soft text-accent"
                : "border border-line bg-surface text-ink-muted hover:border-ink-muted hover:text-ink"
            }`}
            aria-pressed={Boolean(filters.favorite)}
            aria-label="Filter favorit"
          >
            <Star
              size={14}
              className={`shrink-0 ${filters.favorite ? "fill-amber-400 text-amber-400" : ""}`}
            />
            <span>Favorit</span>
          </button>
        )}

        {/* Chip Live Photo */}
        <button
          type="button"
          onClick={() => onChange({ live: !filters.live || undefined })}
          className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-caption font-medium transition-colors ${
            filters.live
              ? "border border-accent/40 bg-accent-soft text-accent"
              : "border border-line bg-surface text-ink-muted hover:border-ink-muted hover:text-ink"
          }`}
          aria-pressed={Boolean(filters.live)}
          aria-label="Filter Live Photo"
        >
          <CircleDot size={14} className="shrink-0" />
          <span>Live</span>
        </button>

        {/* Chip Belum di Album */}
        <button
          type="button"
          onClick={() => onChange({ unalbumed: !filters.unalbumed || undefined })}
          className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-caption font-medium transition-colors ${
            filters.unalbumed
              ? "border border-accent/40 bg-accent-soft text-accent"
              : "border border-line bg-surface text-ink-muted hover:border-ink-muted hover:text-ink"
          }`}
          aria-pressed={Boolean(filters.unalbumed)}
          aria-label="Filter file belum masuk album"
        >
          <Album size={14} className="shrink-0" />
          <span>Belum di album</span>
        </button>

        {/* Chip Tempat */}
        <button
          type="button"
          onClick={() => {
            setTempPlace(filters.place || "");
            setShowPlaceSheet(true);
          }}
          className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-caption font-medium transition-colors ${
            filters.place
              ? "border border-accent/40 bg-accent-soft text-accent"
              : "border border-line bg-surface text-ink-muted hover:border-ink-muted hover:text-ink"
          }`}
          aria-label="Filter lokasi / tempat"
        >
          <MapPin size={14} className="shrink-0" />
          <span>{filters.place ? filters.place : "Tempat"}</span>
        </button>

        {/* Chip Tanggal */}
        <button
          type="button"
          onClick={() => {
            setTempFrom(filters.from || "");
            setTempTo(filters.to || "");
            setShowDateSheet(true);
          }}
          className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-caption font-medium transition-colors ${
            filters.from || filters.to
              ? "border border-accent/40 bg-accent-soft text-accent"
              : "border border-line bg-surface text-ink-muted hover:border-ink-muted hover:text-ink"
          }`}
          aria-label="Filter rentang tanggal"
        >
          <Calendar size={14} className="shrink-0" />
          <span>
            {filters.from || filters.to
              ? `${filters.from || "..."} - ${filters.to || "..."}`
              : "Tanggal"}
          </span>
        </button>

        {/* Chip Duplikat */}
        <button
          type="button"
          onClick={() => onChange({ duplicates: !filters.duplicates || undefined })}
          className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-caption font-medium transition-colors ${
            filters.duplicates
              ? "border border-accent/40 bg-accent-soft text-accent"
              : "border border-line bg-surface text-ink-muted hover:border-ink-muted hover:text-ink"
          }`}
          aria-pressed={Boolean(filters.duplicates)}
          aria-label="Filter foto kembar / duplikat"
        >
          <Copy size={14} className="shrink-0" />
          <span>Duplikat</span>
        </button>

        {/* Tombol Hapus Filter */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-full bg-sunken px-3 py-1.5 text-caption font-medium text-danger hover:bg-danger-soft transition-colors"
            title="Hapus semua filter"
            aria-label="Hapus semua filter"
          >
            <RotateCcw size={13} />
            <span>Reset</span>
          </button>
        )}
      </div>

      {/* Bottom Sheet: Urutkan */}
      {showSortSheet && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Urutkan galeri"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-scrim p-0 sm:p-4 backdrop-blur-xs"
          onClick={() => setShowSortSheet(false)}
        >
          <div
            className="flex max-h-[85dvh] w-full max-w-sm flex-col rounded-t-2xl sm:rounded-2xl border border-line bg-surface p-4 shadow-float animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <h3 className="text-label font-bold text-ink">Urutkan Media</h3>
              <button
                type="button"
                onClick={() => setShowSortSheet(false)}
                className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-ink hover:bg-sunken"
                aria-label="Tutup"
              >
                <X size={20} strokeWidth={1.5} />
              </button>
            </div>

            <div className="flex flex-col py-2">
              {(Object.keys(SORT_LABELS) as SortOption[]).map((key) => {
                const isSelected = filters.sort === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      onChange({ sort: key });
                      setShowSortSheet(false);
                    }}
                    className={`flex min-h-11 items-center justify-between px-3 py-2.5 rounded-lg text-body text-left transition-colors ${
                      isSelected
                        ? "bg-accent-soft text-accent font-semibold"
                        : "text-ink hover:bg-sunken"
                    }`}
                  >
                    <span>{SORT_LABELS[key]}</span>
                    {isSelected && <Check size={18} className="text-accent" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Sheet: Filter Jenis */}
      {showKindSheet && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Pilih jenis media"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-scrim p-0 sm:p-4 backdrop-blur-xs"
          onClick={() => setShowKindSheet(false)}
        >
          <div
            className="flex w-full max-w-sm flex-col rounded-t-2xl sm:rounded-2xl border border-line bg-surface p-4 shadow-float animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <h3 className="text-label font-bold text-ink">Jenis Media</h3>
              <button
                type="button"
                onClick={() => setShowKindSheet(false)}
                className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-ink hover:bg-sunken"
                aria-label="Tutup"
              >
                <X size={20} strokeWidth={1.5} />
              </button>
            </div>

            <div className="flex flex-col py-2 gap-1">
              {[
                { label: "Semua Media", value: undefined },
                { label: "Foto saja", value: "image" as const },
                { label: "Video saja", value: "video" as const },
              ].map((opt) => {
                const isSelected = filters.kind === opt.value;
                return (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => {
                      onChange({ kind: opt.value });
                      setShowKindSheet(false);
                    }}
                    className={`flex min-h-11 items-center justify-between px-3 py-2.5 rounded-lg text-body text-left transition-colors ${
                      isSelected
                        ? "bg-accent-soft text-accent font-semibold"
                        : "text-ink hover:bg-sunken"
                    }`}
                  >
                    <span>{opt.label}</span>
                    {isSelected && <Check size={18} className="text-accent" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Sheet: Filter Tempat */}
      {showPlaceSheet && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Filter tempat"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-scrim p-0 sm:p-4 backdrop-blur-xs"
          onClick={() => setShowPlaceSheet(false)}
        >
          <div
            className="flex w-full max-w-md flex-col rounded-t-2xl sm:rounded-2xl border border-line bg-surface p-5 shadow-float animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <div className="flex items-center gap-2">
                <MapPin size={18} className="text-accent" />
                <h3 className="text-label font-bold text-ink">Filter Tempat</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPlaceSheet(false)}
                className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-ink hover:bg-sunken"
                aria-label="Tutup"
              >
                <X size={20} strokeWidth={1.5} />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                onChange({ place: tempPlace.trim() || undefined });
                setShowPlaceSheet(false);
              }}
              className="flex flex-col gap-4 pt-4"
            >
              <div>
                <label htmlFor="input-filter-tempat" className="text-caption font-medium text-ink-muted mb-1 block">
                  Nama Kota, Provinsi, atau Negara
                </label>
                <input
                  id="input-filter-tempat"
                  type="text"
                  value={tempPlace}
                  onChange={(e) => setTempPlace(e.target.value)}
                  placeholder="Misal: Bandung, Bali, Indonesia"
                  className="min-h-11 w-full rounded-lg border border-line bg-sunken/40 px-3 py-2 text-body text-ink outline-none transition-colors focus:border-accent"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                {filters.place && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setTempPlace("");
                      onChange({ place: undefined });
                      setShowPlaceSheet(false);
                    }}
                    className="min-h-11 text-caption text-danger"
                  >
                    Hapus
                  </Button>
                )}
                <Button type="submit" variant="primary" className="min-h-11 px-5">
                  Terapkan
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sheet: Filter Rentang Tanggal */}
      {showDateSheet && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Filter rentang tanggal"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-scrim p-0 sm:p-4 backdrop-blur-xs"
          onClick={() => setShowDateSheet(false)}
        >
          <div
            className="flex w-full max-w-md flex-col rounded-t-2xl sm:rounded-2xl border border-line bg-surface p-5 shadow-float animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <div className="flex items-center gap-2">
                <Calendar size={18} className="text-accent" />
                <h3 className="text-label font-bold text-ink">Rentang Tanggal</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowDateSheet(false)}
                className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-ink hover:bg-sunken"
                aria-label="Tutup"
              >
                <X size={20} strokeWidth={1.5} />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                onChange({
                  from: tempFrom || undefined,
                  to: tempTo || undefined,
                });
                setShowDateSheet(false);
              }}
              className="flex flex-col gap-4 pt-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="input-filter-dari" className="text-caption font-medium text-ink-muted mb-1 block">
                    Dari Tanggal
                  </label>
                  <input
                    id="input-filter-dari"
                    type="date"
                    value={tempFrom}
                    onChange={(e) => setTempFrom(e.target.value)}
                    className="min-h-11 w-full rounded-lg border border-line bg-sunken/40 px-3 py-2 text-caption text-ink outline-none transition-colors focus:border-accent"
                  />
                </div>
                <div>
                  <label htmlFor="input-filter-sampai" className="text-caption font-medium text-ink-muted mb-1 block">
                    Sampai Tanggal
                  </label>
                  <input
                    id="input-filter-sampai"
                    type="date"
                    value={tempTo}
                    onChange={(e) => setTempTo(e.target.value)}
                    className="min-h-11 w-full rounded-lg border border-line bg-sunken/40 px-3 py-2 text-caption text-ink outline-none transition-colors focus:border-accent"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                {(filters.from || filters.to) && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setTempFrom("");
                      setTempTo("");
                      onChange({ from: undefined, to: undefined });
                      setShowDateSheet(false);
                    }}
                    className="min-h-11 text-caption text-danger"
                  >
                    Hapus
                  </Button>
                )}
                <Button type="submit" variant="primary" className="min-h-11 px-5">
                  Terapkan
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

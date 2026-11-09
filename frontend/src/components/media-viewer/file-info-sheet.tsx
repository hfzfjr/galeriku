"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { FileDetail, FileItem } from "@galeriku/contracts";
import {
  Calendar,
  Camera,
  Check,
  Clock,
  ExternalLink,
  HardDrive,
  MapPin,
  Maximize2,
} from "lucide-react";
import { getFileDetail, updateFileCapturedAt } from "@/lib/api";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/format-bytes";
import { getPhotoDateGroup } from "@/lib/date-group";

interface FileInfoSheetProps {
  open: boolean;
  onClose: () => void;
  file: FileItem;
  isOwner: boolean;
  onDateUpdated?: (updatedFile: FileItem) => void;
}

function formatExposure(s?: number | null): string | null {
  if (s == null || isNaN(s)) return null;
  if (s >= 1) return `${s}s`;
  const denominator = Math.round(1 / s);
  return `1/${denominator}s`;
}

export function FileInfoSheet({
  open,
  onClose,
  file,
  isOwner,
  onDateUpdated,
}: FileInfoSheetProps) {
  const queryClient = useQueryClient();

  const { data: detail, isLoading: isLoadingDetail } = useQuery({
    queryKey: ["file-detail", file.id],
    queryFn: () => getFileDetail(file.id),
    enabled: open && isOwner,
  });

  // Edit captured at state
  const [isEditingDate, setIsEditingDate] = useState(false);
  const [editDateValue, setEditDateValue] = useState("");
  const [isSavingDate, setIsSavingDate] = useState(false);
  const [saveDateError, setSaveDateError] = useState<string | null>(null);

  const handleClose = () => {
    setIsEditingDate(false);
    setSaveDateError(null);
    onClose();
  };

  const activeData: FileItem | FileDetail = detail ?? file;

  const dateInfo = getPhotoDateGroup(
    activeData.capturedAt || activeData.createdAt,
    activeData.capturedTzOffsetMin,
  );

  const startEditDate = () => {
    const d = new Date(activeData.capturedAt || activeData.createdAt);
    // Format YYYY-MM-DDTHH:mm untuk datetime-local
    const pad = (n: number) => String(n).padStart(2, "0");
    const localIso = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(
      d.getUTCDate(),
    )}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
    setEditDateValue(localIso);
    setIsEditingDate(true);
    setSaveDateError(null);
  };

  const handleSaveDate = async () => {
    if (!editDateValue) return;
    setIsSavingDate(true);
    setSaveDateError(null);
    try {
      const [datePart, timePart] = editDateValue.split("T");
      const [y, m, day] = datePart.split("-").map(Number);
      const [h, min] = timePart.split(":").map(Number);
      const utcIso = new Date(Date.UTC(y, m - 1, day, h, min, 0)).toISOString();
      const updated = await updateFileCapturedAt(file.id, {
        capturedAt: utcIso,
      });
      if (onDateUpdated) {
        onDateUpdated(updated);
      }
      queryClient.invalidateQueries({ queryKey: ["file-detail", file.id] });
      queryClient.invalidateQueries({ queryKey: ["files"] });
      setIsEditingDate(false);
    } catch {
      setSaveDateError("Gagal mengubah tanggal. Coba lagi.");
    } finally {
      setIsSavingDate(false);
    }
  };

  // Source label
  const getSourceLabel = (src?: string) => {
    switch (src) {
      case "manual":
        return "Diubah manual";
      case "exif":
        return "EXIF kamera";
      case "filename":
        return "Pola nama file";
      case "client_last_modified":
        return "Waktu modifikasi berkas";
      case "upload":
        return "Waktu unggah (diperkirakan)";
      default:
        return null;
    }
  };

  const cameraMake = detail?.cameraMake || file.cameraMake;
  const cameraModel = detail?.cameraModel || file.cameraModel;
  const lensModel = detail?.lensModel || file.lensModel;
  const iso = detail?.iso ?? file.iso;
  const fNumber = detail?.fNumber ?? file.fNumber;
  const exposureS = detail?.exposureS ?? file.exposureS;
  const focalLengthMm = detail?.focalLengthMm ?? file.focalLengthMm;

  const hasCameraInfo = Boolean(cameraMake || cameraModel || iso || fNumber || exposureS || focalLengthMm);

  const gpsLat = detail?.gpsLat;
  const gpsLng = detail?.gpsLng;
  const hasGps = gpsLat != null && gpsLng != null;

  return (
    <Sheet open={open} onClose={handleClose} title="Info Detail">
      <div className="space-y-6 text-body">
        {/* Nama File */}
        <div>
          <h3 className="text-h3 font-serif italic text-ink break-words">
            {file.originalName}
          </h3>
          <p className="text-caption text-ink-muted mt-0.5">
            {file.kind === "video" ? "Video" : "Foto"} · {file.mimeType}
          </p>
        </div>

        {/* Tanggal & Waktu Pengambilan */}
        <div className="rounded-xl border border-line bg-surface p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <Calendar
                size={20}
                strokeWidth={1.5}
                className="text-accent shrink-0 mt-0.5"
              />
              <div>
                <p className="font-medium text-ink">
                  {dateInfo.displayDate}
                </p>
                <p className="text-caption text-ink-muted">
                  Pukul {dateInfo.formattedTime}
                  {activeData.capturedTzOffsetMin != null && (
                    <span className="ml-1 text-ink-muted/80">
                      (GMT{activeData.capturedTzOffsetMin >= 0 ? "+" : ""}
                      {(activeData.capturedTzOffsetMin / 60).toFixed(0)})
                    </span>
                  )}
                </p>
                {activeData.capturedAtSource && (
                  <p className="text-[12px] text-accent mt-0.5">
                    {getSourceLabel(activeData.capturedAtSource)}
                  </p>
                )}
              </div>
            </div>

            {isOwner && !isEditingDate && (
              <Button
                type="button"
                variant="ghost"
                onClick={startEditDate}
                className="shrink-0 text-accent hover:text-accent-hover text-caption px-2 py-1 h-auto"
              >
                Ubah tanggal
              </Button>
            )}
          </div>

          {/* Form Ubah Tanggal */}
          {isEditingDate && (
            <div className="pt-2 border-t border-line space-y-2">
              <label
                htmlFor="input-edit-date"
                className="block text-caption font-medium text-ink"
              >
                Pilih tanggal & jam baru:
              </label>
              <input
                id="input-edit-date"
                type="datetime-local"
                value={editDateValue}
                onChange={(e) => setEditDateValue(e.target.value)}
                className="w-full rounded-md border border-line bg-paper px-3 py-2 text-label text-ink focus:border-accent focus:outline-none"
              />
              {saveDateError && (
                <p className="text-caption text-danger">{saveDateError}</p>
              )}
              <div className="flex justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsEditingDate(false)}
                  disabled={isSavingDate}
                  className="px-3 py-1.5 h-auto text-caption"
                >
                  Batal
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  onClick={handleSaveDate}
                  loading={isSavingDate}
                  className="gap-1.5 px-3 py-1.5 h-auto text-caption"
                >
                  <Check size={16} strokeWidth={1.5} />
                  Simpan
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Lokasi */}
        <div className="rounded-xl border border-line bg-surface p-4 flex items-start gap-3">
          <MapPin
            size={20}
            strokeWidth={1.5}
            className="text-accent shrink-0 mt-0.5"
          />
          <div className="flex-1">
            <p className="font-medium text-ink">
              {activeData.place || "Tanpa lokasi"}
            </p>
            {hasGps && (
              <div className="mt-1 flex items-center gap-2">
                <p className="text-caption font-mono text-ink-muted">
                  {gpsLat?.toFixed(4)}°, {gpsLng?.toFixed(4)}°
                </p>
                <a
                  href={`https://maps.google.com/?q=${gpsLat},${gpsLng}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1 text-[12px] text-accent hover:underline"
                >
                  Buka peta <ExternalLink size={12} strokeWidth={1.5} />
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Detail Kamera & Pengambilan */}
        {hasCameraInfo && (
          <div className="rounded-xl border border-line bg-surface p-4 space-y-3">
            <div className="flex items-start gap-3">
              <Camera
                size={20}
                strokeWidth={1.5}
                className="text-accent shrink-0 mt-0.5"
              />
              <div className="flex-1">
                {(cameraMake || cameraModel) && (
                  <p className="font-medium text-ink">
                    {[cameraMake, cameraModel].filter(Boolean).join(" ")}
                  </p>
                )}
                {lensModel && (
                  <p className="text-caption text-ink-muted">{lensModel}</p>
                )}
              </div>
            </div>

            {/* Setelan Kamera */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-line text-caption">
              {focalLengthMm != null && (
                <div>
                  <span className="text-ink-muted block">Panjang fokus</span>
                  <span className="font-medium text-ink font-mono">
                    {focalLengthMm} mm
                  </span>
                </div>
              )}
              {fNumber != null && (
                <div>
                  <span className="text-ink-muted block">Bukaan</span>
                  <span className="font-medium text-ink font-mono">
                    f/{fNumber}
                  </span>
                </div>
              )}
              {exposureS != null && (
                <div>
                  <span className="text-ink-muted block">Kecepatan</span>
                  <span className="font-medium text-ink font-mono">
                    {formatExposure(exposureS)}
                  </span>
                </div>
              )}
              {iso != null && (
                <div>
                  <span className="text-ink-muted block">ISO</span>
                  <span className="font-medium text-ink font-mono">
                    {iso}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Spesifikasi Berkas */}
        <div className="rounded-xl border border-line bg-surface p-4 space-y-3">
          <div className="flex items-center gap-3">
            <Maximize2
              size={20}
              strokeWidth={1.5}
              className="text-accent shrink-0"
            />
            <div className="flex-1">
              <p className="font-medium text-ink">
                {activeData.width && activeData.height
                  ? `${activeData.width} × ${activeData.height}`
                  : "Resolusi tidak diketahui"}
              </p>
              {activeData.width && activeData.height && (
                <p className="text-caption text-ink-muted">
                  {((activeData.width * activeData.height) / 1_000_000).toFixed(1)} MP
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-line text-caption">
            <div className="flex items-start gap-2">
              <HardDrive size={16} strokeWidth={1.5} className="text-ink-muted shrink-0 mt-0.5" />
              <div>
                <span className="text-ink-muted block">Ukuran berkas</span>
                <span className="font-medium text-ink font-mono">
                  {formatBytes(activeData.sizeBytes)}
                </span>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <Clock size={16} strokeWidth={1.5} className="text-ink-muted shrink-0 mt-0.5" />
              <div>
                <span className="text-ink-muted block">Diunggah pada</span>
                <span className="font-medium text-ink">
                  {new Date(activeData.createdAt).toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </div>
            </div>
          </div>
        </div>

        {isLoadingDetail && (
          <p className="text-caption text-center text-ink-muted animate-pulse">
            Memuat detail lanjutan...
          </p>
        )}
      </div>
    </Sheet>
  );
}

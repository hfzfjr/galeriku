// SEMENTARA (spike US-16): halaman uji tus, dihapus di US-17.
// Mengunggah satu file langsung ke host API (tidak lewat Vercel).
"use client";

import { useRef, useState } from "react";
import { Upload } from "tus-js-client";
import { Button } from "@/components/ui/button";

const CHUNK_SIZE = 5242880;
const RETRY_DELAYS = [0, 1000, 3000, 5000];

function getEndpoint(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/+$/, "");
  const base = raw && raw.length > 0 ? raw : "http://localhost:4000";
  return `${base}/uploads`;
}

function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "0 B";
  if (n < 1024) return `${n} B`;
  const kb = n / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(2)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

function formatSpeed(bytesPerSec: number): string {
  if (!Number.isFinite(bytesPerSec) || bytesPerSec <= 0) return "-";
  return `${formatBytes(bytesPerSec)}/dtk`;
}

function ambilIdDariUrl(url: string): string {
  return (url.split("/").pop() ?? "").split("?")[0];
}

type Fase = "siap" | "mengunggah" | "jeda" | "selesai" | "gagal" | "dibatalkan";

export function UjiUploadClient() {
  const [namaBerkas, setNamaBerkas] = useState("");
  const [fase, setFase] = useState<Fase>("siap");
  const [terkirim, setTerkirim] = useState(0);
  const [total, setTotal] = useState(0);
  const [kecepatan, setKecepatan] = useState(0);
  const [lokasi, setLokasi] = useState("");
  const [galat, setGalat] = useState("");
  const uploadRef = useRef<Upload | null>(null);
  const berkasRef = useRef<File | null>(null);
  const mulaiRef = useRef(0);
  const terkirimRef = useRef(0);

  const persen =
    total > 0 ? Math.min(100, Math.round((terkirim / total) * 100)) : 0;

  function buatUpload(berkas: File): Upload {
    return new Upload(berkas, {
      endpoint: getEndpoint(),
      chunkSize: CHUNK_SIZE,
      retryDelays: RETRY_DELAYS,
      storeFingerprintForResuming: true,
      metadata: { filename: berkas.name || "tanpa-nama" },
      onBeforeRequest: (req) => {
        const xhr = req.getUnderlyingObject() as
          | { withCredentials?: boolean }
          | null
          | undefined;
        if (xhr && typeof xhr === "object") {
          xhr.withCredentials = true;
        }
      },
      onUploadUrlAvailable: () => {
        const url = uploadRef.current?.url ?? "";
        if (url) setLokasi(url);
      },
      onProgress: (terkirimByte, totalByte) => {
        const kini = Date.now();
        const durasi = (kini - (mulaiRef.current || kini)) / 1000;
        setTerkirim(terkirimByte);
        setTotal(totalByte);
        terkirimRef.current = terkirimByte;
        if (durasi > 0) setKecepatan(terkirimByte / durasi);
      },
      onSuccess: () => {
        const url = uploadRef.current?.url ?? "";
        setLokasi(url);
        setFase("selesai");
        setGalat("");
      },
      onError: (err) => {
        setFase("gagal");
        setGalat(err instanceof Error ? `${err.name}: ${err.message}` : String(err));
      },
    });
  }

  function pilihBerkas(berkas: File | null) {
    berkasRef.current = berkas;
    setNamaBerkas(berkas?.name ?? "");
    setTerkirim(0);
    setTotal(berkas?.size ?? 0);
    setKecepatan(0);
    setLokasi("");
    setGalat("");
    setFase("siap");
    uploadRef.current = null;
  }

  function mulai() {
    const berkas = berkasRef.current;
    if (!berkas) {
      setGalat("Pilih dulu berkasnya.");
      return;
    }
    setGalat("");
    setLokasi("");
    setTerkirim(0);
    setTotal(berkas.size);
    setKecepatan(0);
    mulaiRef.current = Date.now();
    terkirimRef.current = 0;
    const unggah = buatUpload(berkas);
    uploadRef.current = unggah;
    setFase("mengunggah");
    unggah.start();
  }

  async function jeda() {
    const unggah = uploadRef.current;
    if (!unggah) return;
    await unggah.abort(false);
    setFase("jeda");
  }

  function lanjutkan() {
    const unggah = uploadRef.current;
    if (!unggah) return;
    setFase("mengunggah");
    setGalat("");
    unggah.start();
  }

  async function batalkan() {
    const unggah = uploadRef.current;
    if (!unggah) return;
    await unggah.abort(true);
    uploadRef.current = null;
    setFase("dibatalkan");
  }

  return (
    <main className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-h1 text-ink">Uji upload</h1>
        <p className="text-body text-ink-muted">
          Halaman sementara untuk mencoba resumable upload langsung ke API.
        </p>
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-4">
        <label htmlFor="uji-upload-berkas" className="text-label text-ink">
          Berkas (satu file, semua tipe untuk uji spike)
        </label>
        <input
          id="uji-upload-berkas"
          type="file"
          className="min-h-11 w-full text-body text-ink"
          onChange={(e) => pilihBerkas(e.target.files?.[0] ?? null)}
        />
        {namaBerkas ? (
          <p className="text-caption text-ink-muted">
            {namaBerkas} · {formatBytes(total)}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="primary"
          onClick={mulai}
          disabled={!namaBerkas || fase === "mengunggah"}
          aria-label="Mulai unggah"
        >
          Mulai
        </Button>
        <Button
          variant="secondary"
          onClick={jeda}
          disabled={fase !== "mengunggah"}
          aria-label="Jeda unggah"
        >
          Jeda
        </Button>
        <Button
          variant="secondary"
          onClick={lanjutkan}
          disabled={fase !== "jeda" && fase !== "gagal"}
          aria-label="Lanjutkan unggah"
        >
          Lanjutkan
        </Button>
        <Button
          variant="ghost"
          onClick={batalkan}
          disabled={fase !== "mengunggah" && fase !== "jeda"}
          aria-label="Batalkan unggah"
        >
          Batalkan
        </Button>
      </div>

      <div
        className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-4"
        aria-live="polite"
      >
        <p className="text-label text-ink">
          {fase === "mengunggah"
            ? `Mengunggah… ${persen}%`
            : fase === "selesai"
              ? "Selesai"
              : fase === "jeda"
                ? `Jeda · ${persen}%`
                : fase === "gagal"
                  ? "Gagal"
                  : fase === "dibatalkan"
                    ? "Dibatalkan"
                    : "Belum mulai"}
        </p>
        <div
          className="h-1 w-full overflow-hidden rounded-full bg-line"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={persen}
          aria-label="Progres unggah"
        >
          <div
            className="h-full bg-accent transition-[width] duration-150"
            style={{ width: `${persen}%` }}
          />
        </div>
        <p className="text-caption text-ink-muted">
          {formatBytes(terkirim)} dari {formatBytes(total)} · {formatSpeed(kecepatan)}
        </p>
        {lokasi ? (
          <div className="flex flex-col gap-1">
            <p className="text-caption text-ink-muted">Location/ID upload:</p>
            <p className="break-all text-body text-ink">{lokasi}</p>
            <p className="text-caption text-ink-muted">
              ID: {ambilIdDariUrl(lokasi)}
            </p>
          </div>
        ) : null}
        {galat ? (
          <p role="alert" className="break-all text-body text-danger">
            {galat}
          </p>
        ) : null}
      </div>
    </main>
  );
}

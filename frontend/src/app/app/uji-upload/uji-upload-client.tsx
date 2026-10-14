"use client";

// SEMENTARA (US-16): halaman uji manual upload tus. Dihapus di US-17 saat
// alur upload asli dibangun. Byte file langsung ke host API (tidak lewat
// Vercel/Next.js) dengan cookie sesi (withCredentials).

import { useRef, useState } from "react";
import { Upload } from "tus-js-client";
import { Button } from "@/components/ui/button";

const CHUNK_SIZE = 5242880; // 5 MB, sama dengan PRD §14.

type Status = "idle" | "mengunggah" | "jeda" | "selesai" | "gagal";

function dapatkanEndpoint(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/+$/, "");
  const dasar =
    raw && raw.length > 0 ? raw : "http://localhost:4000";
  return `${dasar}/uploads`;
}

function formatByte(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "0 B";
  const satuan = ["B", "KB", "MB", "GB"];
  let nilai = n;
  let i = 0;
  while (nilai >= 1024 && i < satuan.length - 1) {
    nilai /= 1024;
    i += 1;
  }
  return `${nilai.toFixed(nilai >= 100 || i === 0 ? 0 : 1)} ${satuan[i]}`;
}

export function UjiUploadClient() {
  const [namaBerkas, setNamaBerkas] = useState<string>("");
  const [ukuranBerkas, setUkuranBerkas] = useState(0);
  const [status, setStatus] = useState<Status>("idle");
  const [terkirim, setTerkirim] = useState(0);
  const [total, setTotal] = useState(0);
  const [kecepatan, setKecepatan] = useState(0);
  const [location, setLocation] = useState("");
  const [galat, setGalat] = useState("");
  const unggahRef = useRef<Upload | null>(null);
  const berkasRef = useRef<File | null>(null);
  const lajuRef = useRef({ byte: 0, waktu: 0 });

  const persen =
    total > 0 ? Math.min(100, Math.round((terkirim / total) * 100)) : 0;

  function mulai() {
    const berkas = berkasRef.current;
    if (!berkas) {
      setGalat("Pilih berkas dulu.");
      return;
    }
    setGalat("");
    setLocation("");
    lajuRef.current = { byte: 0, waktu: Date.now() };
    const unggah = new Upload(berkas, {
      endpoint: dapatkanEndpoint(),
      chunkSize: CHUNK_SIZE,
      retryDelays: [0, 1000, 3000, 5000],
      storeFingerprintForResuming: true,
      metadata: {
        filename: berkas.name,
        filetype: berkas.type || "application/octet-stream",
      },
      onBeforeRequest(req) {
        // Cookie sesi HttpOnly ikut terkirim (same-site + CORS credentials).
        const xhr = req.getUnderlyingObject() as unknown as {
          withCredentials?: boolean;
        } | null;
        if (xhr) {
          xhr.withCredentials = true;
        }
      },
      onProgress(terkirimByte, totalByte) {
        setTerkirim(terkirimByte);
        setTotal(totalByte);
        const sekarang = Date.now();
        const lalu = lajuRef.current;
        const dt = (sekarang - lalu.waktu) / 1000;
        if (dt >= 0.5) {
          setKecepatan((terkirimByte - lalu.byte) / dt);
          lajuRef.current = { byte: terkirimByte, waktu: sekarang };
        }
      },
      onSuccess() {
        setStatus("selesai");
        setLocation(unggah.url ?? "");
      },
      onError(err) {
        setStatus("gagal");
        setGalat(err instanceof Error ? err.message : String(err));
      },
    });
    unggahRef.current = unggah;
    setStatus("mengunggah");
    unggah.start();
  }

  function jeda() {
    unggahRef.current?.abort();
    setStatus("jeda");
  }

  function lanjutkan() {
    setStatus("mengunggah");
    unggahRef.current?.start();
  }

  function batalkan() {
    // Batal di sisi klien saja (upload di server tetap ada untuk spike).
    unggahRef.current?.abort();
    unggahRef.current = null;
    setStatus("idle");
    setTerkirim(0);
    setTotal(0);
    setKecepatan(0);
  }

  const idUpload = location.split("/").filter(Boolean).pop() ?? "";

  return (
    <main className="flex flex-col gap-4">
      <div>
        <h1 className="text-h1 text-ink">Uji Upload</h1>
        <p className="text-body text-ink-muted">
          Halaman sementara untuk mencoba upload resumable langsung ke host
          API.
        </p>
      </div>

      <label
        htmlFor="uji-upload-berkas"
        className="text-label text-ink"
      >
        Berkas
      </label>
      <input
        id="uji-upload-berkas"
        type="file"
        aria-label="Pilih berkas untuk diunggah"
        className="min-h-11 w-full rounded-md border border-line bg-surface px-4 py-3 text-base text-ink"
        onChange={(e) => {
          const dipilih = e.target.files?.[0] ?? null;
          berkasRef.current = dipilih;
          setNamaBerkas(dipilih?.name ?? "");
          setUkuranBerkas(dipilih?.size ?? 0);
          setStatus("idle");
          setTerkirim(0);
          setTotal(dipilih?.size ?? 0);
          setGalat("");
          setLocation("");
        }}
      />
      {namaBerkas ? (
        <p className="text-body text-ink-muted">
          {namaBerkas} · {formatByte(ukuranBerkas)}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          variant="primary"
          disabled={status === "mengunggah" || !namaBerkas}
          onClick={mulai}
        >
          Mulai
        </Button>
        <Button
          variant="secondary"
          disabled={status !== "mengunggah"}
          onClick={jeda}
        >
          Jeda
        </Button>
        <Button
          variant="secondary"
          disabled={status !== "jeda" && status !== "gagal"}
          onClick={lanjutkan}
        >
          Lanjutkan
        </Button>
        <Button
          variant="secondary"
          disabled={status !== "mengunggah" && status !== "jeda"}
          onClick={batalkan}
        >
          Batalkan
        </Button>
      </div>

      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={persen}
        aria-label="Progres upload"
        className="h-1 w-full overflow-hidden rounded-full bg-line"
      >
        <div
          className="h-full rounded-full bg-accent transition-[width]"
          style={{ width: `${persen}%` }}
        />
      </div>
      <p className="text-body text-ink" aria-live="polite">
        {persen}% · {formatByte(terkirim)} dari {formatByte(total)} ·{" "}
        {formatByte(kecepatan)}/dtk · {status}
      </p>

      {location ? (
        <p className="text-body text-ink">
          Location:{" "}
          <span className="break-all font-mono text-sm">{location}</span>
          {idUpload ? (
            <span className="mt-1 block text-sm text-ink-muted">
              ID: {idUpload}
            </span>
          ) : null}
        </p>
      ) : null}

      {galat ? (
        <p role="alert" className="text-body text-danger">
          Galat: {galat}
        </p>
      ) : null}
    </main>
  );
}

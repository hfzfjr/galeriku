"use client";

// US-17: upload banyak file sekaligus yang bisa dilanjutkan (tus).
// Byte file langsung ke host API (tidak lewat Vercel/Next.js) dengan
// cookie sesi (withCredentials). Daftar file galeri (GET /files)
// menyusul di US-20; halaman ini hanya menampilkan upload yang berjalan.

import { useEffect, useRef, useState } from "react";
import { Upload } from "tus-js-client";
import { useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronUp,
  CircleAlert,
  FileImage,
  Film,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Upload as IkonUnggah,
  WifiOff,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { GalleryGrid } from "@/components/gallery/gallery-grid";

const CHUNK_SIZE = 5242880; // 5 MB, sama dengan PRD.
const MAKS_PARALEL = 2;
const TUS_VERSION = "1.0.0";
const MAKS_FOTO_BYTE = 26214400; // 25 MB (US-18)
const MAKS_VIDEO_BYTE = 2147483648; // 2 GB (US-18)

const EXT_FOTO = new Set(["jpg", "jpeg", "png", "webp", "gif", "heic", "heif"]);
const EXT_VIDEO = new Set(["mp4", "mov", "webm", "m4v"]);
const EXT_DIIZINKAN = new Set([...EXT_FOTO, ...EXT_VIDEO]);

type StatusItem =
  | "menunggu"
  | "mengunggah"
  | "jeda"
  | "menunggu-jaringan"
  | "selesai"
  | "gagal";

type ItemUpload = {
  id: string;
  nama: string;
  ukuran: number;
  tipe: string;
  pratinjau: string | null;
  status: StatusItem;
  terkirim: number;
  total: number;
  galat: string;
};

function dapatkanEndpoint(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/+$/, "");
  const dasar = raw && raw.length > 0 ? raw : "http://localhost:4000";
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

function daring(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

// Galat tus mentah (kode HTTP, stack) tidak ditampilkan ke pengguna (US-18).
function pesanGalatRamah(err: unknown): string {
  if (!daring()) return "Koneksi terputus, akan dilanjutkan otomatis.";
  const teks = err instanceof Error ? err.message : String(err);
  if (/\b401\b|unauthorized/i.test(teks)) {
    return "Sesi habis. Masuk ulang lalu coba lagi.";
  }
  if (/\b415\b|unsupported|tidak didukung|svg/i.test(teks)) {
    if (/svg/i.test(teks)) return "Format SVG tidak diizinkan.";
    return "Format file tidak didukung.";
  }
  if (/\b413\b|too large|melebihi/i.test(teks)) {
    if (/foto/i.test(teks)) return "Ukuran foto melebihi batas 25 MB.";
    if (/video/i.test(teks)) return "Ukuran video melebihi batas 2 GB.";
    return "Berkas terlalu besar untuk diunggah.";
  }
  if (/\b403\b|quota|kuota|suspended|ditangguhkan/i.test(teks)) {
    if (/suspended|ditangguhkan/i.test(teks)) return "Akun Anda sedang ditangguhkan.";
    return "Sisa kuota penyimpanan tidak mencukupi.";
  }
  if (/\b507\b|insufficient|penyimpanan server/i.test(teks)) {
    return "Penyimpanan server hampir penuh. Coba lagi nanti.";
  }
  return "Upload gagal. Coba lagi.";
}

const TEKS_STATUS: Record<StatusItem, string> = {
  menunggu: "Menunggu",
  mengunggah: "Mengunggah",
  jeda: "Dijeda",
  "menunggu-jaringan": "Menunggu jaringan",
  selesai: "Selesai",
  gagal: "Gagal",
};

let hitungId = 0;

function buatId(): string {
  hitungId += 1;
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `unggah-${Date.now()}-${hitungId}`;
}

export function GaleriUploadClient() {
  const queryClient = useQueryClient();
  const [daftar, setDaftar] = useState<ItemUpload[]>([]);
  const [terbuka, setTerbuka] = useState(true);
  const masukanRef = useRef<HTMLInputElement | null>(null);
  const berkasRef = useRef(new Map<string, File>());
  const unggahRef = useRef(new Map<string, Upload>());
  const antreRef = useRef<string[]>([]);
  const aktifRef = useRef(0);

  function ubahItem(id: string, ubah: Partial<ItemUpload>) {
    setDaftar((sebelum) =>
      sebelum.map((item) =>
        item.id === id ? { ...item, ...ubah } : item,
      ),
    );
  }

  function prosesAntre() {
    if (!daring()) {
      // Tandai yang menunggu agar jelas, jangan mulai upload baru.
      setDaftar((sebelum) =>
        sebelum.map((item) =>
          item.status === "menunggu" || item.status === "mengunggah"
            ? { ...item, status: "menunggu-jaringan" as StatusItem }
            : item,
        ),
      );
      return;
    }
    while (aktifRef.current < MAKS_PARALEL && antreRef.current.length > 0) {
      const id = antreRef.current.shift();
      if (id === undefined) break;
      mulaiUpload(id);
    }
  }

  function mulaiUpload(id: string) {
    const berkas = berkasRef.current.get(id);
    if (!berkas) return;
    aktifRef.current += 1;
    ubahItem(id, { status: "mengunggah", galat: "" });
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
        ubahItem(id, { terkirim: terkirimByte, total: totalByte });
      },
      onSuccess() {
        unggahRef.current.delete(id);
        aktifRef.current = Math.max(0, aktifRef.current - 1);
        ubahItem(id, { status: "selesai", galat: "" });
        queryClient.invalidateQueries({ queryKey: ["files"] });
        prosesAntre();
      },
      onError(err) {
        unggahRef.current.delete(id);
        aktifRef.current = Math.max(0, aktifRef.current - 1);
        if (!daring()) {
          ubahItem(id, {
            status: "menunggu-jaringan",
            galat: "Koneksi terputus, akan dilanjutkan otomatis.",
          });
          return;
        }
        ubahItem(id, { status: "gagal", galat: pesanGalatRamah(err) });
        prosesAntre();
      },
    });
    unggahRef.current.set(id, unggah);
    unggah.start();
  }

  function tambahBerkas(pilihan: FileList | null) {
    if (!pilihan || pilihan.length === 0) return;
    const baru: ItemUpload[] = [];
    for (const berkas of Array.from(pilihan)) {
      const id = buatId();
      const nama = berkas.name || "Berkas tanpa nama";
      const ext = (nama.split(".").pop() ?? "").toLowerCase();
      const isVideo = EXT_VIDEO.has(ext) || berkas.type.startsWith("video/");
      const isSvg = ext === "svg" || berkas.type.includes("svg");

      let galatAwal = "";
      if (isSvg) {
        galatAwal = "Format SVG tidak diizinkan.";
      } else if (ext && !EXT_DIIZINKAN.has(ext)) {
        galatAwal = "Format file tidak didukung.";
      } else if (!isVideo && berkas.size > MAKS_FOTO_BYTE) {
        galatAwal = "Ukuran foto melebihi batas 25 MB.";
      } else if (isVideo && berkas.size > MAKS_VIDEO_BYTE) {
        galatAwal = "Ukuran video melebihi batas 2 GB.";
      }

      berkasRef.current.set(id, berkas);
      const pratinjau =
        !isSvg && berkas.type.startsWith("image/") && typeof URL !== "undefined"
          ? URL.createObjectURL(berkas)
          : null;
      baru.push({
        id,
        nama,
        ukuran: berkas.size,
        tipe: berkas.type,
        pratinjau,
        status: galatAwal ? "gagal" : "menunggu",
        terkirim: 0,
        total: berkas.size,
        galat: galatAwal,
      });
      if (!galatAwal) {
        antreRef.current.push(id);
      }
    }
    setDaftar((sebelum) => [...sebelum, ...baru]);
    setTerbuka(true);
    prosesAntre();
    if (masukanRef.current) {
      masukanRef.current.value = "";
    }
  }

  function jeda(id: string) {
    unggahRef.current.get(id)?.abort();
    unggahRef.current.delete(id);
    aktifRef.current = Math.max(0, aktifRef.current - 1);
    ubahItem(id, { status: "jeda" });
    prosesAntre();
  }

  function lanjutkan(id: string) {
    antreRef.current = antreRef.current.filter((x) => x !== id);
    antreRef.current.unshift(id);
    ubahItem(id, { galat: "" });
    prosesAntre();
  }

  function hapusItem(id: string) {
    const unggah = unggahRef.current.get(id);
    const url = unggah?.url;
    unggah?.abort();
    unggahRef.current.delete(id);
    if (url) {
      // Batal = hapus upload di server; abaikan hasilnya.
      void fetch(url, {
        method: "DELETE",
        credentials: "include",
        headers: { "Tus-Resumable": TUS_VERSION },
      }).catch(() => {});
    }
    antreRef.current = antreRef.current.filter((x) => x !== id);
    setDaftar((sebelum) => {
      const korban = sebelum.find((item) => item.id === id);
      if (korban?.pratinjau) {
        URL.revokeObjectURL(korban.pratinjau);
      }
      return sebelum.filter((item) => item.id !== id);
    });
    berkasRef.current.delete(id);
  }

  function batalkan(id: string, sedangJalan: boolean) {
    if (sedangJalan) {
      aktifRef.current = Math.max(0, aktifRef.current - 1);
    }
    hapusItem(id);
    prosesAntre();
  }

  // Lanjut otomatis saat koneksi kembali; tandai saat koneksi putus.
  useEffect(() => {
    const simpanUnggah = unggahRef.current;
    function saatLuring() {
      for (const unggah of unggahRef.current.values()) {
        unggah.abort();
      }
      unggahRef.current.clear();
      aktifRef.current = 0;
      setDaftar((sebelum) =>
        sebelum.map((item) =>
          item.status === "mengunggah" || item.status === "menunggu"
            ? {
                ...item,
                status: "menunggu-jaringan" as StatusItem,
                galat: "Koneksi terputus, akan dilanjutkan otomatis.",
              }
            : item,
        ),
      );
    }
    function saatDaring() {
      setDaftar((sebelum) => {
        const bangun = sebelum
          .filter((item) => item.status === "menunggu-jaringan")
          .map((item) => item.id);
        antreRef.current = [...bangun, ...antreRef.current];
        return sebelum.map((item) =>
          item.status === "menunggu-jaringan"
            ? { ...item, status: "menunggu" as StatusItem, galat: "" }
            : item,
        );
      });
      // antreRef diisi di dalam setDaftar; tunda proses ke tick berikut.
      window.setTimeout(() => prosesAntre(), 0);
    }
    window.addEventListener("offline", saatLuring);
    window.addEventListener("online", saatDaring);
    return () => {
      window.removeEventListener("offline", saatLuring);
      window.removeEventListener("online", saatDaring);
      for (const unggah of simpanUnggah.values()) {
        unggah.abort();
      }
      simpanUnggah.clear();
    };
    // Sengaja sekali pasang; prosesAntre stabil lewat ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalTerkirim = daftar.reduce((a, item) => a + item.terkirim, 0);
  const totalUkuran = daftar.reduce(
    (a, item) => a + (item.total > 0 ? item.total : item.ukuran),
    0,
  );
  const selesai = daftar.filter((item) => item.status === "selesai").length;
  const persen =
    totalUkuran > 0
      ? Math.min(100, Math.round((totalTerkirim / totalUkuran) * 100))
      : 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" onClick={() => masukanRef.current?.click()}>
          <IkonUnggah size={20} strokeWidth={1.5} aria-hidden="true" />
          Unggah
        </Button>
        <input
          ref={masukanRef}
          type="file"
          multiple
          accept="image/*,video/*"
          className="hidden"
          aria-label="Pilih foto atau video untuk diunggah"
          onChange={(e) => tambahBerkas(e.target.files)}
        />
      </div>

      <GalleryGrid onTriggerUpload={() => masukanRef.current?.click()} />

      {daftar.length > 0 ? (
        <section
          aria-label="Progres upload"
          className="fixed inset-x-4 bottom-[calc(56px+env(safe-area-inset-bottom)+16px)] z-20 rounded-lg border border-line bg-surface shadow-float lg:static lg:inset-auto lg:bottom-auto lg:z-auto"
        >
          <button
            type="button"
            aria-expanded={terbuka}
            onClick={() => setTerbuka((v) => !v)}
            className="flex min-h-11 w-full items-center justify-between gap-2 px-4 py-3 text-left"
          >
            <span className="text-label text-ink" aria-live="polite">
              Mengunggah {selesai} dari {daftar.length} file · {persen}%
            </span>
            {terbuka ? (
              <ChevronDown size={20} strokeWidth={1.5} aria-hidden="true" />
            ) : (
              <ChevronUp size={20} strokeWidth={1.5} aria-hidden="true" />
            )}
          </button>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={persen}
            aria-label="Progres seluruh upload"
            className="h-1 w-full overflow-hidden bg-line"
          >
            <div
              className="h-full bg-accent transition-[width]"
              style={{ width: `${persen}%` }}
            />
          </div>
          {terbuka ? (
            <ul className="flex max-h-64 flex-col gap-3 overflow-y-auto px-4 py-3">
              {daftar.map((item) => {
                const persenItem =
                  item.total > 0
                    ? Math.min(
                        100,
                        Math.round((item.terkirim / item.total) * 100),
                      )
                    : 0;
                const sedangJalan =
                  item.status === "mengunggah" ||
                  item.status === "menunggu" ||
                  item.status === "menunggu-jaringan";
                const Ikon =
                  item.tipe.startsWith("video/") ||
                  /\.(mp4|mov|webm)$/i.test(item.nama)
                    ? Film
                    : FileImage;
                return (
                  <li key={item.id} className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-3">
                      {item.pratinjau ? (
                        // eslint-disable-next-line @next/next/no-img-element -- pratinjau blob: lokal, next/image tak mendukung object URL.
                        <img
                          src={item.pratinjau}
                          alt=""
                          className="h-11 w-11 shrink-0 rounded-md bg-sunken object-cover"
                        />
                      ) : (
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-sunken text-ink-muted">
                          <Ikon
                            size={20}
                            strokeWidth={1.5}
                            aria-hidden="true"
                          />
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-label text-ink">
                          {item.nama}
                        </p>
                        <p className="text-caption text-ink-muted">
                          {formatByte(item.ukuran)} · {TEKS_STATUS[item.status]}
                          {item.status === "mengunggah" ? ` · ${persenItem}%` : ""}
                        </p>
                      </div>
                      {item.status === "mengunggah" ||
                      item.status === "menunggu" ? (
                        <button
                          type="button"
                          aria-label={`Jeda upload ${item.nama}`}
                          onClick={() => jeda(item.id)}
                          className="flex min-h-11 min-w-11 items-center justify-center rounded-md text-ink"
                        >
                          <Pause
                            size={20}
                            strokeWidth={1.5}
                            aria-hidden="true"
                          />
                        </button>
                      ) : null}
                      {item.status === "jeda" || item.status === "gagal" ? (
                        <button
                          type="button"
                          aria-label={
                            item.status === "gagal"
                              ? `Coba lagi upload ${item.nama}`
                              : `Lanjutkan upload ${item.nama}`
                          }
                          onClick={() => lanjutkan(item.id)}
                          className="flex min-h-11 min-w-11 items-center justify-center rounded-md text-ink"
                        >
                          {item.status === "gagal" ? (
                            <RotateCcw
                              size={20}
                              strokeWidth={1.5}
                              aria-hidden="true"
                            />
                          ) : (
                            <Play
                              size={20}
                              strokeWidth={1.5}
                              aria-hidden="true"
                            />
                          )}
                        </button>
                      ) : null}
                      {item.status !== "selesai" ? (
                        <button
                          type="button"
                          aria-label={`Batalkan upload ${item.nama}`}
                          onClick={() => batalkan(item.id, sedangJalan)}
                          className="flex min-h-11 min-w-11 items-center justify-center rounded-md text-ink"
                        >
                          <X size={20} strokeWidth={1.5} aria-hidden="true" />
                        </button>
                      ) : null}
                    </div>
                    <div
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={persenItem}
                      aria-label={`Progres ${item.nama}`}
                      className="h-1 w-full overflow-hidden rounded-full bg-line"
                    >
                      <div
                        className="h-full rounded-full bg-accent transition-[width]"
                        style={{ width: `${persenItem}%` }}
                      />
                    </div>
                    {item.status === "menunggu-jaringan" ? (
                      <p className="flex items-start gap-1.5 text-caption text-ink-muted">
                        <WifiOff
                          size={20}
                          strokeWidth={1.5}
                          className="mt-0.5 shrink-0"
                          aria-hidden="true"
                        />
                        <span>{item.galat}</span>
                      </p>
                    ) : null}
                    {item.status === "gagal" && item.galat ? (
                      <p
                        role="alert"
                        className="flex items-start gap-1.5 text-caption text-danger"
                      >
                        <CircleAlert
                          size={20}
                          strokeWidth={1.5}
                          className="mt-0.5 shrink-0"
                          aria-hidden="true"
                        />
                        <span>{item.galat}</span>
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : null}
        </section>
      ) : null}

      <button
        type="button"
        aria-label="Unggah file"
        onClick={() => masukanRef.current?.click()}
        className="fixed bottom-[calc(72px+env(safe-area-inset-bottom))] right-4 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-on-accent shadow-float active:bg-accent-hover lg:hidden"
      >
        <Plus size={24} strokeWidth={1.5} aria-hidden="true" />
      </button>
    </div>
  );
}

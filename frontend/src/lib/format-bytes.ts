/**
 * Format ukuran byte ke teks Indonesia ("1,2 GB dari 5 GB").
 * 1 GB = 1024^3 byte. Utilitas kecil yang bisa dipakai ulang.
 */

const KB = 1024;
const MB = 1024 * 1024;
const GB = 1024 * 1024 * 1024;

export const GB_BYTES = GB;

const penomoran = new Intl.NumberFormat("id-ID", {
  maximumFractionDigits: 1,
});

export function formatBytes(value: bigint | number | string): string {
  const angka = typeof value === "bigint" ? Number(value) : Number(value);
  if (!Number.isFinite(angka) || angka < 0) {
    return "0 B";
  }
  if (angka >= GB) {
    return `${penomoran.format(Math.round((angka / GB) * 10) / 10)} GB`;
  }
  if (angka >= MB) {
    return `${penomoran.format(Math.round((angka / MB) * 10) / 10)} MB`;
  }
  if (angka >= KB) {
    return `${penomoran.format(Math.round((angka / KB) * 10) / 10)} KB`;
  }
  return `${penomoran.format(Math.round(angka))} B`;
}

/**
 * Parse input kuota dalam GB (terima koma atau titik desimal) menjadi
 * byte BigInt. Mengembalikan null bila bukan angka positif.
 */
export function parseGbInput(raw: string): bigint | null {
  const teks = raw.trim().replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(teks)) {
    return null;
  }
  const gb = Number(teks);
  if (!Number.isFinite(gb)) {
    return null;
  }
  return BigInt(Math.round(gb * GB));
}

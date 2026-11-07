/**
 * Membentuk header Content-Disposition sesuai RFC 6266 & RFC 5987.
 * - `filename`: fallback ASCII bersih untuk klien HTTP lama. Karakter non-ASCII,
 *   tanda kutip ganda, dan backslash diganti `_`.
 * - `filename*`: representasi UTF-8 terenkode persen (RFC 5987).
 *
 * Mencegah bug B8 (nama berkas berkode %20 atau rusak pada browser modern).
 */
export function contentDisposition(
  filename: string,
  type: 'attachment' | 'inline' = 'attachment',
): string {
  const trimmed = filename.trim();
  const fallback = trimmed
    ? trimmed
        .replace(/[^\x20-\x7E]/g, '_')
        .replace(/["\\]/g, '_')
        .trim() || 'berkas'
    : 'berkas';

  const rawTarget = trimmed || 'berkas';
  const encodedUtf8 = encodeURIComponent(rawTarget).replace(
    /['()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );

  return `${type}; filename="${fallback}"; filename*=UTF-8''${encodedUtf8}`;
}


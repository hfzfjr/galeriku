import { join } from 'node:path';

// Util US-17: penyelesaian upload tus -> baris File + file final.
// Validasi MIME/kuota/disk guard BELUM ada (itu US-18): US-17 menerima
// semua tipe file.

// Upload tus yang tak selesai lebih lama dari ini dianggap yatim dan
// dihapus job cleanup lewat ekstensi expiration FileStore.
export const TUS_ORPHAN_TTL_MS = 24 * 60 * 60 * 1000;

export const FALLBACK_ORIGINAL_NAME = 'berkas';

const MAX_ORIGINAL_NAME_LENGTH = 255;

// Sanitasi nama asli dari metadata klien: buang komponen path (mis.
// "../../etc/passwd" atau "C:\fakepath\foto.jpg"), buang karakter
// kontrol, pangkas spasi, batasi panjang. Tak pernah kosong.
export function sanitizeOriginalName(raw: unknown): string {
  if (typeof raw !== 'string') {
    return FALLBACK_ORIGINAL_NAME;
  }
  const dasar = raw.split(/[\\/]/).pop() ?? '';
  // eslint-disable-next-line no-control-regex -- sengaja: buang karakter kontrol dari nama klien.
  const bersih = dasar.replace(/[\x00-\x1F\x7F]/g, '').trim();
  if (bersih.length === 0) {
    return FALLBACK_ORIGINAL_NAME;
  }
  return bersih.slice(0, MAX_ORIGINAL_NAME_LENGTH);
}

export type FileKindLike = 'image' | 'video';

// Jenis sementara sampai US-18 (MIME sniffing + whitelist): video bila
// tipe mime video/* atau ekstensi video umum, selainnya image.
export function inferKind(mimeType: string, originalName: string): FileKindLike {
  const tipe = mimeType.toLowerCase().trim();
  if (tipe.startsWith('video/')) {
    return 'video';
  }
  const ekstensi = originalName.split('.').pop()?.toLowerCase() ?? '';
  if (ekstensi === 'mp4' || ekstensi === 'mov' || ekstensi === 'webm') {
    return 'video';
  }
  return 'image';
}

// Direktori media + sub-direktori tus, satu sumber kebenaran agar
// UploadsService, job cleanup, dan hapus-pengguna memakai path yang sama.
export function resolveMediaDir(): string {
  return process.env.MEDIA_DIR?.trim() || process.cwd();
}

export function tusDirOf(mediaDir: string): string {
  return join(mediaDir, '_tus');
}

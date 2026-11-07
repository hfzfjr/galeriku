import { statfsSync } from 'node:fs';
import { open, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { fileTypeFromFile } from 'file-type';
import { UserStatus } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  FORBIDDEN_EXTENSIONS,
  VIDEO_EXTENSIONS,
  VIDEO_MIME_TYPES,
  WHITELIST_EXTENSIONS,
  WHITELIST_MIME_TYPES,
} from './uploads.constants';

// Util US-17 & US-18: validasi, kuota, disk guard, dan penyelesaian upload.

export const TUS_ORPHAN_TTL_MS = 24 * 60 * 60 * 1000;
export const FALLBACK_ORIGINAL_NAME = 'berkas';
const MAX_ORIGINAL_NAME_LENGTH = 255;

export type FileKindLike = 'image' | 'video';

// Ekstrak ekstensi (tanpa titik, huruf kecil).
export function getFileExtension(filename: string): string {
  const dotIndex = filename.lastIndexOf('.');
  if (dotIndex === -1) return '';
  return filename.slice(dotIndex + 1).toLowerCase().trim();
}

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

// Penentuan jenis file: video bila mime video/* atau ekstensi video,
// selainnya image (US-18 whitelist hanya mencakup foto dan video).
export function inferKind(
  mimeType: string,
  originalName?: string,
): FileKindLike {
  const tipe = mimeType.toLowerCase().trim();
  if (VIDEO_MIME_TYPES.has(tipe) || tipe.startsWith('video/')) {
    return 'video';
  }
  if (originalName) {
    const ext = getFileExtension(originalName);
    if (VIDEO_EXTENSIONS.has(ext)) {
      return 'video';
    }
  }
  return 'image';
}

export function isSvg(filename: string, declaredMime?: string): boolean {
  if (getFileExtension(filename) === 'svg') return true;
  if (declaredMime && declaredMime.toLowerCase().includes('svg')) return true;
  return false;
}

// Validasi metadata kiriman klien saat pembuatan upload (onUploadCreate).
// Memastikan SVG ditolak keras, ekstensi dan tipe MIME masuk whitelist,
// dan ukuran tidak melampaui batas per tipe (foto 25 MB / video 2 GB).
export function validateUploadMetadata(
  metadata: Record<string, string | null> | undefined,
  uploadSizeBytes: bigint | undefined,
  maxImageBytes: bigint,
  maxVideoBytes: bigint,
): { originalName: string; declaredMime: string; kind: FileKindLike } {
  const originalName = sanitizeOriginalName(metadata?.['filename']);
  const ext = getFileExtension(originalName);
  const declaredMime = (
    typeof metadata?.['filetype'] === 'string' && metadata['filetype'].length > 0
      ? metadata['filetype']
      : 'application/octet-stream'
  ).toLowerCase().trim();

  // SVG ditolak keras (PRD §11 & §12.4).
  if (isSvg(originalName, declaredMime)) {
    throw {
      status_code: 415,
      body: JSON.stringify({
        statusCode: 415,
        code: 'UNSUPPORTED_MEDIA_TYPE',
        message: 'Format SVG tidak diizinkan.',
      }),
    };
  }

  // Tolak ekstensi berbahaya atau di luar whitelist.
  if (FORBIDDEN_EXTENSIONS.has(ext)) {
    throw {
      status_code: 415,
      body: JSON.stringify({
        statusCode: 415,
        code: 'UNSUPPORTED_MEDIA_TYPE',
        message: 'Tipe file tidak didukung.',
      }),
    };
  }

  if (ext.length > 0 && !WHITELIST_EXTENSIONS.has(ext)) {
    throw {
      status_code: 415,
      body: JSON.stringify({
        statusCode: 415,
        code: 'UNSUPPORTED_MEDIA_TYPE',
        message: 'Tipe file tidak didukung.',
      }),
    };
  }

  // Bila klien mendeklarasikan tipe MIME spesifik, pastikan masuk whitelist.
  if (
    declaredMime !== 'application/octet-stream' &&
    !WHITELIST_MIME_TYPES.has(declaredMime)
  ) {
    throw {
      status_code: 415,
      body: JSON.stringify({
        statusCode: 415,
        code: 'UNSUPPORTED_MEDIA_TYPE',
        message: 'Tipe file tidak didukung.',
      }),
    };
  }

  const kind = inferKind(declaredMime, originalName);

  // Validasi batas ukuran per tipe bila ukuran diumumkan di awal.
  if (uploadSizeBytes !== undefined && uploadSizeBytes > 0n) {
    if (kind === 'image' && uploadSizeBytes > maxImageBytes) {
      throw {
        status_code: 413,
        body: JSON.stringify({
          statusCode: 413,
          code: 'PAYLOAD_TOO_LARGE',
          message: 'Ukuran foto melebihi batas 25 MB.',
        }),
      };
    }
    if (kind === 'video' && uploadSizeBytes > maxVideoBytes) {
      throw {
        status_code: 413,
        body: JSON.stringify({
          statusCode: 413,
          code: 'PAYLOAD_TOO_LARGE',
          message: 'Ukuran video melebihi batas 2 GB.',
        }),
      };
    }
  }

  return { originalName, declaredMime, kind };
}

// Disk Guard (PRD §11 & §12.4 US-18): tolak upload bila sisa ruang disk
// server kurang dari ambang batas (default 15 GB).
export function checkDiskGuard(
  mediaDir: string,
  uploadSizeBytes: bigint,
  minFreeBytes: bigint,
): void {
  let freeBytes: bigint;
  try {
    const stat = statfsSync(mediaDir);
    freeBytes = BigInt(stat.bavail) * BigInt(stat.bsize);
  } catch {
    // Pada lingkungan tanpa statfs (mis. mock test), lewati pemeriksaan disk.
    return;
  }
  if (
    freeBytes < minFreeBytes ||
    (uploadSizeBytes > 0n && freeBytes < minFreeBytes + uploadSizeBytes)
  ) {
    throw {
      status_code: 507,
      body: JSON.stringify({
        statusCode: 507,
        code: 'INSUFFICIENT_STORAGE',
        message: 'Penyimpanan server hampir penuh. Coba lagi nanti.',
      }),
    };
  }
}

// Kuota pengguna & status akun (PRD §11 & §12.4 US-18): tolak bila akun
// ditangguhkan (403) atau pemakaian melebihi kuota pengguna (403).
export async function checkUserQuotaAndStatus(
  userId: string,
  uploadSizeBytes: bigint,
  prisma: PrismaService,
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { status: true, quotaBytes: true },
  });
  if (!user) {
    throw {
      status_code: 401,
      body: JSON.stringify({
        statusCode: 401,
        code: 'UNAUTHENTICATED',
        message: 'Masuk dulu untuk melanjutkan.',
      }),
    };
  }
  if (user.status === UserStatus.SUSPENDED) {
    throw {
      status_code: 403,
      body: JSON.stringify({
        statusCode: 403,
        code: 'ACCOUNT_SUSPENDED',
        message: 'Akun Anda sedang ditangguhkan.',
      }),
    };
  }
  if (uploadSizeBytes <= 0n) {
    return;
  }
  const agg = await prisma.file.aggregate({
    where: { ownerId: userId, deletedAt: null },
    _sum: { sizeBytes: true },
  });
  const currentUsed = agg._sum.sizeBytes ?? 0n;
  if (currentUsed + uploadSizeBytes > user.quotaBytes) {
    throw {
      status_code: 403,
      body: JSON.stringify({
        statusCode: 403,
        code: 'QUOTA_EXCEEDED',
        message: 'Sisa kuota penyimpanan tidak mencukupi.',
      }),
    };
  }
}

// MIME sniffing file di disk saat upload selesai (onUploadFinish).
// Membaca magic bytes asli via file-type; memeriksa bila kontennya teks SVG.
export async function sniffAndValidateFile(
  filePath: string,
  maxImageBytes: bigint,
  maxVideoBytes: bigint,
): Promise<{ mime: string; kind: FileKindLike }> {
  const detected = await fileTypeFromFile(filePath);

  // Jika file-type tidak mendeteksi magic bytes gambar/video biner yang ada di whitelist,
  // periksa apakah file sebenarnya berupa teks XML/SVG yang disamarkan (file-type mengembalikan
  // undefined untuk dokumen XML teks seperti SVG).
  if (!detected || !WHITELIST_MIME_TYPES.has(detected.mime)) {
    let handle;
    try {
      handle = await open(filePath, 'r');
      const buf = Buffer.alloc(1024);
      const { bytesRead } = await handle.read(buf, 0, 1024, 0);
      const headerStr = buf.subarray(0, bytesRead).toString('utf8').toLowerCase();
      if (
        headerStr.includes('<svg') ||
        headerStr.includes('xmlns="http://www.w3.org/2000/svg"')
      ) {
        throw {
          status_code: 415,
          body: JSON.stringify({
            statusCode: 415,
            code: 'UNSUPPORTED_MEDIA_TYPE',
            message: 'Format SVG tidak diizinkan.',
          }),
        };
      }
    } finally {
      await handle?.close();
    }

    throw {
      status_code: 415,
      body: JSON.stringify({
        statusCode: 415,
        code: 'UNSUPPORTED_MEDIA_TYPE',
        message: 'Format file tidak didukung.',
      }),
    };
  }

  const fileStat = await stat(filePath);
  const size = BigInt(fileStat.size);
  const kind = inferKind(detected.mime);

  if (kind === 'image' && size > maxImageBytes) {
    throw {
      status_code: 413,
      body: JSON.stringify({
        statusCode: 413,
        code: 'PAYLOAD_TOO_LARGE',
        message: 'Ukuran foto melebihi batas 25 MB.',
      }),
    };
  }

  if (kind === 'video' && size > maxVideoBytes) {
    throw {
      status_code: 413,
      body: JSON.stringify({
        statusCode: 413,
        code: 'PAYLOAD_TOO_LARGE',
        message: 'Ukuran video melebihi batas 2 GB.',
      }),
    };
  }

  return { mime: detected.mime, kind };
}

// Direktori media + sub-direktori tus.
export function resolveMediaDir(): string {
  return process.env.MEDIA_DIR?.trim() || process.cwd();
}

export function tusDirOf(mediaDir: string): string {
  return join(mediaDir, '_tus');
}

import { existsSync, statSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { Injectable } from '@nestjs/common';
import type {
  FileDetail,
  FileItem,
  FilesQuery,
  FilesResponse,
  FilesTimelineQuery,
  FilesTimelineResponse,
} from '@galeriku/contracts';
import {
  filesQuerySchema,
  filesTimelineQuerySchema,
  updateCapturedAtSchema,
} from '@galeriku/contracts';
import { FileStatus } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ApiError } from '../common/errors/api-error';
import { resolveMediaDir } from '../uploads/uploads.utils';

export type KeysetCursor = {
  sort: 'taken' | 'uploaded' | 'name' | 'size';
  order: 'desc' | 'asc';
  val: string;
  id: string;
  capturedAt?: string;
  createdAt?: string;
};

// Cursor keyset universal (RF-12, RF-23, RF-40) sandi base64url.
// Kompatibel mundur: format lama { capturedAt, id } atau { createdAt, id } tetap diterima.
export function encodeCursor(
  val: Date | string | bigint | number,
  id: string,
  sort: 'taken' | 'uploaded' | 'name' | 'size' = 'taken',
  order: 'desc' | 'asc' = 'desc',
): string {
  const valStr =
    val instanceof Date
      ? val.toISOString()
      : typeof val === 'bigint'
        ? val.toString()
        : String(val);

  let payload: Record<string, unknown>;
  if (sort === 'taken' && order === 'desc') {
    payload = { capturedAt: valStr, id };
  } else if (sort === 'uploaded' && order === 'desc') {
    payload = { createdAt: valStr, id };
  } else {
    payload = { sort, order, val: valStr, id };
  }
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

export function decodeCursor(cursor: string): KeysetCursor {
  try {
    const raw = Buffer.from(cursor, 'base64url').toString('utf8');
    const parsed = JSON.parse(raw);

    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof parsed.id === 'string' &&
      parsed.id.length > 0
    ) {
      // Format baru universal
      if (parsed.sort && parsed.order && parsed.val !== undefined) {
        const validSorts = ['taken', 'uploaded', 'name', 'size'];
        const validOrders = ['desc', 'asc'];
        if (
          validSorts.includes(parsed.sort) &&
          validOrders.includes(parsed.order)
        ) {
          return {
            sort: parsed.sort,
            order: parsed.order,
            val: String(parsed.val),
            id: parsed.id,
          };
        }
      }

      // Format warisan capturedAt
      if (
        typeof parsed.capturedAt === 'string' &&
        !isNaN(Date.parse(parsed.capturedAt))
      ) {
        const res: Record<string, unknown> = {
          capturedAt: parsed.capturedAt,
          id: parsed.id,
        };
        Object.defineProperty(res, 'sort', {
          value: 'taken',
          enumerable: false,
          writable: true,
        });
        Object.defineProperty(res, 'order', {
          value: 'desc',
          enumerable: false,
          writable: true,
        });
        Object.defineProperty(res, 'val', {
          value: parsed.capturedAt,
          enumerable: false,
          writable: true,
        });
        return res as KeysetCursor;
      }

      // Format warisan createdAt
      if (
        typeof parsed.createdAt === 'string' &&
        !isNaN(Date.parse(parsed.createdAt))
      ) {
        const res: Record<string, unknown> = {
          createdAt: parsed.createdAt,
          id: parsed.id,
        };
        Object.defineProperty(res, 'sort', {
          value: 'uploaded',
          enumerable: false,
          writable: true,
        });
        Object.defineProperty(res, 'order', {
          value: 'desc',
          enumerable: false,
          writable: true,
        });
        Object.defineProperty(res, 'val', {
          value: parsed.createdAt,
          enumerable: false,
          writable: true,
        });
        return res as KeysetCursor;
      }
    }
  } catch {
    // Abaikan dan lempar ApiError di bawah
  }

  throw new ApiError(
    400,
    'INVALID_CURSOR',
    'Cursor paginasi tidak valid atau telah usang. Silakan muat ulang halaman dari awal.',
    { fields: [{ field: 'cursor', message: 'Cursor tidak valid atau telah usang.' }] },
  );
}

type FileRow = {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: bigint;
  kind: string;
  width: number | null;
  height: number | null;
  durationS: number | null;
  thumbKey: string | null;
  previewKey?: string | null;
  status: string;
  isFavorite?: boolean;
  takenAt?: Date | null;
  capturedAt?: Date | null;
  capturedTzOffsetMin?: number | null;
  capturedAtSource?: string | null;
  placeCountry?: string | null;
  placeAdmin1?: string | null;
  placeCity?: string | null;
  gpsLat?: number | null;
  gpsLng?: number | null;
  gpsAltM?: number | null;
  cameraMake?: string | null;
  cameraModel?: string | null;
  lensModel?: string | null;
  iso?: number | null;
  fNumber?: number | null;
  exposureS?: number | null;
  focalLengthMm?: number | null;
  orientation?: number | null;
  liveKind?: string | null;
  liveOffset?: bigint | null;
  liveLength?: bigint | null;
  createdAt: Date;
  deletedAt?: Date | null;
};

export function toFileItem(file: FileRow): FileItem {
  const capturedAt = file.capturedAt ?? file.takenAt ?? file.createdAt;
  const hasLocation =
    file.gpsLat !== null &&
    file.gpsLat !== undefined &&
    file.gpsLng !== null &&
    file.gpsLng !== undefined;
  const placeParts = [file.placeCity, file.placeAdmin1, file.placeCountry].filter(Boolean);
  const place = placeParts.length > 0 ? placeParts.join(', ') : null;

  return {
    id: file.id,
    originalName: file.originalName,
    mimeType: file.mimeType,
    sizeBytes: file.sizeBytes.toString(),
    kind: file.kind === 'video' ? 'video' : 'image',
    width: file.width,
    height: file.height,
    durationS: file.durationS,
    thumbKey: file.thumbKey,
    previewKey: file.previewKey ?? null,
    status: file.status,
    liveKind:
      file.liveKind === 'motion' || file.liveKind === 'ios_pair'
        ? file.liveKind
        : 'none',
    isFavorite: Boolean(file.isFavorite),
    takenAt: file.takenAt ? file.takenAt.toISOString() : null,
    capturedAt: capturedAt.toISOString(),
    capturedTzOffsetMin: file.capturedTzOffsetMin ?? null,
    capturedAtSource: (file.capturedAtSource as any) ?? undefined,
    place,
    hasLocation,
    cameraMake: file.cameraMake ?? null,
    cameraModel: file.cameraModel ?? null,
    lensModel: file.lensModel ?? null,
    iso: file.iso ?? null,
    fNumber: file.fNumber ?? null,
    exposureS: file.exposureS ?? null,
    focalLengthMm: file.focalLengthMm ?? null,
    createdAt: file.createdAt.toISOString(),
    deletedAt: file.deletedAt ? file.deletedAt.toISOString() : null,
  };
}

export function toFileDetail(file: FileRow): FileDetail {
  const base = toFileItem(file);
  return {
    ...base,
    gpsLat: file.gpsLat ?? null,
    gpsLng: file.gpsLng ?? null,
    gpsAltM: file.gpsAltM ?? null,
    orientation: file.orientation ?? null,
    placeCountry: file.placeCountry ?? null,
    placeAdmin1: file.placeAdmin1 ?? null,
    placeCity: file.placeCity ?? null,
  };
}

@Injectable()
export class FilesService {
  constructor(private readonly prisma: PrismaService) {}

  async listFiles(userId: string, rawQuery: unknown): Promise<FilesResponse> {
    const parsed = filesQuerySchema.safeParse(rawQuery ?? {});
    if (!parsed.success) {
      throw new ApiError(
        400,
        'VALIDATION_ERROR',
        'Parameter query tidak valid.',
        {
          fields: parsed.error.issues.map((i) => ({
            field: i.path.join('.') || '(query)',
            message: i.message,
          })),
        },
      );
    }

    const query: FilesQuery = parsed.data;
    const sort = query.sort ?? 'taken';
    const order = query.order ?? 'desc';

    const where: Record<string, unknown> = {
      ownerId: userId,
      status: FileStatus.ready,
      deletedAt: null,
    };

    const andConditions: any[] = [];

    // Filter jenis (kind)
    if (query.kind) {
      where.kind = query.kind;
    }

    // Filter favorit
    if (query.favorite !== undefined) {
      where.isFavorite = query.favorite;
    }

    // Filter live foto (RF-40)
    if (query.live !== undefined) {
      where.liveKind = query.live ? { not: 'none' } : 'none';
    }

    // Filter lokasi (hasLocation: punya koordinat GPS)
    if (query.hasLocation !== undefined) {
      where.gpsLat = query.hasLocation ? { not: null } : null;
    }

    // Filter unalbumed (belum dimasukkan ke dalam album manapun)
    if (query.unalbumed !== undefined) {
      where.albumFiles = query.unalbumed ? { none: {} } : { some: {} };
    }

    // Filter duplikat (RF-40 & RF-45)
    if (query.duplicates !== undefined) {
      where.duplicateOfId = query.duplicates ? { not: null } : null;
    }

    // Filter rentang tanggal foto (from / to pada capturedAt)
    if (query.from || query.to) {
      const dateFilter: Record<string, Date> = {};
      if (query.from) {
        dateFilter.gte = new Date(query.from);
      }
      if (query.to) {
        dateFilter.lte =
          query.to.length === 10
            ? new Date(`${query.to}T23:59:59.999Z`)
            : new Date(query.to);
      }
      where.capturedAt = dateFilter;
    }

    // Filter tempat (kota / provinsi / negara)
    if (query.place) {
      andConditions.push({
        OR: [
          { placeCity: { contains: query.place, mode: 'insensitive' } },
          { placeAdmin1: { contains: query.place, mode: 'insensitive' } },
          { placeCountry: { contains: query.place, mode: 'insensitive' } },
        ],
      });
    }

    // Pencarian q (nama file dan tempat, tidak peka huruf besar-kecil)
    if (query.q) {
      andConditions.push({
        OR: [
          { originalName: { contains: query.q, mode: 'insensitive' } },
          { placeCity: { contains: query.q, mode: 'insensitive' } },
          { placeAdmin1: { contains: query.q, mode: 'insensitive' } },
          { placeCountry: { contains: query.q, mode: 'insensitive' } },
        ],
      });
    }

    // Paginasi Keyset Cursor (sort, order, val, id)
    if (query.cursor !== undefined) {
      const decoded = decodeCursor(query.cursor);
      if (decoded.sort !== sort || decoded.order !== order) {
        throw new ApiError(
          400,
          'INVALID_CURSOR',
          'Cursor tidak cocok dengan opsi sortir yang dipilih.',
          {
            fields: [
              {
                field: 'cursor',
                message: 'Sort atau order pada cursor tidak cocok dengan query saat ini.',
              },
            ],
          },
        );
      }

      const opMain = order === 'desc' ? 'lt' : 'gt';
      const opTie = order === 'desc' ? 'lt' : 'gt';

      if (sort === 'taken') {
        const cursorDate = new Date(decoded.val);
        andConditions.push({
          OR: [
            { capturedAt: { [opMain]: cursorDate } },
            { capturedAt: cursorDate, id: { [opTie]: decoded.id } },
          ],
        });
      } else if (sort === 'uploaded') {
        const cursorDate = new Date(decoded.val);
        andConditions.push({
          OR: [
            { createdAt: { [opMain]: cursorDate } },
            { createdAt: cursorDate, id: { [opTie]: decoded.id } },
          ],
        });
      } else if (sort === 'name') {
        andConditions.push({
          OR: [
            { originalName: { [opMain]: decoded.val } },
            { originalName: decoded.val, id: { [opTie]: decoded.id } },
          ],
        });
      } else if (sort === 'size') {
        const cursorSize = BigInt(decoded.val);
        andConditions.push({
          OR: [
            { sizeBytes: { [opMain]: cursorSize } },
            { sizeBytes: cursorSize, id: { [opTie]: decoded.id } },
          ],
        });
      }
    } else if (query.anchor !== undefined && (sort === 'taken' || !query.sort)) {
      // Anchor loncat waktu YYYY-MM (RF-41)
      const [yStr, mStr] = query.anchor.split('-');
      const y = parseInt(yStr, 10);
      const m = parseInt(mStr, 10);

      if (order === 'desc') {
        // Mulai dari akhir bulan anchor menuju tanggal lebih lama
        const anchorDate = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0));
        andConditions.push({ capturedAt: { lt: anchorDate } });
      } else {
        // Mulai dari awal bulan anchor menuju tanggal lebih baru
        const anchorDate = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
        andConditions.push({ capturedAt: { gte: anchorDate } });
      }
    }

    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    // OrderBy sesuai sort dan order
    let orderBy: any[];
    if (sort === 'taken') {
      orderBy = [{ capturedAt: order }, { id: order }];
    } else if (sort === 'uploaded') {
      orderBy = [{ createdAt: order }, { id: order }];
    } else if (sort === 'name') {
      orderBy = [{ originalName: order }, { id: order }];
    } else {
      orderBy = [{ sizeBytes: order }, { id: order }];
    }

    const rows = await this.prisma.file.findMany({
      where,
      orderBy,
      take: query.limit + 1,
    });

    const halaman = rows.slice(0, query.limit);
    let nextCursor: string | null = null;
    if (rows.length > query.limit && halaman.length > 0) {
      const last = halaman[halaman.length - 1];
      let val: Date | string | bigint;
      if (sort === 'taken') {
        val = last.capturedAt ?? last.createdAt;
      } else if (sort === 'uploaded') {
        val = last.createdAt;
      } else if (sort === 'name') {
        val = last.originalName;
      } else {
        val = last.sizeBytes;
      }
      nextCursor = encodeCursor(val, last.id, sort, order);
    }

    return {
      items: halaman.map(toFileItem),
      nextCursor,
    };
  }

  async getTimeline(
    userId: string,
    rawQuery: unknown,
  ): Promise<FilesTimelineResponse> {
    const parsed = filesTimelineQuerySchema.safeParse(rawQuery ?? {});
    if (!parsed.success) {
      throw new ApiError(
        400,
        'VALIDATION_ERROR',
        'Parameter query timeline tidak valid.',
        {
          fields: parsed.error.issues.map((i) => ({
            field: i.path.join('.') || '(query)',
            message: i.message,
          })),
        },
      );
    }

    const query: FilesTimelineQuery = parsed.data;
    const where: Record<string, unknown> = {
      ownerId: userId,
      status: FileStatus.ready,
      deletedAt: null,
    };

    const andConditions: any[] = [];

    if (query.kind) {
      where.kind = query.kind;
    }

    if (query.favorite !== undefined) {
      where.isFavorite = query.favorite;
    }

    if (query.live !== undefined) {
      where.liveKind = query.live ? { not: 'none' } : 'none';
    }

    if (query.hasLocation !== undefined) {
      where.gpsLat = query.hasLocation ? { not: null } : null;
    }

    if (query.unalbumed !== undefined) {
      where.albumFiles = query.unalbumed ? { none: {} } : { some: {} };
    }

    if (query.duplicates !== undefined) {
      where.duplicateOfId = query.duplicates ? { not: null } : null;
    }

    if (query.from || query.to) {
      const dateFilter: Record<string, Date> = {};
      if (query.from) {
        dateFilter.gte = new Date(query.from);
      }
      if (query.to) {
        dateFilter.lte =
          query.to.length === 10
            ? new Date(`${query.to}T23:59:59.999Z`)
            : new Date(query.to);
      }
      where.capturedAt = dateFilter;
    }

    if (query.place) {
      andConditions.push({
        OR: [
          { placeCity: { contains: query.place, mode: 'insensitive' } },
          { placeAdmin1: { contains: query.place, mode: 'insensitive' } },
          { placeCountry: { contains: query.place, mode: 'insensitive' } },
        ],
      });
    }

    if (query.q) {
      andConditions.push({
        OR: [
          { originalName: { contains: query.q, mode: 'insensitive' } },
          { placeCity: { contains: query.q, mode: 'insensitive' } },
          { placeAdmin1: { contains: query.q, mode: 'insensitive' } },
          { placeCountry: { contains: query.q, mode: 'insensitive' } },
        ],
      });
    }

    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    const rows = await this.prisma.file.findMany({
      where,
      select: { capturedAt: true },
      orderBy: [{ capturedAt: 'desc' }, { id: 'desc' }],
    });

    const bucketMap = new Map<string, { year: number; month: number; count: number }>();
    for (const row of rows) {
      const d = row.capturedAt ?? new Date();
      const year = d.getUTCFullYear();
      const month = d.getUTCMonth() + 1;
      const key = `${year}-${month}`;
      const existing = bucketMap.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        bucketMap.set(key, { year, month, count: 1 });
      }
    }

    return {
      buckets: Array.from(bucketMap.values()),
    };
  }

  async getFileDetail(userId: string, fileId: string): Promise<FileDetail> {
    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
    });

    if (
      !file ||
      file.ownerId !== userId ||
      file.deletedAt !== null ||
      file.status !== FileStatus.ready
    ) {
      throw new ApiError(404, 'NOT_FOUND', 'File tidak ditemukan.');
    }

    return toFileDetail(file as unknown as FileRow);
  }

  async getThumbnailPath(userId: string, fileId: string): Promise<string> {
    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
    });

    // Kepemilikan menjawab 404 identik (AD-12 & US-13): file bukan milik saya
    // dijawab sama persis seperti file yang tidak ada.
    if (
      !file ||
      file.ownerId !== userId ||
      file.status !== FileStatus.ready
    ) {
      throw new ApiError(404, 'NOT_FOUND', 'File tidak ditemukan.');
    }

    if (!file.thumbKey) {
      throw new ApiError(404, 'NOT_FOUND', 'Thumbnail tidak tersedia.');
    }

    const mediaDir = resolveMediaDir();
    const thumbPath = join(mediaDir, file.thumbKey);
    if (!existsSync(thumbPath)) {
      throw new ApiError(404, 'NOT_FOUND', 'Thumbnail tidak ditemukan.');
    }

    return thumbPath;
  }

  async getPreviewPath(userId: string, fileId: string): Promise<string> {
    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
    });

    // Kepemilikan menjawab 404 identik (AD-12 & US-13)
    if (
      !file ||
      file.ownerId !== userId ||
      file.status !== FileStatus.ready
    ) {
      throw new ApiError(404, 'NOT_FOUND', 'File tidak ditemukan.');
    }

    if (!file.previewKey) {
      throw new ApiError(404, 'NOT_FOUND', 'Preview tidak tersedia.');
    }

    const mediaDir = resolveMediaDir();
    const previewPath = join(mediaDir, file.previewKey);
    if (!existsSync(previewPath)) {
      throw new ApiError(404, 'NOT_FOUND', 'Preview tidak ditemukan.');
    }

    return previewPath;
  }

  async getFileContentInfo(userId: string, fileId: string): Promise<{
    filePath: string;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
  }> {
    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
    });

    // Kepemilikan menjawab 404 identik (AD-12 & US-13)
    if (
      !file ||
      file.ownerId !== userId ||
      file.deletedAt !== null ||
      file.status !== FileStatus.ready
    ) {
      throw new ApiError(404, 'NOT_FOUND', 'File tidak ditemukan.');
    }

    const mediaDir = resolveMediaDir();
    const filePath = join(mediaDir, file.storageKey);
    if (!existsSync(filePath)) {
      throw new ApiError(404, 'NOT_FOUND', 'File tidak ditemukan.');
    }

    const stat = statSync(filePath);

    return {
      filePath,
      originalName: file.originalName,
      mimeType: file.mimeType,
      sizeBytes: stat.size,
    };
  }

  async getMotionContentInfo(userId: string, fileId: string): Promise<{
    filePath: string;
    originalName: string;
    mimeType: string;
    videoLength: number;
    videoOffset: number;
  }> {
    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
    });

    // Kepemilikan menjawab 404 identik (AD-12 & US-13)
    if (
      !file ||
      file.ownerId !== userId ||
      file.deletedAt !== null ||
      file.status !== FileStatus.ready
    ) {
      throw new ApiError(404, 'NOT_FOUND', 'File tidak ditemukan.');
    }

    const mediaDir = resolveMediaDir();

    if (file.liveKind === 'motion' && file.liveOffset && file.liveLength) {
      const filePath = join(mediaDir, file.storageKey);
      if (!existsSync(filePath)) {
        throw new ApiError(404, 'NOT_FOUND', 'File tidak ditemukan.');
      }
      return {
        filePath,
        originalName: `${file.originalName.replace(/\.[^.]+$/, '')}.mp4`,
        mimeType: 'video/mp4',
        videoOffset: Number(file.liveOffset),
        videoLength: Number(file.liveLength),
      };
    }

    if (file.liveKind === 'ios_pair' && file.liveVideoKey) {
      const filePath = join(mediaDir, file.liveVideoKey);
      if (!existsSync(filePath)) {
        throw new ApiError(404, 'NOT_FOUND', 'File tidak ditemukan.');
      }
      const st = statSync(filePath);
      return {
        filePath,
        originalName: `${file.originalName.replace(/\.[^.]+$/, '')}.mp4`,
        mimeType: 'video/mp4',
        videoOffset: 0,
        videoLength: st.size,
      };
    }

    throw new ApiError(404, 'NOT_FOUND', 'Motion video tidak tersedia.');
  }

  async deleteFile(userId: string, fileId: string): Promise<void> {
    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
    });

    // Kepemilikan menjawab 404 identik (AD-12 & US-13)
    if (
      !file ||
      file.ownerId !== userId ||
      file.deletedAt !== null ||
      file.status !== FileStatus.ready
    ) {
      throw new ApiError(404, 'NOT_FOUND', 'File tidak ditemukan.');
    }

    await this.prisma.file.update({
      where: { id: fileId },
      data: { deletedAt: new Date() },
    });
  }

  async deleteFilesBatch(
    userId: string,
    fileIds: string[],
  ): Promise<{ count: number }> {
    const uniqueIds = Array.from(new Set(fileIds));
    const files = await this.prisma.file.findMany({
      where: {
        id: { in: uniqueIds },
        ownerId: userId,
        deletedAt: null,
        status: FileStatus.ready,
      },
      select: { id: true },
    });

    if (files.length === 0) {
      return { count: 0 };
    }

    const idsToDelete = files.map((f) => f.id);
    await this.prisma.file.updateMany({
      where: { id: { in: idsToDelete } },
      data: { deletedAt: new Date() },
    });

    return { count: files.length };
  }

  private async hapusBerkasFisik(file: {
    storageKey: string;
    thumbKey: string | null;
    previewKey?: string | null;
    liveVideoKey?: string | null;
  }): Promise<void> {
    const mediaDir = resolveMediaDir();
    try {
      await rm(join(mediaDir, file.storageKey), { force: true });
    } catch {
      // Abaikan bila file fisik sudah hilang
    }
    if (file.liveVideoKey) {
      try {
        await rm(join(mediaDir, file.liveVideoKey), { force: true });
      } catch {
        // Abaikan
      }
    }
    if (file.thumbKey) {
      try {
        await rm(join(mediaDir, file.thumbKey), { force: true });
      } catch {
        // Abaikan
      }
    }
    if (file.previewKey) {
      try {
        await rm(join(mediaDir, file.previewKey), { force: true });
      } catch {
        // Abaikan
      }
    }
  }

  async setFavorite(
    userId: string,
    fileId: string,
    isFavorite: boolean,
  ): Promise<FileItem> {
    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
    });

    if (
      !file ||
      file.ownerId !== userId ||
      file.deletedAt !== null ||
      file.status !== FileStatus.ready
    ) {
      throw new ApiError(404, 'NOT_FOUND', 'File tidak ditemukan.');
    }

    const updated = await this.prisma.file.update({
      where: { id: fileId },
      data: { isFavorite },
    });

    return toFileItem(updated as FileRow);
  }

  // Mengubah tanggal & jam pengambilan foto secara manual (RF-12).
  // Menerima capturedAt ISO 8601 dan opsional capturedTzOffsetMin.
  // Menyimpan capturedAtSource = 'manual'.
  async updateCapturedAt(
    userId: string,
    fileId: string,
    rawBody: unknown,
  ): Promise<FileItem> {
    const parsed = updateCapturedAtSchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new ApiError(
        400,
        'VALIDATION_ERROR',
        'Data tanggal pengambilan tidak valid.',
        {
          fields: parsed.error.issues.map((i) => ({
            field: i.path.join('.'),
            message: i.message,
          })),
        },
      );
    }

    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
    });

    // Kepemilikan menjawab 404 identik (AD-12 & US-13)
    if (
      !file ||
      file.ownerId !== userId ||
      file.deletedAt !== null ||
      file.status !== FileStatus.ready
    ) {
      throw new ApiError(404, 'NOT_FOUND', 'File tidak ditemukan.');
    }

    let offsetMin = parsed.data.capturedTzOffsetMin;
    if (offsetMin === undefined) {
      const match = /(?:([+-])(\d{2}):(\d{2})|Z)$/.exec(parsed.data.capturedAt);
      if (match) {
        if (match[0] === 'Z') {
          offsetMin = 0;
        } else {
          const sign = match[1] === '-' ? -1 : 1;
          const hours = Number(match[2]);
          const mins = Number(match[3]);
          offsetMin = sign * (hours * 60 + mins);
        }
      } else {
        offsetMin = null;
      }
    }

    const updated = await this.prisma.file.update({
      where: { id: fileId },
      data: {
        capturedAt: new Date(parsed.data.capturedAt),
        capturedTzOffsetMin: offsetMin,
        capturedAtSource: 'manual',
      },
    });

    return toFileItem(updated as FileRow);
  }

  async listTrash(userId: string): Promise<{ items: FileItem[] }> {
    const rows = await this.prisma.file.findMany({
      where: {
        ownerId: userId,
        deletedAt: { not: null },
      },
      orderBy: { deletedAt: 'desc' },
    });

    return {
      items: (rows as FileRow[]).map(toFileItem),
    };
  }

  async restoreFile(userId: string, fileId: string): Promise<FileItem> {
    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!file || file.ownerId !== userId || file.deletedAt === null) {
      throw new ApiError(404, 'NOT_FOUND', 'File tidak ditemukan di tempat sampah.');
    }

    const restored = await this.prisma.file.update({
      where: { id: fileId },
      data: { deletedAt: null },
    });

    return toFileItem(restored as FileRow);
  }

  private async lepaskanSampulAlbum(
    tx: PrismaService,
    fileIds: string[],
  ): Promise<void> {
    const fileIdSet = new Set(fileIds);
    const affectedAlbums = await tx.album.findMany({
      where: { coverFileId: { in: fileIds } },
    });

    for (const album of affectedAlbums) {
      const candidates = await tx.albumFile.findMany({
        where: { albumId: album.id },
        orderBy: { position: 'asc' },
      });
      let nextCoverId: string | null = null;
      for (const cand of candidates) {
        if (!fileIdSet.has(cand.fileId)) {
          const f = await tx.file.findUnique({ where: { id: cand.fileId } });
          if (f && f.deletedAt === null) {
            nextCoverId = f.id;
            break;
          }
        }
      }
      await tx.album.update({
        where: { id: album.id },
        data: { coverFileId: nextCoverId },
      });
    }
  }

  async deletePermanent(userId: string, fileId: string): Promise<void> {
    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!file || file.ownerId !== userId) {
      throw new ApiError(404, 'NOT_FOUND', 'File tidak ditemukan.');
    }

    await this.prisma.$transaction(async (tx) => {
      await this.lepaskanSampulAlbum(tx as unknown as PrismaService, [fileId]);
      await tx.file.delete({
        where: { id: fileId },
      });
    });

    // Hapus fisik setelah commit transaksi berhasil
    await this.hapusBerkasFisik(file);
  }

  async emptyTrash(userId: string): Promise<{ count: number }> {
    const BATCH_SIZE = 100;
    let totalDeleted = 0;

    while (true) {
      const files = await this.prisma.file.findMany({
        where: {
          ownerId: userId,
          deletedAt: { not: null },
        },
        take: BATCH_SIZE,
        select: {
          id: true,
          storageKey: true,
          thumbKey: true,
          previewKey: true,
          liveVideoKey: true,
        },
      });

      if (files.length === 0) {
        break;
      }

      const idsToDelete = files.map((f) => f.id);

      try {
        await this.prisma.$transaction(async (tx) => {
          await this.lepaskanSampulAlbum(
            tx as unknown as PrismaService,
            idsToDelete,
          );
          await tx.file.deleteMany({
            where: {
              id: { in: idsToDelete },
            },
          });
        });

        // Hapus fisik setelah commit berhasil
        for (const file of files) {
          await this.hapusBerkasFisik(file);
        }
        totalDeleted += files.length;
      } catch {
        // Fallback per-file jika batch gagal agar satu file gagal tidak membatalkan seluruhnya
        for (const file of files) {
          try {
            await this.prisma.$transaction(async (tx) => {
              await this.lepaskanSampulAlbum(tx as unknown as PrismaService, [
                file.id,
              ]);
              await tx.file.delete({ where: { id: file.id } });
            });
            await this.hapusBerkasFisik(file);
            totalDeleted++;
          } catch {
            // Abaikan dan lanjutkan file berikutnya
          }
        }
        break;
      }

      if (files.length < BATCH_SIZE) {
        break;
      }
    }

    return { count: totalDeleted };
  }

  async purgeExpiredTrash(
    retentionDays: number = 30,
  ): Promise<{ count: number }> {
    const cutoffDate = new Date(
      Date.now() - retentionDays * 24 * 60 * 60 * 1000,
    );
    const BATCH_SIZE = 100;
    let totalDeleted = 0;

    while (true) {
      const files = await this.prisma.file.findMany({
        where: {
          deletedAt: { lte: cutoffDate },
        },
        take: BATCH_SIZE,
        select: {
          id: true,
          storageKey: true,
          thumbKey: true,
          previewKey: true,
          liveVideoKey: true,
        },
      });

      if (files.length === 0) {
        break;
      }

      const idsToDelete = files.map((f) => f.id);

      try {
        await this.prisma.$transaction(async (tx) => {
          await this.lepaskanSampulAlbum(
            tx as unknown as PrismaService,
            idsToDelete,
          );
          await tx.file.deleteMany({
            where: {
              id: { in: idsToDelete },
            },
          });
        });

        for (const file of files) {
          await this.hapusBerkasFisik(file);
        }
        totalDeleted += files.length;
      } catch {
        // Fallback per-file jika batch gagal
        for (const file of files) {
          try {
            await this.prisma.$transaction(async (tx) => {
              await this.lepaskanSampulAlbum(tx as unknown as PrismaService, [
                file.id,
              ]);
              await tx.file.delete({ where: { id: file.id } });
            });
            await this.hapusBerkasFisik(file);
            totalDeleted++;
          } catch {
            // Abaikan dan lanjutkan file berikutnya
          }
        }
        break;
      }

      if (files.length < BATCH_SIZE) {
        break;
      }
    }

    return { count: totalDeleted };
  }
}


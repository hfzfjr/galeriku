import { existsSync, statSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { Injectable } from '@nestjs/common';
import type {
  FileItem,
  FilesQuery,
  FilesResponse,
} from '@galeriku/contracts';
import { filesQuerySchema } from '@galeriku/contracts';
import { FileStatus } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ApiError } from '../common/errors/api-error';
import { resolveMediaDir } from '../uploads/uploads.utils';

export function encodeCursor(id: string): string {
  return Buffer.from(JSON.stringify({ id }), 'utf8').toString('base64url');
}

export function decodeCursor(cursor: string): string | null {
  try {
    const parsed = JSON.parse(
      Buffer.from(cursor, 'base64url').toString('utf8'),
    ) as { id?: unknown };
    return typeof parsed.id === 'string' && parsed.id.length > 0
      ? parsed.id
      : null;
  } catch {
    return null;
  }
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
    status: file.status,
    isFavorite: Boolean(file.isFavorite),
    takenAt: file.takenAt ? file.takenAt.toISOString() : null,
    capturedAt: capturedAt.toISOString(),
    capturedTzOffsetMin: file.capturedTzOffsetMin ?? null,
    capturedAtSource: (file.capturedAtSource as any) ?? undefined,
    place,
    hasLocation,
    createdAt: file.createdAt.toISOString(),
    deletedAt: file.deletedAt ? file.deletedAt.toISOString() : null,
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
    const where: Record<string, unknown> = {
      ownerId: userId,
      status: FileStatus.ready,
      deletedAt: null,
    };

    if (query.kind) {
      where.kind = query.kind;
    }

    if (query.favorite) {
      where.isFavorite = true;
    }

    if (query.cursor !== undefined) {
      const jangkar = decodeCursor(query.cursor);
      if (!jangkar) {
        throw new ApiError(
          400,
          'VALIDATION_ERROR',
          'Cursor tidak valid.',
          { fields: [{ field: 'cursor', message: 'Cursor tidak valid.' }] },
        );
      }
      const ada = await this.prisma.file.findFirst({
        where: { id: jangkar, ...where },
        select: { id: true },
      });
      if (!ada) {
        throw new ApiError(
          400,
          'VALIDATION_ERROR',
          'Cursor tidak valid.',
          { fields: [{ field: 'cursor', message: 'Cursor tidak valid.' }] },
        );
      }

      const rows = await this.prisma.file.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        cursor: { id: jangkar },
        skip: 1,
        take: query.limit + 1,
      });

      return this.keRespons(rows as FileRow[], query.limit);
    }

    const rows = await this.prisma.file.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
    });

    return this.keRespons(rows as FileRow[], query.limit);
  }

  private keRespons(rows: FileRow[], limit: number): FilesResponse {
    const halaman = rows.slice(0, limit);
    const lanjut =
      rows.length > limit && halaman.length > 0
        ? encodeCursor(halaman[halaman.length - 1].id)
        : null;

    return {
      items: halaman.map(toFileItem),
      nextCursor: lanjut,
    };
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
  }): Promise<void> {
    const mediaDir = resolveMediaDir();
    try {
      await rm(join(mediaDir, file.storageKey), { force: true });
    } catch {
      // Abaikan bila file fisik sudah hilang
    }
    if (file.thumbKey) {
      try {
        await rm(join(mediaDir, file.thumbKey), { force: true });
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
        select: { id: true, storageKey: true, thumbKey: true },
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
        select: { id: true, storageKey: true, thumbKey: true },
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


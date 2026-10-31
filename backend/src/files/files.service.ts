import { existsSync, statSync } from 'node:fs';
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
  takenAt: Date | null;
  createdAt: Date;
};

export function toFileItem(file: FileRow): FileItem {
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
    takenAt: file.takenAt ? file.takenAt.toISOString() : null,
    createdAt: file.createdAt.toISOString(),
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
    const where = {
      ownerId: userId,
      status: FileStatus.ready,
      deletedAt: null,
    };

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
      file.deletedAt !== null ||
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
}


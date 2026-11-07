import { Injectable } from '@nestjs/common';
import { FileKind, FileStatus, ShareTarget } from '../generated/prisma/client';
import type {
  AddAlbumFilesRequest,
  AlbumDetail,
  AlbumItem,
  AlbumsResponse,
  CreateAlbumRequest,
  FileItem,
  UpdateAlbumRequest,
} from '@galeriku/contracts';
import { ApiError } from '../common/errors/api-error';
import { PrismaService } from '../prisma/prisma.service';

function toFileItem(file: {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: bigint;
  kind: FileKind;
  width: number | null;
  height: number | null;
  durationS: number | null;
  thumbKey: string | null;
  status: FileStatus;
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
}): FileItem {
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
    kind: file.kind === FileKind.video ? 'video' : 'image',
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
export class AlbumsService {
  constructor(private readonly prisma: PrismaService) {}

  async createAlbum(
    userId: string,
    data: CreateAlbumRequest,
  ): Promise<AlbumItem> {
    const album = await this.prisma.album.create({
      data: {
        ownerId: userId,
        title: data.title,
      },
    });

    return {
      id: album.id,
      title: album.title,
      coverFileId: null,
      fileCount: 0,
      createdAt: (album.createdAt ?? new Date()).toISOString(),
    };
  }

  async getAlbums(userId: string): Promise<AlbumsResponse> {
    const albums = await this.prisma.album.findMany({
      where: { ownerId: userId },
      orderBy: { createdAt: 'desc' },
      include: {
        coverFile: {
          select: { id: true, thumbKey: true, deletedAt: true, status: true },
        },
        albumFiles: {
          where: {
            file: {
              deletedAt: null,
              status: FileStatus.ready,
            },
          },
          orderBy: { position: 'asc' },
          select: {
            file: {
              select: { id: true, thumbKey: true },
            },
          },
        },
      },
    });

    const items: AlbumItem[] = albums.map((album) => {
      let activeCoverId =
        album.coverFile &&
        album.coverFile.deletedAt === null &&
        album.coverFile.status === FileStatus.ready
          ? album.coverFile.id
          : null;

      if (!activeCoverId && album.albumFiles.length > 0) {
        activeCoverId = album.albumFiles[0].file.id;
      }

      return {
        id: album.id,
        title: album.title,
        coverFileId: activeCoverId,
        fileCount: album.albumFiles.length,
        createdAt: (album.createdAt ?? new Date()).toISOString(),
      };
    });

    return { items };
  }

  async getAlbumDetail(userId: string, albumId: string): Promise<AlbumDetail> {
    const album = await this.prisma.album.findUnique({
      where: { id: albumId },
      include: {
        coverFile: {
          select: { id: true, thumbKey: true, deletedAt: true, status: true },
        },
        albumFiles: {
          where: {
            file: {
              deletedAt: null,
              status: FileStatus.ready,
            },
          },
          orderBy: { position: 'asc' },
          include: {
            file: true,
          },
        },
      },
    });

    // Kepemilikan menjawab 404 identik (AD-12 & US-13)
    if (!album || album.ownerId !== userId) {
      throw new ApiError(404, 'NOT_FOUND', 'Album tidak ditemukan.');
    }

    let activeCoverId =
      album.coverFile &&
      album.coverFile.deletedAt === null &&
      album.coverFile.status === FileStatus.ready
        ? album.coverFile.id
        : null;

    if (!activeCoverId && album.albumFiles.length > 0) {
      activeCoverId = album.albumFiles[0].file.id;
    }

    return {
      id: album.id,
      title: album.title,
      coverFileId: activeCoverId,
      fileCount: album.albumFiles.length,
      createdAt: (album.createdAt ?? new Date()).toISOString(),
      files: album.albumFiles.map((af) => toFileItem(af.file)),
    };
  }

  async updateAlbum(
    userId: string,
    albumId: string,
    data: UpdateAlbumRequest,
  ): Promise<AlbumItem> {
    const album = await this.prisma.album.findUnique({
      where: { id: albumId },
    });

    if (!album || album.ownerId !== userId) {
      throw new ApiError(404, 'NOT_FOUND', 'Album tidak ditemukan.');
    }

    const updated = await this.prisma.album.update({
      where: { id: albumId },
      data: { title: data.title },
      include: {
        coverFile: {
          select: { id: true, thumbKey: true, deletedAt: true, status: true },
        },
        albumFiles: {
          where: {
            file: {
              deletedAt: null,
              status: FileStatus.ready,
            },
          },
          orderBy: { position: 'asc' },
          include: {
            file: true,
          },
        },
      },
    });

    let activeCoverId =
      updated.coverFile &&
      updated.coverFile.deletedAt === null &&
      updated.coverFile.status === FileStatus.ready
        ? updated.coverFile.id
        : null;

    if (!activeCoverId && updated.albumFiles.length > 0) {
      activeCoverId = updated.albumFiles[0].file.id;
    }

    return {
      id: updated.id,
      title: updated.title,
      coverFileId: activeCoverId,
      fileCount: updated.albumFiles.length,
      createdAt: (updated.createdAt ?? new Date()).toISOString(),
    };
  }

  async deleteAlbum(userId: string, albumId: string): Promise<void> {
    const album = await this.prisma.album.findUnique({
      where: { id: albumId },
    });

    if (!album || album.ownerId !== userId) {
      throw new ApiError(404, 'NOT_FOUND', 'Album tidak ditemukan.');
    }

    await this.prisma.$transaction([
      this.prisma.shareLink.updateMany({
        where: {
          targetType: ShareTarget.album,
          targetId: albumId,
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      }),
      this.prisma.album.delete({
        where: { id: albumId },
      }),
    ]);
  }

  async addFilesToAlbum(
    userId: string,
    albumId: string,
    data: AddAlbumFilesRequest,
  ): Promise<AlbumDetail> {
    const album = await this.prisma.album.findUnique({
      where: { id: albumId },
      include: {
        albumFiles: {
          select: { fileId: true, position: true },
          orderBy: { position: 'desc' },
        },
      },
    });

    if (!album || album.ownerId !== userId) {
      throw new ApiError(404, 'NOT_FOUND', 'Album tidak ditemukan.');
    }

    // Validasi file yang akan ditambahkan: harus milik pengguna, status READY, dan deletedAt null
    const validFiles = await this.prisma.file.findMany({
      where: {
        id: { in: data.fileIds },
        ownerId: userId,
        status: FileStatus.ready,
        deletedAt: null,
      },
      select: { id: true },
    });

    const existingFileIds = new Set(album.albumFiles.map((af) => af.fileId));
    const newFiles = validFiles.filter((f) => !existingFileIds.has(f.id));

    if (newFiles.length > 0) {
      let maxPosition =
        album.albumFiles.length > 0 ? album.albumFiles[0].position : 0;

      await this.prisma.$transaction(
        newFiles.map((f) => {
          maxPosition += 1;
          return this.prisma.albumFile.create({
            data: {
              albumId,
              fileId: f.id,
              position: maxPosition,
            },
          });
        }),
      );

      // Cover otomatis dari file pertama jika belum disetel
      if (!album.coverFileId) {
        await this.prisma.album.update({
          where: { id: albumId },
          data: { coverFileId: newFiles[0].id },
        });
      }
    }

    return this.getAlbumDetail(userId, albumId);
  }

  async removeFileFromAlbum(
    userId: string,
    albumId: string,
    fileId: string,
  ): Promise<AlbumDetail> {
    const album = await this.prisma.album.findUnique({
      where: { id: albumId },
      include: {
        albumFiles: {
          orderBy: { position: 'asc' },
          select: { fileId: true },
        },
      },
    });

    if (!album || album.ownerId !== userId) {
      throw new ApiError(404, 'NOT_FOUND', 'Album tidak ditemukan.');
    }

    await this.prisma.albumFile.deleteMany({
      where: {
        albumId,
        fileId,
      },
    });

    // Jika file yang dihapus adalah cover, perbarui coverFileId ke file berikutnya
    if (album.coverFileId === fileId) {
      const remaining = album.albumFiles.filter((af) => af.fileId !== fileId);
      const nextCoverId = remaining.length > 0 ? remaining[0].fileId : null;

      await this.prisma.album.update({
        where: { id: albumId },
        data: { coverFileId: nextCoverId },
      });
    }

    return this.getAlbumDetail(userId, albumId);
  }
}


import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { FileKind, FileStatus, ShareTarget, UserStatus } from '../generated/prisma/client';
import type {
  CreateShareLinkRequest,
  FileItem,
  PublicShareResponse,
  ShareLinkItem,
  ShareLinksResponse,
} from '@galeriku/contracts';
import { APP_CONFIG, type AppConfig } from '../config/app-config';
import { ApiError } from '../common/errors/api-error';
import { hashIp } from '../common/utils/client-ip';
import { PrismaService } from '../prisma/prisma.service';
import { resolveMediaDir } from '../uploads/uploads.utils';

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
  takenAt: Date | null;
  createdAt: Date;
}): FileItem {
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
    takenAt: file.takenAt ? file.takenAt.toISOString() : null,
    createdAt: file.createdAt.toISOString(),
  };
}

@Injectable()
export class SharesService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async createShare(
    userId: string,
    data: CreateShareLinkRequest,
  ): Promise<ShareLinkItem> {
    let targetTitle = 'Tautan Berbagi';

    if (data.targetType === 'FILE') {
      const file = await this.prisma.file.findUnique({
        where: { id: data.targetId },
      });

      // Kepemilikan 404 identik (AD-12 & US-13)
      if (
        !file ||
        file.ownerId !== userId ||
        file.deletedAt !== null ||
        file.status !== FileStatus.ready
      ) {
        throw new ApiError(404, 'NOT_FOUND', 'File tidak ditemukan.');
      }
      targetTitle = file.originalName;
    } else {
      const album = await this.prisma.album.findUnique({
        where: { id: data.targetId },
      });

      // Kepemilikan 404 identik
      if (!album || album.ownerId !== userId) {
        throw new ApiError(404, 'NOT_FOUND', 'Album tidak ditemukan.');
      }
      targetTitle = album.title;
    }

    // Buat token 32 byte acak, base64url
    const token = randomBytes(32).toString('base64url');

    const share = await this.prisma.shareLink.create({
      data: {
        token,
        ownerId: userId,
        targetType:
          data.targetType === 'FILE' ? ShareTarget.FILE : ShareTarget.ALBUM,
        targetId: data.targetId,
        allowDownload: data.allowDownload ?? true,
      },
    });

    return {
      id: share.id,
      token: share.token,
      targetType: share.targetType === ShareTarget.FILE ? 'FILE' : 'ALBUM',
      targetId: share.targetId,
      targetTitle,
      allowDownload: share.allowDownload,
      viewCount: share.viewCount,
      expiresAt: share.expiresAt ? share.expiresAt.toISOString() : null,
      hasPassword: share.passwordHash !== null,
      isRevoked: share.revokedAt !== null,
      createdAt: (share.createdAt ?? new Date()).toISOString(),
    };
  }

  async getShares(userId: string): Promise<ShareLinksResponse> {
    const shares = await this.prisma.shareLink.findMany({
      where: { ownerId: userId },
      orderBy: { createdAt: 'desc' },
    });

    // Ambil judul target sekaligus
    const fileIds = shares
      .filter((s) => s.targetType === ShareTarget.FILE)
      .map((s) => s.targetId);
    const albumIds = shares
      .filter((s) => s.targetType === ShareTarget.ALBUM)
      .map((s) => s.targetId);

    const [files, albums] = await Promise.all([
      fileIds.length > 0
        ? this.prisma.file.findMany({
            where: { id: { in: fileIds } },
            select: { id: true, originalName: true },
          })
        : [],
      albumIds.length > 0
        ? this.prisma.album.findMany({
            where: { id: { in: albumIds } },
            select: { id: true, title: true },
          })
        : [],
    ]);

    const fileMap = new Map(files.map((f) => [f.id, f.originalName]));
    const albumMap = new Map(albums.map((a) => [a.id, a.title]));

    const items: ShareLinkItem[] = shares.map((share) => {
      const targetTitle =
        share.targetType === ShareTarget.FILE
          ? fileMap.get(share.targetId) ?? 'File'
          : albumMap.get(share.targetId) ?? 'Album';

      return {
        id: share.id,
        token: share.token,
        targetType: share.targetType === ShareTarget.FILE ? 'FILE' : 'ALBUM',
        targetId: share.targetId,
        targetTitle,
        allowDownload: share.allowDownload,
        viewCount: share.viewCount,
        expiresAt: share.expiresAt ? share.expiresAt.toISOString() : null,
        hasPassword: share.passwordHash !== null,
        isRevoked: share.revokedAt !== null,
        createdAt: (share.createdAt ?? new Date()).toISOString(),
      };
    });

    return { items };
  }

  async getShareDetail(
    userId: string,
    shareId: string,
  ): Promise<ShareLinkItem> {
    const share = await this.prisma.shareLink.findUnique({
      where: { id: shareId },
    });

    if (!share || share.ownerId !== userId) {
      throw new ApiError(404, 'NOT_FOUND', 'Tautan berbagi tidak ditemukan.');
    }

    let targetTitle = 'Tautan Berbagi';
    if (share.targetType === ShareTarget.FILE) {
      const file = await this.prisma.file.findUnique({
        where: { id: share.targetId },
        select: { originalName: true },
      });
      if (file) targetTitle = file.originalName;
    } else {
      const album = await this.prisma.album.findUnique({
        where: { id: share.targetId },
        select: { title: true },
      });
      if (album) targetTitle = album.title;
    }

    return {
      id: share.id,
      token: share.token,
      targetType: share.targetType === ShareTarget.FILE ? 'FILE' : 'ALBUM',
      targetId: share.targetId,
      targetTitle,
      allowDownload: share.allowDownload,
      viewCount: share.viewCount,
      expiresAt: share.expiresAt ? share.expiresAt.toISOString() : null,
      hasPassword: share.passwordHash !== null,
      isRevoked: share.revokedAt !== null,
      createdAt: (share.createdAt ?? new Date()).toISOString(),
    };
  }

  /**
   * Validasi tautan publik aktif (US-25 & carry-over):
   * 1. Token valid & ada di DB.
   * 2. Tidak dicabut (revokedAt null).
   * 3. Tidak kedaluwarsa (expiresAt null atau > now).
   * 4. Pemilik berstatus ACTIVE (jika SUSPENDED, link otomatis tidak aktif).
   */
  async validateActiveShare(token: string) {
    const share = await this.prisma.shareLink.findUnique({
      where: { token },
      include: {
        owner: {
          select: { status: true },
        },
      },
    });

    if (!share) {
      throw new ApiError(404, 'NOT_FOUND', 'Tautan tidak valid atau telah dihapus.');
    }

    if (share.revokedAt !== null) {
      throw new ApiError(404, 'NOT_FOUND', 'Tautan telah dicabut oleh pemiliknya.');
    }

    if (share.expiresAt && share.expiresAt.getTime() <= Date.now()) {
      throw new ApiError(404, 'NOT_FOUND', 'Tautan telah kedaluwarsa.');
    }

    // Carry-over US-25: akun nonaktif/suspended membuat link publik tidak bisa diakses
    if (share.owner.status !== UserStatus.ACTIVE) {
      throw new ApiError(404, 'NOT_FOUND', 'Tautan tidak dapat diakses.');
    }

    return share;
  }

  async getPublicShare(
    token: string,
    clientIp: string,
    userAgent?: string,
  ): Promise<PublicShareResponse> {
    const share = await this.validateActiveShare(token);

    // Catat log akses & tambah viewCount
    const ipHash = hashIp(clientIp, this.config.ipHashSecret);
    await Promise.all([
      this.prisma.shareLink.update({
        where: { id: share.id },
        data: { viewCount: { increment: 1 } },
      }),
      this.prisma.shareAccessLog.create({
        data: {
          linkId: share.id,
          ipHash,
          userAgent: userAgent ? userAgent.slice(0, 255) : null,
        },
      }),
    ]);

    if (share.targetType === ShareTarget.FILE) {
      const file = await this.prisma.file.findUnique({
        where: { id: share.targetId },
      });

      if (
        !file ||
        file.deletedAt !== null ||
        file.status !== FileStatus.ready
      ) {
        throw new ApiError(404, 'NOT_FOUND', 'File dalam tautan ini sudah tidak tersedia.');
      }

      return {
        token: share.token,
        targetType: 'FILE',
        title: file.originalName,
        allowDownload: share.allowDownload,
        createdAt: (share.createdAt ?? new Date()).toISOString(),
        files: [toFileItem(file)],
      };
    } else {
      const album = await this.prisma.album.findUnique({
        where: { id: share.targetId },
        include: {
          albumFiles: {
            where: {
              file: {
                deletedAt: null,
                status: FileStatus.ready,
              },
            },
            orderBy: { position: 'asc' },
            include: { file: true },
          },
        },
      });

      if (!album) {
        throw new ApiError(404, 'NOT_FOUND', 'Album dalam tautan ini sudah tidak tersedia.');
      }

      return {
        token: share.token,
        targetType: 'ALBUM',
        title: album.title,
        allowDownload: share.allowDownload,
        createdAt: (share.createdAt ?? new Date()).toISOString(),
        files: album.albumFiles.map((af) => toFileItem(af.file)),
      };
    }
  }

  async getPublicFileContentInfo(
    token: string,
    fileId: string,
    download = false,
  ): Promise<{
    filePath: string;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
  }> {
    const share = await this.validateActiveShare(token);

    if (download && !share.allowDownload) {
      throw new ApiError(
        403,
        'DOWNLOAD_FORBIDDEN',
        'Izin unduh dinonaktifkan oleh pemilik tautan.',
      );
    }

    let fileFound = false;
    if (share.targetType === ShareTarget.FILE) {
      if (share.targetId === fileId) {
        fileFound = true;
      }
    } else {
      const af = await this.prisma.albumFile.findFirst({
        where: {
          albumId: share.targetId,
          fileId,
        },
      });
      if (af) {
        fileFound = true;
      }
    }

    if (!fileFound) {
      throw new ApiError(404, 'NOT_FOUND', 'File tidak ditemukan dalam tautan ini.');
    }

    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
    });

    if (
      !file ||
      file.deletedAt !== null ||
      file.status !== FileStatus.ready
    ) {
      throw new ApiError(404, 'NOT_FOUND', 'File tidak ditemukan.');
    }

    const mediaDir = resolveMediaDir();
    const filePath = join(mediaDir, file.storageKey);
    if (!existsSync(filePath)) {
      throw new ApiError(404, 'NOT_FOUND', 'Berkas fisik tidak ditemukan.');
    }

    const stat = statSync(filePath);

    return {
      filePath,
      originalName: file.originalName,
      mimeType: file.mimeType,
      sizeBytes: stat.size,
    };
  }

  async getPublicThumbnailPath(
    token: string,
    fileId: string,
  ): Promise<string> {
    const share = await this.validateActiveShare(token);

    let fileFound = false;
    if (share.targetType === ShareTarget.FILE) {
      if (share.targetId === fileId) {
        fileFound = true;
      }
    } else {
      const af = await this.prisma.albumFile.findFirst({
        where: {
          albumId: share.targetId,
          fileId,
        },
      });
      if (af) {
        fileFound = true;
      }
    }

    if (!fileFound) {
      throw new ApiError(404, 'NOT_FOUND', 'Thumbnail tidak ditemukan dalam tautan ini.');
    }

    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
    });

    if (
      !file ||
      file.deletedAt !== null ||
      file.status !== FileStatus.ready ||
      !file.thumbKey
    ) {
      throw new ApiError(404, 'NOT_FOUND', 'Thumbnail tidak ditemukan.');
    }

    const mediaDir = resolveMediaDir();
    const thumbPath = join(mediaDir, file.thumbKey);
    if (!existsSync(thumbPath)) {
      throw new ApiError(404, 'NOT_FOUND', 'Thumbnail fisik tidak ditemukan.');
    }

    return thumbPath;
  }
}

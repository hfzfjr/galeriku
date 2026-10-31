import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { FileStatus, ShareTarget } from '../generated/prisma/client';
import type {
  CreateShareLinkRequest,
  ShareLinkItem,
  ShareLinksResponse,
} from '@galeriku/contracts';
import { ApiError } from '../common/errors/api-error';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SharesService {
  constructor(private readonly prisma: PrismaService) {}

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
}


import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { FileKind, FileStatus, ShareTarget, UserStatus } from '../generated/prisma/client';
import type {
  CreateShareLinkRequest,
  FileItem,
  PublicShareResponse,
  ShareExpiryOption,
  ShareLinkItem,
  ShareLinksResponse,
  UpdateShareLinkRequest,
} from '@galeriku/contracts';
import { APP_CONFIG, type AppConfig } from '../config/app-config';
import { ApiError } from '../common/errors/api-error';
import { hashIp } from '../common/utils/client-ip';
import { PrismaService } from '../prisma/prisma.service';
import { PasswordService } from '../auth/services/password.service';
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
  previewKey?: string | null;
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
    previewKey: file.previewKey ?? null,
    status: file.status,
    isFavorite: Boolean(file.isFavorite),
    takenAt: file.takenAt ? file.takenAt.toISOString() : null,
    capturedAt: capturedAt.toISOString(),
    capturedTzOffsetMin: file.capturedTzOffsetMin ?? null,
    capturedAtSource: (file.capturedAtSource as any) ?? undefined,
    place,
    hasLocation,
    cameraMake: (file as any).cameraMake ?? null,
    cameraModel: (file as any).cameraModel ?? null,
    lensModel: (file as any).lensModel ?? null,
    iso: (file as any).iso ?? null,
    fNumber: (file as any).fNumber ?? null,
    exposureS: (file as any).exposureS ?? null,
    focalLengthMm: (file as any).focalLengthMm ?? null,
    createdAt: file.createdAt.toISOString(),
    deletedAt: file.deletedAt ? file.deletedAt.toISOString() : null,
  };
}

@Injectable()
export class SharesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  calculateExpiresAt(expiry?: ShareExpiryOption): Date | null {
    const mode = expiry ?? '30_DAYS';
    const now = Date.now();
    switch (mode) {
      case '1_DAY':
        return new Date(now + 86400_000);
      case '7_DAYS':
        return new Date(now + 7 * 86400_000);
      case '30_DAYS':
        return new Date(now + 30 * 86400_000);
      case 'NEVER':
        return null;
      default:
        return new Date(now + 30 * 86400_000);
    }
  }

  getPasswordFingerprint(passwordHash: string | null): string {
    if (!passwordHash) return 'none';
    return createHash('sha256').update(passwordHash).digest('hex').slice(0, 16);
  }

  generateUnlockToken(shareId: string, passwordHash: string | null): string {
    const expiresAt = Date.now() + 24 * 3600 * 1000;
    const fingerprint = this.getPasswordFingerprint(passwordHash);
    const payload = `${shareId}:${fingerprint}:${expiresAt}`;
    const sig = createHmac('sha256', this.config.ipHashSecret)
      .update(payload)
      .digest('hex');
    return `${expiresAt}.${sig}`;
  }

  verifyUnlockToken(
    shareId: string,
    passwordHash: string | null,
    token: string | undefined,
  ): boolean {
    if (!token || typeof token !== 'string') return false;
    const dotIndex = token.indexOf('.');
    if (dotIndex === -1) return false;

    const expiresAtStr = token.slice(0, dotIndex);
    const sigHex = token.slice(dotIndex + 1);
    const expiresAt = Number(expiresAtStr);

    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      return false;
    }

    const fingerprint = this.getPasswordFingerprint(passwordHash);
    const payload = `${shareId}:${fingerprint}:${expiresAtStr}`;
    const expectedSig = createHmac('sha256', this.config.ipHashSecret)
      .update(payload)
      .digest('hex');

    const expectedBuf = Buffer.from(expectedSig, 'hex');
    const actualBuf = Buffer.from(sigHex, 'hex');

    if (expectedBuf.length !== actualBuf.length) {
      return false;
    }

    return timingSafeEqual(expectedBuf, actualBuf);
  }

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

    const token = randomBytes(32).toString('base64url');
    const expiresAt = this.calculateExpiresAt(data.expiry);
    const passwordHash = data.password?.trim()
      ? await this.passwordService.hashPassword(data.password.trim())
      : null;

    const share = await this.prisma.shareLink.create({
      data: {
        token,
        ownerId: userId,
        targetType:
          data.targetType === 'FILE' ? ShareTarget.file : ShareTarget.album,
        targetId: data.targetId,
        allowDownload: data.allowDownload ?? true,
        expiresAt,
        passwordHash,
      },
    });

    return {
      id: share.id,
      token: share.token,
      targetType: share.targetType === ShareTarget.file ? 'FILE' : 'ALBUM',
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

  async updateShare(
    userId: string,
    shareId: string,
    data: UpdateShareLinkRequest,
  ): Promise<ShareLinkItem> {
    const existing = await this.prisma.shareLink.findUnique({
      where: { id: shareId },
    });

    if (!existing || existing.ownerId !== userId) {
      throw new ApiError(404, 'NOT_FOUND', 'Tautan berbagi tidak ditemukan.');
    }

    const updateData: Record<string, unknown> = {};

    if (data.allowDownload !== undefined) {
      updateData.allowDownload = data.allowDownload;
    }

    if (data.expiry !== undefined) {
      updateData.expiresAt = this.calculateExpiresAt(data.expiry);
    }

    if (data.password !== undefined) {
      if (data.password && data.password.trim()) {
        updateData.passwordHash = await this.passwordService.hashPassword(
          data.password.trim(),
        );
      } else {
        updateData.passwordHash = null;
      }
    }

    const share = await this.prisma.shareLink.update({
      where: { id: shareId },
      data: updateData,
    });

    return this.getShareDetail(userId, share.id);
  }

  async revokeShare(
    userId: string,
    shareId: string,
  ): Promise<ShareLinkItem> {
    const existing = await this.prisma.shareLink.findUnique({
      where: { id: shareId },
    });

    if (!existing || existing.ownerId !== userId) {
      throw new ApiError(404, 'NOT_FOUND', 'Tautan berbagi tidak ditemukan.');
    }

    if (!existing.revokedAt) {
      await this.prisma.shareLink.update({
        where: { id: shareId },
        data: { revokedAt: new Date() },
      });
    }

    return this.getShareDetail(userId, shareId);
  }

  async getShares(userId: string): Promise<ShareLinksResponse> {
    const shares = await this.prisma.shareLink.findMany({
      where: { ownerId: userId },
      orderBy: { createdAt: 'desc' },
    });

    const fileIds = shares
      .filter((s) => s.targetType === ShareTarget.file)
      .map((s) => s.targetId);
    const albumIds = shares
      .filter((s) => s.targetType === ShareTarget.album)
      .map((s) => s.targetId);

    const [files, albums] = await Promise.all([
      fileIds.length > 0
        ? this.prisma.file.findMany({
            where: { id: { in: fileIds } },
            select: { id: true, originalName: true, deletedAt: true },
          })
        : [],
      albumIds.length > 0
        ? this.prisma.album.findMany({
            where: { id: { in: albumIds } },
            select: { id: true, title: true },
          })
        : [],
    ]);

    const fileMap = new Map(
      files.map((f) => [
        f.id,
        f.deletedAt === null ? f.originalName : 'File dihapus',
      ]),
    );
    const albumMap = new Map(albums.map((a) => [a.id, a.title]));

    const items: ShareLinkItem[] = shares.map((share) => {
      const targetTitle =
        share.targetType === ShareTarget.file
          ? fileMap.get(share.targetId) ?? 'File dihapus'
          : albumMap.get(share.targetId) ?? 'Album dihapus';

      return {
        id: share.id,
        token: share.token,
        targetType: share.targetType === ShareTarget.file ? 'FILE' : 'ALBUM',
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
    if (share.targetType === ShareTarget.file) {
      const file = await this.prisma.file.findUnique({
        where: { id: share.targetId },
        select: { originalName: true, deletedAt: true },
      });
      if (!file || file.deletedAt !== null) {
        targetTitle = 'File dihapus';
      } else {
        targetTitle = file.originalName;
      }
    } else {
      const album = await this.prisma.album.findUnique({
        where: { id: share.targetId },
        select: { title: true },
      });
      if (!album) {
        targetTitle = 'Album dihapus';
      } else {
        targetTitle = album.title;
      }
    }

    return {
      id: share.id,
      token: share.token,
      targetType: share.targetType === ShareTarget.file ? 'FILE' : 'ALBUM',
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

    if (share.owner.status !== UserStatus.ACTIVE) {
      throw new ApiError(404, 'NOT_FOUND', 'Tautan tidak dapat diakses.');
    }

    return share;
  }

  async unlockShare(
    token: string,
    passwordInput: string,
  ): Promise<{ unlockToken: string; cookieName: string }> {
    const share = await this.validateActiveShare(token);

    if (share.passwordHash) {
      const valid = await this.passwordService.verifyPassword(
        share.passwordHash,
        passwordInput,
      );
      if (!valid) {
        throw new ApiError(401, 'INVALID_PASSWORD', 'Kata sandi salah.');
      }
    }

    const unlockToken = this.generateUnlockToken(share.id, share.passwordHash);
    const cookieName = `galeriku_unlock_${share.id}`;
    return { unlockToken, cookieName };
  }

  async resolvePublicShare(token: string) {
    return this.validateActiveShare(token);
  }

  async recordPublicShareView(
    shareId: string,
    clientIp: string,
    userAgent?: string,
  ): Promise<void> {
    const ipHash = hashIp(clientIp, this.config.ipHashSecret);
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

    const recentLog = await this.prisma.shareAccessLog.findFirst({
      where: {
        linkId: shareId,
        ipHash,
        createdAt: { gte: thirtyMinutesAgo },
      },
    });

    if (!recentLog) {
      await Promise.all([
        this.prisma.shareLink.update({
          where: { id: shareId },
          data: { viewCount: { increment: 1 } },
        }),
        this.prisma.shareAccessLog.create({
          data: {
            linkId: shareId,
            ipHash,
            userAgent: userAgent ? userAgent.slice(0, 255) : null,
          },
        }),
      ]);
    }
  }

  async getPublicShare(
    token: string,
    clientIp: string,
    userAgent?: string,
    unlockTokenOrGetter?: string | ((shareId: string) => string | undefined),
  ): Promise<PublicShareResponse> {
    const share = await this.resolvePublicShare(token);
    const unlockToken =
      typeof unlockTokenOrGetter === 'function'
        ? unlockTokenOrGetter(share.id)
        : unlockTokenOrGetter;

    // Ambil judul target
    let targetTitle = 'Tautan Berbagi';
    if (share.targetType === ShareTarget.file) {
      const f = await this.prisma.file.findUnique({
        where: { id: share.targetId },
        select: { originalName: true, deletedAt: true },
      });
      if (f && f.deletedAt === null) {
        targetTitle = f.originalName;
      } else {
        targetTitle = 'File dihapus';
      }
    } else {
      const a = await this.prisma.album.findUnique({
        where: { id: share.targetId },
        select: { title: true },
      });
      if (a) {
        targetTitle = a.title;
      } else {
        targetTitle = 'Album dihapus';
      }
    }

    const hasPassword = share.passwordHash !== null;
    const isUnlocked =
      !hasPassword ||
      this.verifyUnlockToken(share.id, share.passwordHash, unlockToken);

    // Catat log akses & viewCount hanya saat unlocked atau jika tidak ada password
    // dan dibatasi paling banyak sekali per (link, ipHash) per 30 menit
    if (isUnlocked) {
      await this.recordPublicShareView(share.id, clientIp, userAgent);
    }

    if (!isUnlocked) {
      return {
        token: share.token,
        targetType: share.targetType === ShareTarget.file ? 'FILE' : 'ALBUM',
        title: targetTitle,
        allowDownload: share.allowDownload,
        createdAt: (share.createdAt ?? new Date()).toISOString(),
        hasPassword: true,
        isUnlocked: false,
        files: [],
      };
    }

    if (share.targetType === ShareTarget.file) {
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
        hasPassword,
        isUnlocked: true,
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
        hasPassword,
        isUnlocked: true,
        files: album.albumFiles.map((af) => toFileItem(af.file)),
      };
    }
  }

  async getPublicFileContentInfo(
    token: string,
    fileId: string,
    download = false,
    unlockTokenOrGetter?: string | ((shareId: string) => string | undefined),
  ): Promise<{
    filePath: string;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
  }> {
    const share = await this.resolvePublicShare(token);
    const unlockToken =
      typeof unlockTokenOrGetter === 'function'
        ? unlockTokenOrGetter(share.id)
        : unlockTokenOrGetter;

    if (
      share.passwordHash &&
      !this.verifyUnlockToken(share.id, share.passwordHash, unlockToken)
    ) {
      throw new ApiError(401, 'LOCKED', 'Tautan dilindungi kata sandi.');
    }

    if (download && !share.allowDownload) {
      throw new ApiError(
        403,
        'DOWNLOAD_FORBIDDEN',
        'Izin unduh dinonaktifkan oleh pemilik tautan.',
      );
    }

    let fileFound = false;
    if (share.targetType === ShareTarget.file) {
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

  async getAlbumZipInfo(
    token: string,
    unlockTokenOrGetter?: string | ((shareId: string) => string | undefined),
  ): Promise<{
    title: string;
    files: Array<{ originalName: string; filePath: string }>;
  }> {
    const share = await this.resolvePublicShare(token);
    const unlockToken =
      typeof unlockTokenOrGetter === 'function'
        ? unlockTokenOrGetter(share.id)
        : unlockTokenOrGetter;

    if (
      share.passwordHash &&
      !this.verifyUnlockToken(share.id, share.passwordHash, unlockToken)
    ) {
      throw new ApiError(401, 'LOCKED', 'Tautan dilindungi kata sandi.');
    }

    if (!share.allowDownload) {
      throw new ApiError(
        403,
        'DOWNLOAD_FORBIDDEN',
        'Izin unduh dinonaktifkan oleh pemilik tautan.',
      );
    }

    if (share.targetType !== ShareTarget.album) {
      throw new ApiError(
        400,
        'BAD_REQUEST',
        'Hanya album yang dapat diunduh sebagai ZIP.',
      );
    }

    const album = await this.prisma.album.findUnique({
      where: { id: share.targetId },
      include: {
        albumFiles: {
          include: {
            file: true,
          },
          orderBy: { position: 'asc' },
        },
      },
    });

    if (!album) {
      throw new ApiError(404, 'NOT_FOUND', 'Album tidak ditemukan.');
    }

    const mediaDir = resolveMediaDir();
    const readyFiles: Array<{ originalName: string; filePath: string }> = [];

    for (const af of album.albumFiles) {
      const f = af.file;
      if (f.deletedAt === null && f.status === FileStatus.ready) {
        const fullPath = join(mediaDir, f.storageKey);
        if (existsSync(fullPath)) {
          readyFiles.push({
            originalName: f.originalName,
            filePath: fullPath,
          });
        }
      }
    }

    return {
      title: album.title,
      files: readyFiles,
    };
  }

  async getPublicCoverPath(
    token: string,
    unlockTokenOrGetter?: string | ((shareId: string) => string | undefined),
  ): Promise<string> {
    const share = await this.resolvePublicShare(token);
    const unlockToken =
      typeof unlockTokenOrGetter === 'function'
        ? unlockTokenOrGetter(share.id)
        : unlockTokenOrGetter;

    if (
      share.passwordHash &&
      !this.verifyUnlockToken(share.id, share.passwordHash, unlockToken)
    ) {
      throw new ApiError(401, 'LOCKED', 'Tautan dilindungi kata sandi.');
    }

    let firstFileId: string | null = null;
    if (share.targetType === ShareTarget.file) {
      firstFileId = share.targetId;
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
            take: 1,
            select: { fileId: true },
          },
        },
      });
      if (album && album.albumFiles.length > 0) {
        firstFileId = album.albumFiles[0].fileId;
      }
    }

    if (!firstFileId) {
      throw new ApiError(404, 'NOT_FOUND', 'Cover tidak tersedia.');
    }

    return this.getPublicThumbnailPath(token, firstFileId, unlockToken);
  }

  async getPublicThumbnailPath(
    token: string,
    fileId: string,
    unlockTokenOrGetter?: string | ((shareId: string) => string | undefined),
  ): Promise<string> {
    const share = await this.resolvePublicShare(token);
    const unlockToken =
      typeof unlockTokenOrGetter === 'function'
        ? unlockTokenOrGetter(share.id)
        : unlockTokenOrGetter;

    if (
      share.passwordHash &&
      !this.verifyUnlockToken(share.id, share.passwordHash, unlockToken)
    ) {
      throw new ApiError(401, 'LOCKED', 'Tautan dilindungi kata sandi.');
    }

    let fileFound = false;
    if (share.targetType === ShareTarget.file) {
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

  async getPublicPreviewPath(
    token: string,
    fileId: string,
    unlockTokenOrGetter?: string | ((shareId: string) => string | undefined),
  ): Promise<{ previewPath: string; hasPassword: boolean }> {
    const share = await this.resolvePublicShare(token);
    const hasPassword = Boolean(share.passwordHash);
    const unlockToken =
      typeof unlockTokenOrGetter === 'function'
        ? unlockTokenOrGetter(share.id)
        : unlockTokenOrGetter;

    if (
      share.passwordHash &&
      !this.verifyUnlockToken(share.id, share.passwordHash, unlockToken)
    ) {
      throw new ApiError(401, 'LOCKED', 'Tautan dilindungi kata sandi.');
    }

    let fileFound = false;
    if (share.targetType === ShareTarget.file) {
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
      throw new ApiError(404, 'NOT_FOUND', 'Preview tidak ditemukan dalam tautan ini.');
    }

    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
    });

    if (
      !file ||
      file.deletedAt !== null ||
      file.status !== FileStatus.ready ||
      !file.previewKey
    ) {
      throw new ApiError(404, 'NOT_FOUND', 'Preview tidak ditemukan.');
    }

    const mediaDir = resolveMediaDir();
    const previewPath = join(mediaDir, file.previewKey);
    if (!existsSync(previewPath)) {
      throw new ApiError(404, 'NOT_FOUND', 'Preview fisik tidak ditemukan.');
    }

    return { previewPath, hasPassword };
  }
}

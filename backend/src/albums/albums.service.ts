import { createReadStream } from 'node:fs';
import { join } from 'node:path';
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
import { resolveMediaDir } from '../uploads/uploads.utils';
import { formatZipEntryName, type ZipEntry } from '../shares/zip-stream';

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
  liveKind?: string | null;
  duplicateOfId?: string | null;
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
    duplicateOfId: file.duplicateOfId ?? null,
    isDuplicate: Boolean(file.duplicateOfId),
    createdAt: file.createdAt.toISOString(),
    deletedAt: file.deletedAt ? file.deletedAt.toISOString() : null,
  };
}

@Injectable()
export class AlbumsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Menghitung kedalaman album dari root (akar = 1, maks 4).
   */
  async getAlbumDepth(albumId: string): Promise<number> {
    let depth = 1;
    let currentId: string | null = albumId;
    const visited = new Set<string>();

    while (currentId) {
      if (visited.has(currentId)) break;
      visited.add(currentId);
      const parent: { parentId?: string | null } | null = await this.prisma.album.findUnique({
        where: { id: currentId },
        select: { parentId: true },
      });
      if (!parent || !parent.parentId) {
        break;
      }
      depth += 1;
      currentId = parent.parentId;
    }
    return depth;
  }

  /**
   * Mengambil urutan breadcrumb [{ id, title }] dari root ke album saat ini.
   */
  async getAlbumBreadcrumb(albumId: string): Promise<Array<{ id: string; title: string }>> {
    const chain: Array<{ id: string; title: string }> = [];
    let currentId: string | null = albumId;
    const visited = new Set<string>();

    while (currentId) {
      if (visited.has(currentId)) break;
      visited.add(currentId);
      const alb: { id: string; title: string; parentId?: string | null } | null =
        await this.prisma.album.findUnique({
          where: { id: currentId },
          select: { id: true, title: true, parentId: true },
        });
      if (!alb) break;
      chain.unshift({ id: alb.id, title: alb.title });
      currentId = alb.parentId ?? null;
    }
    return chain;
  }

  /**
   * Menghitung tinggi subtree (maksimum jarak ke daun terdalam, album sendiri = 1).
   */
  async getSubtreeHeight(albumId: string): Promise<number> {
    const children: Array<{ id: string }> = await this.prisma.album.findMany({
      where: { parentId: albumId },
      select: { id: true },
    });
    if (children.length === 0) return 1;
    const childHeights = await Promise.all(
      children.map((c) => this.getSubtreeHeight(c.id)),
    );
    return 1 + Math.max(...childHeights);
  }

  /**
   * Mengambil seluruh id di dalam subtree album (termasuk albumId sendiri).
   */
  async getAllSubtreeIds(albumId: string): Promise<string[]> {
    const ids: string[] = [albumId];
    const children: Array<{ id: string }> = await this.prisma.album.findMany({
      where: { parentId: albumId },
      select: { id: true },
    });
    for (const c of children) {
      const subIds = await this.getAllSubtreeIds(c.id);
      ids.push(...subIds);
    }
    return ids;
  }

  /**
   * Memastikan judul album unik per induk secara case-insensitive (RF-50 / D6).
   */
  async assertTitleUnique(
    userId: string,
    parentId: string | null,
    title: string,
    excludeAlbumId?: string,
  ): Promise<void> {
    const siblings = await this.prisma.album.findMany({
      where: {
        ownerId: userId,
        parentId,
        ...(excludeAlbumId ? { id: { not: excludeAlbumId } } : {}),
      },
      select: { id: true, title: true },
    });

    const normalized = title.trim().toLowerCase();
    const duplicate = siblings.find(
      (s) => s.title.trim().toLowerCase() === normalized,
    );
    if (duplicate) {
      throw new ApiError(
        409,
        'ALBUM_TITLE_EXISTS',
        'Sudah ada album dengan nama ini di dalam folder yang sama.',
      );
    }
  }

  /**
   * Menentukan coverFileId dengan fallback ke foto anak pertama jika kosong.
   */
  private async resolveCoverFileId(
    album: {
      id: string;
      coverFileId?: string | null;
      coverFile?: { id: string; deletedAt?: Date | null; status?: string } | null;
      albumFiles?: Array<{ file: { id: string; deletedAt?: Date | null; status?: string } }>;
    },
  ): Promise<string | null> {
    if (
      album.coverFile &&
      album.coverFile.deletedAt === null &&
      album.coverFile.status === FileStatus.ready
    ) {
      return album.coverFile.id;
    }
    if (album.albumFiles && album.albumFiles.length > 0) {
      const active = album.albumFiles.find(
        (af) => !af.file.deletedAt && af.file.status === FileStatus.ready,
      );
      if (active) return active.file.id;
    }
    // Coba cari dari anak-anak jika album sendiri kosong
    const childAlbums = await this.prisma.album.findMany({
      where: { parentId: album.id },
      include: {
        albumFiles: {
          where: { file: { deletedAt: null, status: FileStatus.ready } },
          orderBy: { position: 'asc' },
          take: 1,
          select: { file: { select: { id: true } } },
        },
      },
    });
    for (const child of childAlbums) {
      if (child.albumFiles && child.albumFiles.length > 0) {
        return child.albumFiles[0].file.id;
      }
    }
    return null;
  }

  async createAlbum(
    userId: string,
    data: CreateAlbumRequest,
  ): Promise<AlbumItem> {
    const targetParentId = data.parentId && data.parentId !== 'null' && data.parentId !== ''
      ? data.parentId
      : null;

    if (targetParentId) {
      const parent = await this.prisma.album.findUnique({
        where: { id: targetParentId },
        select: { id: true, ownerId: true },
      });
      if (!parent || parent.ownerId !== userId) {
        throw new ApiError(404, 'NOT_FOUND', 'Album induk tidak ditemukan.');
      }
      const parentDepth = await this.getAlbumDepth(targetParentId);
      if (parentDepth >= 4) {
        throw new ApiError(
          400,
          'MAX_DEPTH_EXCEEDED',
          'Kedalaman album maksimal 4 tingkat.',
        );
      }
    }

    await this.assertTitleUnique(userId, targetParentId, data.title);

    const album = await this.prisma.album.create({
      data: {
        ownerId: userId,
        title: data.title,
        parentId: targetParentId,
      },
    });

    return {
      id: album.id,
      title: album.title,
      parentId: (album as any).parentId ?? null,
      coverFileId: null,
      fileCount: 0,
      childCount: 0,
      createdAt: (album.createdAt ?? new Date()).toISOString(),
    };
  }

  async getAlbums(
    userId: string,
    query?: { parentId?: string | null },
  ): Promise<AlbumsResponse> {
    const parentId =
      query?.parentId && query.parentId !== 'null' && query.parentId !== ''
        ? query.parentId
        : null;

    if (parentId !== null) {
      const parent = await this.prisma.album.findUnique({
        where: { id: parentId },
        select: { id: true, ownerId: true },
      });
      if (!parent || parent.ownerId !== userId) {
        throw new ApiError(404, 'NOT_FOUND', 'Album tidak ditemukan.');
      }
    }

    const albums = await this.prisma.album.findMany({
      where: {
        ownerId: userId,
        parentId,
      },
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
              select: { id: true, thumbKey: true, deletedAt: true, status: true },
            },
          },
        },
        children: {
          select: { id: true },
        },
      },
    });

    const items: AlbumItem[] = await Promise.all(
      albums.map(async (album) => {
        const activeCoverId = await this.resolveCoverFileId(album as any);
        const childCount = (album as any).children?.length ?? 0;

        return {
          id: album.id,
          title: album.title,
          parentId: (album as any).parentId ?? null,
          coverFileId: activeCoverId,
          fileCount: album.albumFiles.length,
          childCount,
          createdAt: (album.createdAt ?? new Date()).toISOString(),
        };
      }),
    );

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
        children: {
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
                  select: { id: true, thumbKey: true, deletedAt: true, status: true },
                },
              },
            },
            children: {
              select: { id: true },
            },
          },
        },
      },
    });

    // Kepemilikan menjawab 404 identik (AD-12 & US-13)
    if (!album || album.ownerId !== userId) {
      throw new ApiError(404, 'NOT_FOUND', 'Album tidak ditemukan.');
    }

    const activeCoverId = await this.resolveCoverFileId(album as any);
    const breadcrumb = await this.getAlbumBreadcrumb(albumId);

    const subAlbums: AlbumItem[] = await Promise.all(
      ((album as any).children ?? []).map(async (child: any) => {
        const coverId = await this.resolveCoverFileId(child);
        return {
          id: child.id,
          title: child.title,
          parentId: child.parentId ?? null,
          coverFileId: coverId,
          fileCount: child.albumFiles?.length ?? 0,
          childCount: child.children?.length ?? 0,
          createdAt: (child.createdAt ?? new Date()).toISOString(),
        };
      }),
    );

    return {
      id: album.id,
      title: album.title,
      parentId: (album as any).parentId ?? null,
      coverFileId: activeCoverId,
      fileCount: album.albumFiles.length,
      childCount: subAlbums.length,
      createdAt: (album.createdAt ?? new Date()).toISOString(),
      breadcrumb,
      subAlbums,
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
      include: {
        children: { select: { id: true } },
      },
    });

    if (!album || album.ownerId !== userId) {
      throw new ApiError(404, 'NOT_FOUND', 'Album tidak ditemukan.');
    }

    await this.assertTitleUnique(
      userId,
      (album as any).parentId ?? null,
      data.title,
      albumId,
    );

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
        children: { select: { id: true } },
      },
    });

    const activeCoverId = await this.resolveCoverFileId(updated as any);

    return {
      id: updated.id,
      title: updated.title,
      parentId: (updated as any).parentId ?? null,
      coverFileId: activeCoverId,
      fileCount: updated.albumFiles.length,
      childCount: (updated as any).children?.length ?? 0,
      createdAt: (updated.createdAt ?? new Date()).toISOString(),
    };
  }

  async moveAlbum(
    userId: string,
    albumId: string,
    data: { parentId: string | null },
  ): Promise<AlbumItem> {
    const album = await this.prisma.album.findUnique({
      where: { id: albumId },
      include: {
        children: { select: { id: true } },
      },
    });

    if (!album || album.ownerId !== userId) {
      throw new ApiError(404, 'NOT_FOUND', 'Album tidak ditemukan.');
    }

    const targetParentId = data.parentId;

    // Tidak boleh memindahkan ke dirinya sendiri
    if (targetParentId === albumId) {
      throw new ApiError(
        400,
        'INVALID_MOVE',
        'Album tidak dapat dipindahkan ke dirinya sendiri.',
      );
    }

    if (targetParentId !== null) {
      const targetParent = await this.prisma.album.findUnique({
        where: { id: targetParentId },
      });
      if (!targetParent || targetParent.ownerId !== userId) {
        throw new ApiError(404, 'NOT_FOUND', 'Album tujuan tidak ditemukan.');
      }

      // Deteksi siklus: pastikan targetParent bukan keturunan dari albumId
      let ancestorId: string | null = targetParentId;
      const visited = new Set<string>();
      while (ancestorId) {
        if (ancestorId === albumId) {
          throw new ApiError(
            400,
            'CYCLE_DETECTED',
            'Album tidak dapat dipindahkan ke dalam keturunannya sendiri.',
          );
        }
        if (visited.has(ancestorId)) break;
        visited.add(ancestorId);
        const anc: { parentId?: string | null } | null =
          await this.prisma.album.findUnique({
            where: { id: ancestorId },
            select: { parentId: true },
          });
        ancestorId = anc?.parentId ?? null;
      }

      // Cek batas kedalaman maksimum 4 tingkat
      const targetDepth = await this.getAlbumDepth(targetParentId);
      const treeHeight = await this.getSubtreeHeight(albumId);
      if (targetDepth + treeHeight > 4) {
        throw new ApiError(
          400,
          'MAX_DEPTH_EXCEEDED',
          'Pemindahan ini akan melebihi batas kedalaman album 4 tingkat.',
        );
      }
    }

    // Pastikan judul unik di parent baru
    await this.assertTitleUnique(userId, targetParentId, album.title, albumId);

    const updated = await this.prisma.album.update({
      where: { id: albumId },
      data: { parentId: targetParentId },
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
        children: { select: { id: true } },
      },
    });

    const activeCoverId = await this.resolveCoverFileId(updated as any);

    return {
      id: updated.id,
      title: updated.title,
      parentId: (updated as any).parentId ?? null,
      coverFileId: activeCoverId,
      fileCount: updated.albumFiles.length,
      childCount: (updated as any).children?.length ?? 0,
      createdAt: (updated.createdAt ?? new Date()).toISOString(),
    };
  }

  async deleteAlbum(
    userId: string,
    albumId: string,
    mode: 'only' | 'subtree' = 'only',
  ): Promise<void> {
    const album = await this.prisma.album.findUnique({
      where: { id: albumId },
    });

    if (!album || album.ownerId !== userId) {
      throw new ApiError(404, 'NOT_FOUND', 'Album tidak ditemukan.');
    }

    const currentParentId = (album as any).parentId ?? null;

    if (mode === 'only') {
      const children = await this.prisma.album.findMany({
        where: { parentId: albumId },
      });

      if (children.length > 0) {
        // Cek apakah ada nama anak yang bentrok di level target parent
        const siblingsAtParent = await this.prisma.album.findMany({
          where: {
            ownerId: userId,
            parentId: currentParentId,
            id: { not: albumId },
          },
          select: { title: true },
        });

        const siblingTitles = new Set(
          siblingsAtParent.map((s) => s.title.trim().toLowerCase()),
        );
        const conflicts = children
          .filter((c) => siblingTitles.has(c.title.trim().toLowerCase()))
          .map((c) => c.title);

        if (conflicts.length > 0) {
          throw new ApiError(
            409,
            'ALBUM_TITLE_EXISTS',
            `Gagal mempromosikan sub-album: nama '${conflicts.join(', ')}' bentrok dengan album lain.`,
          );
        }

        // Naikkan sub-album ke parent dari album yang dihapus
        await this.prisma.album.updateMany({
          where: { parentId: albumId },
          data: { parentId: currentParentId },
        });
      }

      // Naikkan file ke induk jika punya induk
      if (currentParentId) {
        const albumFiles = await this.prisma.albumFile.findMany({
          where: { albumId },
        });
        for (const af of albumFiles) {
          const exists = await this.prisma.albumFile.findUnique({
            where: {
              albumId_fileId: {
                albumId: currentParentId,
                fileId: af.fileId,
              },
            },
          });
          if (!exists) {
            await this.prisma.albumFile.create({
              data: {
                albumId: currentParentId,
                fileId: af.fileId,
                position: af.position,
              },
            });
          }
        }
      }

      // Cabut tautan berbagi untuk album yang dihapus
      await this.prisma.shareLink.updateMany({
        where: {
          targetType: ShareTarget.album,
          targetId: albumId,
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });

      // Hapus album
      await this.prisma.album.delete({
        where: { id: albumId },
      });
    } else {
      // mode === 'subtree': hapus seluruh subtree album
      const allIds = await this.getAllSubtreeIds(albumId);

      // Cabut seluruh tautan berbagi di subtree
      await this.prisma.shareLink.updateMany({
        where: {
          targetType: ShareTarget.album,
          targetId: { in: allIds },
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });

      // Hapus seluruh album dari anak terdalam ke induk
      for (const id of allIds.reverse()) {
        await this.prisma.album.delete({
          where: { id },
        });
      }
    }
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

  async getAlbumZipEntries(
    userId: string,
    albumId: string,
  ): Promise<{ filename: string; entries: ZipEntry[] }> {
    const root = await this.prisma.album.findUnique({
      where: { id: albumId },
    });

    if (!root || root.ownerId !== userId) {
      throw new ApiError(404, 'NOT_FOUND', 'Album tidak ditemukan.');
    }

    const allAlbumIds = await this.getAllSubtreeIds(albumId);
    const albums = await this.prisma.album.findMany({
      where: { id: { in: allAlbumIds } },
      include: {
        albumFiles: {
          orderBy: { position: 'asc' },
          include: {
            file: true,
          },
        },
      },
    });

    const albumMap = new Map(albums.map((a) => [a.id, a]));
    const sanitizeFolder = (name: string) =>
      name.replace(/[/\\?%*:|"<>]/g, '_').trim() || 'album';

    const getFolderPath = (albId: string): string => {
      const alb = albumMap.get(albId);
      if (!alb) return sanitizeFolder(root.title);
      if (alb.id === root.id || !alb.parentId) {
        return sanitizeFolder(root.title);
      }
      const parentP = getFolderPath(alb.parentId);
      return `${parentP}/${sanitizeFolder(alb.title)}`;
    };

    const mediaDir = resolveMediaDir();
    const entries: ZipEntry[] = [];

    for (const alb of albums) {
      const folderPath = getFolderPath(alb.id);
      const files = alb.albumFiles
        .map((af) => af.file)
        .filter((f) => f.deletedAt === null && f.status === FileStatus.ready);

      const total = files.length;
      for (let i = 0; i < total; i++) {
        const f = files[i];
        const entryName = formatZipEntryName(
          alb.title,
          i + 1,
          total,
          f.originalName,
        );
        const zipPath = `${folderPath}/${entryName}`;
        const filePath = join(mediaDir, f.storageKey);

        entries.push({
          filename: zipPath,
          getStream: () => createReadStream(filePath),
          mtime: f.capturedAt ?? f.createdAt,
        });
      }
    }

    const safeTitle = sanitizeFolder(root.title);
    const filename = `${safeTitle}.zip`;

    return { filename, entries };
  }
}


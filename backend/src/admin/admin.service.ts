import { Injectable, Logger } from '@nestjs/common';
import { readdir, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  AdminUserItem,
  AdminUsersQuery,
  AdminUsersResponse,
} from '@galeriku/contracts';
import { adminUsersQuerySchema } from '@galeriku/contracts';
import {
  FileStatus,
  UserStatus,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ApiError } from '../common/errors/api-error';
import { TUS_OWNER_METADATA_KEY } from '../uploads/uploads.constants';
import { resolveMediaDir, tusDirOf } from '../uploads/uploads.utils';

// Cursor buram: base64url dari { id } terakhir halaman sebelumnya.
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

type UserRow = {
  id: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
  role: string;
  status: string;
  emailVerifiedAt: Date | null;
  quotaBytes: bigint;
  createdAt: Date;
  lastLoginAt: Date | null;
};

// BigInt selalu string di JSON; tanpa password_hash/google_sub/sesi.
export function toAdminUserItem(
  user: UserRow,
  usedBytes: bigint,
): AdminUserItem {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl,
    role: user.role,
    status: user.status,
    emailVerified: user.emailVerifiedAt !== null,
    quotaBytes: user.quotaBytes.toString(),
    usedBytes: usedBytes.toString(),
    createdAt: user.createdAt.toISOString(),
    lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
  };
}

function validationError(
  fields: Array<{ field: string; message: string }>,
): ApiError {
  return new ApiError(400, 'VALIDATION_ERROR', 'Data yang dikirim tidak valid.', {
    fields,
  });
}

function userNotFound(): ApiError {
  return new ApiError(
    404,
    'USER_NOT_FOUND',
    'Pengguna tidak ditemukan. Mungkin sudah dihapus.',
  );
}

function cannotModifySelf(aksi: 'menangguhkan' | 'menghapus'): ApiError {
  return new ApiError(
    403,
    'CANNOT_MODIFY_SELF',
    `Kamu tidak bisa ${aksi} akunmu sendiri.`,
  );
}

const ADMIN_SELECT = {
  id: true,
  name: true,
  email: true,
  avatarUrl: true,
  role: true,
  status: true,
  emailVerifiedAt: true,
  quotaBytes: true,
  createdAt: true,
  lastLoginAt: true,
} as const;

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(private readonly prisma: PrismaService) {}

  // Satu agregat untuk seluruh halaman (bukan N+1): SUM(size_bytes)
  // file milik pengguna dengan deleted_at NULL dan status bukan failed.
  private async usedBytesByOwner(ids: string[]): Promise<Map<string, bigint>> {
    if (ids.length === 0) {
      return new Map();
    }
    const rows = await this.prisma.file.groupBy({
      by: ['ownerId'],
      where: {
        ownerId: { in: ids },
        deletedAt: null,
        status: { not: FileStatus.failed },
      },
      _sum: { sizeBytes: true },
    });
    const hasil = new Map<string, bigint>();
    for (const row of rows) {
      hasil.set(row.ownerId, row._sum.sizeBytes ?? 0n);
    }
    return hasil;
  }

  private async toItemWithUsage(user: UserRow): Promise<AdminUserItem> {
    const terpakai = await this.usedBytesByOwner([user.id]);
    return toAdminUserItem(user, terpakai.get(user.id) ?? 0n);
  }

  async listUsers(rawQuery: unknown): Promise<AdminUsersResponse> {
    const parsed = adminUsersQuerySchema.safeParse(rawQuery ?? {});
    if (!parsed.success) {
      throw validationError(
        parsed.error.issues.map((issue) => ({
          field:
            issue.path.length > 0 ? issue.path.join('.') : '(query)',
          message: issue.message,
        })),
      );
    }
    const query: AdminUsersQuery = parsed.data;
    const kata = query.q.trim();
    const where =
      kata.length > 0
        ? {
            OR: [
              { name: { contains: kata, mode: 'insensitive' as const } },
              { email: { contains: kata, mode: 'insensitive' as const } },
            ],
          }
        : {};
    if (query.cursor !== undefined) {
      const jangkar = decodeCursor(query.cursor);
      if (!jangkar) {
        throw validationError([
          { field: 'cursor', message: 'Cursor tidak valid.' },
        ]);
      }
      const ada = await this.prisma.user.findUnique({
        where: { id: jangkar },
        select: { id: true },
      });
      if (!ada) {
        throw validationError([
          { field: 'cursor', message: 'Cursor tidak valid.' },
        ]);
      }
      const rows = await this.prisma.user.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        cursor: { id: jangkar },
        skip: 1,
        take: query.limit + 1,
        select: ADMIN_SELECT,
      });
      return this.keRespons(rows, query.limit);
    }
    const rows = await this.prisma.user.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      select: ADMIN_SELECT,
    });
    return this.keRespons(rows, query.limit);
  }

  private async keRespons(
    rows: UserRow[],
    limit: number,
  ): Promise<AdminUsersResponse> {
    const halaman = rows.slice(0, limit);
    const lanjut =
      rows.length > limit && halaman.length > 0
        ? encodeCursor(halaman[halaman.length - 1].id)
        : null;
    const terpakai = await this.usedBytesByOwner(halaman.map((u) => u.id));
    return {
      items: halaman.map((u) => toAdminUserItem(u, terpakai.get(u.id) ?? 0n)),
      nextCursor: lanjut,
    };
  }

  async suspendUser(id: string, adminId: string): Promise<AdminUserItem> {
    if (id === adminId) {
      throw cannotModifySelf('menangguhkan');
    }
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw userNotFound();
    }
    // Idempotent: sudah SUSPENDED pun sukses. Satu transaksi: status +
    // hapus SEMUA sesi (sesi lama tak bisa dipakai lagi).
    const [diperbarui] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id },
        data: { status: UserStatus.SUSPENDED },
      }),
      this.prisma.session.deleteMany({ where: { userId: id } }),
    ]);
    return this.toItemWithUsage(diperbarui as UserRow);
  }

  async activateUser(id: string): Promise<AdminUserItem> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw userNotFound();
    }
    const diperbarui = await this.prisma.user.update({
      where: { id },
      data: { status: UserStatus.ACTIVE },
    });
    return this.toItemWithUsage(diperbarui as UserRow);
  }

  async updateQuota(id: string, quotaBytes: bigint): Promise<AdminUserItem> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw userNotFound();
    }
    // Menurunkan di bawah pemakaian tidak menghapus apa pun; hanya
    // menghalangi upload baru (ditegakkan di US-18).
    const diperbarui = await this.prisma.user.update({
      where: { id },
      data: { quotaBytes },
    });
    return this.toItemWithUsage(diperbarui as UserRow);
  }

  // Hapus pengguna beserta seluruh datanya dalam satu transaksi, urut
  // sesuai FK (Restrict): log akses lewat link miliknya, link, baris
  // album (lewat album maupun file miliknya), sampul album yang menunjuk
  // file miliknya (dibersihkan dulu), album, file, sesi, kode email
  // menurut email-nya, lalu user. US-12 hanya menghapus baris database;
  // file fisik di disk menjadi kewajiban US-17 (carry-over PROGRESS.md).
  async deleteUser(id: string, adminId: string): Promise<void> {
    if (id === adminId) {
      throw cannotModifySelf('menghapus');
    }
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw userNotFound();
    }
    const tautan = await this.prisma.shareLink.findMany({
      where: { ownerId: id },
      select: { id: true },
    });
    const album = await this.prisma.album.findMany({
      where: { ownerId: id },
      select: { id: true },
    });
    const berkas = await this.prisma.file.findMany({
      where: { ownerId: id },
      select: { id: true, storageKey: true, thumbKey: true },
    });
    const idTautan = tautan.map((t) => t.id);
    const idAlbum = album.map((a) => a.id);
    const idBerkas = berkas.map((f) => f.id);
    await this.prisma.$transaction([
      this.prisma.shareAccessLog.deleteMany({
        where: { linkId: { in: idTautan } },
      }),
      this.prisma.shareLink.deleteMany({ where: { ownerId: id } }),
      this.prisma.albumFile.deleteMany({ where: { albumId: { in: idAlbum } } }),
      this.prisma.albumFile.deleteMany({ where: { fileId: { in: idBerkas } } }),
      this.prisma.album.updateMany({
        where: { coverFileId: { in: idBerkas } },
        data: { coverFileId: null },
      }),
      this.prisma.album.deleteMany({ where: { ownerId: id } }),
      this.prisma.file.deleteMany({ where: { ownerId: id } }),
      this.prisma.session.deleteMany({ where: { userId: id } }),
      this.prisma.emailCode.deleteMany({ where: { email: user.email } }),
      this.prisma.user.delete({ where: { id } }),
    ]);
    // File fisik (US-17 carry-over): file final + thumbnail + sisa upload
    // tus miliknya. Kegagalan hapus file HANYA dicatat di log dan TIDAK
    // membatalkan penghapusan pengguna (baris DB sudah terhapus).
    await this.hapusFileFisik(
      id,
      berkas as Array<{ storageKey: string; thumbKey: string | null }>,
    );
  }

  private async hapusFileFisik(
    userId: string,
    berkas: Array<{ storageKey: string; thumbKey: string | null }>,
  ): Promise<void> {
    const mediaDir = resolveMediaDir();
    for (const b of berkas) {
      for (const kunci of [b.storageKey, b.thumbKey]) {
        if (typeof kunci !== 'string' || kunci.length === 0) {
          continue;
        }
        // Data kunci dari DB: ambil basename saja agar tak bisa keluar
        // dari MEDIA_DIR bila isinya pernah tercemar.
        const nama = kunci.split(/[\\/]/).pop() ?? '';
        if (nama.length === 0) {
          continue;
        }
        try {
          await rm(join(mediaDir, nama), { force: true });
        } catch (error) {
          this.logger.warn(
            `File fisik ${nama} milik ${userId} gagal dihapus: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    }
    // Sisa upload tus miliknya yang belum selesai (sidecar memuat
    // ownerId sisi server).
    const tusDir = tusDirOf(mediaDir);
    let entri: string[];
    try {
      entri = await readdir(tusDir);
    } catch {
      return;
    }
    for (const nama of entri) {
      if (!nama.endsWith('.json')) {
        continue;
      }
      const uploadId = nama.slice(0, -'.json'.length);
      let pemilik: unknown;
      try {
        const isi = await readFile(join(tusDir, nama), 'utf8');
        pemilik = (JSON.parse(isi) as { metadata?: Record<string, unknown> })
          ?.metadata?.[TUS_OWNER_METADATA_KEY];
      } catch {
        continue;
      }
      if (pemilik !== userId) {
        continue;
      }
      try {
        await rm(join(tusDir, uploadId), { force: true });
        await rm(join(tusDir, nama), { force: true });
      } catch (error) {
        this.logger.warn(
          `Sisa upload ${uploadId} milik ${userId} gagal dihapus: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }
}

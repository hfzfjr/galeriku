import { Injectable } from '@nestjs/common';
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
      select: { id: true },
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
  }
}

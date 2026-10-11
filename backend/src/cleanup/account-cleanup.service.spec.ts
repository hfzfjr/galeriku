import type { PrismaService } from '../prisma/prisma.service';
import { AccountCleanupService } from './account-cleanup.service';

const JAM = new Date('2026-10-11T12:00:00.000Z').getTime();
const HARI = 24 * 60 * 60 * 1000;

type Baris = Record<string, unknown>;

function nilai(v: unknown): unknown {
  return v instanceof Date ? v.getTime() : v;
}

function cocok(row: Baris, where: Baris): boolean {
  return Object.entries(where).every(([key, value]) => {
    const aktual = row[key];
    if (value && typeof value === 'object' && !(value instanceof Date)) {
      const ops = value as Baris;
      if ('in' in ops) return (ops.in as unknown[]).includes(aktual);
      if ('lt' in ops) return (nilai(aktual) as number) < (nilai(ops.lt) as number);
      if ('lte' in ops)
        return (nilai(aktual) as number) <= (nilai(ops.lte) as number);
      if ('gt' in ops) return (nilai(aktual) as number) > (nilai(ops.gt) as number);
      if ('gte' in ops)
        return (nilai(aktual) as number) >= (nilai(ops.gte) as number);
    }
    return aktual === value;
  });
}

function fakePrisma() {
  const users: Baris[] = [
    {
      id: 'u-tua',
      email: 'tua@contoh.id',
      emailVerifiedAt: null,
      createdAt: new Date(JAM - 25 * HARI),
    },
    {
      id: 'u-baru',
      email: 'baru@contoh.id',
      emailVerifiedAt: null,
      createdAt: new Date(JAM - 1 * HARI),
    },
    {
      id: 'u-verif',
      email: 'verif@contoh.id',
      emailVerifiedAt: new Date(JAM - 48 * HARI),
      createdAt: new Date(JAM - 72 * HARI),
    },
  ];
  const sessions: Baris[] = [
    { id: 's-tua', userId: 'u-tua' },
    { id: 's-verif', userId: 'u-verif' },
  ];
  const codes: Baris[] = [
    { id: 'c-tua', email: 'tua@contoh.id', expiresAt: new Date(JAM - 1 * HARI) },
    {
      id: 'c-basi',
      email: 'lain@contoh.id',
      expiresAt: new Date(JAM - 25 * HARI),
    },
    {
      id: 'c-segar',
      email: 'baru@contoh.id',
      expiresAt: new Date(JAM + 1 * HARI),
    },
  ];
  const hapusBanyak = (rows: Baris[], where: Baris) => {
    let n = 0;
    for (let i = rows.length - 1; i >= 0; i -= 1) {
      if (cocok(rows[i] as Baris, where)) {
        rows.splice(i, 1);
        n += 1;
      }
    }
    return { count: n };
  };
  return {
    users,
    sessions,
    codes,
    user: {
      findMany: async ({ where }: { where: Baris }) =>
        users.filter((u) => cocok(u, where)).map((u) => ({ ...u })),
      deleteMany: async ({ where }: { where: Baris }) =>
        hapusBanyak(users, where),
    },
    session: {
      deleteMany: async ({ where }: { where: Baris }) =>
        hapusBanyak(sessions, where),
    },
    emailCode: {
      deleteMany: async ({ where }: { where: Baris }) =>
        hapusBanyak(codes, where),
    },
  };
}

describe('AccountCleanupService', () => {
  it('menghapus akun unverified >24 jam (+sesi+kode) dan kode basi', async () => {
    const prisma = fakePrisma();
    const service = new AccountCleanupService(
      prisma as unknown as PrismaService,
    );
    const hasil = await service.runOnce(new Date(JAM));
    expect(hasil).toEqual({ users: 1, codes: 1 });
    expect(prisma.users.some((u) => u.id === 'u-tua')).toBe(false);
    expect(prisma.users.some((u) => u.id === 'u-baru')).toBe(true);
    expect(prisma.users.some((u) => u.id === 'u-verif')).toBe(true);
    expect(prisma.sessions.some((s) => s.userId === 'u-tua')).toBe(false);
    expect(prisma.sessions.some((s) => s.userId === 'u-verif')).toBe(true);
    // c-tua ikut terhapus bersama akunnya; c-basi karena kedaluwarsa
    // >1 hari; c-segar tetap ada.
    expect(prisma.codes.some((c) => c.id === 'c-tua')).toBe(false);
    expect(prisma.codes.some((c) => c.id === 'c-basi')).toBe(false);
    expect(prisma.codes.some((c) => c.id === 'c-segar')).toBe(true);
  });

  it('tidak tumpang tindih dan mengembalikan nol saat sibuk', async () => {
    const prisma = fakePrisma();
    const service = new AccountCleanupService(
      prisma as unknown as PrismaService,
    );
    (service as unknown as { running: boolean }).running = true;
    await expect(service.runOnce(new Date(JAM))).resolves.toEqual({
      users: 0,
      codes: 0,
    });
  });
});

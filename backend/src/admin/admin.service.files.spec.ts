import { Logger } from '@nestjs/common';
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AdminService } from './admin.service';

const ID_KORBAN = 'u-korban';
const EMAIL_KORBAN = 'korban@contoh.id';

function prismaPalsu(
  berkas: Array<{ storageKey: string; thumbKey: string | null }>,
) {
  const users = new Map([[ID_KORBAN, { id: ID_KORBAN, email: EMAIL_KORBAN }]]);
  const kosong = async () => ({ count: 0 });
  return {
    users,
    user: {
      findUnique: async () => users.get(ID_KORBAN) ?? null,
      delete: async () => {
        users.delete(ID_KORBAN);
        return { id: ID_KORBAN };
      },
    },
    shareLink: { findMany: async () => [], deleteMany: kosong },
    album: { findMany: async () => [], deleteMany: kosong, updateMany: kosong },
    file: {
      findMany: async () =>
        berkas.map((b, i) => ({ id: `f-${i}`, ...b })),
      deleteMany: kosong,
    },
    shareAccessLog: { deleteMany: kosong },
    albumFile: { deleteMany: kosong },
    session: { deleteMany: kosong },
    emailCode: { deleteMany: kosong },
    $transaction: async (ops: Array<Promise<unknown>>) => Promise.all(ops),
  };
}

describe('AdminService.deleteUser file fisik (US-17)', () => {
  let mediaDir: string;
  let semula: string | undefined;
  let peringatan: unknown[][];
  let warnAsli: typeof Logger.prototype.warn;

  beforeEach(() => {
    semula = process.env.MEDIA_DIR;
    mediaDir = mkdtempSync(join(tmpdir(), 'galeriku-hapus-user-'));
    process.env.MEDIA_DIR = mediaDir;
    // Tanpa global jest di modul ESM (lihat test-app.ts): catat manual.
    peringatan = [];
    const catat = peringatan;
    warnAsli = Logger.prototype.warn;
    Logger.prototype.warn = function (...args: [unknown, ...unknown[]]) {
      catat.push(args);
    } as typeof Logger.prototype.warn;
  });

  afterEach(() => {
    Logger.prototype.warn = warnAsli;
    if (semula === undefined) {
      delete process.env.MEDIA_DIR;
    } else {
      process.env.MEDIA_DIR = semula;
    }
    rmSync(mediaDir, { recursive: true, force: true });
  });

  it('menghapus file final, thumbnail, dan sisa _tus miliknya', async () => {
    const kunci = 'uuid-file-1';
    const thumb = 'thumb-1';
    writeFileSync(join(mediaDir, kunci), 'isi');
    writeFileSync(join(mediaDir, thumb), 'thumb');
    const tusDir = join(mediaDir, '_tus');
    mkdirSync(tusDir, { recursive: true });
    const yatim = 'uuid-yatim';
    writeFileSync(join(tusDir, yatim), 'sebagian');
    writeFileSync(
      join(tusDir, `${yatim}.json`),
      JSON.stringify({ metadata: { ownerId: ID_KORBAN } }),
    );
    const milikOrang = 'uuid-orang-lain';
    writeFileSync(
      join(tusDir, `${milikOrang}.json`),
      JSON.stringify({ metadata: { ownerId: 'u-lain' } }),
    );
    writeFileSync(join(tusDir, milikOrang), 'milik-orang');

    const service = new AdminService(
      prismaPalsu([{ storageKey: kunci, thumbKey: thumb }]) as never,
    );
    await service.deleteUser(ID_KORBAN, 'u-admin');

    expect(existsSync(join(mediaDir, kunci))).toBe(false);
    expect(existsSync(join(mediaDir, thumb))).toBe(false);
    expect(existsSync(join(tusDir, yatim))).toBe(false);
    expect(existsSync(join(tusDir, `${yatim}.json`))).toBe(false);
    // Milik orang lain utuh.
    expect(existsSync(join(tusDir, `${milikOrang}.json`))).toBe(true);
    expect(existsSync(join(tusDir, milikOrang))).toBe(true);
  });

  it('gagal hapus file dicatat dan TIDAK membatalkan hapus pengguna', async () => {
    // Direktori tak-kosong sebagai storageKey: rm tanpa recursive gagal.
    const bandel = 'dir-bandel';
    mkdirSync(join(mediaDir, bandel));
    writeFileSync(join(mediaDir, bandel, 'anak.txt'), 'x');

    const prisma = prismaPalsu([{ storageKey: bandel, thumbKey: null }]);
    const service = new AdminService(prisma as never);
    await expect(
      service.deleteUser(ID_KORBAN, 'u-admin'),
    ).resolves.toBeUndefined();
    expect(prisma.users.has(ID_KORBAN)).toBe(false);
    expect(peringatan.length).toBeGreaterThan(0);
  });

  it('tetap 204 bila file fisik sudah tak ada', async () => {
    const prisma = prismaPalsu([{ storageKey: 'tak-ada', thumbKey: null }]);
    const service = new AdminService(prisma as never);
    await expect(
      service.deleteUser(ID_KORBAN, 'u-admin'),
    ).resolves.toBeUndefined();
    expect(prisma.users.has(ID_KORBAN)).toBe(false);
  });
});

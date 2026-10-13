import { createHash } from 'node:crypto';
import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
} from '@nestjs/common';
import { PasswordService } from '../src/auth/services/password.service';
import { ApiError } from '../src/common/errors/api-error';
import { CurrentUser } from '../src/auth/guards/auth.guard';
import type { SessionUser } from '../src/auth/guards/auth.guard';
import {
  createTestApp,
  type FakeDb,
  type TestApp,
} from './test-app';
import { expectOwnerOnly } from './ownership';

process.env.FRONTEND_ORIGIN ??= 'https://galeriku.hafizfajar.com';
process.env.ADMIN_EMAIL ??= 'admin@contoh.id';
const ORIGIN = process.env.FRONTEND_ORIGIN as string;
const PASSWORD_BENAR = 'kata-sandi-benar';

const passwords = new PasswordService();

// Penyimpanan mainan milik spek ini saja. Route di bawah HANYA ada di
// berkas tes (didaftarkan via extraControllers); tidak boleh ada di
// kode produksi.
const toko = new Map<string, { id: string; pemilik: string }>();

function milikAtau404(id: string, saya: SessionUser): { id: string } {
  const barang = toko.get(id);
  // Milik orang lain dijawab PERSIS seperti id yang tidak ada (404).
  if (!barang || barang.pemilik !== saya.id) {
    throw new ApiError(404, 'BARANG_TIDAK_ADA', 'Barang tidak ada.');
  }
  return { id: barang.id };
}

@Controller('uji-milik')
class UjiMilikController {
  @Get(':id')
  baca(
    @Param('id') id: string,
    @CurrentUser() saya: SessionUser,
  ): { id: string } {
    return milikAtau404(id, saya);
  }

  @Delete(':id')
  @HttpCode(204)
  hapus(
    @Param('id') id: string,
    @CurrentUser() saya: SessionUser,
  ): void {
    milikAtau404(id, saya);
    toko.delete(id);
  }
}

async function seedUser(
  db: FakeDb,
  email: string,
): Promise<Record<string, unknown>> {
  const hash = await passwords.hashPassword(PASSWORD_BENAR);
  const id = `u-${email}`;
  const row = {
    email,
    name: email,
    avatarUrl: null,
    passwordHash: hash,
    googleSub: null,
    role: 'USER',
    status: 'ACTIVE',
    quotaBytes: 123456789n,
    createdAt: new Date(),
    lastLoginAt: null,
    emailVerifiedAt: new Date('2026-10-11T00:00:00.000Z'),
    id,
  };
  db.users.set(id, row);
  return row;
}

function craftSession(db: FakeDb, userId: string): string {
  const token = `token-milik-${db.sessions.size + 1}`;
  const id = createHash('sha256').update(token, 'utf8').digest('hex');
  db.sessions.set(id, {
    id,
    userId,
    expiresAt: new Date(Date.now() + 30 * 86400_000),
    createdAt: new Date(),
    ipHash: 'uji',
    userAgent: '',
  });
  return token;
}

describe('Helper ownership A-vs-B (US-13)', () => {
  let app: TestApp['app'];
  let db: FakeDb;
  let hitung = 0;

  beforeEach(async () => {
    toko.clear();
    hitung = 0;
    ({ app, db } = await createTestApp(undefined, undefined, undefined, {
      extraControllers: [UjiMilikController],
    }));
  });

  afterEach(async () => {
    await app.close();
  });

  const server = () => app;

  async function siapkan(): Promise<{
    cookieA: string;
    cookieB: string;
    buat: () => Promise<string>;
  }> {
    const a = await seedUser(db, 'a@contoh.id');
    const b = await seedUser(db, 'b@contoh.id');
    return {
      cookieA: craftSession(db, a.id as string),
      cookieB: craftSession(db, b.id as string),
      buat: async () => {
        hitung += 1;
        const id = `barang-${hitung}`;
        toko.set(id, { id, pemilik: a.id as string });
        return id;
      },
    };
  }

  it('lolos: B 404 identik, A 2xx, tanpa sesi 401', async () => {
    const { cookieA, cookieB, buat } = await siapkan();
    await expectOwnerOnly(server(), {
      cookieA,
      cookieB,
      origin: ORIGIN,
      createResource: buat,
      buildRequests: (id) => [
        { method: 'get', url: `/uji-milik/${id}` },
        { method: 'delete', url: `/uji-milik/${id}` },
      ],
    });
  });

  it('gagal bila A sebenarnya bukan pemilik', async () => {
    const { cookieA, cookieB, buat } = await siapkan();
    await expect(
      expectOwnerOnly(server(), {
        // Tertukar: "A" memakai sesi B sehingga selalu 404.
        cookieA: cookieB,
        cookieB: cookieA,
        origin: ORIGIN,
        createResource: buat,
        buildRequests: (id) => [{ method: 'get', url: `/uji-milik/${id}` }],
      }),
    ).rejects.toThrow();
  });
});

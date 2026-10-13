import { createHash } from 'node:crypto';
import request from 'supertest';
import { PasswordService } from '../src/auth/services/password.service';
import {
  createTestApp,
  type FakeDb,
  type TestApp,
} from './test-app';

process.env.FRONTEND_ORIGIN ??= 'https://galeriku.hafizfajar.com';
process.env.ADMIN_EMAIL ??= 'admin@contoh.id';
const ORIGIN = process.env.FRONTEND_ORIGIN as string;
const TEST_IP = '203.0.113.11';
const PASSWORD_BENAR = 'kata-sandi-benar';

const passwords = new PasswordService();

let hitungId = 0;

async function seedUser(
  db: FakeDb,
  overrides: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  hitungId += 1;
  const hash = await passwords.hashPassword(PASSWORD_BENAR);
  const id = `u-seed-${hitungId}`;
  const row = {
    email: `orang-${hitungId}@contoh.id`,
    name: `Orang ${hitungId}`,
    avatarUrl: null,
    passwordHash: hash,
    googleSub: null,
    role: 'USER',
    status: 'ACTIVE',
    quotaBytes: 5368709120n,
    createdAt: new Date(Date.now() + hitungId),
    lastLoginAt: null,
    emailVerifiedAt: new Date('2026-10-11T00:00:00.000Z'),
    ...overrides,
    id,
  };
  db.users.set(id, row);
  return row;
}

async function seedAdmin(db: FakeDb): Promise<Record<string, unknown>> {
  return seedUser(db, {
    email: 'admin@contoh.id',
    name: 'Admin',
    role: 'ADMIN',
  });
}

function craftSession(db: FakeDb, userId: string): string {
  const token = `token-admin-${db.sessions.size + 1}-${Date.now()}`;
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

function seedFile(
  db: FakeDb,
  ownerId: string,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  const id = `f-${db.files.size + 1}`;
  const row = {
    ownerId,
    originalName: 'foto.jpg',
    storageKey: `kunci-${id}`,
    mimeType: 'image/jpeg',
    sizeBytes: 100n,
    kind: 'image',
    status: 'ready',
    createdAt: new Date(),
    deletedAt: null,
    ...overrides,
    id,
  };
  db.files.set(row.id as string, row);
  return row;
}

describe('Admin (e2e)', () => {
  let app: TestApp['app'];
  let db: FakeDb;

  beforeEach(async () => {
    hitungId = 0;
    ({ app, db } = await createTestApp());
  });

  afterEach(async () => {
    await app.close();
  });

  const server = () => app.getHttpAdapter().getInstance().server;

  function sebagai(
    method: 'get' | 'post' | 'patch' | 'delete',
    url: string,
    token?: string,
  ) {
    let req = request(server())[method](url).set('cf-connecting-ip', TEST_IP);
    if (token !== undefined) {
      req = req.set('Cookie', `galeriku_session=${token}`);
    }
    return req.set('Origin', ORIGIN);
  }

  describe('matriks akses', () => {
    it('tanpa sesi -> 401, USER biasa -> 403 di semua endpoint', async () => {
      const biasa = await seedUser(db);
      const tokenBiasa = craftSession(db, biasa.id as string);
      const korban = await seedUser(db);

      await request(server()).get('/admin/users').expect(401).expect((res) => {
        if (res.body.code !== 'UNAUTHENTICATED') {
          throw new Error(`kode tak terduga: ${res.text}`);
        }
      });
      await request(server())
        .post(`/admin/users/${korban.id}/suspend`)
        .expect(401);

      const kasus: Array<{
        method: 'get' | 'post' | 'patch' | 'delete';
        url: string;
      }> = [
        { method: 'get', url: '/admin/users' },
        { method: 'post', url: `/admin/users/${korban.id}/suspend` },
        { method: 'post', url: `/admin/users/${korban.id}/activate` },
        { method: 'patch', url: `/admin/users/${korban.id}/quota` },
        { method: 'delete', url: `/admin/users/${korban.id}` },
      ];
      for (const { method, url } of kasus) {
        let req = sebagai(method, url, tokenBiasa);
        if (method === 'patch') {
          req = req.send({ quotaBytes: '100' });
        }
        const res = await req.expect(403);
        if (res.body.code !== 'FORBIDDEN') {
          throw new Error(`${method} ${url}: ${res.text}`);
        }
      }
      // Pengguna korban tidak berubah oleh upaya ditolak.
      expect(db.users.get(korban.id as string)?.status).toBe('ACTIVE');
    });
  });

  describe('daftar pengguna', () => {
    it('ADMIN 200: bentuk item tanpa rahasia, BigInt string', async () => {
      const admin = await seedAdmin(db);
      await seedUser(db);
      const res = await sebagai(
        'get',
        '/admin/users',
        craftSession(db, admin.id as string),
      ).expect(200);
      expect(res.body.nextCursor).toBeNull();
      expect(res.body.items).toHaveLength(2);
      for (const item of res.body.items as Array<Record<string, unknown>>) {
        expect(Object.keys(item).sort()).toEqual(
          [
            'avatarUrl',
            'createdAt',
            'email',
            'emailVerified',
            'id',
            'lastLoginAt',
            'name',
            'quotaBytes',
            'role',
            'status',
            'usedBytes',
          ].sort(),
        );
        expect(typeof item.quotaBytes).toBe('string');
        expect(typeof item.usedBytes).toBe('string');
      }
      const teks = JSON.stringify(res.body);
      expect(teks).not.toContain('passwordHash');
      expect(teks).not.toContain('googleSub');
    });

    it('urut created_at DESC dan paginasi cursor 20 + 5', async () => {
      const admin = await seedAdmin(db);
      for (let i = 0; i < 24; i += 1) {
        await seedUser(db);
      }
      const token = craftSession(db, admin.id as string);
      const satu = await sebagai('get', '/admin/users', token).expect(200);
      expect(satu.body.items).toHaveLength(20);
      expect(typeof satu.body.nextCursor).toBe('string');
      const idSatu = (satu.body.items as Array<{ id: string }>).map(
        (u) => u.id,
      );
      // Admin dibuat paling awal -> tidak di halaman pertama.
      expect(idSatu).not.toContain(admin.id);
      const dua = await sebagai(
        'get',
        `/admin/users?cursor=${encodeURIComponent(satu.body.nextCursor as string)}`,
        token,
      ).expect(200);
      expect(dua.body.items).toHaveLength(5);
      expect(dua.body.nextCursor).toBeNull();
      const idDua = (dua.body.items as Array<{ id: string }>).map(
        (u) => u.id,
      );
      expect(idDua).toContain(admin.id as string);
      expect(new Set([...idSatu, ...idDua]).size).toBe(25);
    });

    it('pencarian nama/email tak peduli huruf, wildcard literal', async () => {
      const admin = await seedAdmin(db);
      await seedUser(db, { name: 'Budi Santoso', email: 'budi@contoh.id' });
      await seedUser(db, {
        name: 'Persen',
        email: 'persen%garis_bawah@contoh.id',
      });
      const token = craftSession(db, admin.id as string);

      const nama = await sebagai('get', '/admin/users?q=budi', token).expect(
        200,
      );
      expect(
        (nama.body.items as Array<{ email: string }>).map((u) => u.email),
      ).toEqual(['budi@contoh.id']);

      const surel = await sebagai('get', '/admin/users?q=BUDI@CONTOH', token).expect(
        200,
      );
      expect(surel.body.items).toHaveLength(1);

      const persen = await sebagai(
        'get',
        '/admin/users?q=%',
        token,
      ).expect(200);
      expect(
        (persen.body.items as Array<{ email: string }>).map((u) => u.email),
      ).toEqual(['persen%garis_bawah@contoh.id']);

      const garis = await sebagai(
        'get',
        '/admin/users?q=garis_bawah',
        token,
      ).expect(200);
      // '_' literal: hanya yang mengandung 'garis_bawah' persis.
      expect(
        (garis.body.items as Array<{ email: string }>).map((u) => u.email),
      ).toEqual(['persen%garis_bawah@contoh.id']);

      const kosong = await sebagai(
        'get',
        '/admin/users?q=tidak-ada-yang-cocok',
        token,
      ).expect(200);
      expect(kosong.body.items).toEqual([]);
      expect(kosong.body.nextCursor).toBeNull();
      expect(admin).toBeDefined();
    });

    it('limit maksimum 50 dan cursor rusak ditolak', async () => {
      const admin = await seedAdmin(db);
      const token = craftSession(db, admin.id as string);
      await sebagai('get', '/admin/users?limit=51', token)
        .expect(400)
        .expect((res) => {
          if (res.body.code !== 'VALIDATION_ERROR') {
            throw new Error(`kode tak terduga: ${res.text}`);
          }
        });
      await sebagai('get', '/admin/users?cursor=sampah', token)
        .expect(400)
        .expect((res) => {
          if (res.body.code !== 'VALIDATION_ERROR') {
            throw new Error(`kode tak terduga: ${res.text}`);
          }
        });
    });

    it('usedBytes hanya file aktif miliknya (string)', async () => {
      const admin = await seedAdmin(db);
      const korban = await seedUser(db);
      const lain = await seedUser(db);
      seedFile(db, korban.id as string, { sizeBytes: 100n });
      seedFile(db, korban.id as string, { sizeBytes: 200n });
      seedFile(db, korban.id as string, {
        sizeBytes: 999n,
        status: 'failed',
      });
      seedFile(db, korban.id as string, {
        sizeBytes: 888n,
        deletedAt: new Date(),
      });
      seedFile(db, lain.id as string, { sizeBytes: 777n });
      const res = await sebagai(
        'get',
        `/admin/users?q=${korban.email}`,
        craftSession(db, admin.id as string),
      ).expect(200);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].usedBytes).toBe('300');
    });
  });

  describe('kuota', () => {
    it('negatif, bukan angka, desimal, di atas 1000 GB ditolak', async () => {
      const admin = await seedAdmin(db);
      const korban = await seedUser(db);
      const token = craftSession(db, admin.id as string);
      for (const quotaBytes of [
        '-1',
        'lima GB',
        '1.5',
        '',
        ((1000n * 1024n * 1024n * 1024n + 1n).toString()),
      ]) {
        await sebagai(
          'patch',
          `/admin/users/${korban.id}/quota`,
          token,
        )
          .send({ quotaBytes })
          .expect(400)
          .expect((res) => {
            if (res.body.code !== 'VALIDATION_ERROR') {
              throw new Error(`${quotaBytes}: ${res.text}`);
            }
            if (!Array.isArray(res.body.details?.fields)) {
              throw new Error(`${quotaBytes}: tanpa fields`);
            }
          });
      }
    });

    it('nilai valid tersimpan; turun di bawah pemakaian tidak menghapus', async () => {
      const admin = await seedAdmin(db);
      const korban = await seedUser(db);
      seedFile(db, korban.id as string, { sizeBytes: 3_000_000_000n });
      const token = craftSession(db, admin.id as string);
      const res = await sebagai(
        'patch',
        `/admin/users/${korban.id}/quota`,
        token,
      )
        .send({ quotaBytes: '1073741824' })
        .expect(200);
      expect(res.body.quotaBytes).toBe('1073741824');
      expect(res.body.usedBytes).toBe('3000000000');
      const row = db.users.get(korban.id as string);
      expect(row?.quotaBytes).toBe(1073741824n);
      // Batas maksimum persis boleh.
      await sebagai('patch', `/admin/users/${korban.id}/quota`, token)
        .send({ quotaBytes: (1000n * 1024n * 1024n * 1024n).toString() })
        .expect(200);
    });

    it('pengguna tak dikenal -> 404 USER_NOT_FOUND', async () => {
      const admin = await seedAdmin(db);
      const res = await sebagai(
        'patch',
        '/admin/users/tidak-ada/quota',
        craftSession(db, admin.id as string),
      )
        .send({ quotaBytes: '100' })
        .expect(404);
      expect(res.body.code).toBe('USER_NOT_FOUND');
    });
  });

  describe('tangguhkan dan aktifkan', () => {
    it('suspend menghapus SEMUA sesi dan idempotent', async () => {
      const admin = await seedAdmin(db);
      const korban = await seedUser(db);
      craftSession(db, korban.id as string);
      craftSession(db, korban.id as string);
      const token = craftSession(db, admin.id as string);
      const res = await sebagai(
        'post',
        `/admin/users/${korban.id}/suspend`,
        token,
      ).expect(200);
      expect(res.body.status).toBe('SUSPENDED');
      expect(db.users.get(korban.id as string)?.status).toBe('SUSPENDED');
      expect(db.sessions.size).toBe(1);
      await sebagai('post', `/admin/users/${korban.id}/suspend`, token).expect(
        200,
      );
    });

    it('sesi lama pengguna SUSPENDED ditolak lalu hangus', async () => {
      const admin = await seedAdmin(db);
      const korban = await seedUser(db);
      const tokenKorban = craftSession(db, korban.id as string);
      const token = craftSession(db, admin.id as string);
      await sebagai('post', `/admin/users/${korban.id}/suspend`, token).expect(
        200,
      );
      // Suspend mencabut semua sesi: sesi lama langsung hangus (401).
      await request(server())
        .get('/auth/me')
        .set('Cookie', `galeriku_session=${tokenKorban}`)
        .expect(401);
      expect(db.sessions.size).toBe(1);
      // Jalur guard sesi: sesi yang masih ada saat status SUSPENDED
      // ditolak (403) sekaligus dicabut, lalu hangus (401).
      const tokenBaru = craftSession(db, korban.id as string);
      await request(server())
        .get('/auth/me')
        .set('Cookie', `galeriku_session=${tokenBaru}`)
        .expect(403)
        .expect((res) => {
          if (res.body.code !== 'ACCOUNT_SUSPENDED') {
            throw new Error(`kode tak terduga: ${res.text}`);
          }
        });
      expect(db.sessions.size).toBe(1);
      await request(server())
        .get('/auth/me')
        .set('Cookie', `galeriku_session=${tokenBaru}`)
        .expect(401);
      // Login ikut ditolak.
      await request(server())
        .post('/auth/login')
        .set('Origin', ORIGIN)
        .set('cf-connecting-ip', TEST_IP)
        .send({
          email: korban.email,
          password: PASSWORD_BENAR,
          turnstileToken: 'token-uji',
        })
        .expect(403)
        .expect((res) => {
          if (res.body.code !== 'ACCOUNT_SUSPENDED') {
            throw new Error(`kode tak terduga: ${res.text}`);
          }
        });
    });

    it('activate mengembalikan ACTIVE; suspend diri ditolak', async () => {
      const admin = await seedAdmin(db);
      const korban = await seedUser(db, { status: 'SUSPENDED' });
      const token = craftSession(db, admin.id as string);
      const res = await sebagai(
        'post',
        `/admin/users/${korban.id}/activate`,
        token,
      ).expect(200);
      expect(res.body.status).toBe('ACTIVE');
      const diri = await sebagai(
        'post',
        `/admin/users/${admin.id}/suspend`,
        token,
      ).expect(403);
      expect(diri.body.code).toBe('CANNOT_MODIFY_SELF');
      expect(db.users.get(admin.id as string)?.status).toBe('ACTIVE');
    });
  });

  describe('hapus pengguna', () => {
    it('204 menghapus semua data miliknya berurut, milik orang lain utuh', async () => {
      const admin = await seedAdmin(db);
      const korban = await seedUser(db, { email: 'korban@contoh.id' });
      const tetangga = await seedUser(db, { email: 'tetangga@contoh.id' });
      const token = craftSession(db, admin.id as string);

      const f1 = seedFile(db, korban.id as string, { sizeBytes: 10n });
      seedFile(db, korban.id as string, { sizeBytes: 20n });
      const albumSendiri = `a-${korban.id}`;
      db.albums.set(albumSendiri, {
        id: albumSendiri,
        ownerId: korban.id,
        title: 'Album',
        coverFileId: f1.id,
        createdAt: new Date(),
      });
      db.albumFiles.set(`af-1`, {
        albumId: albumSendiri,
        fileId: f1.id,
        position: 0,
        addedAt: new Date(),
      });
      const albumTetangga = `a-${tetangga.id}`;
      db.albums.set(albumTetangga, {
        id: albumTetangga,
        ownerId: tetangga.id,
        title: 'Tetangga',
        // Sampul menunjuk file milik korban (Restrict bila tak dibersihkan).
        coverFileId: f1.id,
        createdAt: new Date(),
      });
      db.albumFiles.set(`af-2`, {
        albumId: albumTetangga,
        fileId: f1.id,
        position: 0,
        addedAt: new Date(),
      });
      const linkId = `s-${korban.id}`;
      db.shareLinks.set(linkId, {
        id: linkId,
        token: 'token-tautan',
        ownerId: korban.id,
        targetType: 'file',
        targetId: f1.id,
        createdAt: new Date(),
      });
      db.shareAccessLogs.set(`l-1`, {
        id: 'l-1',
        linkId,
        accessedAt: new Date(),
        ipHash: 'uji',
      });
      craftSession(db, korban.id as string);
      db.emailCodes.push({ email: 'korban@contoh.id', kind: 'VERIFY_EMAIL' });
      // Milik tetangga yang harus utuh.
      const fTetangga = seedFile(db, tetangga.id as string, { sizeBytes: 5n });

      await sebagai('delete', `/admin/users/${korban.id}`, token).expect(204);

      expect(db.users.has(korban.id as string)).toBe(false);
      expect(
        [...db.files.values()].some((f) => f.ownerId === korban.id),
      ).toBe(false);
      expect(
        [...db.albums.values()].some((a) => a.ownerId === korban.id),
      ).toBe(false);
      expect(
        [...db.shareLinks.values()].some((s) => s.ownerId === korban.id),
      ).toBe(false);
      expect(db.shareAccessLogs.size).toBe(0);
      expect(
        [...db.sessions.values()].some((s) => s.userId === korban.id),
      ).toBe(false);
      expect(
        db.emailCodes.some((c) => c.email === 'korban@contoh.id'),
      ).toBe(false);
      // Tetangga utuh kecuali rujukan ke file korban.
      expect(db.users.has(tetangga.id as string)).toBe(true);
      expect(db.files.has(fTetangga.id as string)).toBe(true);
      const albumSisa = db.albums.get(albumTetangga);
      expect(albumSisa?.coverFileId).toBeNull();
      expect(db.albumFiles.has('af-2')).toBe(false);
    });

    it('404 bila tak ada; hapus diri ditolak', async () => {
      const admin = await seedAdmin(db);
      const token = craftSession(db, admin.id as string);
      await sebagai('delete', '/admin/users/tidak-ada', token)
        .expect(404)
        .expect((res) => {
          if (res.body.code !== 'USER_NOT_FOUND') {
            throw new Error(`kode tak terduga: ${res.text}`);
          }
        });
      const diri = await sebagai(
        'delete',
        `/admin/users/${admin.id}`,
        token,
      ).expect(403);
      expect(diri.body.code).toBe('CANNOT_MODIFY_SELF');
      expect(db.users.has(admin.id as string)).toBe(true);
    });

    it('mutasi dengan Origin asing ditolak', async () => {
      const admin = await seedAdmin(db);
      const korban = await seedUser(db);
      const token = craftSession(db, admin.id as string);
      await request(server())
        .post(`/admin/users/${korban.id}/suspend`)
        .set('Origin', 'https://pencuri.example')
        .set('Cookie', `galeriku_session=${token}`)
        .set('cf-connecting-ip', TEST_IP)
        .expect(403)
        .expect((res) => {
          if (res.body.code !== 'FORBIDDEN_ORIGIN') {
            throw new Error(`kode tak terduga: ${res.text}`);
          }
        });
    });
  });
});

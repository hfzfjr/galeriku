import { createHash } from 'node:crypto';
import request from 'supertest';
import { ApiError } from '../src/auth/api-error';
import { PasswordService } from '../src/auth/password.service';
import {
  createTestApp,
  type FakeDb,
  type TestApp,
  type TestTurnstile,
} from './test-app';

process.env.FRONTEND_ORIGIN ??= 'https://galeriku.hafizfajar.com';
process.env.ADMIN_EMAIL ??= 'admin@contoh.id';
const ORIGIN = process.env.FRONTEND_ORIGIN as string;
const TEST_IP = '203.0.113.7';
const PASSWORD_BENAR = 'kata-sandi-benar';

const passwords = new PasswordService();

function post(
  server: TestApp['app'],
  url: string,
  origin: string | null = ORIGIN,
) {
  let req = request(server.getHttpAdapter().getInstance().server).post(url);
  if (origin !== null) {
    req = req.set('Origin', origin);
  }
  return req.set('cf-connecting-ip', TEST_IP);
}

async function seedUser(
  db: FakeDb,
  overrides: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  const hash = await passwords.hashPassword(PASSWORD_BENAR);
  const id = `u-${db.users.size + 1}`;
  const row = {
    email: 'saya@contoh.id',
    name: 'Saya',
    avatarUrl: null,
    passwordHash: hash,
    googleSub: null,
    role: 'USER',
    status: 'ACTIVE',
    quotaBytes: 123456789n,
    createdAt: new Date(),
    lastLoginAt: null,
    emailVerifiedAt: new Date('2026-10-11T00:00:00.000Z'),
    ...overrides,
    id,
  };
  db.users.set(id, row);
  return row;
}

function craftSession(
  db: FakeDb,
  userId: string,
  expired = false,
): string {
  const token = `token-uji-${db.sessions.size + 1}`;
  const id = createHash('sha256').update(token, 'utf8').digest('hex');
  db.sessions.set(id, {
    id,
    userId,
    expiresAt: new Date(Date.now() + (expired ? -60_000 : 30 * 86400_000)),
    createdAt: new Date(),
    ipHash: 'uji',
    userAgent: '',
  });
  return token;
}

function registerBody(email = 'baru@contoh.id') {
  return {
    name: 'Pengguna Baru',
    email,
    password: 'kata-sandi-baru',
    turnstileToken: 'token-uji',
  };
}

function loginBody(email = 'saya@contoh.id', password = PASSWORD_BENAR) {
  return { email, password, turnstileToken: 'token-uji' };
}

describe('Auth (e2e)', () => {
  let app: TestApp['app'];
  let db: FakeDb;
  let turnstile: TestTurnstile;

  beforeEach(async () => {
    ({ app, db, turnstile } = await createTestApp());
  });

  afterEach(async () => {
    await app.close();
  });

  const server = () => app.getHttpAdapter().getInstance().server;

  describe('register', () => {
    it('201 akun baru USER belum terverifikasi', async () => {
      const res = await post(app, '/auth/register')
        .send(registerBody())
        .expect(201);
      expect(res.body).toEqual({
        email: 'baru@contoh.id',
        needsVerification: true,
      });
      const row = [...db.users.values()].find(
        (u) => u.email === 'baru@contoh.id',
      );
      expect(row?.role).toBe('USER');
      expect(row?.status).toBe('ACTIVE');
      expect(row?.emailVerifiedAt).toBeNull();
      expect(row?.quotaBytes).toBe(123456789n);
      expect(row?.passwordHash).toMatch(/^\$argon2id\$/);
      expect(db.sessions.size).toBe(0);
    });

    it('409 EMAIL_TAKEN bila email sudah terverifikasi', async () => {
      await seedUser(db);
      const res = await post(app, '/auth/register')
        .send({ ...registerBody(), email: 'saya@contoh.id' })
        .expect(409);
      expect(res.body).toEqual({
        statusCode: 409,
        code: 'EMAIL_TAKEN',
        message: 'Email ini sudah terdaftar. Masuk atau atur ulang password.',
      });
    });

    it('menimpa akun belum terverifikasi (sesi dan kode dibersihkan)', async () => {
      const lama = await seedUser(db, { emailVerifiedAt: null });
      const tokenLama = craftSession(db, lama.id as string);
      db.emailCodes.push({
        email: 'saya@contoh.id',
        kind: 'VERIFY_EMAIL',
      });
      const sebelum = Date.now();
      const res = await post(app, '/auth/register')
        .send({
          name: 'Nama Baru',
          email: 'saya@contoh.id',
          password: 'kata-sandi-pengganti',
          turnstileToken: 'token-uji',
        })
        .expect(201);
      expect(res.body).toEqual({
        email: 'saya@contoh.id',
        needsVerification: true,
      });
      const baru = db.users.get(lama.id as string);
      expect(baru?.name).toBe('Nama Baru');
      expect(baru?.role).toBe('USER');
      expect(baru?.passwordHash).not.toBe(lama.passwordHash);
      const createdBaru: unknown = baru?.createdAt;
      if (!(createdBaru instanceof Date)) {
        throw new Error('createdAt hilang setelah timpa');
      }
      expect(createdBaru.getTime()).toBeGreaterThanOrEqual(sebelum);
      expect(db.sessions.has(tokenLama)).toBe(false);
      expect(db.sessions.size).toBe(0);
      // Kode lama terhapus, kode verifikasi baru terbit (satu baris segar).
      expect(db.emailCodes).toHaveLength(1);
      const kodeBaru = db.emailCodes[0] as Record<string, unknown>;
      expect(kodeBaru.attempts).toBe(0);
      expect(kodeBaru.codeHash).toMatch(/^[0-9a-f]{64}$/);
      // Password baru bisa dipakai login (setelah verifikasi).
      (baru as Record<string, unknown>).emailVerifiedAt = new Date();
      await post(app, '/auth/login')
        .send(loginBody('saya@contoh.id', 'kata-sandi-pengganti'))
        .expect(200);
    });

    it('daftar dengan ADMIN_EMAIL tetap USER', async () => {
      const res = await post(app, '/auth/register')
        .send(registerBody('admin@contoh.id'))
        .expect(201);
      expect(res.body.email).toBe('admin@contoh.id');
      const row = [...db.users.values()].find(
        (u) => u.email === 'admin@contoh.id',
      );
      expect(row?.role).toBe('USER');
    });

    it('400 VALIDATION_ERROR tanpa memantulkan nilai rahasia', async () => {
      const res = await post(app, '/auth/register')
        .send({
          name: '   ',
          email: 'bukan-email',
          password: 'pendek',
          turnstileToken: 'rahasia-jangan-muncul',
        })
        .expect(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(Array.isArray(res.body.details?.fields)).toBe(true);
      const teks = JSON.stringify(res.body);
      expect(teks).not.toContain('rahasia-jangan-muncul');
      expect(teks).not.toContain('pendek');
    });

    it('400 TURNSTILE_FAILED dan 503 TURNSTILE_UNAVAILABLE', async () => {
      turnstile.rejectOnce(
        new ApiError(400, 'TURNSTILE_FAILED', 'Verifikasi keamanan gagal.'),
      );
      await post(app, '/auth/register')
        .send(registerBody())
        .expect(400)
        .expect((res) => {
          if (res.body.code !== 'TURNSTILE_FAILED') {
            throw new Error(`kode tak terduga: ${res.text}`);
          }
        });
      turnstile.rejectOnce(
        new ApiError(503, 'TURNSTILE_UNAVAILABLE', 'Gangguan.'),
      );
      await post(app, '/auth/register')
        .send(registerBody())
        .expect(503)
        .expect((res) => {
          if (res.body.code !== 'TURNSTILE_UNAVAILABLE') {
            throw new Error(`kode tak terduga: ${res.text}`);
          }
        });
    });
  });

  describe('login', () => {
    it('200 data me + Set-Cookie benar + last_login_at', async () => {
      await seedUser(db);
      const res = await post(app, '/auth/login')
        .send(loginBody())
        .expect(200);
      expect(res.body).toEqual({
        id: expect.any(String),
        email: 'saya@contoh.id',
        name: 'Saya',
        avatarUrl: null,
        role: 'USER',
        status: 'ACTIVE',
        quotaBytes: '123456789',
        emailVerifiedAt: '2026-10-11T00:00:00.000Z',
      });
      expect(typeof res.body.quotaBytes).toBe('string');
      const cookies = res.headers['set-cookie'] as unknown as string[];
      const sesi = cookies.find((c) => c.startsWith('galeriku_session='));
      expect(sesi).toBeDefined();
      expect(sesi).toMatch(/HttpOnly/i);
      expect(sesi).toMatch(/SameSite=Lax/i);
      expect(sesi).toMatch(/Path=\//);
      expect(sesi).toMatch(/Max-Age=2592000/);
      expect(sesi).not.toMatch(/Domain=/i);
      expect(sesi).not.toMatch(/Secure/i);
      const row = [...db.users.values()].find(
        (u) => u.email === 'saya@contoh.id',
      );
      expect(row?.lastLoginAt).toBeInstanceOf(Date);
    });

    it('email tak ada vs password salah: status dan body identik', async () => {
      await seedUser(db);
      const a = await post(app, '/auth/login')
        .send(loginBody('tidak-ada@contoh.id'))
        .expect(401);
      const b = await post(app, '/auth/login')
        .send(loginBody('saya@contoh.id', 'kata-sandi-keliru'))
        .expect(401);
      expect(JSON.stringify(a.body)).toBe(JSON.stringify(b.body));
      expect(a.body).toEqual({
        statusCode: 401,
        code: 'INVALID_CREDENTIALS',
        message: 'Email atau password tidak cocok.',
      });
    });

    it('belum terverifikasi hanya terbuka bila password benar', async () => {
      await seedUser(db, { emailVerifiedAt: null });
      await post(app, '/auth/login')
        .send(loginBody('saya@contoh.id', 'kata-sandi-keliru'))
        .expect(401)
        .expect((res) => {
          if (res.body.code !== 'INVALID_CREDENTIALS') {
            throw new Error(`kode tak terduga: ${res.text}`);
          }
        });
      const res = await post(app, '/auth/login')
        .send(loginBody())
        .expect(403);
      expect(res.body.code).toBe('EMAIL_NOT_VERIFIED');
    });

    it('403 ACCOUNT_SUSPENDED beserta contactEmail', async () => {
      await seedUser(db, { status: 'SUSPENDED' });
      const res = await post(app, '/auth/login')
        .send(loginBody())
        .expect(403);
      expect(res.body.code).toBe('ACCOUNT_SUSPENDED');
      expect(res.body.details).toEqual({ contactEmail: 'admin@contoh.id' });
    });
  });

  describe('me dan logout', () => {
    it('401 tanpa cookie, 200 dengan cookie', async () => {
      await request(server()).get('/auth/me').expect(401).expect((res) => {
        if (res.body.code !== 'UNAUTHENTICATED') {
          throw new Error(`kode tak terduga: ${res.text}`);
        }
      });
      const user = await seedUser(db);
      const token = craftSession(db, user.id as string);
      const res = await request(server())
        .get('/auth/me')
        .set('Cookie', `galeriku_session=${token}`)
        .expect(200);
      expect(res.body.email).toBe('saya@contoh.id');
      expect(typeof res.body.quotaBytes).toBe('string');
    });

    it('logout 204 menghapus sesi dan cookie', async () => {
      const user = await seedUser(db);
      const token = craftSession(db, user.id as string);
      const jar = `galeriku_session=${token}`;
      await request(server())
        .post('/auth/logout')
        .set('Origin', ORIGIN)
        .set('Cookie', jar)
        .expect(204)
        .expect((res) => {
          const cookies = res.headers['set-cookie'] as unknown as string[];
          const sesi = cookies.find((c) =>
            c.startsWith('galeriku_session='),
          );
          if (!sesi || !/Max-Age=0/.test(sesi)) {
            throw new Error(`cookie belum dihapus: ${res.text}`);
          }
        });
      expect(db.sessions.size).toBe(0);
      await request(server())
        .get('/auth/me')
        .set('Cookie', jar)
        .expect(401);
    });

    it('401 dan sesi dicabut bila sesi kedaluwarsa', async () => {
      const user = await seedUser(db);
      const token = craftSession(db, user.id as string, true);
      await request(server())
        .get('/auth/me')
        .set('Cookie', `galeriku_session=${token}`)
        .expect(401);
      expect(db.sessions.size).toBe(0);
    });

    it('403 dan sesi dicabut bila user ditangguhkan', async () => {
      const user = await seedUser(db, { status: 'SUSPENDED' });
      const token = craftSession(db, user.id as string);
      await request(server())
        .get('/auth/me')
        .set('Cookie', `galeriku_session=${token}`)
        .expect(403)
        .expect((res) => {
          if (res.body.code !== 'ACCOUNT_SUSPENDED') {
            throw new Error(`kode tak terduga: ${res.text}`);
          }
        });
      expect(db.sessions.size).toBe(0);
    });
  });

  describe('origin', () => {
    it('403 FORBIDDEN_ORIGIN bila Origin asing', async () => {
      await post(app, '/auth/login', 'https://pencuri.example')
        .send(loginBody())
        .expect(403)
        .expect((res) => {
          if (res.body.code !== 'FORBIDDEN_ORIGIN') {
            throw new Error(`kode tak terduga: ${res.text}`);
          }
        });
    });

    it('403 bila tanpa Origin tapi membawa cookie sesi', async () => {
      const user = await seedUser(db);
      const token = craftSession(db, user.id as string);
      await request(server())
        .post('/auth/logout')
        .set('Cookie', `galeriku_session=${token}`)
        .expect(403)
        .expect((res) => {
          if (res.body.code !== 'FORBIDDEN_ORIGIN') {
            throw new Error(`kode tak terduga: ${res.text}`);
          }
        });
      expect(db.sessions.size).toBe(1);
    });

    it('tanpa Origin dan tanpa cookie tetap diproses (klien non-browser)', async () => {
      await post(app, '/auth/login', null)
        .send(loginBody('tidak-ada@contoh.id'))
        .expect(401)
        .expect((res) => {
          if (res.body.code !== 'INVALID_CREDENTIALS') {
            throw new Error(`kode tak terduga: ${res.text}`);
          }
        });
    });
  });

  describe('rate limit', () => {
    it('register ke-6 dalam sejam -> 429 + Retry-After', async () => {
      for (let i = 0; i < 5; i += 1) {
        await post(app, '/auth/register').send(
          registerBody('sama@contoh.id'),
        );
      }
      const res = await post(app, '/auth/register')
        .send(registerBody('sama@contoh.id'))
        .expect(429);
      expect(res.body).toEqual({
        statusCode: 429,
        code: 'RATE_LIMITED',
        message: 'Terlalu banyak percobaan. Coba lagi beberapa menit lagi.',
      });
      expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
    });

    it('login IP ke-12 dalam 15 menit -> 429', async () => {
      for (let i = 0; i < 11; i += 1) {
        await post(app, '/auth/login').send(
          loginBody(`orang-${i}@contoh.id`),
        );
      }
      await post(app, '/auth/login')
        .send(loginBody('orang-11@contoh.id'))
        .expect(429)
        .expect((res) => {
          if (res.body.code !== 'RATE_LIMITED') {
            throw new Error(`kode tak terduga: ${res.text}`);
          }
          if (Number(res.headers['retry-after']) <= 0) {
            throw new Error('header Retry-After hilang');
          }
        });
    });

    it('login email sama ke-6 dalam 15 menit -> 429', async () => {
      for (let i = 0; i < 5; i += 1) {
        await post(app, '/auth/login').send(
          loginBody('korban@contoh.id'),
        );
      }
      await post(app, '/auth/login')
        .send(loginBody('korban@contoh.id'))
        .expect(429)
        .expect((res) => {
          if (res.body.code !== 'RATE_LIMITED') {
            throw new Error(`kode tak terduga: ${res.text}`);
          }
        });
    });
  });
});

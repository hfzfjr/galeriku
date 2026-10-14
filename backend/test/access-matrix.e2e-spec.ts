import { createHash } from 'node:crypto';
import request from 'supertest';
import { PasswordService } from '../src/auth/services/password.service';
import {
  createFakeDb,
  createTestApp,
  type FakeDb,
  type TestApp,
} from './test-app';
import { isPublicRoute, PUBLIC_ROUTES } from './public-routes';

process.env.FRONTEND_ORIGIN ??= 'https://galeriku.hafizfajar.com';
process.env.ADMIN_EMAIL ??= 'admin@contoh.id';
const ORIGIN = process.env.FRONTEND_ORIGIN as string;
const ORIGIN_ASING = 'https://pencuri.example';
const TEST_IP = '203.0.113.13';
const PASSWORD_BENAR = 'kata-sandi-benar';

const passwords = new PasswordService();

type RouteTerdaftar = { method: string; url: string };

const MUTASI = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function samarkanParam(url: string): string {
  return url.replace(/:[^/]+/g, 'test-id');
}

async function seedUser(
  db: FakeDb,
  overrides: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  const hash = await passwords.hashPassword(PASSWORD_BENAR);
  const id = `u-${db.users.size + 1}`;
  const row = {
    email: `orang-${db.users.size + 1}@contoh.id`,
    name: 'Orang',
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
  const token = `token-matriks-${db.sessions.size + 1}`;
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

function panggil(
  server: TestApp['app'],
  method: string,
  url: string,
  opts?: { cookie?: string; origin?: string | null; body?: unknown },
) {
  const m = method.toLowerCase();
  let req = request(server.getHttpAdapter().getInstance().server)[m](url);
  if (opts?.cookie !== undefined) {
    req = req.set('Cookie', `galeriku_session=${opts.cookie}`);
  }
  if (opts?.origin !== undefined && opts.origin !== null) {
    req = req.set('Origin', opts.origin);
  }
  if (opts?.body !== undefined) {
    req = req.send(opts.body as Record<string, unknown>);
  }
  return req.set('cf-connecting-ip', TEST_IP);
}

describe('Matriks akses (US-13)', () => {
  let app: TestApp['app'];
  let db: FakeDb;
  // Enumerasi SATU kali dari aplikasi nyata (aturan d: route baru Sprint
  // berikutnya otomatis ikut diuji tanpa mengubah tes).
  let semuaRoute: RouteTerdaftar[] = [];

  beforeAll(async () => {
    const mentah: RouteTerdaftar[] = [];
    const probe = await createTestApp(createFakeDb(), undefined, undefined, {
      onRoute: (r) => mentah.push(r),
    });
    await probe.app.close();
    const punyaGet = new Set(
      mentah.filter((r) => r.method === 'GET').map((r) => r.url),
    );
    semuaRoute = mentah.filter((r) => {
      // Fastify mendaftarkan HEAD otomatis untuk tiap GET: jangan hitung
      // ganda (handler sama dengan GET).
      if (r.method === 'HEAD' && punyaGet.has(r.url)) {
        return false;
      }
      // Rute OPTIONS '*' milik plugin @fastify/cors (preflight), bukan
      // route aplikasi: kecualikan dari matriks.
      if (r.method === 'OPTIONS' && r.url === '*') {
        return false;
      }
      return true;
    });
    if (semuaRoute.length === 0) {
      throw new Error('enumerasi route kosong; hook onRoute tak berjalan');
    }
  });

  beforeEach(async () => {
    ({ app, db } = await createTestApp());
  });

  afterEach(async () => {
    await app.close();
  });

  const server = () => app;

  const privat = () =>
    semuaRoute.filter((r) => !isPublicRoute(r.method, r.url));
  const admin = () =>
    semuaRoute.filter((r) => r.url.startsWith('/admin'));
  const mutasi = () => semuaRoute.filter((r) => MUTASI.has(r.method));

  describe('daftar putih', () => {
    it('setiap entri cocok dengan route yang benar-benar terdaftar', () => {
      // Aturan (c): daftar usang langsung menggagalkan tes.
      for (const w of PUBLIC_ROUTES) {
        const ada = semuaRoute.some(
          (r) => r.method === w.method && r.url === w.path,
        );
        if (!ada) {
          throw new Error(
            `daftar putih usang: ${w.method} ${w.path} tidak terdaftar`,
          );
        }
      }
      expect(semuaRoute.length).toBeGreaterThan(PUBLIC_ROUTES.length);
    });
  });

  describe('default-deny', () => {
    it('setiap route non-publik menjawab 401 tanpa sesi', async () => {
      // Aturan (a)(b): route berparameter memakai dummy; mutasi
      // menyertakan Origin benar + body JSON agar yang diuji 401-nya,
      // bukan galat Origin/body.
      for (const r of privat()) {
        const url = samarkanParam(r.url);
        const mutasi = MUTASI.has(r.method);
        const res = await panggil(server(), r.method, url, {
          origin: mutasi ? ORIGIN : undefined,
          body: mutasi ? {} : undefined,
        }).expect(401);
        // HEAD tidak membawa body (semantik HTTP): cukup status 401.
        // Lihat uploads.e2e-spec.ts untuk pola yang sama.
        if (r.method === 'HEAD') {
          continue;
        }
        if (res.body.code !== 'UNAUTHENTICATED') {
          throw new Error(
            `${r.method} ${r.url}: kode ${res.body.code}, bukan UNAUTHENTICATED (${(res.text ?? '').slice(0, 200)})`,
          );
        }
      }
    });
  });

  describe('admin', () => {
    it('tanpa sesi 401; USER 403 FORBIDDEN; ADMIN lolos guard', async () => {
      const biasa = await seedUser(db);
      const pengurus = await seedUser(db, {
        email: 'admin@contoh.id',
        role: 'ADMIN',
      });
      const tokenBiasa = craftSession(db, biasa.id as string);
      const tokenAdmin = craftSession(db, pengurus.id as string);
      if (admin().length === 0) {
        throw new Error('tidak ada route /admin terdaftar');
      }
      for (const r of admin()) {
        const url = samarkanParam(r.url);
        const mutasi = MUTASI.has(r.method);
        const tanpa = await panggil(server(), r.method, url, {
          origin: mutasi ? ORIGIN : undefined,
          body: mutasi ? {} : undefined,
        }).expect(401);
        if (tanpa.body.code !== 'UNAUTHENTICATED') {
          throw new Error(`${r.method} ${r.url} tanpa sesi: ${tanpa.text}`);
        }
        const user = await panggil(server(), r.method, url, {
          cookie: tokenBiasa,
          origin: mutasi ? ORIGIN : undefined,
          body: mutasi ? (r.method === 'PATCH' ? { quotaBytes: '100' } : {}) : undefined,
        }).expect(403);
        if (user.body.code !== 'FORBIDDEN') {
          throw new Error(`${r.method} ${r.url} USER: ${user.text}`);
        }
        // ADMIN lolos guard (bukan 401/403); 400/404 karena dummy wajar.
        const kelola = await panggil(server(), r.method, url, {
          cookie: tokenAdmin,
          origin: mutasi ? ORIGIN : undefined,
          body: mutasi ? (r.method === 'PATCH' ? { quotaBytes: '100' } : {}) : undefined,
        });
        if (kelola.status === 401 || kelola.status === 403) {
          throw new Error(
            `${r.method} ${r.url} ADMIN tertolak: ${kelola.text}`,
          );
        }
      }
    });
  });

  describe('ditangguhkan dan basi', () => {
    it('SUSPENDED ditolak di semua route privat; login ditolak', async () => {
      const korban = await seedUser(db, { status: 'SUSPENDED' });
      const token = craftSession(db, korban.id as string);
      for (const r of privat()) {
        const url = samarkanParam(r.url);
        const mutasi = MUTASI.has(r.method);
        const res = await panggil(server(), r.method, url, {
          cookie: token,
          origin: mutasi ? ORIGIN : undefined,
          body: mutasi ? {} : undefined,
        });
        // Pemakaian pertama 403 (+sesi dicabut), sisanya 401.
        if (res.status !== 401 && res.status !== 403) {
          throw new Error(
            `${r.method} ${r.url} SUSPENDED lolos: ${res.status}`,
          );
        }
      }
      await panggil(server(), 'POST', '/auth/login', {
        origin: ORIGIN,
        body: {
          email: korban.email,
          password: PASSWORD_BENAR,
          turnstileToken: 'token-uji',
        },
      })
        .expect(403)
        .expect((res) => {
          if (res.body.code !== 'ACCOUNT_SUSPENDED') {
            throw new Error(`login SUSPENDED: ${res.text}`);
          }
        });
    });

    it('sesi basi 401 di semua route privat', async () => {
      const orang = await seedUser(db);
      const token = craftSession(db, orang.id as string, true);
      for (const r of privat()) {
        const url = samarkanParam(r.url);
        const mutasi = MUTASI.has(r.method);
        await panggil(server(), r.method, url, {
          cookie: token,
          origin: mutasi ? ORIGIN : undefined,
          body: mutasi ? {} : undefined,
        }).expect(401);
      }
    });
  });

  describe('origin', () => {
    it('mutasi menolak Origin salah; Origin kosong ditolak bila bawa sesi', async () => {
      const orang = await seedUser(db);
      const token = craftSession(db, orang.id as string);
      for (const r of mutasi()) {
        const url = samarkanParam(r.url);
        const publik = isPublicRoute(r.method, r.url);
        if (!publik) {
          const salah = await panggil(server(), r.method, url, {
            cookie: token,
            origin: ORIGIN_ASING,
            body: {},
          }).expect(403);
          if (salah.body.code !== 'FORBIDDEN_ORIGIN') {
            throw new Error(`${r.method} ${r.url} origin asing: ${salah.text}`);
          }
          const kosong = await panggil(server(), r.method, url, {
            cookie: token,
            body: {},
          }).expect(403);
          if (kosong.body.code !== 'FORBIDDEN_ORIGIN') {
            throw new Error(`${r.method} ${r.url} origin kosong: ${kosong.text}`);
          }
        } else {
          const salah = await panggil(server(), r.method, url, {
            origin: ORIGIN_ASING,
            body: {},
          }).expect(403);
          if (salah.body.code !== 'FORBIDDEN_ORIGIN') {
            throw new Error(
              `${r.method} ${r.url} publik origin asing: ${salah.text}`,
            );
          }
        }
      }
    });

    it('publik tanpa sesi dan tanpa Origin BUKAN galat Origin (pengecualian curl)', async () => {
      // Pengecualian disengaja di OriginGuard untuk klien non-browser;
      // didokumentasikan di sini agar tidak dianggap celah diam-diam.
      for (const r of mutasi().filter((x) =>
        isPublicRoute(x.method, x.url),
      )) {
        const res = await panggil(server(), r.method, samarkanParam(r.url), {
          body: {},
        });
        if (res.body.code === 'FORBIDDEN_ORIGIN') {
          throw new Error(`${r.method} ${r.url}: tak terduga FORBIDDEN_ORIGIN`);
        }
      }
    });
  });
});

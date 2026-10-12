import { createHash } from 'node:crypto';
import request from 'supertest';
import { OtpService } from '../src/auth/services/otp.service';
import { PasswordService } from '../src/auth/services/password.service';
import { EmailCodeKind } from '../src/generated/prisma/client';
import {
  createFakeDb,
  createTestApp,
  type FakeDb,
  type TestApp,
} from './test-app';

process.env.FRONTEND_ORIGIN ??= 'https://galeriku.hafizfajar.com';
process.env.ADMIN_EMAIL ??= 'admin@contoh.id';
process.env.GOOGLE_CLIENT_ID ??= 'client-uji';
process.env.GOOGLE_CLIENT_SECRET ??= 'rahasia-uji';
process.env.GOOGLE_CALLBACK_URL ??=
  'https://galeriku-api.hafizfajar.com/auth/google/callback';

const ORIGIN = process.env.FRONTEND_ORIGIN as string;
const CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL as string;
const TEST_IP = '203.0.113.9';
const PASSWORD_BENAR = 'kata-sandi-benar';

const passwords = new PasswordService();

const PROFIL_DEFAULT = {
  sub: 'sub-google-uji',
  email: 'saya@contoh.id',
  email_verified: true,
  name: 'Saya Google',
  picture: 'https://gambar.uji/foto.png',
};

// Perilaku stub fetch ke Google (tanpa jaringan asli).
const stub = {
  statusToken: 200,
  profil: PROFIL_DEFAULT as unknown,
  gantungUserinfo: false,
};
const fetchAsli = globalThis.fetch;
function pasangStubFetch(): void {
  globalThis.fetch = (async (url: unknown, init?: {
    signal?: AbortSignal | null;
  }) => {
    const alamat = String(url);
    if (alamat.startsWith('https://oauth2.googleapis.com/token')) {
      if (stub.statusToken !== 200) {
        return new Response(JSON.stringify({ error: 'invalid_grant' }), {
          status: stub.statusToken,
        });
      }
      return new Response(
        JSON.stringify({
          access_token: 'token-akses-uji',
          token_type: 'Bearer',
          expires_in: 3600,
        }),
        { status: 200 },
      );
    }
    if (alamat.startsWith('https://openidconnect.googleapis.com')) {
      if (stub.gantungUserinfo) {
        await new Promise((_selesai, gagal) => {
          init?.signal?.addEventListener('abort', () => {
            gagal(new DOMException('Dibatalkan', 'AbortError'));
          });
        });
      }
      return new Response(JSON.stringify(stub.profil), { status: 200 });
    }
    return fetchAsli(alamat, init as RequestInit);
  }) as typeof fetch;
}

function resetStub(): void {
  stub.statusToken = 200;
  stub.profil = PROFIL_DEFAULT;
  stub.gantungUserinfo = false;
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

function craftSession(db: FakeDb, userId: string): string {
  const token = `token-google-${db.sessions.size + 1}`;
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

function cookies(res: { headers: Record<string, unknown> }): string[] {
  return (res.headers['set-cookie'] as unknown as string[]) ?? [];
}

function nilaiCookie(cookies: string[], nama: string): string | null {
  const baris = cookies.find((c) => c.startsWith(`${nama}=`));
  if (!baris) {
    return null;
  }
  return baris.split(';')[0].slice(nama.length + 1);
}

// Mulai alur: kembalikan state + nilai cookie oauth.
async function mulaiAlur(app: TestApp['app']): Promise<{
  state: string;
  cookieOauth: string;
  lokasi: string;
  mentah: string[];
}> {
  const res = await request(app.getHttpAdapter().getInstance().server)
    .get('/auth/google')
    .redirects(0)
    .set('cf-connecting-ip', TEST_IP)
    .expect(302);
  const mentah = cookies(res);
  const cookieOauth = nilaiCookie(mentah, 'galeriku_oauth');
  if (!cookieOauth) {
    throw new Error(`cookie oauth hilang: ${res.text}`);
  }
  const lokasi = res.headers.location as string;
  const state = new URL(lokasi).searchParams.get('state');
  if (!state) {
    throw new Error(`state hilang di: ${lokasi}`);
  }
  return { state, cookieOauth, lokasi, mentah };
}

function panggilCallback(
  app: TestApp['app'],
  query: Record<string, string>,
  cookieOauth?: string,
) {
  let req = request(app.getHttpAdapter().getInstance().server)
    .get('/auth/google/callback')
    .redirects(0);
  for (const [kunci, nilai] of Object.entries(query)) {
    req = req.query(`${kunci}=${encodeURIComponent(nilai)}`);
  }
  if (cookieOauth !== undefined) {
    req = req.set('Cookie', `galeriku_oauth=${cookieOauth}`);
  }
  return req.set('cf-connecting-ip', TEST_IP);
}

function harapRedirectGalat(
  lokasi: string,
  kode: string,
): void {
  const url = new URL(lokasi, ORIGIN);
  if (`${url.origin}${url.pathname}` !== `${ORIGIN}/login`) {
    throw new Error(`tujuan salah: ${lokasi}`);
  }
  if (url.searchParams.get('error') !== kode) {
    throw new Error(`kode salah di ${lokasi}, harap ${kode}`);
  }
}

describe('Auth Google (e2e)', () => {
  let app: TestApp['app'];
  let db: FakeDb;

  beforeAll(() => {
    pasangStubFetch();
  });

  afterAll(() => {
    globalThis.fetch = fetchAsli;
  });

  beforeEach(async () => {
    resetStub();
    ({ app, db } = await createTestApp());
  });

  afterEach(async () => {
    await app.close();
  });

  const server = () => app.getHttpAdapter().getInstance().server;

  describe('mulai', () => {
    it('302 ke Google + cookie oauth HttpOnly berumur 10 menit', async () => {
      const { lokasi, mentah, state, cookieOauth } = await mulaiAlur(app);
      const tujuan = new URL(lokasi);
      expect(`${tujuan.origin}${tujuan.pathname}`).toBe(
        'https://accounts.google.com/o/oauth2/v2/auth',
      );
      expect(tujuan.searchParams.get('client_id')).toBe('client-uji');
      expect(tujuan.searchParams.get('redirect_uri')).toBe(CALLBACK_URL);
      expect(tujuan.searchParams.get('response_type')).toBe('code');
      expect(tujuan.searchParams.get('scope')).toBe('openid email profile');
      expect(tujuan.searchParams.get('prompt')).toBe('select_account');
      expect(tujuan.searchParams.get('code_challenge_method')).toBe('S256');
      // PKCE: challenge = sha256 verifier dari cookie.
      const verifier = cookieOauth.split('.')[1];
      const harap = createHash('sha256')
        .update(verifier, 'utf8')
        .digest('base64url');
      expect(tujuan.searchParams.get('code_challenge')).toBe(harap);
      expect(tujuan.searchParams.get('state')).toBe(state);
      const sesi = mentah.find((c) => c.startsWith('galeriku_oauth='));
      expect(sesi).toBeDefined();
      expect(sesi).toMatch(/HttpOnly/i);
      expect(sesi).toMatch(/SameSite=Lax/i);
      expect(sesi).toMatch(/Path=\/auth\/google/);
      expect(sesi).toMatch(/Max-Age=600/);
      expect(sesi).not.toMatch(/Domain=/i);
    });

    it('503 jelas bila belum dikonfigurasi di non-produksi', async () => {
      const simpanId = process.env.GOOGLE_CLIENT_ID;
      const simpanSecret = process.env.GOOGLE_CLIENT_SECRET;
      const simpanCallback = process.env.GOOGLE_CALLBACK_URL;
      delete process.env.GOOGLE_CLIENT_ID;
      delete process.env.GOOGLE_CLIENT_SECRET;
      delete process.env.GOOGLE_CALLBACK_URL;
      const lain = await createTestApp(createFakeDb());
      try {
        const res = await request(lain.app.getHttpAdapter().getInstance().server)
          .get('/auth/google')
          .expect(503);
        expect(res.body).toEqual({
          statusCode: 503,
          code: 'GOOGLE_UNCONFIGURED',
          message: 'Login Google belum dikonfigurasi.',
        });
      } finally {
        await lain.app.close();
        if (simpanId !== undefined) process.env.GOOGLE_CLIENT_ID = simpanId;
        if (simpanSecret !== undefined)
          process.env.GOOGLE_CLIENT_SECRET = simpanSecret;
        if (simpanCallback !== undefined)
          process.env.GOOGLE_CALLBACK_URL = simpanCallback;
      }
    });

    it('rate limit: mulai ke-21 dalam 15 menit -> redirect rate_limited', async () => {
      for (let i = 0; i < 20; i += 1) {
        await request(server())
          .get('/auth/google')
          .redirects(0)
          .set('cf-connecting-ip', TEST_IP)
          .expect(302)
          .expect((res) => {
            if (!String(res.headers.location).includes('accounts.google.com')) {
              throw new Error(`bukan ke Google: ${res.headers.location}`);
            }
          });
      }
      const res = await request(server())
        .get('/auth/google')
        .redirects(0)
        .set('cf-connecting-ip', TEST_IP)
        .expect(302);
      harapRedirectGalat(res.headers.location as string, 'rate_limited');
    });
  });

  describe('callback sukses', () => {
    it('akun baru: USER terverifikasi tanpa password + cookie sama dengan manual', async () => {
      const { state, cookieOauth } = await mulaiAlur(app);
      const res = await panggilCallback(
        app,
        { code: 'kode-uji', state },
        cookieOauth,
      ).expect(302);
      expect(res.headers.location).toBe(`${ORIGIN}/app`);
      const mentah = cookies(res);
      const sesi = mentah.find((c) => c.startsWith('galeriku_session='));
      expect(sesi).toBeDefined();
      expect(sesi).toMatch(/HttpOnly/i);
      expect(sesi).toMatch(/SameSite=Lax/i);
      expect(sesi).toMatch(/Path=\//);
      expect(sesi).toMatch(/Max-Age=2592000/);
      expect(sesi).not.toMatch(/Domain=/i);
      expect(sesi).not.toMatch(/Secure/i);
      // Cookie oauth sekali pakai ikut dihapus.
      const hapus = mentah.find((c) => c.startsWith('galeriku_oauth='));
      expect(hapus).toMatch(/Max-Age=0/);
      const row = [...db.users.values()].find(
        (u) => u.email === 'saya@contoh.id',
      );
      expect(row?.role).toBe('USER');
      expect(row?.status).toBe('ACTIVE');
      expect(row?.googleSub).toBe('sub-google-uji');
      expect(row?.passwordHash).toBeNull();
      expect(row?.name).toBe('Saya Google');
      expect(row?.avatarUrl).toBe('https://gambar.uji/foto.png');
      expect(row?.quotaBytes).toBe(123456789n);
      expect(row?.emailVerifiedAt).toBeInstanceOf(Date);
      expect(row?.lastLoginAt).toBeInstanceOf(Date);
      expect(db.sessions.size).toBe(1);
    });

    it('nama fallback dari bagian lokal email bila name kosong', async () => {
      stub.profil = { ...PROFIL_DEFAULT, name: '   ' };
      const { state, cookieOauth } = await mulaiAlur(app);
      await panggilCallback(app, { code: 'kode-uji', state }, cookieOauth).expect(
        302,
      );
      const row = [...db.users.values()].find(
        (u) => u.email === 'saya@contoh.id',
      );
      expect(row?.name).toBe('saya');
      expect(row?.avatarUrl).toBe('https://gambar.uji/foto.png');
    });

    it('tautan ke akun terverifikasi: password, nama, avatar tetap', async () => {
      const lama = await seedUser(db, {
        name: 'Nama Lama',
        avatarUrl: 'https://lama/avatar.png',
      });
      const { state, cookieOauth } = await mulaiAlur(app);
      await panggilCallback(app, { code: 'kode-uji', state }, cookieOauth)
        .expect(302)
        .expect((res) => {
          if (res.headers.location !== `${ORIGIN}/app`) {
            throw new Error(`tujuan salah: ${res.headers.location}`);
          }
        });
      const baru = db.users.get(lama.id as string);
      expect(baru?.googleSub).toBe('sub-google-uji');
      expect(baru?.passwordHash).toBe(lama.passwordHash);
      expect(baru?.name).toBe('Nama Lama');
      expect(baru?.avatarUrl).toBe('https://lama/avatar.png');
      expect(baru?.emailVerifiedAt).toEqual(lama.emailVerifiedAt);
      expect(db.sessions.size).toBe(1);
    });

    it('tautan ke akun BELUM terverifikasi: password dihapus, kode dan sesi dibersihkan', async () => {
      const lama = await seedUser(db, { emailVerifiedAt: null });
      const tokenLama = craftSession(db, lama.id as string);
      db.emailCodes.push({
        email: 'saya@contoh.id',
        kind: 'VERIFY_EMAIL',
      });
      const { state, cookieOauth } = await mulaiAlur(app);
      await panggilCallback(app, { code: 'kode-uji', state }, cookieOauth).expect(
        302,
      );
      const baru = db.users.get(lama.id as string);
      expect(baru?.googleSub).toBe('sub-google-uji');
      expect(baru?.passwordHash).toBeNull();
      expect(baru?.emailVerifiedAt).toBeInstanceOf(Date);
      const idSesiLama = createHash('sha256')
        .update(tokenLama, 'utf8')
        .digest('hex');
      expect(db.sessions.has(idSesiLama)).toBe(false);
      expect(db.sessions.size).toBe(1);
      expect(
        db.emailCodes.filter((c) => c.email === 'saya@contoh.id'),
      ).toHaveLength(0);
    });

    it('ADMIN_EMAIL menjadi ADMIN setelah verifikasi Google', async () => {
      stub.profil = { ...PROFIL_DEFAULT, email: 'admin@contoh.id' };
      const { state, cookieOauth } = await mulaiAlur(app);
      await panggilCallback(app, { code: 'kode-uji', state }, cookieOauth).expect(
        302,
      );
      const row = [...db.users.values()].find(
        (u) => u.email === 'admin@contoh.id',
      );
      expect(row?.role).toBe('ADMIN');
    });
  });

  describe('callback gagal', () => {
    it('state tidak cocok / cookie hilang / code hilang -> google_failed', async () => {
      const { state, cookieOauth } = await mulaiAlur(app);
      const salah = await panggilCallback(
        app,
        { code: 'kode-uji', state: `${state}beda` },
        cookieOauth,
      ).expect(302);
      harapRedirectGalat(salah.headers.location as string, 'google_failed');
      const tanpaCookie = await panggilCallback(app, {
        code: 'kode-uji',
        state,
      }).expect(302);
      harapRedirectGalat(
        tanpaCookie.headers.location as string,
        'google_failed',
      );
      const tanpaCode = await panggilCallback(app, { state }, cookieOauth).expect(
        302,
      );
      harapRedirectGalat(tanpaCode.headers.location as string, 'google_failed');
      expect(db.users.size).toBe(0);
      expect(db.sessions.size).toBe(0);
    });

    it('access_denied -> google_cancelled, error lain -> google_failed', async () => {
      const batal = await request(server())
        .get('/auth/google/callback')
        .redirects(0)
        .query('error=access_denied')
        .set('cf-connecting-ip', TEST_IP)
        .expect(302);
      harapRedirectGalat(batal.headers.location as string, 'google_cancelled');
      const lain = await request(server())
        .get('/auth/google/callback')
        .redirects(0)
        .query('error=temporarily_unavailable')
        .set('cf-connecting-ip', TEST_IP)
        .expect(302);
      harapRedirectGalat(lain.headers.location as string, 'google_failed');
    });

    it('google_sub berbeda -> google_failed tanpa sesi', async () => {
      await seedUser(db, { googleSub: 'sub-milik-orang' });
      const { state, cookieOauth } = await mulaiAlur(app);
      const res = await panggilCallback(
        app,
        { code: 'kode-uji', state },
        cookieOauth,
      ).expect(302);
      harapRedirectGalat(res.headers.location as string, 'google_failed');
      expect(db.sessions.size).toBe(0);
      expect(nilaiCookie(cookies(res), 'galeriku_session')).toBeNull();
    });

    it('email Google tak terverifikasi -> google_unverified', async () => {
      stub.profil = { ...PROFIL_DEFAULT, email_verified: false };
      const { state, cookieOauth } = await mulaiAlur(app);
      const res = await panggilCallback(
        app,
        { code: 'kode-uji', state },
        cookieOauth,
      ).expect(302);
      harapRedirectGalat(res.headers.location as string, 'google_unverified');
      expect(db.users.size).toBe(0);
    });

    it('akun SUSPENDED -> suspended tanpa sesi', async () => {
      await seedUser(db, {
        status: 'SUSPENDED',
        googleSub: 'sub-google-uji',
      });
      const { state, cookieOauth } = await mulaiAlur(app);
      const res = await panggilCallback(
        app,
        { code: 'kode-uji', state },
        cookieOauth,
      ).expect(302);
      harapRedirectGalat(res.headers.location as string, 'suspended');
      expect(db.sessions.size).toBe(0);
      expect(nilaiCookie(cookies(res), 'galeriku_session')).toBeNull();
    });

    it('akun email SUSPENDED belum tertaut -> suspended tanpa tertaut', async () => {
      await seedUser(db, { status: 'SUSPENDED' });
      const { state, cookieOauth } = await mulaiAlur(app);
      const res = await panggilCallback(
        app,
        { code: 'kode-uji', state },
        cookieOauth,
      ).expect(302);
      harapRedirectGalat(res.headers.location as string, 'suspended');
      const row = [...db.users.values()].find(
        (u) => u.email === 'saya@contoh.id',
      );
      expect(row?.googleSub).toBeNull();
      expect(db.sessions.size).toBe(0);
    });

    it('tukar code gagal / userinfo rusak -> google_failed', async () => {
      stub.statusToken = 400;
      const { state, cookieOauth } = await mulaiAlur(app);
      const gagal = await panggilCallback(
        app,
        { code: 'kode-uji', state },
        cookieOauth,
      ).expect(302);
      harapRedirectGalat(gagal.headers.location as string, 'google_failed');
      stub.statusToken = 200;
      stub.profil = { email: 'saya@contoh.id', email_verified: true };
      const { state: s2, cookieOauth: c2 } = await mulaiAlur(app);
      const rusak = await panggilCallback(
        app,
        { code: 'kode-uji', state: s2 },
        c2,
      ).expect(302);
      harapRedirectGalat(rusak.headers.location as string, 'google_failed');
    });

    // Timeout fetch Google 10 detik; butuh batas tes lebih longgar.
    it(
      'Google timeout -> google_unavailable',
      async () => {
        stub.gantungUserinfo = true;
        const { state, cookieOauth } = await mulaiAlur(app);
        const res = await panggilCallback(
          app,
          { code: 'kode-uji', state },
          cookieOauth,
        ).expect(302);
        harapRedirectGalat(res.headers.location as string, 'google_unavailable');
      },
      20_000,
    );
  });

  describe('akun tanpa password (khusus Google)', () => {
    it('login manual seragam INVALID_CREDENTIALS', async () => {
      await seedUser(db, { passwordHash: null });
      const res = await request(server())
        .post('/auth/login')
        .set('Origin', ORIGIN)
        .set('cf-connecting-ip', TEST_IP)
        .send({
          email: 'saya@contoh.id',
          password: PASSWORD_BENAR,
          turnstileToken: 'token-uji',
        })
        .expect(401);
      expect(res.body).toEqual({
        statusCode: 401,
        code: 'INVALID_CREDENTIALS',
        message: 'Email atau password tidak cocok.',
      });
    });

    it('reset password BOLEH menetapkan password pertama via OTP', async () => {
      await seedUser(db, { passwordHash: null, googleSub: 'sub-google-uji' });
      await request(server())
        .post('/auth/forgot-password')
        .set('Origin', ORIGIN)
        .set('cf-connecting-ip', TEST_IP)
        .send({ email: 'saya@contoh.id', turnstileToken: 'token-uji' })
        .expect(202);
      const otp = app.get(OtpService);
      const kode = await otp.issueCode('saya@contoh.id', EmailCodeKind.RESET_PASSWORD);
      await request(server())
        .post('/auth/reset-password')
        .set('Origin', ORIGIN)
        .set('cf-connecting-ip', TEST_IP)
        .send({
          email: 'saya@contoh.id',
          code: kode,
          newPassword: 'kata-sandi-pertama',
        })
        .expect(204);
      const row = [...db.users.values()].find(
        (u) => u.email === 'saya@contoh.id',
      );
      expect(typeof row?.passwordHash).toBe('string');
      await request(server())
        .post('/auth/login')
        .set('Origin', ORIGIN)
        .set('cf-connecting-ip', TEST_IP)
        .send({
          email: 'saya@contoh.id',
          password: 'kata-sandi-pertama',
          turnstileToken: 'token-uji',
        })
        .expect(200);
    });
  });
});

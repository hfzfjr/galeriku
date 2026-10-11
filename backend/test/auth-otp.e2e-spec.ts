import { createHash } from 'node:crypto';
import request from 'supertest';
import { ApiError } from '../src/auth/api-error';
import { PasswordService } from '../src/auth/password.service';
import {
  createFakeDb,
  createTestApp,
  createVerifyStub,
  type FakeDb,
  type MailOutbox,
  type TestApp,
  type TestTurnstile,
} from './test-app';

process.env.FRONTEND_ORIGIN ??= 'https://galeriku.hafizfajar.com';
process.env.ADMIN_EMAIL ??= 'admin@contoh.id';
const ORIGIN = process.env.FRONTEND_ORIGIN as string;
const TEST_IP = '203.0.113.7';
const PASSWORD_BENAR = 'kata-sandi-benar';
const PASSWORD_BARU = 'kata-sandi-yang-baru';

const passwords = new PasswordService();

function post(app: TestApp['app'], url: string) {
  return request(app.getHttpAdapter().getInstance().server)
    .post(url)
    .set('Origin', ORIGIN)
    .set('cf-connecting-ip', TEST_IP);
}

function kodeDariOutbox(outbox: MailOutbox, index: number): string {
  const entri = outbox.sent[index] as { code?: unknown } | undefined;
  if (!entri || typeof entri.code !== 'string') {
    throw new Error('kode tidak ada di outbox');
  }
  return entri.code;
}

async function tungguMail(outbox: MailOutbox, jumlah: number): Promise<number> {
  const mulai = Date.now();
  while (outbox.sent.length < jumlah && Date.now() - mulai < 2000) {
    await new Promise((r) => setTimeout(r, 25));
  }
  return outbox.sent.length;
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

function barisKode(db: FakeDb, email: string) {
  return db.emailCodes.filter((r) => r.email === email);
}

describe('Auth OTP (e2e)', () => {
  let app: TestApp['app'];
  let db: FakeDb;
  let turnstile: TestTurnstile;
  let mail: MailOutbox;

  beforeEach(async () => {
    ({ app, db, turnstile, mail } = await createTestApp());
  });

  afterEach(async () => {
    await app.close();
  });

  function daftar(email = 'baru@contoh.id') {
    return post(app, '/auth/register').send({
      name: 'Pengguna Baru',
      email,
      password: PASSWORD_BENAR,
      turnstileToken: 'token-uji',
    });
  }

  describe('verify-email', () => {
    it('kode benar -> terverifikasi + cookie sesi + me', async () => {
      await daftar().expect(201);
      const kode = kodeDariOutbox(mail, 0);
      // Hanya hash yang tersimpan di DB.
      expect(barisKode(db, 'baru@contoh.id')).toHaveLength(1);
      const tersimpan = barisKode(db, 'baru@contoh.id')[0] as Record<
        string,
        unknown
      >;
      expect(tersimpan.codeHash).toMatch(/^[0-9a-f]{64}$/);
      expect(JSON.stringify(tersimpan)).not.toContain(kode);

      const res = await post(app, '/auth/verify-email')
        .send({ email: 'baru@contoh.id', code: kode })
        .expect(200);
      expect(res.body.email).toBe('baru@contoh.id');
      expect(res.body.role).toBe('USER');
      expect(typeof res.body.emailVerifiedAt).toBe('string');
      const cookies = res.headers['set-cookie'] as unknown as string[];
      const sesi = cookies.find((c) => c.startsWith('galeriku_session='));
      expect(sesi).toMatch(/HttpOnly/i);
      expect(sesi).toMatch(/SameSite=Lax/i);
      expect(barisKode(db, 'baru@contoh.id')).toHaveLength(0);
      const jar = sesi?.split(';')[0] as string;
      await request(app.getHttpAdapter().getInstance().server)
        .get('/auth/me')
        .set('Cookie', jar)
        .expect(200);
    });

    it('salah menaikkan attempts; ke-5 hangus; benar sesudahnya tetap salah', async () => {
      await daftar().expect(201);
      const kode = kodeDariOutbox(mail, 0);
      const salah = kode === '000000' ? '000001' : '000000';
      for (let i = 1; i <= 4; i += 1) {
        await post(app, '/auth/verify-email')
          .send({ email: 'baru@contoh.id', code: salah })
          .expect(400)
          .expect((res) => {
            if (res.body.code !== 'INVALID_CODE') {
              throw new Error(`kode tak terduga: ${res.text}`);
            }
          });
        expect(barisKode(db, 'baru@contoh.id')[0]?.attempts).toBe(i);
      }
      await post(app, '/auth/verify-email')
        .send({ email: 'baru@contoh.id', code: salah })
        .expect(400);
      expect(barisKode(db, 'baru@contoh.id')).toHaveLength(0);
      await post(app, '/auth/verify-email')
        .send({ email: 'baru@contoh.id', code: kode })
        .expect(400)
        .expect((res) => {
          if (res.body.code !== 'INVALID_CODE') {
            throw new Error(`kode tak terduga: ${res.text}`);
          }
        });
    });

    it('kedaluwarsa -> INVALID_CODE dan dibersihkan', async () => {
      await daftar().expect(201);
      const kode = kodeDariOutbox(mail, 0);
      const baris = barisKode(db, 'baru@contoh.id')[0] as Record<
        string,
        unknown
      >;
      baris.expiresAt = new Date(Date.now() - 1000);
      await post(app, '/auth/verify-email')
        .send({ email: 'baru@contoh.id', code: kode })
        .expect(400)
        .expect((res) => {
          if (res.body.code !== 'INVALID_CODE') {
            throw new Error(`kode tak terduga: ${res.text}`);
          }
        });
      expect(barisKode(db, 'baru@contoh.id')).toHaveLength(0);
    });

    it('email tak dikenal vs kode salah: body identik', async () => {
      await daftar().expect(201);
      const a = await post(app, '/auth/verify-email')
        .send({ email: 'tak-ada@contoh.id', code: '123456' })
        .expect(400);
      const b = await post(app, '/auth/verify-email')
        .send({ email: 'baru@contoh.id', code: '123456' })
        .expect(400);
      expect(JSON.stringify(a.body)).toBe(JSON.stringify(b.body));
      expect(a.body).toEqual({
        statusCode: 400,
        code: 'INVALID_CODE',
        message:
          'Kode salah atau sudah tidak berlaku. Minta kode baru jika perlu.',
      });
    });

    it('SUSPENDED dan sudah-terverifikasi -> INVALID_CODE', async () => {
      await daftar().expect(201);
      const kode = kodeDariOutbox(mail, 0);
      const user = [...db.users.values()].find(
        (u) => u.email === 'baru@contoh.id',
      ) as Record<string, unknown>;
      user.status = 'SUSPENDED';
      await post(app, '/auth/verify-email')
        .send({ email: 'baru@contoh.id', code: kode })
        .expect(400)
        .expect((res) => {
          if (res.body.code !== 'INVALID_CODE') {
            throw new Error(`kode tak terduga: ${res.text}`);
          }
        });
      user.status = 'ACTIVE';
      // Kode sudah hangus; verifikasi kedua juga invalid walau kode benar.
      await post(app, '/auth/verify-email')
        .send({ email: 'baru@contoh.id', code: kode })
        .expect(400);
    });

    it('ADMIN_EMAIL menjadi ADMIN setelah verifikasi, USER sebelumnya', async () => {
      await daftar('admin@contoh.id').expect(201);
      const sebelum = [...db.users.values()].find(
        (u) => u.email === 'admin@contoh.id',
      );
      expect(sebelum?.role).toBe('USER');
      const kode = kodeDariOutbox(mail, 0);
      const res = await post(app, '/auth/verify-email')
        .send({ email: 'admin@contoh.id', code: kode })
        .expect(200);
      expect(res.body.role).toBe('ADMIN');
    });

    it('kode reset tak berlaku untuk verify dan sebaliknya', async () => {
      await seedUser(db);
      await post(app, '/auth/forgot-password')
        .send({ email: 'saya@contoh.id', turnstileToken: 'token-uji' })
        .expect(202);
      expect(await tungguMail(mail, 1)).toBe(1);
      await tungguMail(mail, 1);
      const kodeReset = kodeDariOutbox(mail, 0);
      await post(app, '/auth/verify-email')
        .send({ email: 'saya@contoh.id', code: kodeReset })
        .expect(400)
        .expect((res) => {
          if (res.body.code !== 'INVALID_CODE') {
            throw new Error(`kode tak terduga: ${res.text}`);
          }
        });
      await daftar('kedua@contoh.id').expect(201);
      const kodeVerify = kodeDariOutbox(mail, 1);
      await post(app, '/auth/reset-password')
        .send({
          email: 'saya@contoh.id',
          code: kodeVerify,
          newPassword: PASSWORD_BARU,
        })
        .expect(400)
        .expect((res) => {
          if (res.body.code !== 'INVALID_CODE') {
            throw new Error(`kode tak terduga: ${res.text}`);
          }
        });
    });
  });

  describe('resend-code', () => {
    it('jeda 60 detik: tanpa mail baru, kode lama tetap berlaku', async () => {
      await daftar().expect(201);
      expect(mail.sent).toHaveLength(1);
      const res = await post(app, '/auth/resend-code')
        .send({ email: 'baru@contoh.id' })
        .expect(202);
      expect(res.body).toEqual({ accepted: true });
      expect(mail.sent).toHaveLength(1);
      const kode = kodeDariOutbox(mail, 0);
      await post(app, '/auth/verify-email')
        .send({ email: 'baru@contoh.id', code: kode })
        .expect(200);
    });

    it('kode baru menggugurkan yang lama', async () => {
      await daftar().expect(201);
      const lama = kodeDariOutbox(mail, 0);
      const baris = barisKode(db, 'baru@contoh.id')[0] as Record<
        string,
        unknown
      >;
      baris.lastSentAt = new Date(Date.now() - 61_000);
      await post(app, '/auth/resend-code')
        .send({ email: 'baru@contoh.id' })
        .expect(202);
      expect(mail.sent).toHaveLength(2);
      const baru = kodeDariOutbox(mail, 1);
      await post(app, '/auth/verify-email')
        .send({ email: 'baru@contoh.id', code: lama })
        .expect(400);
      await post(app, '/auth/verify-email')
        .send({ email: 'baru@contoh.id', code: baru })
        .expect(200);
    });

    it('respons identik untuk tak-ada/terverifikasi/dalam-jeda', async () => {
      await seedUser(db);
      const a = await post(app, '/auth/resend-code')
        .send({ email: 'tak-ada@contoh.id' })
        .expect(202);
      const b = await post(app, '/auth/resend-code')
        .send({ email: 'saya@contoh.id' })
        .expect(202);
      await daftar('tunggu@contoh.id').expect(201);
      const c = await post(app, '/auth/resend-code')
        .send({ email: 'tunggu@contoh.id' })
        .expect(202);
      expect(JSON.stringify(a.body)).toBe(JSON.stringify(b.body));
      expect(JSON.stringify(b.body)).toBe(JSON.stringify(c.body));
      expect(a.body).toEqual({ accepted: true });
      expect(mail.sent).toHaveLength(1);
    });
  });

  describe('forgot-password', () => {
    it('respons dan status identik untuk ada vs tak-ada', async () => {
      await seedUser(db);
      const a = await post(app, '/auth/forgot-password')
        .send({ email: 'tak-ada@contoh.id', turnstileToken: 'token-uji' })
        .expect(202);
      const b = await post(app, '/auth/forgot-password')
        .send({ email: 'saya@contoh.id', turnstileToken: 'token-uji' })
        .expect(202);
      expect(JSON.stringify(a.body)).toBe(JSON.stringify(b.body));
      expect(a.body).toEqual({ accepted: true });
      expect(await tungguMail(mail, 1)).toBe(1);
      const entri = mail.sent[0] as Record<string, unknown>;
      expect(entri.to).toBe('saya@contoh.id');
      expect(entri.subject).toBe('Kode atur ulang password Galeriku');
    });

    it('Turnstile gagal -> 400 dan tanpa mail', async () => {
      turnstile.rejectOnce(
        new ApiError(400, 'TURNSTILE_FAILED', 'Verifikasi keamanan gagal.'),
      );
      await seedUser(db);
      await post(app, '/auth/forgot-password')
        .send({ email: 'saya@contoh.id', turnstileToken: 'token-uji' })
        .expect(400)
        .expect((res) => {
          if (res.body.code !== 'TURNSTILE_FAILED') {
            throw new Error(`kode tak terduga: ${res.text}`);
          }
        });
      expect(mail.sent).toHaveLength(0);
    });

    it('unverified dan SUSPENDED tidak menerima kode', async () => {
      await seedUser(db, { email: 'belum@contoh.id', emailVerifiedAt: null });
      await seedUser(db, { email: 'beku@contoh.id', status: 'SUSPENDED' });
      await post(app, '/auth/forgot-password')
        .send({ email: 'belum@contoh.id', turnstileToken: 'token-uji' })
        .expect(202);
      await post(app, '/auth/forgot-password')
        .send({ email: 'beku@contoh.id', turnstileToken: 'token-uji' })
        .expect(202);
      await new Promise((r) => setTimeout(r, 300));
      expect(mail.sent).toHaveLength(0);
    });
  });

  describe('reset-password', () => {
    it('sukses mencabut SEMUA sesi, tanpa sesi baru; password berganti', async () => {
      const user = await seedUser(db);
      const sesiLama: string[] = [];
      for (const label of ['satu', 'dua']) {
        const token = `token-${label}`;
        const id = createHash('sha256').update(token).digest('hex');
        db.sessions.set(id, {
          id,
          userId: user.id,
          expiresAt: new Date(Date.now() + 3600_000),
          createdAt: new Date(),
          ipHash: 'uji',
          userAgent: '',
        });
        sesiLama.push(token);
      }
      await post(app, '/auth/forgot-password')
        .send({ email: 'saya@contoh.id', turnstileToken: 'token-uji' })
        .expect(202);
      await tungguMail(mail, 1);
      const kode = kodeDariOutbox(mail, 0);
      await post(app, '/auth/reset-password')
        .send({
          email: 'saya@contoh.id',
          code: kode,
          newPassword: PASSWORD_BARU,
        })
        .expect(204);
      expect(db.sessions.size).toBe(0);
      for (const token of sesiLama) {
        await request(app.getHttpAdapter().getInstance().server)
          .get('/auth/me')
          .set('Cookie', `galeriku_session=${token}`)
          .expect(401);
      }
      await post(app, '/auth/login')
        .send({
          email: 'saya@contoh.id',
          password: PASSWORD_BENAR,
          turnstileToken: 'token-uji',
        })
        .expect(401);
      await post(app, '/auth/login')
        .send({
          email: 'saya@contoh.id',
          password: PASSWORD_BARU,
          turnstileToken: 'token-uji',
        })
        .expect(200);
    });
  });

  describe('register mengirim email; gagal mail tak menggagalkan', () => {
    it('register mengirim email verifikasi', async () => {
      await daftar().expect(201);
      expect(mail.sent).toHaveLength(1);
      const entri = mail.sent[0] as Record<string, unknown>;
      expect(entri.to).toBe('baru@contoh.id');
      expect(entri.subject).toBe('Kode verifikasi Galeriku');
      expect(entri.kind).toBe('verify-email');
    });

    it('kegagalan MailService tak menggagalkan register/forgot', async () => {
      await app.close();
      const gagal = {
        sender: {
          send: async () => {
            throw new Error('SMTP down');
          },
        },
        sent: [],
      };
      ({ app, db, turnstile, mail } = await createTestApp(
        createFakeDb(),
        createVerifyStub(),
        gagal,
      ));
      await daftar().expect(201);
      await post(app, '/auth/forgot-password')
        .send({ email: 'baru@contoh.id', turnstileToken: 'token-uji' })
        .expect(202);
    });
  });

  describe('rate limit endpoint baru', () => {
    it('verify ke-11 -> 429 + Retry-After', async () => {
      for (let i = 0; i < 10; i += 1) {
        await post(app, '/auth/verify-email').send({
          email: 'tak-ada@contoh.id',
          code: '123456',
        });
      }
      await post(app, '/auth/verify-email')
        .send({ email: 'tak-ada@contoh.id', code: '123456' })
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

    it('resend: IP ke-6 -> 429', async () => {
      for (let i = 0; i < 5; i += 1) {
        await post(app, '/auth/resend-code').send({
          email: `orang-${i}@contoh.id`,
        });
      }
      await post(app, '/auth/resend-code')
        .send({ email: 'orang-5@contoh.id' })
        .expect(429)
        .expect((res) => {
          if (res.body.code !== 'RATE_LIMITED') {
            throw new Error(`kode tak terduga: ${res.text}`);
          }
        });
    });

    it('resend: email sama ke-4 -> 429', async () => {
      for (let i = 0; i < 3; i += 1) {
        await post(app, '/auth/resend-code').send({
          email: 'sama@contoh.id',
        });
      }
      await post(app, '/auth/resend-code')
        .send({ email: 'sama@contoh.id' })
        .expect(429)
        .expect((res) => {
          if (res.body.code !== 'RATE_LIMITED') {
            throw new Error(`kode tak terduga: ${res.text}`);
          }
        });
    });

    it('forgot: IP ke-6 -> 429', async () => {
      const badan = (email: string) => ({
        email,
        turnstileToken: 'token-uji',
      });
      for (let i = 0; i < 5; i += 1) {
        await post(app, '/auth/forgot-password').send(
          badan(`orang-${i}@contoh.id`),
        );
      }
      await post(app, '/auth/forgot-password')
        .send(badan('orang-5@contoh.id'))
        .expect(429)
        .expect((res) => {
          if (res.body.code !== 'RATE_LIMITED') {
            throw new Error(`kode tak terduga: ${res.text}`);
          }
        });
    });

    it('forgot: email sama ke-4 -> 429', async () => {
      const badan = (email: string) => ({
        email,
        turnstileToken: 'token-uji',
      });
      for (let i = 0; i < 3; i += 1) {
        await post(app, '/auth/forgot-password').send(badan('sama@contoh.id'));
      }
      await post(app, '/auth/forgot-password')
        .send(badan('sama@contoh.id'))
        .expect(429)
        .expect((res) => {
          if (res.body.code !== 'RATE_LIMITED') {
            throw new Error(`kode tak terduga: ${res.text}`);
          }
        });
    });

    it('reset ke-11 -> 429', async () => {
      for (let i = 0; i < 10; i += 1) {
        await post(app, '/auth/reset-password').send({
          email: 'tak-ada@contoh.id',
          code: '123456',
          newPassword: 'kata-sandi-baru-banget',
        });
      }
      await post(app, '/auth/reset-password')
        .send({
          email: 'tak-ada@contoh.id',
          code: '123456',
          newPassword: 'kata-sandi-baru-banget',
        })
        .expect(429);
    });
  });
});

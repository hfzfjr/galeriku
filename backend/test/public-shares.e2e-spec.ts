import request from 'supertest';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { FileKind, FileStatus, ShareTarget } from '../src/generated/prisma/client';
import { PasswordService } from '../src/auth/services/password.service';
import {
  createTestApp,
  type FakeDb,
  type TestApp,
} from './test-app';
import { resolveMediaDir } from '../src/uploads/uploads.utils';

function seedUser(
  db: FakeDb,
  id: string,
  status: 'ACTIVE' | 'SUSPENDED' = 'ACTIVE',
): void {
  db.users.set(id, {
    id,
    email: `${id}@contoh.id`,
    name: id,
    avatarUrl: null,
    passwordHash: 'hash',
    googleSub: null,
    role: 'USER',
    status,
    quotaBytes: 1024n * 1024n * 1024n,
    createdAt: new Date(),
    lastLoginAt: null,
    emailVerifiedAt: new Date(),
  });
}

function seedPhysicalFile(fileId: string, content: Buffer): {
  storageKey: string;
  thumbKey: string;
} {
  const mediaDir = resolveMediaDir();
  mkdirSync(mediaDir, { recursive: true });
  const storageKey = `${fileId}.jpg`;
  const thumbKey = `${fileId}.thumb.webp`;
  writeFileSync(join(mediaDir, storageKey), content);
  writeFileSync(join(mediaDir, thumbKey), Buffer.from('RIFF....WEBPVP8 '));
  return { storageKey, thumbKey };
}

describe('Public Shares (US-25)', () => {
  let app: TestApp;
  const contentBuf = Buffer.from('0123456789abcdefghij'); // 20 bytes

  beforeAll(async () => {
    app = await createTestApp();
    seedUser(app.db, 'user-active', 'ACTIVE');
    seedUser(app.db, 'user-suspended', 'SUSPENDED');
  });

  afterAll(async () => {
    await app.app.close();
    const mediaDir = resolveMediaDir();
    try {
      rmSync(join(mediaDir, 'f-pub-1.jpg'), { force: true });
      rmSync(join(mediaDir, 'f-pub-1.thumb.webp'), { force: true });
    } catch {
      // Abaikan
    }
  });

  it('penerima dapat membuka tautan publik dan melihat file tanpa login', async () => {
    const http = () =>
      request(app.app.getHttpAdapter().getInstance().server);

    const { storageKey, thumbKey } = seedPhysicalFile('f-pub-1', contentBuf);

    app.db.files.set('f-pub-1', {
      id: 'f-pub-1',
      ownerId: 'user-active',
      originalName: 'pemandangan.jpg',
      storageKey,
      thumbKey,
      mimeType: 'image/jpeg',
      sizeBytes: BigInt(contentBuf.length),
      kind: FileKind.image,
      width: 1920,
      height: 1080,
      durationS: null,
      status: FileStatus.ready,
      takenAt: null,
      createdAt: new Date(),
      deletedAt: null,
    });

    const token = 'token-publik-xyz-123';
    app.db.shareLinks.set('sh-1', {
      id: 'sh-1',
      token,
      ownerId: 'user-active',
      targetType: ShareTarget.file,
      targetId: 'f-pub-1',
      allowDownload: true,
      viewCount: 0,
      expiresAt: null,
      passwordHash: null,
      revokedAt: null,
      createdAt: new Date(),
    });

    // 1. Buka metadata publik tanpa login (tanpa cookie)
    const res = await http()
      .get(`/public/s/${token}`)
      .expect(200);

    expect(res.header['x-robots-tag']).toBe('noindex, nofollow');
    expect(res.body.token).toBe(token);
    expect(res.body.title).toBe('pemandangan.jpg');
    expect(res.body.files).toHaveLength(1);
    expect(res.body.allowDownload).toBe(true);

    // viewCount bertambah di DB
    const updatedShare = app.db.shareLinks.get('sh-1');
    expect(updatedShare?.viewCount).toBe(1);

    // 2. Stream thumbnail tanpa login
    const resThumb = await http()
      .get(`/public/s/${token}/files/f-pub-1/thumb`)
      .expect(200);

    expect(resThumb.header['content-type']).toBe('image/webp');
    expect(resThumb.header['x-robots-tag']).toBe('noindex, nofollow');

    // 3. Streaming HTTP Range tanpa login
    const resRange = await http()
      .get(`/public/s/${token}/files/f-pub-1`)
      .set('Range', 'bytes=0-4')
      .expect(206);

    expect(resRange.header['content-range']).toBe(`bytes 0-4/${contentBuf.length}`);
    expect(resRange.body.toString()).toBe('01234');

    // 4. Unduh berkas tanpa login
    const resDownload = await http()
      .get(`/public/s/${token}/files/f-pub-1?download=1`)
      .expect(200);

    expect(resDownload.header['content-disposition']).toContain('attachment');
  });

  it('menolak akses jika pemilik berstatus SUSPENDED (carry-over rule US-25)', async () => {
    const http = () =>
      request(app.app.getHttpAdapter().getInstance().server);

    const tokenSuspended = 'token-milik-suspended';
    app.db.shareLinks.set('sh-susp', {
      id: 'sh-susp',
      token: tokenSuspended,
      ownerId: 'user-suspended',
      targetType: ShareTarget.file,
      targetId: 'f-pub-1',
      allowDownload: true,
      viewCount: 0,
      expiresAt: null,
      passwordHash: null,
      revokedAt: null,
      createdAt: new Date(),
    });

    await http().get(`/public/s/${tokenSuspended}`).expect(404);
  });

  it('menolak unduh 403 jika allowDownload dinonaktifkan', async () => {
    const http = () =>
      request(app.app.getHttpAdapter().getInstance().server);

    const tokenNoDownload = 'token-tanpa-unduh';
    app.db.shareLinks.set('sh-nodl', {
      id: 'sh-nodl',
      token: tokenNoDownload,
      ownerId: 'user-active',
      targetType: ShareTarget.file,
      targetId: 'f-pub-1',
      allowDownload: false,
      viewCount: 0,
      expiresAt: null,
      passwordHash: null,
      revokedAt: null,
      createdAt: new Date(),
    });

    // Konten masih bisa dilihat (preview)
    await http().get(`/public/s/${tokenNoDownload}/files/f-pub-1`).expect(200);

    // Tapi query download ditolak 403
    const res = await http()
      .get(`/public/s/${tokenNoDownload}/files/f-pub-1?download=1`)
      .expect(403);

    expect(res.body.code).toBe('DOWNLOAD_FORBIDDEN');
  });

  it('B6: dua link berpassword di satu browser membaca cookie galeriku_unlock_<share.id> yang tepat', async () => {
    const http = () =>
      request(app.app.getHttpAdapter().getInstance().server);

    const passwords = app.app.get(PasswordService);
    const pwdHash1 = await passwords.hashPassword('RahasiaSatu123!');
    const pwdHash2 = await passwords.hashPassword('RahasiaDua456!');

    app.db.shareLinks.set('sh-pwd-1', {
      id: 'sh-pwd-1',
      token: 'token-pwd-1',
      ownerId: 'user-active',
      targetType: ShareTarget.file,
      targetId: 'f-pub-1',
      allowDownload: true,
      viewCount: 0,
      expiresAt: null,
      passwordHash: pwdHash1,
      revokedAt: null,
      createdAt: new Date(),
    });

    app.db.shareLinks.set('sh-pwd-2', {
      id: 'sh-pwd-2',
      token: 'token-pwd-2',
      ownerId: 'user-active',
      targetType: ShareTarget.file,
      targetId: 'f-pub-1',
      allowDownload: true,
      viewCount: 0,
      expiresAt: null,
      passwordHash: pwdHash2,
      revokedAt: null,
      createdAt: new Date(),
    });

    // 1. Unlock link 1
    const resUnlock1 = await http()
      .post('/public/s/token-pwd-1/unlock')
      .send({ password: 'RahasiaSatu123!' })
      .expect(200);

    expect(resUnlock1.body.unlocked).toBe(true);
    const cookie1Header = resUnlock1.headers['set-cookie']?.[0] ?? '';
    expect(cookie1Header).toContain('galeriku_unlock_sh-pwd-1=');

    // 2. Unlock link 2
    const resUnlock2 = await http()
      .post('/public/s/token-pwd-2/unlock')
      .send({ password: 'RahasiaDua456!' })
      .expect(200);

    expect(resUnlock2.body.unlocked).toBe(true);
    const cookie2Header = resUnlock2.headers['set-cookie']?.[0] ?? '';
    expect(cookie2Header).toContain('galeriku_unlock_sh-pwd-2=');

    const cookieVal1 = resUnlock1.body.unlockToken;
    const cookieVal2 = resUnlock2.body.unlockToken;

    // Akses link 2 dengan HANYA cookie link 1 -> harus terkunci (isUnlocked: false)
    const resLocked2 = await http()
      .get('/public/s/token-pwd-2')
      .set('Cookie', `galeriku_unlock_sh-pwd-1=${cookieVal1}`)
      .expect(200);
    expect(resLocked2.body.isUnlocked).toBe(false);

    // Akses link 2 dengan kedua cookie (link 1 dulu lalu link 2) -> harus membaca cookie link 2 dan unlocked
    const resUnlocked2 = await http()
      .get('/public/s/token-pwd-2')
      .set(
        'Cookie',
        `galeriku_unlock_sh-pwd-1=${cookieVal1}; galeriku_unlock_sh-pwd-2=${cookieVal2}`,
      )
      .expect(200);
    expect(resUnlocked2.body.isUnlocked).toBe(true);
  });

  it('B6: mengganti kata sandi link mencabut unlock token lama', async () => {
    const http = () =>
      request(app.app.getHttpAdapter().getInstance().server);

    const passwords = app.app.get(PasswordService);
    const pwdLama = await passwords.hashPassword('PasswordLama123!');

    app.db.shareLinks.set('sh-ubah-pwd', {
      id: 'sh-ubah-pwd',
      token: 'token-ubah-pwd',
      ownerId: 'user-active',
      targetType: ShareTarget.file,
      targetId: 'f-pub-1',
      allowDownload: true,
      viewCount: 0,
      expiresAt: null,
      passwordHash: pwdLama,
      revokedAt: null,
      createdAt: new Date(),
    });

    // 1. Unlock dengan password lama
    const resUnlock = await http()
      .post('/public/s/token-ubah-pwd/unlock')
      .send({ password: 'PasswordLama123!' })
      .expect(200);
    const oldUnlockToken = resUnlock.body.unlockToken;

    // Verifikasi unlocked
    const resBefore = await http()
      .get('/public/s/token-ubah-pwd')
      .set('Cookie', `galeriku_unlock_sh-ubah-pwd=${oldUnlockToken}`)
      .expect(200);
    expect(resBefore.body.isUnlocked).toBe(true);

    // 2. Ganti password link di DB (seperti dipanggil oleh PATCH /shares/:id)
    const pwdBaru = await passwords.hashPassword('PasswordBaru456!');
    const shareRow = app.db.shareLinks.get('sh-ubah-pwd')!;
    shareRow.passwordHash = pwdBaru;

    // 3. Akses kembali dengan token lama -> harus ditolak / terkunci
    const resAfter = await http()
      .get('/public/s/token-ubah-pwd')
      .set('Cookie', `galeriku_unlock_sh-ubah-pwd=${oldUnlockToken}`)
      .expect(200);
    expect(resAfter.body.isUnlocked).toBe(false);
  });

  it('B7: viewCount hanya naik 1x per (link, ipHash) per 30 menit; /cover dan thumbnail tidak menaikkan viewCount', async () => {
    const http = () =>
      request(app.app.getHttpAdapter().getInstance().server);

    const tokenB7 = 'token-viewcount-b7';
    app.db.shareLinks.set('sh-b7', {
      id: 'sh-b7',
      token: tokenB7,
      ownerId: 'user-active',
      targetType: ShareTarget.file,
      targetId: 'f-pub-1',
      allowDownload: true,
      viewCount: 0,
      expiresAt: null,
      passwordHash: null,
      revokedAt: null,
      createdAt: new Date(),
    });

    // 1. Akses pertama: viewCount naik jadi 1
    await http()
      .get(`/public/s/${tokenB7}`)
      .set('x-forwarded-for', '203.0.113.10')
      .expect(200);
    expect(app.db.shareLinks.get('sh-b7')?.viewCount).toBe(1);

    // 2. Akses kedua langsung dari IP sama: viewCount tetap 1
    await http()
      .get(`/public/s/${tokenB7}`)
      .set('x-forwarded-for', '203.0.113.10')
      .expect(200);
    expect(app.db.shareLinks.get('sh-b7')?.viewCount).toBe(1);

    // 3. Akses cover: viewCount tidak boleh bertambah
    await http()
      .get(`/public/s/${tokenB7}/cover`)
      .set('x-forwarded-for', '203.0.113.10')
      .expect(200);
    expect(app.db.shareLinks.get('sh-b7')?.viewCount).toBe(1);

    // 4. Akses thumbnail: viewCount tidak boleh bertambah
    await http()
      .get(`/public/s/${tokenB7}/files/f-pub-1/thumb`)
      .set('x-forwarded-for', '203.0.113.10')
      .expect(200);
    expect(app.db.shareLinks.get('sh-b7')?.viewCount).toBe(1);
  });
});


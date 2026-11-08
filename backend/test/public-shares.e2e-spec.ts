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
  previewKey: string;
} {
  const mediaDir = resolveMediaDir();
  mkdirSync(mediaDir, { recursive: true });
  const storageKey = `${fileId}.jpg`;
  const thumbKey = `${fileId}.thumb.webp`;
  const previewKey = `${fileId}.preview.webp`;
  writeFileSync(join(mediaDir, storageKey), content);
  writeFileSync(join(mediaDir, thumbKey), Buffer.from('RIFF....WEBPVP8 '));
  writeFileSync(join(mediaDir, previewKey), Buffer.from('RIFFPREVIEWWEBP'));
  return { storageKey, thumbKey, previewKey };
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
      rmSync(join(mediaDir, 'f-pub-1.preview.webp'), { force: true });
      rmSync(join(mediaDir, 'f-pub-vid.jpg'), { force: true });
      rmSync(join(mediaDir, 'f-pub-vid.thumb.webp'), { force: true });
      rmSync(join(mediaDir, 'f-pub-vid.preview.webp'), { force: true });
      rmSync(join(mediaDir, 'f-gps-strip.jpg'), { force: true });
    } catch {
      // Abaikan
    }
  });

  it('penerima dapat membuka tautan publik dan melihat file tanpa login', async () => {
    const http = () =>
      request(app.app.getHttpAdapter().getInstance().server);

    const { storageKey, thumbKey, previewKey } = seedPhysicalFile('f-pub-1', contentBuf);

    app.db.files.set('f-pub-1', {
      id: 'f-pub-1',
      ownerId: 'user-active',
      originalName: 'pemandangan.jpg',
      storageKey,
      thumbKey,
      previewKey,
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

    // RF-14: Publik tidak pernah menerima koordinat gpsLat/gpsLng
    expect(res.body.files[0].gpsLat).toBeUndefined();
    expect(res.body.files[0].gpsLng).toBeUndefined();
    expect(res.body.files[0].gpsAltM).toBeUndefined();

    // viewCount bertambah di DB
    const updatedShare = app.db.shareLinks.get('sh-1');
    expect(updatedShare?.viewCount).toBe(1);

    // 2. Stream thumbnail tanpa login
    const resThumb = await http()
      .get(`/public/s/${token}/files/f-pub-1/thumb`)
      .expect(200);

    expect(resThumb.header['content-type']).toBe('image/webp');
    expect(resThumb.header['x-robots-tag']).toBe('noindex, nofollow');

    // 2b. Stream preview 2048px (RF-11) tanpa login (Cache-Control public bila tanpa sandi)
    const resPreview = await http()
      .get(`/public/s/${token}/files/f-pub-1/preview`)
      .expect(200);

    expect(resPreview.header['content-type']).toBe('image/webp');
    expect(resPreview.header['cache-control']).toBe('public, max-age=86400');
    expect(resPreview.header['x-robots-tag']).toBe('noindex, nofollow');

    // 3. Streaming HTTP Range video tanpa login
    const videoBuf = Buffer.from('0123456789video');
    const { storageKey: videoKey } = seedPhysicalFile('f-pub-vid', videoBuf);
    app.db.files.set('f-pub-vid', {
      id: 'f-pub-vid',
      ownerId: 'user-active',
      originalName: 'rekaman.mp4',
      storageKey: videoKey,
      thumbKey: null,
      previewKey: null,
      mimeType: 'video/mp4',
      sizeBytes: BigInt(videoBuf.length),
      kind: FileKind.video,
      width: 1920,
      height: 1080,
      durationS: 10,
      status: FileStatus.ready,
      takenAt: null,
      createdAt: new Date(),
      deletedAt: null,
    });
    app.db.shareLinks.set('sh-vid', {
      id: 'sh-vid',
      token: 'token-vid-1',
      ownerId: 'user-active',
      targetType: ShareTarget.file,
      targetId: 'f-pub-vid',
      allowDownload: true,
      viewCount: 0,
      expiresAt: null,
      passwordHash: null,
      revokedAt: null,
      createdAt: new Date(),
    });

    const resRange = await http()
      .get(`/public/s/token-vid-1/files/f-pub-vid`)
      .set('Range', 'bytes=0-4')
      .expect(206);

    expect(resRange.header['content-range']).toBe(`bytes 0-4/${videoBuf.length}`);
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

    // 5. Akses preview: viewCount tidak boleh bertambah (RF-11)
    await http()
      .get(`/public/s/${tokenB7}/files/f-pub-1/preview`)
      .set('x-forwarded-for', '203.0.113.10')
      .expect(200);
    expect(app.db.shareLinks.get('sh-b7')?.viewCount).toBe(1);
  });

  describe('RF-20: GET /public/s/:token/meta (SSR & Open Graph preview)', () => {
    const http = () => request(app.app.getHttpAdapter().getInstance().server);
    const passwords = new PasswordService();

    it('mengembalikan metadata publik tanpa efek samping atau viewCount', async () => {
      const token = 'token-meta-active';
      app.db.shareLinks.set('sh-meta-active', {
        id: 'sh-meta-active',
        token,
        ownerId: 'user-active',
        targetType: ShareTarget.file,
        targetId: 'f-pub-1',
        allowDownload: true,
        viewCount: 0,
        expiresAt: new Date(Date.now() + 86400_000),
        passwordHash: null,
        revokedAt: null,
        createdAt: new Date(),
      });

      const res = await http().get(`/public/s/${token}/meta`).expect(200);

      expect(res.body.status).toBe('ACTIVE');
      expect(res.body.title).toBe('pemandangan.jpg');
      expect(res.body.ownerName).toBe('user-active');
      expect(res.body.fileCount).toBe(1);
      expect(res.body.hasCover).toBe(true);
      expect(res.body.hasPassword).toBe(false);

      // viewCount tidak boleh bertambah
      expect(app.db.shareLinks.get('sh-meta-active')?.viewCount).toBe(0);
    });

    it('link berpassword tidak membocorkan judul, sampul, atau nama pemilik', async () => {
      const token = 'token-meta-pwd';
      const hash = await passwords.hashPassword('rahasia');
      app.db.shareLinks.set('sh-meta-pwd', {
        id: 'sh-meta-pwd',
        token,
        ownerId: 'user-active',
        targetType: ShareTarget.file,
        targetId: 'f-pub-1',
        allowDownload: true,
        viewCount: 0,
        expiresAt: null,
        passwordHash: hash,
        revokedAt: null,
        createdAt: new Date(),
      });

      const res = await http().get(`/public/s/${token}/meta`).expect(200);

      expect(res.body.status).toBe('PASSWORD_PROTECTED');
      expect(res.body.hasPassword).toBe(true);
      expect(res.body.title).not.toBe('pemandangan.jpg');
      expect(res.body.hasCover).toBe(false);
      expect(res.body.fileCount).toBe(0);
      expect(app.db.shareLinks.get('sh-meta-pwd')?.viewCount).toBe(0);
    });
  });

  describe('RF-21: allowDownload nyata, toggle lokasi, & pembersihan GPS (B2, B3)', () => {
    const http = () => request(app.app.getHttpAdapter().getInstance().server);

    it('gambar inline selalu menyajikan preview, bukan file asli', async () => {
      const token = 'token-rf21-inline';
      app.db.shareLinks.set('sh-rf21-inline', {
        id: 'sh-rf21-inline',
        token,
        ownerId: 'user-active',
        targetType: ShareTarget.file,
        targetId: 'f-pub-1',
        allowDownload: false,
        showLocation: false,
        viewCount: 0,
        expiresAt: null,
        passwordHash: null,
        revokedAt: null,
        createdAt: new Date(),
      });

      // Permintaan inline (tanpa ?download=1)
      const res = await http().get(`/public/s/${token}/files/f-pub-1`).expect(200);

      // Memastikan yang dikembalikan adalah preview WebP, bukan byte asli (contentBuf)
      expect(res.header['content-type']).toBe('image/webp');
      expect(res.body).toEqual(Buffer.from('RIFFPREVIEWWEBP'));
      expect(res.body).not.toEqual(contentBuf);
    });

    it('show_location=false menyembunyikan place dan hasLocation dari daftar publik', async () => {
      // Setup file dengan GPS
      app.db.files.set('f-gps-1', {
        id: 'f-gps-1',
        ownerId: 'user-active',
        originalName: 'foto_gps.jpg',
        storageKey: 'f-gps-1.jpg',
        thumbKey: 'f-gps-1.thumb.webp',
        previewKey: 'f-gps-1.preview.webp',
        mimeType: 'image/jpeg',
        sizeBytes: 1000n,
        kind: FileKind.image,
        width: 1920,
        height: 1080,
        durationS: null,
        status: FileStatus.ready,
        takenAt: null,
        capturedAt: new Date(),
        gpsLat: -6.2,
        gpsLng: 106.81,
        placeCity: 'Jakarta Selatan',
        placeAdmin1: 'DKI Jakarta',
        placeCountry: 'Indonesia',
        createdAt: new Date(),
        deletedAt: null,
      });

      const tokenNoLoc = 'token-rf21-noloc';
      app.db.shareLinks.set('sh-rf21-noloc', {
        id: 'sh-rf21-noloc',
        token: tokenNoLoc,
        ownerId: 'user-active',
        targetType: ShareTarget.file,
        targetId: 'f-gps-1',
        allowDownload: true,
        showLocation: false,
        viewCount: 0,
        expiresAt: null,
        passwordHash: null,
        revokedAt: null,
        createdAt: new Date(),
      });

      const res = await http().get(`/public/s/${tokenNoLoc}`).expect(200);
      expect(res.body.showLocation).toBe(false);
      expect(res.body.files[0].hasLocation).toBe(false);
      expect(res.body.files[0].place).toBeNull();
      expect(res.body.files[0].gpsLat).toBeUndefined();
      expect(res.body.files[0].gpsLng).toBeUndefined();
    });

    it('show_location=false membersihkan segmen APP1 EXIF saat JPEG diunduh', async () => {
      const mediaDir = resolveMediaDir();
      const soi = Buffer.from([0xff, 0xd8]);
      const app1 = Buffer.from([0xff, 0xe1, 0x00, 0x06, 0x45, 0x78, 0x69, 0x66]); // "Exif"
      const sos = Buffer.from([0xff, 0xda, 0x00, 0x02, 0xaa, 0xbb, 0xff, 0xd9]);
      const jpegWithGps = Buffer.concat([soi, app1, sos]);

      writeFileSync(join(mediaDir, 'f-gps-strip.jpg'), jpegWithGps);

      app.db.files.set('f-gps-strip', {
        id: 'f-gps-strip',
        ownerId: 'user-active',
        originalName: 'foto_pantai.jpg',
        storageKey: 'f-gps-strip.jpg',
        thumbKey: 'f-gps-strip.thumb.webp',
        previewKey: 'f-gps-strip.preview.webp',
        mimeType: 'image/jpeg',
        sizeBytes: BigInt(jpegWithGps.length),
        kind: FileKind.image,
        width: 1920,
        height: 1080,
        durationS: null,
        status: FileStatus.ready,
        takenAt: null,
        capturedAt: new Date(),
        gpsLat: -8.7,
        gpsLng: 115.17,
        placeCity: 'Badung',
        placeAdmin1: 'Bali',
        placeCountry: 'Indonesia',
        createdAt: new Date(),
        deletedAt: null,
      });

      const tokenStrip = 'token-rf21-strip';
      app.db.shareLinks.set('sh-rf21-strip', {
        id: 'sh-rf21-strip',
        token: tokenStrip,
        ownerId: 'user-active',
        targetType: ShareTarget.file,
        targetId: 'f-gps-strip',
        allowDownload: true,
        showLocation: false,
        viewCount: 0,
        expiresAt: null,
        passwordHash: null,
        revokedAt: null,
        createdAt: new Date(),
      });

      const res = await http()
        .get(`/public/s/${tokenStrip}/files/f-gps-strip?download=1`)
        .expect(200);

      // Byte hasil unduhan tidak boleh memuat marker APP1 (0xFF 0xE1)
      expect(res.body.includes(Buffer.from([0xff, 0xe1]))).toBe(false);
      expect(res.body.length).toBe(jpegWithGps.length - app1.length);
    });
  });
});


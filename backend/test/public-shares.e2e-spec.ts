import request from 'supertest';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { FileKind, FileStatus, ShareTarget } from '../src/generated/prisma/client';
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
});


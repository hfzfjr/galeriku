import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { PasswordService } from '../src/auth/services/password.service';
import { FileKind, FileStatus, ShareTarget } from '../src/generated/prisma/client';
import { createTestApp, type FakeDb, type TestApp } from './test-app';
import { expectOwnerOnly } from './ownership';

process.env.FRONTEND_ORIGIN ??= 'https://galeriku.hafizfajar.com';
const ORIGIN = process.env.FRONTEND_ORIGIN as string;
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
    email: `user-${hitungId}@contoh.id`,
    name: `User ${hitungId}`,
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

function craftSession(db: FakeDb, userId: string): string {
  const token = `token-${db.sessions.size + 1}-${Date.now()}`;
  const id = createHash('sha256').update(token, 'utf8').digest('hex');
  db.sessions.set(id, {
    id,
    userId,
    expiresAt: new Date(Date.now() + 30 * 86400_000),
    createdAt: new Date(),
    ipHash: 'uji',
    userAgent: 'test-agent',
  });
  return token;
}

function createSyntheticMp4(length = 64): Buffer {
  const buf = Buffer.alloc(length, 0);
  buf.writeUInt32BE(length, 0);
  buf.write('ftyp', 4, 'ascii');
  buf.write('isom', 8, 'ascii');
  return buf;
}

describe('Motion Photo Android (RF-31)', () => {
  let app: TestApp;
  let userA: Record<string, unknown>;
  let userB: Record<string, unknown>;
  let cookieA: string;
  let cookieB: string;
  let testMediaDir: string;
  const prevMediaDir = process.env.MEDIA_DIR;

  beforeAll(async () => {
    testMediaDir = mkdtempSync(join(tmpdir(), 'galeriku-media-motion-'));
    process.env.MEDIA_DIR = testMediaDir;
    app = await createTestApp();
    userA = await seedUser(app.db);
    userB = await seedUser(app.db);
    cookieA = craftSession(app.db, userA.id as string);
    cookieB = craftSession(app.db, userB.id as string);
  });

  afterAll(async () => {
    await app.app.close();
    rmSync(testMediaDir, { recursive: true, force: true });
    if (prevMediaDir !== undefined) {
      process.env.MEDIA_DIR = prevMediaDir;
    } else {
      delete process.env.MEDIA_DIR;
    }
  });

  const http = () => request(app.app.getHttpAdapter().getInstance().server);

  it('streaming potongan byte motion video dengan Range (206) dan tanpa Range (200)', async () => {
    const fileId = 'file-motion-1';
    const storageKey = 'storage-motion-1.jpg';
    const filePath = join(testMediaDir, storageKey);

    const jpegHead = Buffer.alloc(1000, 0xee);
    const mp4Tail = createSyntheticMp4(128);
    // Isi data unik di mp4Tail untuk verifikasi potongan byte
    for (let i = 12; i < 128; i++) {
      mp4Tail[i] = i;
    }
    const fullBuffer = Buffer.concat([jpegHead, mp4Tail]);
    writeFileSync(filePath, fullBuffer);

    const liveOffset = BigInt(jpegHead.length);
    const liveLength = BigInt(mp4Tail.length);

    app.db.files.set(fileId, {
      id: fileId,
      ownerId: userA.id,
      originalName: 'kucing.jpg',
      storageKey,
      mimeType: 'image/jpeg',
      sizeBytes: BigInt(fullBuffer.length),
      kind: FileKind.image,
      width: 1920,
      height: 1080,
      durationS: null,
      thumbKey: null,
      previewKey: null,
      status: FileStatus.ready,
      liveKind: 'motion',
      liveOffset,
      liveLength,
      isFavorite: false,
      capturedAt: new Date(),
      createdAt: new Date(),
      deletedAt: null,
    });

    // 1. Full stream (200)
    const fullRes = await http()
      .get(`/files/${fileId}/motion`)
      .set('Cookie', `galeriku_session=${cookieA}`)
      .set('Origin', ORIGIN)
      .expect(200);

    expect(fullRes.headers['content-type']).toBe('video/mp4');
    expect(fullRes.headers['content-length']).toBe(String(mp4Tail.length));
    expect(fullRes.body).toEqual(mp4Tail);

    // 2. Range request parsial (206)
    const rangeRes = await http()
      .get(`/files/${fileId}/motion`)
      .set('Cookie', `galeriku_session=${cookieA}`)
      .set('Origin', ORIGIN)
      .set('Range', 'bytes=0-15')
      .expect(206);

    expect(rangeRes.headers['content-type']).toBe('video/mp4');
    expect(rangeRes.headers['content-range']).toBe(`bytes 0-15/${mp4Tail.length}`);
    expect(rangeRes.headers['content-length']).toBe('16');
    expect(rangeRes.body).toEqual(mp4Tail.subarray(0, 16));

    // 3. Range di luar batas (416)
    await http()
      .get(`/files/${fileId}/motion`)
      .set('Cookie', `galeriku_session=${cookieA}`)
      .set('Origin', ORIGIN)
      .set('Range', 'bytes=999-1000')
      .expect(416);
  });

  it('menegakkan kepemilikan pola A-vs-B (404 identik) via helper ownership', async () => {
    let counter = 0;
    await expectOwnerOnly(app.app, {
      cookieA,
      cookieB,
      origin: ORIGIN,
      createResource: async () => {
        counter += 1;
        const fileId = `file-motion-owner-${counter}`;
        const storageKey = `storage-${fileId}.jpg`;
        const filePath = join(testMediaDir, storageKey);
        const jpegHead = Buffer.alloc(100, 0x11);
        const mp4Tail = createSyntheticMp4(64);
        writeFileSync(filePath, Buffer.concat([jpegHead, mp4Tail]));

        app.db.files.set(fileId, {
          id: fileId,
          ownerId: userA.id,
          originalName: 'owner-test.jpg',
          storageKey,
          mimeType: 'image/jpeg',
          sizeBytes: BigInt(164),
          kind: FileKind.image,
          width: 800,
          height: 600,
          status: FileStatus.ready,
          liveKind: 'motion',
          liveOffset: 100n,
          liveLength: 64n,
          createdAt: new Date(),
          deletedAt: null,
        });

        return fileId;
      },
      buildRequests: (id: string) => [
        {
          method: 'get',
          url: `/files/${id}/motion`,
        },
      ],
    });
  });

  it('melayani motion video pada link publik (/public/s/:token/files/:fileId/motion)', async () => {
    const fileId = 'file-public-motion-1';
    const storageKey = 'storage-pub-motion.jpg';
    const filePath = join(testMediaDir, storageKey);
    const jpegHead = Buffer.alloc(500, 0x22);
    const mp4Tail = createSyntheticMp4(64);
    writeFileSync(filePath, Buffer.concat([jpegHead, mp4Tail]));

    app.db.files.set(fileId, {
      id: fileId,
      ownerId: userA.id,
      originalName: 'pantai.jpg',
      storageKey,
      mimeType: 'image/jpeg',
      sizeBytes: BigInt(564),
      kind: FileKind.image,
      width: 1920,
      height: 1080,
      status: FileStatus.ready,
      liveKind: 'motion',
      liveOffset: 500n,
      liveLength: 64n,
      createdAt: new Date(),
      deletedAt: null,
    });

    const token = 'token-share-motion-xyz';
    app.db.shareLinks.set('share-motion-1', {
      id: 'share-motion-1',
      token,
      ownerId: userA.id,
      targetType: ShareTarget.file,
      targetId: fileId,
      allowDownload: true,
      showLocation: false,
      passwordHash: null,
      expiresAt: null,
      revokedAt: null,
      createdAt: new Date(),
    });

    const pubRes = await http()
      .get(`/public/s/${token}/files/${fileId}/motion`)
      .set('Range', 'bytes=0-31')
      .expect(206);

    expect(pubRes.headers['content-type']).toBe('video/mp4');
    expect(pubRes.headers['content-range']).toBe('bytes 0-31/64');
    expect(pubRes.body).toEqual(mp4Tail.subarray(0, 32));

    // File tanpa motion photo mengembalikan 404
    const normalFileId = 'file-normal-no-motion';
    app.db.files.set(normalFileId, {
      id: normalFileId,
      ownerId: userA.id,
      originalName: 'normal.jpg',
      storageKey: 'normal.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 100n,
      kind: FileKind.image,
      status: FileStatus.ready,
      liveKind: 'none',
      createdAt: new Date(),
      deletedAt: null,
    });

    await http()
      .get(`/public/s/${token}/files/${normalFileId}/motion`)
      .expect(404);
  });
});

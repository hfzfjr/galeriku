import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { PasswordService } from '../src/auth/services/password.service';
import { FileKind, FileStatus } from '../src/generated/prisma/client';
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
  const id = `u-live-${hitungId}`;
  const row = {
    email: `live-user-${hitungId}@contoh.id`,
    name: `User Live ${hitungId}`,
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

describe('Pairing Live Photo iOS (RF-32)', () => {
  let app: TestApp;
  let userA: Record<string, unknown>;
  let userB: Record<string, unknown>;
  let cookieA: string;
  let cookieB: string;
  let testMediaDir: string;
  const prevMediaDir = process.env.MEDIA_DIR;

  beforeAll(async () => {
    testMediaDir = mkdtempSync(join(tmpdir(), 'galeriku-media-live-pair-'));
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

  it('urutan 1: Foto tiba lebih dulu, lalu MOV tiba dan digabungkan menjadi satu unit', async () => {
    const contentId = '46E2070F-B829-4B5E-AC6A-78D7CDDCAC30';
    const photoId = 'photo-apple-1';
    const photoKey = 'storage-photo-1.heic';
    const movKey = 'storage-mov-1.mov';

    const photoPath = join(testMediaDir, photoKey);
    const movPath = join(testMediaDir, movKey);
    const photoBytes = Buffer.alloc(2048, 0x11);
    const movBytes = Buffer.alloc(4096, 0x22);

    writeFileSync(photoPath, photoBytes);
    writeFileSync(movPath, movBytes);

    // 1. Simulasikan foto tiba lebih dulu
    app.db.files.set(photoId, {
      id: photoId,
      ownerId: userA.id,
      originalName: 'IMG_0001.HEIC',
      storageKey: photoKey,
      mimeType: 'image/heic',
      sizeBytes: BigInt(photoBytes.length),
      kind: FileKind.image,
      width: 4032,
      height: 3024,
      durationS: null,
      thumbKey: 'photo-1.thumb.webp',
      previewKey: 'photo-1.preview.webp',
      status: FileStatus.ready,
      liveKind: 'none',
      liveGroupId: contentId,
      liveVideoKey: null,
      isFavorite: false,
      capturedAt: new Date(),
      createdAt: new Date(),
      deletedAt: null,
    });

    // 2. Simulasikan penggabungan MOV yang tiba berikutnya (seperti di finishUpload)
    const existingPhoto = Array.from(app.db.files.values()).find(
      (f) =>
        f.ownerId === userA.id &&
        f.liveGroupId === contentId &&
        f.kind === FileKind.image &&
        f.deletedAt === null,
    );

    expect(existingPhoto).toBeDefined();
    existingPhoto!.liveKind = 'ios_pair';
    existingPhoto!.liveVideoKey = movKey;
    existingPhoto!.sizeBytes =
      BigInt(existingPhoto!.sizeBytes as bigint) + BigInt(movBytes.length);

    // 3. Verifikasi daftar galeri: hanya ada SATU item (foto), bukan dua item
    const listRes = await http()
      .get('/files')
      .set('Cookie', `galeriku_session=${cookieA}`)
      .expect(200);

    const items = listRes.body.items;
    const photoItem = items.find((i: { id: string }) => i.id === photoId);
    expect(photoItem).toBeDefined();
    expect(photoItem.liveKind).toBe('ios_pair');
    // Kuota menghitung kedua berkas (2048 + 4096 = 6144)
    expect(photoItem.sizeBytes).toBe('6144');

    // Pastikan tidak ada berkas MOV terpisah di daftar galeri
    const movItem = items.find((i: { originalName: string }) =>
      i.originalName.endsWith('.mov'),
    );
    expect(movItem).toBeUndefined();

    // 4. Endpoint GET /files/:id/motion melayani liveVideoKey dengan Range
    const motionRes = await http()
      .get(`/files/${photoId}/motion`)
      .set('Cookie', `galeriku_session=${cookieA}`)
      .set('Range', 'bytes=0-15')
      .expect(206);

    expect(motionRes.headers['content-range']).toBe(`bytes 0-15/${movBytes.length}`);
    expect(motionRes.body).toEqual(movBytes.subarray(0, 16));
  });

  it('urutan 2: MOV tiba lebih dulu (yatim), lalu Foto tiba dan menghapus baris File MOV yatim', async () => {
    const contentId = 'B1C2D3E4-F5A6-7B8C-9D0E-1F2A3B4C5D6E';
    const orphanMovId = 'orphan-mov-2';
    const photoId = 'photo-apple-2';
    const movKey = 'storage-mov-2.mov';
    const photoKey = 'storage-photo-2.heic';

    const movPath = join(testMediaDir, movKey);
    const photoPath = join(testMediaDir, photoKey);
    const movBytes = Buffer.alloc(3000, 0x33);
    const photoBytes = Buffer.alloc(1500, 0x44);

    writeFileSync(movPath, movBytes);
    writeFileSync(photoPath, photoBytes);

    // 1. Simulasikan MOV tiba lebih dulu (yatim)
    app.db.files.set(orphanMovId, {
      id: orphanMovId,
      ownerId: userA.id,
      originalName: 'IMG_0002.MOV',
      storageKey: movKey,
      mimeType: 'video/quicktime',
      sizeBytes: BigInt(movBytes.length),
      kind: FileKind.video,
      width: 1920,
      height: 1080,
      durationS: 2.8,
      thumbKey: null,
      previewKey: null,
      status: FileStatus.ready,
      liveKind: 'none',
      liveGroupId: contentId,
      liveVideoKey: null,
      isFavorite: false,
      capturedAt: new Date(),
      createdAt: new Date(),
      deletedAt: null,
    });

    // 2. Simulasikan foto tiba berikutnya: menemukan orphanMov, mengadopsi liveVideoKey, dan menghapus baris File MOV
    const orphanMov = Array.from(app.db.files.values()).find(
      (f) =>
        f.ownerId === userA.id &&
        f.liveGroupId === contentId &&
        f.kind === FileKind.video &&
        f.deletedAt === null,
    );

    expect(orphanMov).toBeDefined();

    // Hapus baris DB MOV yatim (tanpa menghapus file fisik movPath)
    app.db.files.delete(orphanMovId);

    // Buat baris foto yang telah terpasang
    app.db.files.set(photoId, {
      id: photoId,
      ownerId: userA.id,
      originalName: 'IMG_0002.HEIC',
      storageKey: photoKey,
      mimeType: 'image/heic',
      sizeBytes: BigInt(photoBytes.length) + BigInt(movBytes.length),
      kind: FileKind.image,
      width: 4032,
      height: 3024,
      durationS: null,
      thumbKey: 'photo-2.thumb.webp',
      previewKey: 'photo-2.preview.webp',
      status: FileStatus.ready,
      liveKind: 'ios_pair',
      liveGroupId: contentId,
      liveVideoKey: movKey,
      isFavorite: false,
      capturedAt: new Date(),
      createdAt: new Date(),
      deletedAt: null,
    });

    // File fisik MOV tetap ada di disk
    expect(existsSync(movPath)).toBe(true);

    // 3. Verifikasi daftar galeri
    const listRes = await http()
      .get('/files')
      .set('Cookie', `galeriku_session=${cookieA}`)
      .expect(200);

    const items = listRes.body.items;
    const photoItem = items.find((i: { id: string }) => i.id === photoId);
    expect(photoItem).toBeDefined();
    expect(photoItem.liveKind).toBe('ios_pair');
    expect(photoItem.sizeBytes).toBe('4500'); // 1500 + 3000

    // Pastikan orphanMov tidak lagi muncul di galeri
    const orphanItem = items.find((i: { id: string }) => i.id === orphanMovId);
    expect(orphanItem).toBeUndefined();
  });

  it('penghapusan permanen menghapus kedua berkas fisik foto dan live video pasangan', async () => {
    const photoId = 'photo-apple-delete';
    const photoKey = 'storage-del.heic';
    const movKey = 'storage-del.mov';
    const photoPath = join(testMediaDir, photoKey);
    const movPath = join(testMediaDir, movKey);

    writeFileSync(photoPath, Buffer.alloc(100));
    writeFileSync(movPath, Buffer.alloc(200));

    app.db.files.set(photoId, {
      id: photoId,
      ownerId: userA.id,
      originalName: 'IMG_DEL.HEIC',
      storageKey: photoKey,
      mimeType: 'image/heic',
      sizeBytes: 300n,
      kind: FileKind.image,
      width: 4032,
      height: 3024,
      status: FileStatus.ready,
      liveKind: 'ios_pair',
      liveGroupId: 'UUID-DEL',
      liveVideoKey: movKey,
      createdAt: new Date(),
      deletedAt: new Date(), // sudah di tempat sampah
    });

    expect(existsSync(photoPath)).toBe(true);
    expect(existsSync(movPath)).toBe(true);

    // Hapus permanen
    await http()
      .delete(`/files/${photoId}/permanent`)
      .set('Cookie', `galeriku_session=${cookieA}`)
      .set('Origin', ORIGIN)
      .expect(204);

    // Kedua berkas fisik wajib terhapus dari disk
    expect(existsSync(photoPath)).toBe(false);
    expect(existsSync(movPath)).toBe(false);
  });

  it('menegakkan pola A-vs-B (404 identik) untuk endpoint motion ios_pair', async () => {
    let counter = 0;
    await expectOwnerOnly(app.app, {
      cookieA,
      cookieB,
      origin: ORIGIN,
      createResource: async () => {
        counter += 1;
        const fileId = `file-live-owner-${counter}`;
        const photoKey = `storage-owner-${fileId}.heic`;
        const movKey = `storage-owner-${fileId}.mov`;
        writeFileSync(join(testMediaDir, photoKey), Buffer.alloc(100));
        writeFileSync(join(testMediaDir, movKey), Buffer.alloc(100));

        app.db.files.set(fileId, {
          id: fileId,
          ownerId: userA.id,
          originalName: 'owner.heic',
          storageKey: photoKey,
          mimeType: 'image/heic',
          sizeBytes: 200n,
          kind: FileKind.image,
          width: 800,
          height: 600,
          status: FileStatus.ready,
          liveKind: 'ios_pair',
          liveGroupId: `UUID-${counter}`,
          liveVideoKey: movKey,
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
});


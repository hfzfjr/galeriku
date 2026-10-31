import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { PasswordService } from '../src/auth/services/password.service';
import { FileKind, FileStatus } from '../src/generated/prisma/client';
import {
  createTestApp,
  type FakeDb,
  type TestApp,
} from './test-app';
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

describe('FilesController (e2e) — US-20', () => {
  let app: TestApp['app'];
  let db: FakeDb;
  let mediaDir: string;

  beforeAll(() => {
    mediaDir = mkdtempSync(join(tmpdir(), 'galeriku-files-test-'));
    process.env.MEDIA_DIR = mediaDir;
  });

  afterAll(() => {
    if (mediaDir) {
      rmSync(mediaDir, { recursive: true, force: true });
    }
  });

  beforeEach(async () => {
    hitungId = 0;
    ({ app, db } = await createTestApp());
  });

  afterEach(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpAdapter().getInstance().server);

  describe('GET /files', () => {
    it('tanpa sesi -> 401 UNAUTHENTICATED', async () => {
      const res = await http().get('/files');
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('UNAUTHENTICATED');
    });

    it('sesi valid, belum ada file -> items kosong dan nextCursor null', async () => {
      const user = await seedUser(db);
      const token = craftSession(db, user.id as string);

      const res = await http()
        .get('/files')
        .set('Cookie', `galeriku_session=${token}`);

      expect(res.status).toBe(200);
      expect(res.body.items).toEqual([]);
      expect(res.body.nextCursor).toBeNull();
    });

    it('mengembalikan daftar file (urut terbaru, 24 per halaman, cursor-based pagination)', async () => {
      const user = await seedUser(db);
      const token = craftSession(db, user.id as string);

      // Buat 30 file dengan timestamp berbeda
      const baseTime = Date.now();
      for (let i = 1; i <= 30; i++) {
        const fileId = `file-${i.toString().padStart(2, '0')}`;
        db.files.set(fileId, {
          id: fileId,
          ownerId: user.id,
          originalName: `foto-${i}.jpg`,
          storageKey: `key-${i}`,
          mimeType: 'image/jpeg',
          sizeBytes: BigInt(i * 1024),
          kind: FileKind.image,
          width: 800,
          height: 600,
          durationS: null,
          thumbKey: `key-${i}.thumb.webp`,
          status: FileStatus.ready,
          takenAt: null,
          createdAt: new Date(baseTime + i * 1000),
          deletedAt: null,
        });
      }

      // Halaman 1: default limit 24
      const resPage1 = await http()
        .get('/files')
        .set('Cookie', `galeriku_session=${token}`);

      expect(resPage1.status).toBe(200);
      expect(resPage1.body.items).toHaveLength(24);
      // Urut terbaru (file 30 sampai file 7)
      expect(resPage1.body.items[0].id).toBe('file-30');
      expect(resPage1.body.items[0].sizeBytes).toBe('30720'); // BigInt diserialisasi string
      expect(resPage1.body.items[23].id).toBe('file-07');
      expect(resPage1.body.nextCursor).toBeTruthy();

      // Halaman 2: lanjut dari nextCursor
      const resPage2 = await http()
        .get(`/files?cursor=${resPage1.body.nextCursor}`)
        .set('Cookie', `galeriku_session=${token}`);

      expect(resPage2.status).toBe(200);
      expect(resPage2.body.items).toHaveLength(6);
      expect(resPage2.body.items[0].id).toBe('file-06');
      expect(resPage2.body.items[5].id).toBe('file-01');
      expect(resPage2.body.nextCursor).toBeNull();
    });

    it('mengabaikan file yang statusnya bukan ready atau sudah deletedAt', async () => {
      const user = await seedUser(db);
      const token = craftSession(db, user.id as string);

      db.files.set('file-deleted', {
        id: 'file-deleted',
        ownerId: user.id,
        originalName: 'terhapus.jpg',
        storageKey: 'key-del',
        mimeType: 'image/jpeg',
        sizeBytes: 1000n,
        kind: FileKind.image,
        width: null,
        height: null,
        durationS: null,
        thumbKey: null,
        status: FileStatus.ready,
        takenAt: null,
        createdAt: new Date(),
        deletedAt: new Date(),
      });

      db.files.set('file-failed', {
        id: 'file-failed',
        ownerId: user.id,
        originalName: 'gagal.jpg',
        storageKey: 'key-fail',
        mimeType: 'image/jpeg',
        sizeBytes: 1000n,
        kind: FileKind.image,
        width: null,
        height: null,
        durationS: null,
        thumbKey: null,
        status: FileStatus.failed,
        takenAt: null,
        createdAt: new Date(),
        deletedAt: null,
      });

      const res = await http()
        .get('/files')
        .set('Cookie', `galeriku_session=${token}`);

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(0);
    });

    it('tidak membocorkan file milik pengguna lain', async () => {
      const userA = await seedUser(db);
      const userB = await seedUser(db);
      const tokenB = craftSession(db, userB.id as string);

      db.files.set('file-milik-a', {
        id: 'file-milik-a',
        ownerId: userA.id,
        originalName: 'rahasia-a.jpg',
        storageKey: 'key-rahasia-a',
        mimeType: 'image/jpeg',
        sizeBytes: 1000n,
        kind: FileKind.image,
        width: null,
        height: null,
        durationS: null,
        thumbKey: 'key-rahasia-a.thumb.webp',
        status: FileStatus.ready,
        takenAt: null,
        createdAt: new Date(),
        deletedAt: null,
      });

      const res = await http()
        .get('/files')
        .set('Cookie', `galeriku_session=${tokenB}`);

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(0);
    });
  });

  describe('GET /files/:id/thumb', () => {
    it('tanpa sesi -> 401 UNAUTHENTICATED', async () => {
      const res = await http().get('/files/f-123/thumb');
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('UNAUTHENTICATED');
    });

    it('mengembalikan 200 image/webp dengan header cache untuk thumbnail milik sendiri', async () => {
      const user = await seedUser(db);
      const token = craftSession(db, user.id as string);

      const thumbFilename = 'sample.thumb.webp';
      const thumbContent = Buffer.from('RIFFmockwebpdata');
      writeFileSync(join(mediaDir, thumbFilename), thumbContent);

      db.files.set('file-valid', {
        id: 'file-valid',
        ownerId: user.id,
        originalName: 'foto.jpg',
        storageKey: 'key-valid',
        mimeType: 'image/jpeg',
        sizeBytes: 2000n,
        kind: FileKind.image,
        width: 800,
        height: 600,
        durationS: null,
        thumbKey: thumbFilename,
        status: FileStatus.ready,
        takenAt: null,
        createdAt: new Date(),
        deletedAt: null,
      });

      const res = await http()
        .get('/files/file-valid/thumb')
        .set('Cookie', `galeriku_session=${token}`);

      expect(res.status).toBe(200);
      expect(res.header['content-type']).toBe('image/webp');
      expect(res.header['cache-control']).toBe('private, max-age=86400');
      expect(res.header['x-content-type-options']).toBe('nosniff');
      expect(res.body).toEqual(thumbContent);
    });

    it('mengembalikan 404 jika file tidak memiliki thumbnail (misal video di v1)', async () => {
      const user = await seedUser(db);
      const token = craftSession(db, user.id as string);

      db.files.set('file-video', {
        id: 'file-video',
        ownerId: user.id,
        originalName: 'video.mp4',
        storageKey: 'key-video',
        mimeType: 'video/mp4',
        sizeBytes: 20000n,
        kind: FileKind.video,
        width: 1920,
        height: 1080,
        durationS: 12.0,
        thumbKey: null,
        status: FileStatus.ready,
        takenAt: null,
        createdAt: new Date(),
        deletedAt: null,
      });

      const res = await http()
        .get('/files/file-video/thumb')
        .set('Cookie', `galeriku_session=${token}`);

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('NOT_FOUND');
    });

    it('IDOR A-vs-B: User B mendapat 404 identik dengan id-tidak-ada saat mengakses file User A', async () => {
      const userA = await seedUser(db);
      const userB = await seedUser(db);
      const cookieA = craftSession(db, userA.id as string);
      const cookieB = craftSession(db, userB.id as string);

      let counter = 0;
      await expectOwnerOnly(app, {
        cookieA,
        cookieB,
        origin: ORIGIN,
        createResource: async () => {
          counter += 1;
          const fid = `resource-a-${counter}`;
          const thumbFile = `thumb-a-${counter}.webp`;
          writeFileSync(join(mediaDir, thumbFile), Buffer.from('mockwebp'));

          db.files.set(fid, {
            id: fid,
            ownerId: userA.id,
            originalName: `gambar-${counter}.jpg`,
            storageKey: `key-a-${counter}`,
            mimeType: 'image/jpeg',
            sizeBytes: 1024n,
            kind: FileKind.image,
            width: 400,
            height: 400,
            durationS: null,
            thumbKey: thumbFile,
            status: FileStatus.ready,
            takenAt: null,
            createdAt: new Date(),
            deletedAt: null,
          });

          return fid;
        },
        buildRequests: (id) => [
          { method: 'get', url: `/files/${id}/thumb` },
        ],
      });
    });
  });
});


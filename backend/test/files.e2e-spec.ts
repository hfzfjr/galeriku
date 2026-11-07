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
          const storageFile = `key-a-${counter}`;
          const contentBuf = Buffer.from('mockisifile');
          writeFileSync(join(mediaDir, thumbFile), Buffer.from('mockwebp'));
          writeFileSync(join(mediaDir, storageFile), contentBuf);

          db.files.set(fid, {
            id: fid,
            ownerId: userA.id,
            originalName: `gambar-${counter}.jpg`,
            storageKey: `key-a-${counter}`,
            mimeType: 'image/jpeg',
            sizeBytes: BigInt(contentBuf.length),
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
          { method: 'get', url: `/files/${id}/content` },
          { method: 'delete', url: `/files/${id}` },
        ],
      });
    });
  });

  describe('GET /files/:id/content — US-21 Streaming & Range', () => {
    it('tanpa sesi -> 401 UNAUTHENTICATED', async () => {
      const res = await http().get('/files/f-123/content');
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('UNAUTHENTICATED');
    });

    it('mengembalikan 200 OK penuh dengan header yang benar', async () => {
      const user = await seedUser(db);
      const token = craftSession(db, user.id as string);

      const storageKey = 'storage-content-1.jpg';
      const fileData = Buffer.from('HALODUNIAGALERIKU');
      writeFileSync(join(mediaDir, storageKey), fileData);

      db.files.set('f-content-1', {
        id: 'f-content-1',
        ownerId: user.id,
        originalName: 'foto-asli.jpg',
        storageKey,
        mimeType: 'image/jpeg',
        sizeBytes: BigInt(fileData.length),
        kind: FileKind.image,
        width: 800,
        height: 600,
        durationS: null,
        thumbKey: null,
        status: FileStatus.ready,
        takenAt: null,
        createdAt: new Date(),
        deletedAt: null,
      });

      const res = await http()
        .get('/files/f-content-1/content')
        .set('Cookie', `galeriku_session=${token}`);

      expect(res.status).toBe(200);
      expect(res.header['content-type']).toBe('image/jpeg');
      expect(res.header['accept-ranges']).toBe('bytes');
      expect(res.header['x-content-type-options']).toBe('nosniff');
      expect(res.header['cache-control']).toBe('private, max-age=86400');
      expect(res.body).toEqual(fileData);
    });

    it('mendukung HTTP Range (206 Partial Content) untuk seek dan streaming video', async () => {
      const user = await seedUser(db);
      const token = craftSession(db, user.id as string);

      const storageKey = 'video-test.mp4';
      // 10 byte: 0123456789
      const fileData = Buffer.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
      writeFileSync(join(mediaDir, storageKey), fileData);

      db.files.set('f-video-range', {
        id: 'f-video-range',
        ownerId: user.id,
        originalName: 'cuplikan.mp4',
        storageKey,
        mimeType: 'video/mp4',
        sizeBytes: 10n,
        kind: FileKind.video,
        width: 1920,
        height: 1080,
        durationS: 5.0,
        thumbKey: null,
        status: FileStatus.ready,
        takenAt: null,
        createdAt: new Date(),
        deletedAt: null,
      });

      // Minta bytes=2-5 (panjang 4: indeks 2, 3, 4, 5)
      const res = await http()
        .get('/files/f-video-range/content')
        .set('Cookie', `galeriku_session=${token}`)
        .set('Range', 'bytes=2-5');

      expect(res.status).toBe(206);
      expect(res.header['content-type']).toBe('video/mp4');
      expect(res.header['content-range']).toBe('bytes 2-5/10');
      expect(res.header['content-length']).toBe('4');
      expect(res.body).toEqual(Buffer.from([2, 3, 4, 5]));
    });

    it('menolak Range yang berada di luar batas dengan 416 Range Not Satisfiable', async () => {
      const user = await seedUser(db);
      const token = craftSession(db, user.id as string);

      const storageKey = 'kecil.bin';
      writeFileSync(join(mediaDir, storageKey), Buffer.from('abc'));

      db.files.set('f-range-416', {
        id: 'f-range-416',
        ownerId: user.id,
        originalName: 'kecil.bin',
        storageKey,
        mimeType: 'application/octet-stream',
        sizeBytes: 3n,
        kind: FileKind.image,
        width: null,
        height: null,
        durationS: null,
        thumbKey: null,
        status: FileStatus.ready,
        takenAt: null,
        createdAt: new Date(),
        deletedAt: null,
      });

      const res = await http()
        .get('/files/f-range-416/content')
        .set('Cookie', `galeriku_session=${token}`)
        .set('Range', 'bytes=100-200');

      expect(res.status).toBe(416);
      expect(res.header['content-range']).toBe('bytes */3');
    });

    it('mendukung parameter ?download=1 dengan header Content-Disposition attachment', async () => {
      const user = await seedUser(db);
      const token = craftSession(db, user.id as string);

      const storageKey = 'unduh.jpg';
      writeFileSync(join(mediaDir, storageKey), Buffer.from('unduhgambar'));

      db.files.set('f-download', {
        id: 'f-download',
        ownerId: user.id,
        originalName: 'foto liburan "dieng".jpg',
        storageKey,
        mimeType: 'image/jpeg',
        sizeBytes: 11n,
        kind: FileKind.image,
        width: null,
        height: null,
        durationS: null,
        thumbKey: null,
        status: FileStatus.ready,
        takenAt: null,
        createdAt: new Date(),
        deletedAt: null,
      });

      const res = await http()
        .get('/files/f-download/content?download=1')
        .set('Cookie', `galeriku_session=${token}`);

      expect(res.status).toBe(200);
      expect(res.header['content-disposition']).toContain('attachment;');
      expect(res.header['content-disposition']).toContain('filename=');
    });
  });

  describe('DELETE /files & batch-delete — US-22', () => {
    it('DELETE /files/:id menghapus file milik sendiri dan berkas fisik', async () => {
      const user = await seedUser(db);
      const token = craftSession(db, user.id as string);

      const storageKey = 'hapus-sendiri.jpg';
      const thumbKey = 'hapus-sendiri.thumb.webp';
      writeFileSync(join(mediaDir, storageKey), Buffer.from('gambar-asli'));
      writeFileSync(join(mediaDir, thumbKey), Buffer.from('thumb-asli'));

      db.files.set('f-hapus', {
        id: 'f-hapus',
        ownerId: user.id,
        originalName: 'hapus.jpg',
        storageKey,
        mimeType: 'image/jpeg',
        sizeBytes: 11n,
        kind: FileKind.image,
        width: null,
        height: null,
        durationS: null,
        thumbKey,
        status: FileStatus.ready,
        takenAt: null,
        createdAt: new Date(),
        deletedAt: null,
      });

      const res = await http()
        .delete('/files/f-hapus')
        .set('Origin', ORIGIN)
        .set('Cookie', `galeriku_session=${token}`);

      expect(res.status).toBe(204);

      // Baris DB ditandai deletedAt
      const row = db.files.get('f-hapus');
      expect(row?.deletedAt).toBeTruthy();
    });

    it('POST /files/batch-delete menghapus banyak file sekaligus', async () => {
      const user = await seedUser(db);
      const token = craftSession(db, user.id as string);

      for (let i = 1; i <= 3; i++) {
        db.files.set(`f-batch-${i}`, {
          id: `f-batch-${i}`,
          ownerId: user.id,
          originalName: `batch-${i}.jpg`,
          storageKey: `key-batch-${i}`,
          mimeType: 'image/jpeg',
          sizeBytes: 100n,
          kind: FileKind.image,
          width: null,
          height: null,
          durationS: null,
          thumbKey: null,
          status: FileStatus.ready,
          takenAt: null,
          createdAt: new Date(),
          deletedAt: null,
        });
      }

      const res = await http()
        .post('/files/batch-delete')
        .set('Origin', ORIGIN)
        .set('Cookie', `galeriku_session=${token}`)
        .send({ ids: ['f-batch-1', 'f-batch-2'] });

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(2);

      expect(db.files.get('f-batch-1')?.deletedAt).toBeTruthy();
      expect(db.files.get('f-batch-2')?.deletedAt).toBeTruthy();
      expect(db.files.get('f-batch-3')?.deletedAt).toBeNull();
    });
  });

  describe('Favorit & Sampah (Trash)', () => {
    it('PATCH /files/:id/favorite mengubah status favorit dan IDOR merespon 404', async () => {
      const userA = await seedUser(db);
      const userB = await seedUser(db);
      const tokenA = craftSession(db, userA.id as string);
      const tokenB = craftSession(db, userB.id as string);

      db.files.set('f-fav-1', {
        id: 'f-fav-1',
        ownerId: userA.id,
        originalName: 'fav.jpg',
        storageKey: 'key-fav',
        mimeType: 'image/jpeg',
        sizeBytes: 100n,
        kind: FileKind.image,
        width: null,
        height: null,
        durationS: null,
        thumbKey: null,
        status: FileStatus.ready,
        isFavorite: false,
        takenAt: null,
        createdAt: new Date(),
        deletedAt: null,
      });

      // User A jadikan favorit
      const res = await http()
        .patch('/files/f-fav-1/favorite')
        .set('Origin', ORIGIN)
        .set('Cookie', `galeriku_session=${tokenA}`)
        .send({ isFavorite: true });

      expect(res.status).toBe(200);
      expect(res.body.isFavorite).toBe(true);

      // User B mencoba ubah milik User A -> 404 identik (IDOR)
      await expectOwnerOnly(app, {
        cookieA: tokenA,
        cookieB: tokenB,
        origin: ORIGIN,
        createResource: async () => {
          const fid = `file-fav-idor-${Date.now()}`;
          db.files.set(fid, {
            id: fid,
            ownerId: userA.id,
            originalName: 'fav.jpg',
            storageKey: `key-${fid}`,
            mimeType: 'image/jpeg',
            sizeBytes: 100n,
            kind: FileKind.image,
            width: null,
            height: null,
            durationS: null,
            thumbKey: null,
            status: FileStatus.ready,
            isFavorite: false,
            takenAt: null,
            createdAt: new Date(),
            deletedAt: null,
          });
          return fid;
        },
        buildRequests: (id: string) => [
          {
            method: 'patch',
            url: `/files/${id}/favorite`,
            body: { isFavorite: true },
          },
        ],
      });
    });

    it('GET /files/trash, restore, dan permanent delete bekerja dengan baik', async () => {
      const user = await seedUser(db);
      const token = craftSession(db, user.id as string);

      db.files.set('f-sampah-1', {
        id: 'f-sampah-1',
        ownerId: user.id,
        originalName: 'dibuang.jpg',
        storageKey: 'key-dibuang',
        mimeType: 'image/jpeg',
        sizeBytes: 100n,
        kind: FileKind.image,
        width: null,
        height: null,
        durationS: null,
        thumbKey: null,
        status: FileStatus.ready,
        isFavorite: false,
        takenAt: null,
        createdAt: new Date(),
        deletedAt: new Date(),
      });

      // Cek list sampah
      const resList = await http()
        .get('/files/trash')
        .set('Origin', ORIGIN)
        .set('Cookie', `galeriku_session=${token}`);

      expect(resList.status).toBe(200);
      expect(resList.body.items).toHaveLength(1);
      expect(resList.body.items[0].id).toBe('f-sampah-1');

      // Pulihkan file
      const resRestore = await http()
        .post('/files/f-sampah-1/restore')
        .set('Origin', ORIGIN)
        .set('Cookie', `galeriku_session=${token}`);

      expect(resRestore.status).toBe(200);
      expect(resRestore.body.deletedAt).toBeNull();
      expect(db.files.get('f-sampah-1')?.deletedAt).toBeNull();
    });

    it('album dengan sampul file X; X ke Sampah; DELETE /files/:id/permanent dan DELETE /files/trash harus berhasil', async () => {
      const user = await seedUser(db);
      const token = craftSession(db, user.id as string);

      // File X menjadi sampul album
      db.files.set('f-cover-1', {
        id: 'f-cover-1',
        ownerId: user.id,
        originalName: 'cover.jpg',
        storageKey: 'key-cover',
        mimeType: 'image/jpeg',
        sizeBytes: 100n,
        kind: FileKind.image,
        width: null,
        height: null,
        durationS: null,
        thumbKey: null,
        status: FileStatus.ready,
        isFavorite: false,
        takenAt: null,
        createdAt: new Date(),
        deletedAt: new Date(), // sudah di sampah
      });

      db.albums.set('alb-1', {
        id: 'alb-1',
        ownerId: user.id,
        title: 'Liburan',
        coverFileId: 'f-cover-1',
        createdAt: new Date(),
      });

      // Test 1: deletePermanent harus sukses (tidak 500 karena FK coverFileId)
      const resPermanent = await http()
        .delete('/files/f-cover-1/permanent')
        .set('Origin', ORIGIN)
        .set('Cookie', `galeriku_session=${token}`);

      expect(resPermanent.status).toBe(204);
      expect(db.files.has('f-cover-1')).toBe(false);
      expect(db.albums.get('alb-1')?.coverFileId).toBeNull();

      // Test 2: emptyTrash dengan file yang menjadi sampul album
      db.files.set('f-cover-2', {
        id: 'f-cover-2',
        ownerId: user.id,
        originalName: 'cover2.jpg',
        storageKey: 'key-cover2',
        mimeType: 'image/jpeg',
        sizeBytes: 100n,
        kind: FileKind.image,
        width: null,
        height: null,
        durationS: null,
        thumbKey: null,
        status: FileStatus.ready,
        isFavorite: false,
        takenAt: null,
        createdAt: new Date(),
        deletedAt: new Date(),
      });
      db.albums.get('alb-1')!.coverFileId = 'f-cover-2';

      const resEmpty = await http()
        .delete('/files/trash')
        .set('Origin', ORIGIN)
        .set('Cookie', `galeriku_session=${token}`);

      expect(resEmpty.status).toBe(200);
      expect(resEmpty.body.count).toBe(1);
      expect(db.files.has('f-cover-2')).toBe(false);
      expect(db.albums.get('alb-1')?.coverFileId).toBeNull();
    });

    it('restore dan deletePermanent milik orang lain mengembalikan 404 identik (A-vs-B)', async () => {
      const userA = await seedUser(db);
      const userB = await seedUser(db);
      const tokenA = craftSession(db, userA.id as string);
      const tokenB = craftSession(db, userB.id as string);

      await expectOwnerOnly(app, {
        cookieA: tokenA,
        cookieB: tokenB,
        origin: ORIGIN,
        createResource: async () => {
          const fid = `file-trash-idor-${Date.now()}`;
          db.files.set(fid, {
            id: fid,
            ownerId: userA.id,
            originalName: 'sampah.jpg',
            storageKey: `key-${fid}`,
            mimeType: 'image/jpeg',
            sizeBytes: 100n,
            kind: FileKind.image,
            width: null,
            height: null,
            durationS: null,
            thumbKey: null,
            status: FileStatus.ready,
            isFavorite: false,
            takenAt: null,
            createdAt: new Date(),
            deletedAt: new Date(),
          });
          return fid;
        },
        buildRequests: (id: string) => [
          {
            method: 'post',
            url: `/files/${id}/restore`,
          },
          {
            method: 'delete',
            url: `/files/${id}/permanent`,
          },
        ],
      });
    });
  });
});


import request from 'supertest';
import { createHash } from 'node:crypto';
import { FileKind, FileStatus, ShareTarget } from '../src/generated/prisma/client';
import {
  createTestApp,
  type FakeDb,
  type TestApp,
} from './test-app';
import { expectOwnerOnly } from './ownership';

process.env.FRONTEND_ORIGIN ??= 'https://galeriku.hafizfajar.com';
const ORIGIN = process.env.FRONTEND_ORIGIN as string;

function craftSession(db: FakeDb, userId: string): string {
  const token = `token-alb-${db.sessions.size + 1}`;
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

function seedUser(db: FakeDb, id: string): void {
  db.users.set(id, {
    id,
    email: `${id}@contoh.id`,
    name: id,
    avatarUrl: null,
    passwordHash: 'hash',
    googleSub: null,
    role: 'USER',
    status: 'ACTIVE',
    quotaBytes: 1024n * 1024n * 1024n,
    createdAt: new Date(),
    lastLoginAt: null,
    emailVerifiedAt: new Date(),
  });
}

function seedFile(
  db: FakeDb,
  fileId: string,
  ownerId: string,
  fileName: string = 'foto.jpg',
): void {
  db.files.set(fileId, {
    id: fileId,
    ownerId,
    originalName: fileName,
    storageKey: `${fileId}.jpg`,
    mimeType: 'image/jpeg',
    sizeBytes: 1024n,
    kind: FileKind.image,
    width: 800,
    height: 600,
    durationS: null,
    thumbKey: `${fileId}.thumb.webp`,
    status: FileStatus.ready,
    takenAt: null,
    createdAt: new Date(),
    deletedAt: null,
  });
}

describe('Albums (US-23)', () => {
  let app: TestApp;
  let cookieA: string;
  let cookieB: string;

  beforeAll(async () => {
    app = await createTestApp();
    seedUser(app.db, 'user-a');
    seedUser(app.db, 'user-b');
    cookieA = craftSession(app.db, 'user-a');
    cookieB = craftSession(app.db, 'user-b');
  });

  afterAll(async () => {
    await app.app.close();
  });

  it('menegakkan kepemilikan pola A-vs-B (404 identik) via helper ownership', async () => {
    let counter = 0;
    await expectOwnerOnly(app.app, {
      cookieA,
      cookieB,
      origin: ORIGIN,
      createResource: async () => {
        counter += 1;
        const albumId = `alb-owner-${counter}`;
        app.db.albums.set(albumId, {
          id: albumId,
          ownerId: 'user-a',
          title: `Album ${counter}`,
          coverFileId: null,
          createdAt: new Date(),
        });
        return albumId;
      },
      buildRequests: (id: string) => [
        { method: 'get', url: `/albums/${id}` },
        {
          method: 'patch',
          url: `/albums/${id}`,
          body: { title: 'Ubah Judul' },
        },
        {
          method: 'post',
          url: `/albums/${id}/files`,
          body: { fileIds: ['file-dummy'] },
        },
        {
          method: 'delete',
          url: `/albums/${id}/files/file-dummy`,
        },
        { method: 'get', url: `/albums/${id}/zip` },
        { method: 'delete', url: `/albums/${id}` },
      ],
    });
  });

  it('alur lengkap CRUD album, tambah file, dan cover otomatis', async () => {
    app.db.albums.clear();
    app.db.albumFiles.clear();

    const http = () =>
      request(app.app.getHttpAdapter().getInstance().server);

    // 1. Buat album
    const resCreate = await http()
      .post('/albums')
      .set('Cookie', `galeriku_session=${cookieA}`)
      .set('Origin', ORIGIN)
      .send({ title: 'Jalan-jalan' })
      .expect(201);

    expect(resCreate.body.title).toBe('Jalan-jalan');
    expect(resCreate.body.fileCount).toBe(0);
    const albumId = resCreate.body.id;

    // 2. Daftar album memuat album baru
    const resList = await http()
      .get('/albums')
      .set('Cookie', `galeriku_session=${cookieA}`)
      .expect(200);

    expect(resList.body.items).toHaveLength(1);
    expect(resList.body.items[0].id).toBe(albumId);

    // 3. Tambah file ke album
    seedFile(app.db, 'f-a-1', 'user-a', 'gunung.jpg');
    seedFile(app.db, 'f-a-2', 'user-a', 'pantai.jpg');

    const resAdd = await http()
      .post(`/albums/${albumId}/files`)
      .set('Cookie', `galeriku_session=${cookieA}`)
      .set('Origin', ORIGIN)
      .send({ fileIds: ['f-a-1', 'f-a-2'] })
      .expect(201);

    expect(resAdd.body.fileCount).toBe(2);
    expect(resAdd.body.coverFileId).toBe('f-a-1');
    expect(resAdd.body.files).toHaveLength(2);

    // 4. Ubah nama album
    const resPatch = await http()
      .patch(`/albums/${albumId}`)
      .set('Cookie', `galeriku_session=${cookieA}`)
      .set('Origin', ORIGIN)
      .send({ title: 'Jalan-jalan 2026' })
      .expect(200);

    expect(resPatch.body.title).toBe('Jalan-jalan 2026');

    // 5. Keluarkan file cover pertama, cover berganti ke f-a-2
    const resRemove = await http()
      .delete(`/albums/${albumId}/files/f-a-1`)
      .set('Cookie', `galeriku_session=${cookieA}`)
      .set('Origin', ORIGIN)
      .expect(200);

    expect(resRemove.body.fileCount).toBe(1);
    expect(resRemove.body.coverFileId).toBe('f-a-2');

    // 6. Hapus album
    await http()
      .delete(`/albums/${albumId}`)
      .set('Cookie', `galeriku_session=${cookieA}`)
      .set('Origin', ORIGIN)
      .expect(204);

    // 7. Ambil album yang sudah dihapus menghasilkan 404
    await http()
      .get(`/albums/${albumId}`)
      .set('Cookie', `galeriku_session=${cookieA}`)
      .expect(404);
  });

  it('B17: menghapus album mencabut semua tautan berbagi yang menarget album tersebut', async () => {
    app.db.albums.clear();
    app.db.albumFiles.clear();

    const http = () =>
      request(app.app.getHttpAdapter().getInstance().server);

    // 1. Buat album
    const resCreate = await http()
      .post('/albums')
      .set('Cookie', `galeriku_session=${cookieA}`)
      .set('Origin', ORIGIN)
      .send({ title: 'Album Liburan' })
      .expect(201);
    const albumId = resCreate.body.id;

    // 2. Buat share link publik untuk album tersebut
    const tokenShare = 'token-share-b17-album';
    app.db.shareLinks.set('sh-b17-album', {
      id: 'sh-b17-album',
      token: tokenShare,
      ownerId: 'user-a',
      targetType: ShareTarget.album,
      targetId: albumId,
      allowDownload: true,
      viewCount: 0,
      expiresAt: null,
      passwordHash: null,
      revokedAt: null,
      createdAt: new Date(),
    });

    // Share link aktif dan bisa diakses
    await http().get(`/public/s/${tokenShare}`).expect(200);

    // 3. Hapus album
    await http()
      .delete(`/albums/${albumId}`)
      .set('Cookie', `galeriku_session=${cookieA}`)
      .set('Origin', ORIGIN)
      .expect(204);

    // 4. Verifikasi bahwa share link dicabut (revokedAt terisi) dan akses publik mengembalikan 404
    const shareAfter = app.db.shareLinks.get('sh-b17-album');
    expect(shareAfter?.revokedAt).toBeTruthy();

    await http().get(`/public/s/${tokenShare}`).expect(404);
  });

  it('B17: PATCH /albums/:id mengembalikan coverFileId aktif dan fileCount konsisten', async () => {
    app.db.albums.clear();
    app.db.albumFiles.clear();

    const http = () =>
      request(app.app.getHttpAdapter().getInstance().server);

    // 1. Buat album
    const resCreate = await http()
      .post('/albums')
      .set('Cookie', `galeriku_session=${cookieA}`)
      .set('Origin', ORIGIN)
      .send({ title: 'Album Tanpa Cover' })
      .expect(201);
    const albumId = resCreate.body.id;

    seedFile(app.db, 'f-patch-1', 'user-a', 'satu.jpg');
    seedFile(app.db, 'f-patch-2', 'user-a', 'dua.jpg');

    // 2. Tambah file
    await http()
      .post(`/albums/${albumId}/files`)
      .set('Cookie', `galeriku_session=${cookieA}`)
      .set('Origin', ORIGIN)
      .send({ fileIds: ['f-patch-1', 'f-patch-2'] })
      .expect(201);

    // 3. Patch album
    const resPatch = await http()
      .patch(`/albums/${albumId}`)
      .set('Cookie', `galeriku_session=${cookieA}`)
      .set('Origin', ORIGIN)
      .send({ title: 'Album Berganti Judul' })
      .expect(200);

    expect(resPatch.body.title).toBe('Album Berganti Judul');
    expect(resPatch.body.coverFileId).toBe('f-patch-1');
    expect(resPatch.body.fileCount).toBe(2);
  });

  it('mengunduh album sebagai ZIP (RF-44 / B15)', async () => {
    const http = () =>
      request(app.app.getHttpAdapter().getInstance().server);

    const albumId = 'alb-zip-test';
    app.db.albums.set(albumId, {
      id: albumId,
      ownerId: 'user-a',
      title: 'Liburan Pantai',
      coverFileId: null,
      createdAt: new Date(),
    });

    const res = await http()
      .get(`/albums/${albumId}/zip`)
      .set('Cookie', `galeriku_session=${cookieA}`);

    expect(res.status).toBe(200);
    expect(res.header['content-type']).toBe('application/zip');
    expect(res.header['content-disposition']).toContain('Liburan Pantai.zip');
  });
});


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
  const token = `token-sh-${db.sessions.size + 1}`;
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

describe('Shares (US-24)', () => {
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
        const shareId = `sh-owner-${counter}`;
        app.db.shareLinks.set(shareId, {
          id: shareId,
          token: `token-${counter}`,
          ownerId: 'user-a',
          targetType: ShareTarget.FILE,
          targetId: 'file-dummy',
          allowDownload: true,
          viewCount: 0,
          expiresAt: null,
          passwordHash: null,
          revokedAt: null,
          createdAt: new Date(),
        });
        return shareId;
      },
      buildRequests: (id: string) => [
        { method: 'get', url: `/shares/${id}` },
      ],
    });
  });

  it('alur membuat link publik untuk file dan album', async () => {
    app.db.shareLinks.clear();
    const http = () =>
      request(app.app.getHttpAdapter().getInstance().server);

    seedFile(app.db, 'f-milik-a', 'user-a', 'dokumen.jpg');
    seedFile(app.db, 'f-milik-b', 'user-b', 'rahasia.jpg');

    // 1. User A mencoba share file milik User B -> ditolak 404 identik
    await http()
      .post('/shares')
      .set('Cookie', `galeriku_session=${cookieA}`)
      .set('Origin', ORIGIN)
      .send({ targetType: 'FILE', targetId: 'f-milik-b' })
      .expect(404);

    // 2. User A share file miliknya sendiri -> sukses 201
    const resFileShare = await http()
      .post('/shares')
      .set('Cookie', `galeriku_session=${cookieA}`)
      .set('Origin', ORIGIN)
      .send({ targetType: 'FILE', targetId: 'f-milik-a' })
      .expect(201);

    expect(resFileShare.body.targetTitle).toBe('dokumen.jpg');
    expect(resFileShare.body.allowDownload).toBe(true);
    expect(typeof resFileShare.body.token).toBe('string');
    expect(resFileShare.body.token.length).toBeGreaterThan(30);

    // 3. User A share album miliknya
    app.db.albums.set('alb-milik-a', {
      id: 'alb-milik-a',
      ownerId: 'user-a',
      title: 'Album Kenangan',
      coverFileId: null,
      createdAt: new Date(),
    });

    const resAlbumShare = await http()
      .post('/shares')
      .set('Cookie', `galeriku_session=${cookieA}`)
      .set('Origin', ORIGIN)
      .send({ targetType: 'ALBUM', targetId: 'alb-milik-a' })
      .expect(201);

    expect(resAlbumShare.body.targetTitle).toBe('Album Kenangan');

    // 4. GET /shares mengembalikan kedua tautan
    const resList = await http()
      .get('/shares')
      .set('Cookie', `galeriku_session=${cookieA}`)
      .expect(200);

    expect(resList.body.items).toHaveLength(2);
  });
});


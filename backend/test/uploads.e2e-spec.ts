import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import request from 'supertest';
import {
  createTestApp,
  type FakeDb,
  type TestApp,
} from './test-app';
import { expectOwnerOnly } from './ownership';
import { UploadsService } from '../src/uploads/uploads.service';

// Spike US-16: @tus/server di dalam NestJS. PrismaService di-mock (pola
// e2e lain); FileStore menulis ke MEDIA_DIR sementara per tes.
process.env.FRONTEND_ORIGIN ??= 'https://galeriku.hafizfajar.com';
process.env.ADMIN_EMAIL ??= 'admin@contoh.id';
const ORIGIN = process.env.FRONTEND_ORIGIN as string;
const ORIGIN_ASING = 'https://pencuri.example';
const TUS = '1.0.0';
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const NOT_FOUND_TEXT = JSON.stringify({
  statusCode: 404,
  code: 'NOT_FOUND',
  message: 'Tidak ditemukan.',
});

async function seedUser(
  db: FakeDb,
  email: string,
): Promise<Record<string, unknown>> {
  const id = `u-${email}`;
  const row = {
    id,
    email,
    name: email,
    avatarUrl: null,
    role: 'USER',
    status: 'ACTIVE',
    quotaBytes: 123456789n,
    emailVerifiedAt: new Date('2026-10-11T00:00:00.000Z'),
    createdAt: new Date(),
    lastLoginAt: null,
    passwordHash: null,
    googleSub: null,
  };
  db.users.set(id, row);
  return row;
}

function craftSession(db: FakeDb, userId: string): string {
  const token = `token-tus-${db.sessions.size + 1}`;
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

describe('Upload tus (US-16 spike)', () => {
  let app: TestApp['app'];
  let db: FakeDb;
  let mediaDir: string;
  let tusDir: string;

  beforeEach(async () => {
    mediaDir = mkdtempSync(join(tmpdir(), 'galeriku-tus-'));
    tusDir = join(mediaDir, '_tus');
    process.env.MEDIA_DIR = mediaDir;
    ({ app, db } = await createTestApp());
  });

  afterEach(async () => {
    await app.close();
    delete process.env.MEDIA_DIR;
    rmSync(mediaDir, { recursive: true, force: true });
  });

  const server = () => app;

  function buatUpload(
    cookie: string,
    panjang: number,
    nama = 'uji.bin',
  ): Promise<{ id: string; location: string }> {
    return request(server().getHttpAdapter().getInstance().server)
      .post('/uploads')
      .set('Cookie', `galeriku_session=${cookie}`)
      .set('Origin', ORIGIN)
      .set('Tus-Resumable', TUS)
      .set('Upload-Length', String(panjang))
      .set(
        'Upload-Metadata',
        `filename ${Buffer.from(nama, 'utf8').toString('base64')}`,
      )
      .expect(201)
      .then((res) => {
        const location = res.headers['location'] as string;
        const id = (location.split('/').pop() ?? '').split('?')[0];
        return { id, location };
      });
  }

  it('tanpa sesi menjawab 401 UNAUTHENTICATED (POST/HEAD/PATCH/DELETE)', async () => {
    const tanpa = request(server().getHttpAdapter().getInstance().server);
    const acak = 'id-tidak-ada-xyz';
    await tanpa
      .post('/uploads')
      .set('Origin', ORIGIN)
      .set('Tus-Resumable', TUS)
      .set('Upload-Length', '11')
      .expect(401)
      .expect((res) => {
        if (res.body.code !== 'UNAUTHENTICATED') {
          throw new Error(`POST: ${res.text}`);
        }
      });
    for (const [method, kirimBody] of [
      ['head', false],
      ['patch', true],
      ['delete', false],
    ] as const) {
      let req = tanpa[method](`/uploads/${acak}`)
        .set('Origin', ORIGIN)
        .set('Tus-Resumable', TUS);
      if (kirimBody) {
        req = req
          .set('Content-Type', 'application/offset+octet-stream')
          .set('Upload-Offset', '0')
          .send(Buffer.from('12345'));
      }
      // HEAD tidak membawa body (semantik HTTP): cukup statusnya.
      // Bentuk {statusCode, code, message} dibuktikan POST/PATCH/DELETE.
      const res = await req.expect(401);
      if (method !== 'head' && res.body.code !== 'UNAUTHENTICATED') {
        throw new Error(`${method}: ${res.text}`);
      }
    }
  });

  it('preflight OPTIONS lolos tanpa sesi dan memuat header tus', async () => {
    const res = await request(server().getHttpAdapter().getInstance().server)
      .options('/uploads/id-apa-saja')
      .set('Origin', ORIGIN)
      .set('Access-Control-Request-Method', 'PATCH')
      .set(
        'Access-Control-Request-Headers',
        'Tus-Resumable, Upload-Offset, Content-Type',
      )
      .expect(204);
    if (res.headers['access-control-allow-origin'] !== ORIGIN) {
      throw new Error(`allow-origin: ${res.text}`);
    }
    const allow = String(
      res.headers['access-control-allow-headers'] ?? '',
    ).toLowerCase();
    for (const h of ['tus-resumable', 'upload-offset', 'upload-metadata']) {
      if (!allow.includes(h)) {
        throw new Error(`allow-headers kurang ${h}: ${allow}`);
      }
    }
    if (res.headers['access-control-allow-credentials'] !== 'true') {
      throw new Error('credentials hilang pada preflight');
    }
  });

  it('Origin salah pada POST menjawab 403 FORBIDDEN_ORIGIN', async () => {
    const a = await seedUser(db, 'a@contoh.id');
    const cookie = craftSession(db, a.id as string);
    await request(server().getHttpAdapter().getInstance().server)
      .post('/uploads')
      .set('Cookie', `galeriku_session=${cookie}`)
      .set('Origin', ORIGIN_ASING)
      .set('Tus-Resumable', TUS)
      .set('Upload-Length', '11')
      .expect(403)
      .expect((res) => {
        if (res.body.code !== 'FORBIDDEN_ORIGIN') {
          throw new Error(res.text);
        }
      });
  });

  it('alur penuh: create -> PATCH -> selesai pindah ke final (HEAD 404 standar)', async () => {
    const a = await seedUser(db, 'a@contoh.id');
    const cookie = craftSession(db, a.id as string);
    const http = () =>
      request(server().getHttpAdapter().getInstance().server);
    const isi = Buffer.from('halo-dunia');
    const buat = await http()
      .post('/uploads')
      .set('Cookie', `galeriku_session=${cookie}`)
      .set('Origin', ORIGIN)
      .set('Tus-Resumable', TUS)
      .set('Upload-Length', String(isi.length))
      .set(
        'Upload-Metadata',
        `filename ${Buffer.from('halo.txt', 'utf8').toString('base64')}`,
      )
      .expect(201);
    if (buat.headers['x-content-type-options'] !== 'nosniff') {
      throw new Error('nosniff hilang pada 201 create');
    }
    const id = ((buat.headers['location'] as string).split('/').pop() ?? '')
      .split('?')[0];
    if (!UUID_RE.test(id)) {
      throw new Error(`id bukan UUID: ${id}`);
    }
    await http()
      .patch(`/uploads/${id}`)
      .set('Cookie', `galeriku_session=${cookie}`)
      .set('Origin', ORIGIN)
      .set('Tus-Resumable', TUS)
      .set('Content-Type', 'application/offset+octet-stream')
      .set('Upload-Offset', '0')
      .send(isi)
      .expect(204);
    // US-17: upload selesai langsung pindah ke MEDIA_DIR/<uuid> (bukan
    // lagi resource tus), sehingga HEAD berikutnya 404 standar.
    const head = await http()
      .head(`/uploads/${id}`)
      .set('Cookie', `galeriku_session=${cookie}`)
      .set('Origin', ORIGIN)
      .set('Tus-Resumable', TUS)
      .expect(404);
    if (head.headers['x-content-type-options'] !== 'nosniff') {
      throw new Error('nosniff hilang pada HEAD 404');
    }
    const final = join(mediaDir, id);
    if (!existsSync(final) || statSync(final).size !== isi.length) {
      throw new Error('berkas final tak ada/ukuran salah');
    }
    if (!readFileSync(final).equals(isi)) {
      throw new Error('isi berkas final berbeda');
    }
    if (existsSync(join(tusDir, `${id}.json`))) {
      throw new Error('sidecar tak dibersihkan setelah selesai');
    }
    const baris = [...db.files.values()];
    if (baris.length !== 1) {
      throw new Error(`baris File: ${baris.length}, harus 1`);
    }
    const f = baris[0] as Record<string, unknown>;
    if (f.ownerId !== a.id || f.storageKey !== id || f.status !== 'ready') {
      throw new Error(`baris File salah: ${JSON.stringify(f)}`);
    }
  });

  it('Location relatif di balik proxy (X-Forwarded-Proto http tidak bocor)', async () => {
    // Regresi fix US-16: rantai Cloudflare -> cloudflared -> Traefik
    // meneruskan proto http hop terakhir; Location wajib tetap relatif
    // "/uploads/<uuid>" (tanpa skema http://) agar browser https tidak
    // memblokir HEAD/PATCH berikutnya (mixed content).
    const a = await seedUser(db, 'a@contoh.id');
    const cookie = craftSession(db, a.id as string);
    const res = await request(server().getHttpAdapter().getInstance().server)
      .post('/uploads')
      .set('Cookie', `galeriku_session=${cookie}`)
      .set('Origin', ORIGIN)
      .set('Tus-Resumable', TUS)
      .set('Upload-Length', '11')
      .set(
        'Upload-Metadata',
        `filename ${Buffer.from('uji.txt', 'utf8').toString('base64')}`,
      )
      .set('X-Forwarded-Proto', 'http')
      .set('X-Forwarded-Host', 'galeriku-api.hafizfajar.com')
      .set('Forwarded', 'proto=http;host="galeriku-api.hafizfajar.com"')
      .expect(201);
    const location = res.headers['location'] as string;
    if (typeof location !== 'string' || location.length === 0) {
      throw new Error('Location hilang');
    }
    if (/^https?:\/\//i.test(location)) {
      throw new Error(`Location absolut (bocor skema proxy): ${location}`);
    }
    if (!location.startsWith('/uploads/')) {
      throw new Error(`Location bukan path /uploads/<uuid>: ${location}`);
    }
    const id = (location.split('/').pop() ?? '').split('?')[0];
    if (!UUID_RE.test(id)) {
      throw new Error(`id bukan UUID: ${location}`);
    }
  });

  it('resume: PATCH sebagian -> HEAD -> PATCH sisanya', async () => {
    const a = await seedUser(db, 'a@contoh.id');
    const cookie = craftSession(db, a.id as string);
    const http = () =>
      request(server().getHttpAdapter().getInstance().server);
    const isi = Buffer.from('01234567890');
    const { id } = await buatUpload(cookie, isi.length);
    const lpatch = (offset: number, potong: Buffer) =>
      http()
        .patch(`/uploads/${id}`)
        .set('Cookie', `galeriku_session=${cookie}`)
        .set('Origin', ORIGIN)
        .set('Tus-Resumable', TUS)
        .set('Content-Type', 'application/offset+octet-stream')
        .set('Upload-Offset', String(offset))
        .send(potong)
        .expect(204);
    await lpatch(0, isi.subarray(0, 5));
    const tengah = await http()
      .head(`/uploads/${id}`)
      .set('Cookie', `galeriku_session=${cookie}`)
      .set('Origin', ORIGIN)
      .set('Tus-Resumable', TUS)
      .expect(200);
    if (tengah.headers['upload-offset'] !== '5') {
      throw new Error(`offset tengah: ${tengah.headers['upload-offset']}`);
    }
    await lpatch(5, isi.subarray(5));
    // US-17: chunk terakhir menyelesaikan upload -> pindah ke final,
    // HEAD tus berikutnya 404 standar.
    await http()
      .head(`/uploads/${id}`)
      .set('Cookie', `galeriku_session=${cookie}`)
      .set('Origin', ORIGIN)
      .set('Tus-Resumable', TUS)
      .expect(404);
    if (!readFileSync(join(mediaDir, id)).equals(isi)) {
      throw new Error('gabungan chunk berbeda dari aslinya');
    }
  });

  it('melebihi maxSize global ditolak 413', async () => {
    const a = await seedUser(db, 'a@contoh.id');
    const cookie = craftSession(db, a.id as string);
    await request(server().getHttpAdapter().getInstance().server)
      .post('/uploads')
      .set('Cookie', `galeriku_session=${cookie}`)
      .set('Origin', ORIGIN)
      .set('Tus-Resumable', TUS)
      .set('Upload-Length', '99999999999')
      .expect(413);
  });

  it('kepemilikan A-vs-B: B 404 identik dengan id tak ada, A 2xx', async () => {
    const a = await seedUser(db, 'a@contoh.id');
    const b = await seedUser(db, 'b@contoh.id');
    const cookieA = craftSession(db, a.id as string);
    const cookieB = craftSession(db, b.id as string);
    const tusHeader = { 'Tus-Resumable': TUS };
    await expectOwnerOnly(server(), {
      cookieA,
      cookieB,
      origin: ORIGIN,
      createResource: () => buatUpload(cookieA, 5).then((r) => r.id),
      buildRequests: (id) => [
        { method: 'head', url: `/uploads/${id}`, headers: tusHeader },
        {
          method: 'patch',
          url: `/uploads/${id}`,
          body: Buffer.from('12345'),
          headers: {
            ...tusHeader,
            'Content-Type': 'application/offset+octet-stream',
            'Upload-Offset': '0',
          },
        },
        { method: 'delete', url: `/uploads/${id}`, headers: tusHeader },
      ],
    });
  });

  describe('penyelesaian upload (US-17)', () => {
    function kirimPatch(
      cookie: string,
      id: string,
      offset: number,
      potong: Buffer,
    ) {
      return request(server().getHttpAdapter().getInstance().server)
        .patch(`/uploads/${id}`)
        .set('Cookie', `galeriku_session=${cookie}`)
        .set('Origin', ORIGIN)
        .set('Tus-Resumable', TUS)
        .set('Content-Type', 'application/offset+octet-stream')
        .set('Upload-Offset', String(offset))
        .send(potong);
    }

    function buatUploadDenganTipe(
      cookie: string,
      panjang: number,
      nama: string,
      tipe: string,
    ): Promise<{ id: string }> {
      return request(server().getHttpAdapter().getInstance().server)
        .post('/uploads')
        .set('Cookie', `galeriku_session=${cookie}`)
        .set('Origin', ORIGIN)
        .set('Tus-Resumable', TUS)
        .set('Upload-Length', String(panjang))
        .set(
          'Upload-Metadata',
          [
            `filename ${Buffer.from(nama, 'utf8').toString('base64')}`,
            `filetype ${Buffer.from(tipe, 'utf8').toString('base64')}`,
          ].join(','),
        )
        .expect(201)
        .then((res) => {
          const location = res.headers['location'] as string;
          const id = (location.split('/').pop() ?? '').split('?')[0];
          return { id };
        });
    }

    it('selesai -> baris File ready + berkas pindah ke MEDIA_DIR/<uuid>', async () => {
      const a = await seedUser(db, 'a@contoh.id');
      const cookie = craftSession(db, a.id as string);
      const isi = Buffer.from('foto-palsu-isi');
      const { id } = await buatUploadDenganTipe(
        cookie,
        isi.length,
        'liburan.jpg',
        'image/jpeg',
      );
      await kirimPatch(cookie, id, 0, isi).expect(204);
      if (!UUID_RE.test(id)) {
        throw new Error(`id bukan UUID: ${id}`);
      }
      // Berkas tus pindah, bukan nama asli di disk.
      if (existsSync(join(tusDir, id))) {
        throw new Error('berkas masih di _tus setelah selesai');
      }
      const final = join(mediaDir, id);
      if (!existsSync(final) || !readFileSync(final).equals(isi)) {
        throw new Error('berkas final tak ada/isi salah');
      }
      if (existsSync(join(tusDir, `${id}.json`))) {
        throw new Error('sidecar tak dibersihkan');
      }
      const baris = [...db.files.values()];
      if (baris.length !== 1) {
        throw new Error(`baris File: ${baris.length}, harus 1`);
      }
      const f = baris[0] as Record<string, unknown>;
      if (
        f.ownerId !== a.id ||
        f.storageKey !== id ||
        f.originalName !== 'liburan.jpg' ||
        f.mimeType !== 'image/jpeg' ||
        f.sizeBytes !== BigInt(isi.length) ||
        f.kind !== 'image' ||
        f.status !== 'ready'
      ) {
        throw new Error(`baris File salah: ${JSON.stringify({ ...f, sizeBytes: String(f.sizeBytes) })}`);
      }
    });

    it('nama disanitasi (buang path), storage_key tetap UUID', async () => {
      const a = await seedUser(db, 'a@contoh.id');
      const cookie = craftSession(db, a.id as string);
      const isi = Buffer.from('x'.repeat(8));
      const { id } = await buatUploadDenganTipe(
        cookie,
        isi.length,
        '../../etc/passwd',
        'application/octet-stream',
      );
      await kirimPatch(cookie, id, 0, isi).expect(204);
      const f = [...db.files.values()][0] as Record<string, unknown>;
      if (f.originalName !== 'passwd') {
        throw new Error(`originalName: ${JSON.stringify(f.originalName)}`);
      }
      if (!UUID_RE.test(String(f.storageKey))) {
        throw new Error(`storageKey bukan UUID: ${f.storageKey}`);
      }
    });

    it('video dikenali dari mime/ekstensi', async () => {
      const a = await seedUser(db, 'a@contoh.id');
      const cookie = craftSession(db, a.id as string);
      const isi = Buffer.from('video-palsu');
      const { id } = await buatUploadDenganTipe(
        cookie,
        isi.length,
        'klip.mp4',
        'video/mp4',
      );
      await kirimPatch(cookie, id, 0, isi).expect(204);
      const f = [...db.files.values()][0] as Record<string, unknown>;
      if (f.kind !== 'video') {
        throw new Error(`kind: ${JSON.stringify(f.kind)}`);
      }
    });

    it('gagal tulis DB setelah pindah -> berkas dibersihkan, galat ramah', async () => {
      const a = await seedUser(db, 'a@contoh.id');
      const cookie = craftSession(db, a.id as string);
      const isi = Buffer.from('gagal-db-isi!');
      const { id } = await buatUpload(cookie, isi.length);
      const service = app.get(UploadsService);
      const prisma = (
        service as unknown as { prisma: { file: { create: unknown } } }
      ).prisma;
      const asli = prisma.file.create;
      prisma.file.create = async () => {
        throw new Error('db down');
      };
      try {
        const res = await kirimPatch(cookie, id, 0, isi).expect(500);
        // Galat tus dikirim teks polos: pakai body terurai bila ada,
        // bila kosong parse teks mentah.
        const terurai = res.body as Record<string, unknown>;
        const badan =
          terurai && typeof terurai.code === 'string'
            ? terurai
            : (JSON.parse(res.text as string) as Record<string, unknown>);
        if (badan.code !== 'UPLOAD_FINISH_FAILED') {
          throw new Error(`kode: ${res.text}`);
        }
        if (
          typeof badan.message !== 'string' ||
          !badan.message.includes('Coba unggah ulang')
        ) {
          throw new Error(`pesan tak ramah: ${res.text}`);
        }
      } finally {
        prisma.file.create = asli;
      }
      if (existsSync(join(mediaDir, id))) {
        throw new Error('berkas yatim tertinggal setelah gagal DB');
      }
      if (db.files.size !== 0) {
        throw new Error('baris File tercipta padahal DB gagal');
      }
    });

    it('cleanup expiration menghapus yatim >24 jam, yang segar utuh', async () => {
      const a = await seedUser(db, 'a@contoh.id');
      const cookie = craftSession(db, a.id as string);
      const yatim = await buatUpload(cookie, 10);
      const segar = await buatUpload(cookie, 10);
      const sidecar = join(tusDir, `${yatim.id}.json`);
      const meta = JSON.parse(readFileSync(sidecar, 'utf8')) as Record<
        string,
        unknown
      >;
      meta.creation_date = new Date(Date.now() - 25 * 3600_000).toISOString();
      writeFileSync(sidecar, JSON.stringify(meta));
      const service = app.get(UploadsService);
      const hasil = await service.deleteExpiredUploads();
      if (hasil !== 1) {
        throw new Error(`terhapus: ${hasil}, harus 1`);
      }
      if (existsSync(join(tusDir, yatim.id))) {
        throw new Error('berkas yatim tak terhapus');
      }
      if (!existsSync(join(tusDir, segar.id))) {
        throw new Error('upload segar ikut terhapus');
      }
    });
  });

  it('404 milik orang lain identik byte-per-byte dengan 404 id tak ada', async () => {
    const a = await seedUser(db, 'a@contoh.id');
    const b = await seedUser(db, 'b@contoh.id');
    const cookieA = craftSession(db, a.id as string);
    const cookieB = craftSession(db, b.id as string);
    const http = () =>
      request(server().getHttpAdapter().getInstance().server);
    const milikA = await buatUpload(cookieA, 5);
    // HEAD tak membawa body: sameness B-vs-hilang untuk HEAD hanya lewat
    // status (helper A-vs-B sudah mencakupnya); teks dibandingkan lewat
    // PATCH/DELETE yang berbody.
    for (const [method, extra] of [
      ['head', {}],
      [
        'patch',
        {
          'Content-Type': 'application/offset+octet-stream',
          'Upload-Offset': '0',
        },
      ],
      ['delete', {}],
    ] as const) {
      const bangun = (id: string) => {
        let req = http()
          [method](`/uploads/${id}`)
          .set('Cookie', `galeriku_session=${cookieB}`)
          .set('Origin', ORIGIN)
          .set('Tus-Resumable', TUS);
        for (const [k, v] of Object.entries(extra)) {
          req = req.set(k, v);
        }
        if (method === 'patch') {
          req = req.send(Buffer.from('12345'));
        }
        return req;
      };
      const resB = await bangun(milikA.id).expect(404);
      const resHilang = await bangun('id-tidak-ada-xyz').expect(404);
      if (method === 'head') {
        continue;
      }
      if (resB.text !== resHilang.text || resB.text !== NOT_FOUND_TEXT) {
        throw new Error(
          `${method}: B=${JSON.stringify(resB.text)} hilang=${JSON.stringify(resHilang.text)}`,
        );
      }
    }
  });
});

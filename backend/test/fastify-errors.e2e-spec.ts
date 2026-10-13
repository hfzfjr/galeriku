import request from 'supertest';
import {
  createTestApp,
  type FakeDb,
  type TestApp,
} from './test-app';

process.env.FRONTEND_ORIGIN ??= 'https://galeriku.hafizfajar.com';
const ORIGIN = process.env.FRONTEND_ORIGIN as string;
const TEST_IP = '203.0.113.21';

// Galat bawaan Fastify (sebelum pipeline Nest) berbentuk standar
// {statusCode, code, message} tanpa kebocoran; header CORS tetap ada
// agar browser bisa membaca galatnya.
describe('Galat Fastify (e2e)', () => {
  let app: TestApp['app'];
  let db: FakeDb;

  beforeEach(async () => {
    ({ app, db } = await createTestApp());
  });

  afterEach(async () => {
    await app.close();
  });

  const server = () => app.getHttpAdapter().getInstance().server;

  function bentukStandar(res: { body: unknown; text: string }): void {
    const body = res.body as Record<string, unknown>;
    // details opsional (mis. dari validasi Zod); kunci lain dilarang.
    const kunci = ['code', 'message', 'statusCode'];
    if ('details' in body) {
      kunci.push('details');
    }
    expect(Object.keys(body).sort()).toEqual(kunci.sort());
    expect(typeof body.statusCode).toBe('number');
    expect(typeof body.code).toBe('string');
    expect(typeof body.message).toBe('string');
    const teks = res.text;
    expect(teks).not.toMatch(/stack|FST_ERR_|FastifyError|node_modules/i);
  }

  it('body kosong + Content-Type JSON -> 400 VALIDATION_ERROR', async () => {
    const res = await request(server())
      .post('/auth/login')
      .set('Origin', ORIGIN)
      .set('Content-Type', 'application/json')
      .set('cf-connecting-ip', TEST_IP)
      .expect(400);
    expect(res.body).toEqual({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'Data yang dikirim tidak valid.',
    });
    bentukStandar(res);
    expect(db).toBeDefined();
  });

  it('JSON rusak -> 400 VALIDATION_ERROR', async () => {
    const res = await request(server())
      .post('/auth/login')
      .set('Origin', ORIGIN)
      .set('Content-Type', 'application/json')
      .set('cf-connecting-ip', TEST_IP)
      .send('{"email": "rusak@')
      .expect(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    bentukStandar(res);
  });

  it('Content-Type tak didukung -> 415 UNSUPPORTED_MEDIA_TYPE', async () => {
    const res = await request(server())
      .post('/auth/login')
      .set('Origin', ORIGIN)
      .set('Content-Type', 'application/octet-stream')
      .set('cf-connecting-ip', TEST_IP)
      .send('halo')
      .expect(415);
    expect(res.body).toEqual({
      statusCode: 415,
      code: 'UNSUPPORTED_MEDIA_TYPE',
      message: 'Tipe konten permintaan tidak didukung.',
    });
    bentukStandar(res);
  });

  it('text/plain diteruskan sebagai string -> 400 VALIDATION_ERROR standar', async () => {
    // Perilaku tumpukan saat ini: text/plain tidak ditolak parser,
    // melainkan sampai ke validasi Zod sebagai string. Bentuknya tetap
    // standar tanpa kebocoran; kunci agar tidak berubah diam-diam.
    const res = await request(server())
      .post('/auth/login')
      .set('Origin', ORIGIN)
      .set('Content-Type', 'text/plain')
      .set('cf-connecting-ip', TEST_IP)
      .send('halo')
      .expect(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    bentukStandar(res);
  });

  it('payload melebihi bodyLimit -> 413 PAYLOAD_TOO_LARGE', async () => {
    const besar = `"${'x'.repeat(2 * 1024 * 1024)}"`;
    const res = await request(server())
      .post('/auth/login')
      .set('Origin', ORIGIN)
      .set('Content-Type', 'application/json')
      .set('cf-connecting-ip', TEST_IP)
      .send(besar)
      .expect(413);
    expect(res.body).toEqual({
      statusCode: 413,
      code: 'PAYLOAD_TOO_LARGE',
      message: 'Data yang dikirim terlalu besar.',
    });
    bentukStandar(res);
  });

  it('route tak dikenal tanpa sesi -> 404 NOT_FOUND + CORS retained', async () => {
    const res = await request(server())
      .get('/tidak-ada-xyz')
      .set('Origin', ORIGIN)
      .set('cf-connecting-ip', TEST_IP)
      .expect(404);
    expect(res.body).toEqual({
      statusCode: 404,
      code: 'NOT_FOUND',
      message: 'Tidak ditemukan.',
    });
    bentukStandar(res);
    expect(res.headers['access-control-allow-origin']).toBe(ORIGIN);
  });

  it('route tak dikenal (mutasi) -> 404 + CORS retained', async () => {
    const res = await request(server())
      .post('/tidak-ada-xyz')
      .set('Origin', ORIGIN)
      .set('Content-Type', 'application/json')
      .set('cf-connecting-ip', TEST_IP)
      .send({ a: 1 })
      .expect(404);
    expect(res.body.code).toBe('NOT_FOUND');
    expect(res.headers['access-control-allow-origin']).toBe(ORIGIN);
  });
});

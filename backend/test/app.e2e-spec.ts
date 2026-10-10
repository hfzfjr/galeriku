import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { setupCors } from './../src/cors';
import { PrismaService } from './../src/prisma.service';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';

// Origin yang diizinkan CORS selama e2e (hanya pencocokan string,
// tanpa request keluar). Dibaca saat bootstrap aplikasi.
process.env.FRONTEND_ORIGIN ??= 'https://galeriku.hafizfajar.com';
const ALLOWED_ORIGIN = process.env.FRONTEND_ORIGIN as string;

describe('AppController (e2e)', () => {
  let app: NestFastifyApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      // Tanpa database di e2e: PrismaService asli diganti mock.
      .overrideProvider(PrismaService)
      .useValue({ $queryRaw: async () => [{ '?column?': 1 }] })
      .compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    setupCors(app);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  it('/ (GET)', () => {
    return request(app.getHttpAdapter().getInstance().server)
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  it('/health (GET) tanpa database', () => {
    return request(app.getHttpAdapter().getInstance().server)
      .get('/health')
      .expect(200)
      .expect((res) => {
        if (res.body.status !== 'ok' || res.body.database !== 'up') {
          throw new Error(`respons health tak terduga: ${res.text}`);
        }
      });
  });

  it('preflight CORS: Origin diizinkan mendapat header allow', () => {
    return request(app.getHttpAdapter().getInstance().server)
      .options('/health')
      .set('Origin', ALLOWED_ORIGIN)
      .set('Access-Control-Request-Method', 'GET')
      .expect((res) => {
        if (
          res.headers['access-control-allow-origin'] !== ALLOWED_ORIGIN ||
          res.headers['access-control-allow-credentials'] !== 'true'
        ) {
          throw new Error(`header CORS tak terduga: ${res.text}`);
        }
      });
  });

  it('preflight CORS: Origin lain tidak mendapat header allow', () => {
    return request(app.getHttpAdapter().getInstance().server)
      .options('/health')
      .set('Origin', 'https://pencuri.example')
      .set('Access-Control-Request-Method', 'GET')
      .expect((res) => {
        if ('access-control-allow-origin' in res.headers) {
          throw new Error('Origin asing tidak boleh mendapat header allow');
        }
      });
  });

  afterEach(async () => {
    await app.close();
  });
});

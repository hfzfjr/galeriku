import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma.service';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';

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

  afterEach(async () => {
    await app.close();
  });
});

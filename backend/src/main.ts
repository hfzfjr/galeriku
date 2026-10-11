import { existsSync } from 'node:fs';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { loadAppConfig } from './config/app-config';
import { AppModule } from './app.module';
import { setupApp } from './setup';

// Muat backend/.env untuk dev lokal tanpa dependency tambahan.
// Di container produksi file ini tidak ada: env datang dari Compose.
if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

async function bootstrap() {
  // Validasi konfigurasi dulu: gagal cepat bila env kurang/salah.
  const config = loadAppConfig(process.env);
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );
  // Konfigurasi yang sama dipakai tes e2e (lihat setupApp).
  await setupApp(app, config);
  await app.listen(
    Number(process.env.PORT ?? 4000),
    process.env.HOST ?? '0.0.0.0',
  );
}
bootstrap();

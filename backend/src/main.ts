import { existsSync } from 'node:fs';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from './app.module';

// Muat backend/.env untuk dev lokal tanpa dependency tambahan.
// Di container produksi file ini tidak ada: env datang dari Compose.
if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );
  await app.listen(
    Number(process.env.PORT ?? 4000),
    process.env.HOST ?? '0.0.0.0',
  );
}
bootstrap();

import cookie from '@fastify/cookie';
import type { FastifyError } from 'fastify';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { AppConfig } from './config/app-config';
import {
  ApiExceptionFilter,
  NotFoundExceptionFilter,
} from './common/filters/exception-filters';
import { sendStandardError } from './common/errors/fastify-error-handler';
import { setupCors } from './config/cors';

// Konfigurasi aplikasi terpusat: dipakai main.ts (produksi/dev) dan
// tes e2e (PrismaService di-mock) agar tidak ada perbedaan perilaku:
// plugin cookie, CORS, galat adapter Fastify, dan filter error global.
export async function setupApp(
  app: NestFastifyApplication,
  config: AppConfig,
): Promise<void> {
  await app.getHttpAdapter().getInstance().register(cookie);
  setupCors(app, config.frontendOrigin);
  // Passthrough tus (US-16): body PATCH (application/offset+octet-stream)
  // tidak dibuffer/di-parse Fastify; stream mentah dibaca @tus/server di
  // UploadsController. Tanpa parseAs string/buffer, Fastify tidak
  // menerapkan bodyLimit di sini (chunk 5 MB lolos); parser JSON bawaan
  // tidak tersentuh.
  app
    .getHttpAdapter()
    .getInstance()
    .addContentTypeParser(
      'application/offset+octet-stream',
      (_request, _payload, done) => {
        done(null);
      },
    );
  app.useGlobalFilters(
    new ApiExceptionFilter(),
    new NotFoundExceptionFilter(),
  );
}

// Galat bawaan Fastify (body kosong/JSON rusak, Content-Type tak didukung,
// payload berlebih) dan NotFoundException dari not-found handler Nest
// dibungkus ke bentuk standar {statusCode, code, message}.
// WAJIB dipanggil SETELAH app.init(): adapter Nest menimpa error handler
// saat init, sehingga pemasangan lebih awal tidak berlaku. Header CORS
// tetap terpasang (hook onRequest plugin CORS jalan duluan).
export function registerFastifyErrorHandler(
  app: NestFastifyApplication,
): void {
  app
    .getHttpAdapter()
    .getInstance()
    .setErrorHandler((error: FastifyError, _request, reply) => {
      sendStandardError(reply, error);
    });
}

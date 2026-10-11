import cookie from '@fastify/cookie';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { AppConfig } from './app-config';
import { ApiExceptionFilter } from './auth/exception-filters';
import { setupCors } from './cors';

// Konfigurasi aplikasi terpusat: dipakai main.ts (produksi/dev) dan
// tes e2e (PrismaService di-mock) agar tidak ada perbedaan perilaku:
// plugin cookie, CORS, dan filter error global.
export async function setupApp(
  app: NestFastifyApplication,
  config: AppConfig,
): Promise<void> {
  await app.getHttpAdapter().getInstance().register(cookie);
  setupCors(app, config.frontendOrigin);
  app.useGlobalFilters(new ApiExceptionFilter());
}

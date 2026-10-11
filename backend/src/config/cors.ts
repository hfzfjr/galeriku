import type { NestFastifyApplication } from '@nestjs/platform-fastify';

// Konfigurasi CORS terpusat agar dipakai main.ts dan e2e.
export function setupCors(
  app: NestFastifyApplication,
  frontendOrigin: string,
) {
  if (process.env.NODE_ENV === 'production' && !frontendOrigin) {
    throw new Error(
      'FRONTEND_ORIGIN wajib diisi di production (untuk CORS).',
    );
  }
  app.enableCors({
    // Satu origin persis dalam array agar @fastify/cors mencocokkan
    // secara eksak per request (bukan wildcard, tanpa refleksi):
    // origin asing tidak mendapat header allow-origin.
    origin: [frontendOrigin],
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-Requested-With'],
    // Header khusus tus (mis. Tus-Resumable, Upload-*) ditambahkan
    // di story upload (Sprint 3).
  });
}

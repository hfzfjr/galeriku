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
    // tus (US-16, upload resumable): browser mengirim header di bawah saat
    // preflight ke /uploads. Preflight dijawab @fastify/cors di hook
    // onRequest (tanpa sesi); response aktual dijawab @tus/server dengan
    // header CORS-nya sendiri (Allow-Origin dari FRONTEND_ORIGIN,
    // Allow-Credentials, Expose). Keduanya tidak ganda: saat controller
    // meng-hijack reply, header yang di-stage @fastify/cors untuk request
    // aktual gugur dan hanya header tus yang terkirim. Penegakan nyata
    // (sesi + Origin) tetap di guard Nest dan hook tus.
    allowedHeaders: [
      'Content-Type',
      'X-Requested-With',
      'Tus-Resumable',
      'Upload-Length',
      'Upload-Offset',
      'Upload-Metadata',
      'Upload-Defer-Length',
      'Upload-Concat',
      'X-HTTP-Method-Override',
    ],
    exposedHeaders: [
      'Location',
      'Upload-Offset',
      'Upload-Length',
      'Tus-Version',
      'Tus-Resumable',
      'Tus-Max-Size',
      'Tus-Extension',
      'Upload-Metadata',
    ],
  });
}

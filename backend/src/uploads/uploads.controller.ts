import {
  Delete,
  Head,
  Patch,
  Post,
  Controller,
  Logger,
  Req,
  Res,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import type { AuthenticatedRequest } from '../auth/guards/auth.guard';
import { TUS_AUTH_USER_KEY } from './uploads.constants';
import { UploadsService } from './uploads.service';

// Route tus (spike US-16). Guard global (SessionAuthGuard 401,
// OriginGuard 403) berjalan SEBELUM handler karena ini controller Nest
// biasa — tanpa sesi tak akan sampai ke @tus/server. Preflight OPTIONS
// SENGAJA tidak didaftarkan di sini agar dijawab @fastify/cors di hook
// onRequest (tanpa sesi). Handler meng-hijack reply lalu mendelegasikan
// stream mentah ke @tus/server.
@Controller('uploads')
export class UploadsController {
  private readonly logger = new Logger(UploadsController.name);

  constructor(private readonly uploads: UploadsService) {}

  // Pembuatan upload (Tus-Resumable creation). Hanya POST di /uploads.
  @Post()
  async root(
    @Req() req: AuthenticatedRequest,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    await this.delegate(req, reply);
  }

  // Operasi per upload-id. OPTIONS sengaja dikecualikan (preflight CORS).
  // GET sengaja tidak didaftarkan (Fastify membuat HEAD otomatis dari GET,
  // bentrok dengan @Head di bawah); spike hanya butuh HEAD/PATCH/DELETE.
  @Head('*')
  async headById(
    @Req() req: AuthenticatedRequest,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    await this.delegate(req, reply);
  }

  @Patch('*')
  async patchById(
    @Req() req: AuthenticatedRequest,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    await this.delegate(req, reply);
  }

  @Delete('*')
  async deleteById(
    @Req() req: AuthenticatedRequest,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    await this.delegate(req, reply);
  }

  private async delegate(
    req: AuthenticatedRequest,
    reply: FastifyReply,
  ): Promise<void> {
    // Titip hasil guard untuk hook tus (baca via req.runtime.node.req).
    (req.raw as unknown as Record<string | symbol, unknown>)[
      TUS_AUTH_USER_KEY
    ] = req.authUser;
    reply.raw.setHeader('X-Content-Type-Options', 'nosniff');
    reply.hijack();
    try {
      await this.uploads.handleRaw(req.raw, reply.raw);
    } catch (error) {
      // Jaring pengaman bug tak terduga (kasus operasional sudah
      // ditangani guard/hook). Reply sudah di-hijack: tulis mentah.
      this.logger.error(
        `tus gagal: ${error instanceof Error ? error.message : String(error)}`,
      );
      if (!reply.raw.headersSent && !reply.raw.destroyed) {
        reply.raw.statusCode = 500;
        reply.raw.setHeader(
          'content-type',
          'application/json; charset=utf-8',
        );
        reply.raw.end(
          JSON.stringify({
            statusCode: 500,
            code: 'INTERNAL_ERROR',
            message: 'Terjadi kesalahan. Muat ulang halaman lalu coba lagi.',
          }),
        );
      }
    }
  }
}

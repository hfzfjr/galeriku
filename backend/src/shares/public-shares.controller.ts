import { createReadStream } from 'node:fs';
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type {
  PublicShareResponse,
  UnlockShareRequest,
} from '@galeriku/contracts';
import { unlockShareSchema } from '@galeriku/contracts';
import { Public } from '../common/decorators/public.decorator';
import { getClientIp, getUserAgent } from '../common/utils/client-ip';
import { RateLimit } from '../common/rate-limit/rate-limit.decorator';
import { RateLimitGuard } from '../common/rate-limit/rate-limit.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { parseRange } from '../files/files.controller';
import { SharesService } from './shares.service';
import { createZipStream } from './zip-stream';

function getUnlockTokenFromReq(req: FastifyRequest): string | undefined {
  // 1. Ambil dari header kustom jika ada
  const headerToken = req.headers['x-unlock-token'];
  if (typeof headerToken === 'string' && headerToken) {
    return headerToken;
  }

  // 2. Ambil dari cookie galeriku_unlock_*
  const cookies = req.cookies as Record<string, string | undefined> | undefined;
  if (cookies) {
    for (const [key, val] of Object.entries(cookies)) {
      if (key.startsWith('galeriku_unlock_') && typeof val === 'string') {
        return val;
      }
    }
  }

  // 3. Fallback parse manual cookie header jika req.cookies kosong
  const rawCookie = req.headers.cookie;
  if (typeof rawCookie === 'string') {
    const parts = rawCookie.split(';');
    for (const p of parts) {
      const [k, v] = p.trim().split('=');
      if (k.startsWith('galeriku_unlock_') && v) {
        return decodeURIComponent(v);
      }
    }
  }

  return undefined;
}

@Controller('public/s')
export class PublicSharesController {
  constructor(private readonly sharesService: SharesService) {}

  @Public()
  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 60, windowMs: 60_000, keyPrefix: 'share:view' })
  @Get(':token')
  async getPublicShare(
    @Param('token') token: string,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
  ): Promise<PublicShareResponse> {
    res.header('X-Robots-Tag', 'noindex, nofollow');
    const ip = getClientIp(req);
    const userAgent = getUserAgent(req);
    const unlockToken = getUnlockTokenFromReq(req);
    return this.sharesService.getPublicShare(token, ip, userAgent, unlockToken);
  }

  @Public()
  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 5, windowMs: 60_000, keyPrefix: 'share:unlock' })
  @Post(':token/unlock')
  @UsePipes(new ZodValidationPipe(unlockShareSchema))
  async unlockShare(
    @Param('token') token: string,
    @Body() body: UnlockShareRequest,
    @Res({ passthrough: true }) res: FastifyReply,
  ): Promise<{ unlocked: boolean; unlockToken: string }> {
    res.header('X-Robots-Tag', 'noindex, nofollow');
    const { unlockToken, cookieName } = await this.sharesService.unlockShare(
      token,
      body.password,
    );

    res.setCookie(cookieName, unlockToken, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 86400,
    });

    return { unlocked: true, unlockToken };
  }

  @Public()
  @Get(':token/files/:fileId/thumb')
  async getPublicThumbnail(
    @Param('token') token: string,
    @Param('fileId') fileId: string,
    @Req() req: FastifyRequest,
    @Res() res: FastifyReply,
  ): Promise<void> {
    const unlockToken = getUnlockTokenFromReq(req);
    const thumbPath = await this.sharesService.getPublicThumbnailPath(
      token,
      fileId,
      unlockToken,
    );

    res.header('Content-Type', 'image/webp');
    res.header('Cache-Control', 'public, max-age=86400');
    res.header('X-Content-Type-Options', 'nosniff');
    res.header('X-Robots-Tag', 'noindex, nofollow');

    const stream = createReadStream(thumbPath);
    return res.send(stream);
  }

  @Public()
  @Get(':token/cover')
  async getPublicCover(
    @Param('token') token: string,
    @Req() req: FastifyRequest,
    @Res() res: FastifyReply,
  ): Promise<void> {
    const ip = getClientIp(req);
    const userAgent = getUserAgent(req);
    const unlockToken = getUnlockTokenFromReq(req);
    const share = await this.sharesService.getPublicShare(
      token,
      ip,
      userAgent,
      unlockToken,
    );

    if (share.files.length === 0) {
      res.status(404).send({
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Cover tidak tersedia.',
      });
      return;
    }

    const firstFileId = share.files[0].id;
    const thumbPath = await this.sharesService.getPublicThumbnailPath(
      token,
      firstFileId,
      unlockToken,
    );

    res.header('Content-Type', 'image/webp');
    res.header('Cache-Control', 'public, max-age=86400');
    res.header('X-Content-Type-Options', 'nosniff');
    res.header('X-Robots-Tag', 'noindex, nofollow');

    const stream = createReadStream(thumbPath);
    return res.send(stream);
  }

  @Public()
  @Get(':token/files/:fileId')
  async getPublicFileContent(
    @Param('token') token: string,
    @Param('fileId') fileId: string,
    @Query('download') downloadQuery: string | undefined,
    @Req() req: FastifyRequest,
    @Res() res: FastifyReply,
  ): Promise<void> {
    const isDownload = downloadQuery === '1';
    const unlockToken = getUnlockTokenFromReq(req);
    const { filePath, originalName, mimeType, sizeBytes } =
      await this.sharesService.getPublicFileContentInfo(
        token,
        fileId,
        isDownload,
        unlockToken,
      );

    res.header('X-Content-Type-Options', 'nosniff');
    res.header('X-Robots-Tag', 'noindex, nofollow');

    if (isDownload) {
      res.header(
        'Content-Disposition',
        `attachment; filename="${encodeURIComponent(originalName)}"`,
      );
      res.header('Content-Type', mimeType);
      res.header('Content-Length', sizeBytes);
      const stream = createReadStream(filePath);
      return res.send(stream);
    }

    res.header('Accept-Ranges', 'bytes');
    res.header('Content-Type', mimeType);

    const rangeHeader = req.headers.range;
    if (rangeHeader) {
      const parsed = parseRange(rangeHeader, sizeBytes);
      if (!parsed) {
        res.status(416);
        res.header('Content-Range', `bytes */${sizeBytes}`);
        return res.send();
      }

      const { start, end } = parsed;
      const chunkSize = end - start + 1;

      res.status(206);
      res.header('Content-Range', `bytes ${start}-${end}/${sizeBytes}`);
      res.header('Content-Length', chunkSize);

      const stream = createReadStream(filePath, { start, end });
      return res.send(stream);
    }

    res.header('Content-Length', sizeBytes);
    const stream = createReadStream(filePath);
    return res.send(stream);
  }

  @Public()
  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 10, windowMs: 60_000, keyPrefix: 'share:zip' })
  @Get(':token/zip')
  async downloadAlbumZip(
    @Param('token') token: string,
    @Req() req: FastifyRequest,
    @Res() res: FastifyReply,
  ): Promise<void> {
    const unlockToken = getUnlockTokenFromReq(req);
    const { title, files } = await this.sharesService.getAlbumZipInfo(
      token,
      unlockToken,
    );

    const safeTitle = title.replace(/[/\\?%*:|"<>]/g, '_').trim() || 'album';
    const filename = `${safeTitle}.zip`;

    res.header('Content-Type', 'application/zip');
    res.header(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(filename)}"`,
    );
    res.header('X-Content-Type-Options', 'nosniff');
    res.header('X-Robots-Tag', 'noindex, nofollow');

    const entries = files.map((f) => ({
      filename: f.originalName,
      getStream: () => createReadStream(f.filePath),
    }));

    const zipStream = createZipStream(entries);
    return res.send(zipStream);
  }
}

import { createReadStream } from 'node:fs';
import {
  Body,
  Controller,
  Get,
  HttpCode,
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
import { contentDisposition } from '../common/utils/content-disposition';
import { parseRange } from '../files/files.controller';
import { SharesService } from './shares.service';
import { createZipStream } from './zip-stream';

function getUnlockTokenFromReq(
  req: FastifyRequest,
  shareId?: string,
): string | undefined {
  // 1. Ambil dari header kustom jika ada
  const headerToken = req.headers['x-unlock-token'];
  if (typeof headerToken === 'string' && headerToken) {
    return headerToken;
  }

  // 2. Ambil dari cookie tepat galeriku_unlock_<share.id>
  if (shareId) {
    const exactCookieName = `galeriku_unlock_${shareId}`;
    const cookies = req.cookies as Record<string, string | undefined> | undefined;
    if (cookies && typeof cookies[exactCookieName] === 'string' && cookies[exactCookieName]) {
      return cookies[exactCookieName];
    }

    // Fallback parse manual cookie header jika req.cookies kosong/belum diparse
    const rawCookie = req.headers.cookie;
    if (typeof rawCookie === 'string') {
      const parts = rawCookie.split(';');
      for (const p of parts) {
        const [k, v] = p.trim().split('=');
        if (k === exactCookieName && v) {
          return decodeURIComponent(v);
        }
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
    return this.sharesService.getPublicShare(
      token,
      ip,
      userAgent,
      (shareId) => getUnlockTokenFromReq(req, shareId),
    );
  }

  @Public()
  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 5, windowMs: 60_000, keyPrefix: 'share:unlock' })
  @HttpCode(200)
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
    const thumbPath = await this.sharesService.getPublicThumbnailPath(
      token,
      fileId,
      (shareId) => getUnlockTokenFromReq(req, shareId),
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
    const thumbPath = await this.sharesService.getPublicCoverPath(
      token,
      (shareId) => getUnlockTokenFromReq(req, shareId),
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
    const { filePath, originalName, mimeType, sizeBytes } =
      await this.sharesService.getPublicFileContentInfo(
        token,
        fileId,
        isDownload,
        (shareId) => getUnlockTokenFromReq(req, shareId),
      );

    res.header('X-Content-Type-Options', 'nosniff');
    res.header('X-Robots-Tag', 'noindex, nofollow');

    if (isDownload) {
      res.header('Content-Disposition', contentDisposition(originalName));
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
    const { title, files } = await this.sharesService.getAlbumZipInfo(
      token,
      (shareId) => getUnlockTokenFromReq(req, shareId),
    );

    const safeTitle = title.replace(/[/\\?%*:|"<>]/g, '_').trim() || 'album';
    const filename = `${safeTitle}.zip`;

    res.header('Content-Type', 'application/zip');
    res.header('Content-Disposition', contentDisposition(filename));
    res.header('X-Content-Type-Options', 'nosniff');
    res.header('X-Robots-Tag', 'noindex, nofollow');

    const entries = files.map((f) => ({
      filename: f.originalName,
      getStream: () => createReadStream(f.filePath),
    }));

    const zipStream = createZipStream(entries);
    zipStream.on('error', (err) => {
      if (!res.raw.destroyed) {
        res.raw.destroy(err);
      }
    });
    return res.send(zipStream);
  }
}

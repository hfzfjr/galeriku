import { createReadStream } from 'node:fs';
import {
  Controller,
  Get,
  Param,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { PublicShareResponse } from '@galeriku/contracts';
import { Public } from '../common/decorators/public.decorator';
import { getClientIp, getUserAgent } from '../common/utils/client-ip';
import { parseRange } from '../files/files.controller';
import { SharesService } from './shares.service';

@Controller('public/s')
export class PublicSharesController {
  constructor(private readonly sharesService: SharesService) {}

  @Public()
  @Get(':token')
  async getPublicShare(
    @Param('token') token: string,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
  ): Promise<PublicShareResponse> {
    res.header('X-Robots-Tag', 'noindex, nofollow');
    const ip = getClientIp(req);
    const userAgent = getUserAgent(req);
    return this.sharesService.getPublicShare(token, ip, userAgent);
  }

  @Public()
  @Get(':token/files/:fileId/thumb')
  async getPublicThumbnail(
    @Param('token') token: string,
    @Param('fileId') fileId: string,
    @Res() res: FastifyReply,
  ): Promise<void> {
    const thumbPath = await this.sharesService.getPublicThumbnailPath(
      token,
      fileId,
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
    const share = await this.sharesService.getPublicShare(token, ip, userAgent);

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
}


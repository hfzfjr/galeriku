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
import type { FilesResponse } from '@galeriku/contracts';
import { CurrentUser, type SessionUser } from '../auth/guards/auth.guard';
import { FilesService } from './files.service';

export function parseRange(
  rangeHeader: string,
  totalSize: number,
): { start: number; end: number } | null {
  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
  if (!match) return null;

  let start: number;
  let end: number;

  const rawStart = match[1];
  const rawEnd = match[2];

  if (!rawStart && !rawEnd) return null;

  if (rawStart && rawEnd) {
    start = parseInt(rawStart, 10);
    end = parseInt(rawEnd, 10);
  } else if (rawStart) {
    start = parseInt(rawStart, 10);
    end = totalSize - 1;
  } else {
    const suffix = parseInt(rawEnd, 10);
    start = Math.max(0, totalSize - suffix);
    end = totalSize - 1;
  }

  if (isNaN(start) || isNaN(end) || start < 0 || start > end || start >= totalSize) {
    return null;
  }

  end = Math.min(end, totalSize - 1);
  return { start, end };
}

@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Get()
  async listFiles(
    @CurrentUser() user: SessionUser,
    @Query() query: Record<string, unknown>,
  ): Promise<FilesResponse> {
    return this.filesService.listFiles(user.id, query);
  }

  @Get(':id/thumb')
  async getThumbnail(
    @Param('id') id: string,
    @CurrentUser() user: SessionUser,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const thumbPath = await this.filesService.getThumbnailPath(user.id, id);
    const stream = createReadStream(thumbPath);

    reply
      .header('Content-Type', 'image/webp')
      .header('Cache-Control', 'private, max-age=86400')
      .header('X-Content-Type-Options', 'nosniff')
      .send(stream);
  }

  @Get(':id/content')
  async getFileContent(
    @Param('id') id: string,
    @CurrentUser() user: SessionUser,
    @Req() req: FastifyRequest,
    @Res() reply: FastifyReply,
    @Query('download') downloadQuery?: string,
  ): Promise<void> {
    const { filePath, originalName, mimeType, sizeBytes } =
      await this.filesService.getFileContentInfo(user.id, id);

    const isDownload = downloadQuery === '1' || downloadQuery === 'true';
    const rangeHeader = req.headers.range;

    reply
      .header('Content-Type', mimeType)
      .header('Accept-Ranges', 'bytes')
      .header('X-Content-Type-Options', 'nosniff');

    if (isDownload) {
      const sanitizedName = originalName.replace(/"/g, '');
      const encodedFilename = encodeURIComponent(originalName);
      reply.header(
        'Content-Disposition',
        `attachment; filename="${sanitizedName}"; filename*=UTF-8''${encodedFilename}`,
      );
    } else {
      reply.header('Cache-Control', 'private, max-age=86400');
    }

    if (rangeHeader && !isDownload) {
      const range = parseRange(rangeHeader, sizeBytes);
      if (!range) {
        reply
          .status(416)
          .header('Content-Range', `bytes */${sizeBytes}`)
          .send();
        return;
      }

      const { start, end } = range;
      const chunkSize = end - start + 1;
      const stream = createReadStream(filePath, { start, end });

      reply
        .status(206)
        .header('Content-Range', `bytes ${start}-${end}/${sizeBytes}`)
        .header('Content-Length', chunkSize)
        .send(stream);
      return;
    }

    reply.header('Content-Length', sizeBytes);
    const stream = createReadStream(filePath);
    reply.send(stream);
  }
}



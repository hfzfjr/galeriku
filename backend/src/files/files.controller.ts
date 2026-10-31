import { createReadStream } from 'node:fs';
import {
  Controller,
  Get,
  Param,
  Query,
  Res,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import type { FilesResponse } from '@galeriku/contracts';
import { CurrentUser, type SessionUser } from '../auth/guards/auth.guard';
import { FilesService } from './files.service';

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
}


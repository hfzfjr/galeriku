import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UsePipes,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import type {
  AddAlbumFilesRequest,
  AlbumDetail,
  AlbumItem,
  AlbumsResponse,
  CreateAlbumRequest,
  MoveAlbumRequest,
  UpdateAlbumRequest,
} from '@galeriku/contracts';
import {
  addAlbumFilesSchema,
  createAlbumSchema,
  moveAlbumSchema,
  updateAlbumSchema,
} from '@galeriku/contracts';
import { CurrentUser, type SessionUser } from '../auth/guards/auth.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { contentDisposition } from '../common/utils/content-disposition';
import { createZipStream } from '../shares/zip-stream';
import { AlbumsService } from './albums.service';

@Controller('albums')
export class AlbumsController {
  constructor(private readonly albumsService: AlbumsService) {}

  @Post()
  @UsePipes(new ZodValidationPipe(createAlbumSchema))
  async createAlbum(
    @CurrentUser() user: SessionUser,
    @Body() body: CreateAlbumRequest,
  ): Promise<AlbumItem> {
    return this.albumsService.createAlbum(user.id, body);
  }

  @Get()
  async getAlbums(
    @CurrentUser() user: SessionUser,
    @Query('parentId') parentId?: string,
  ): Promise<AlbumsResponse> {
    return this.albumsService.getAlbums(user.id, { parentId });
  }

  @Get(':id')
  async getAlbumDetail(
    @CurrentUser() user: SessionUser,
    @Param('id') albumId: string,
  ): Promise<AlbumDetail> {
    return this.albumsService.getAlbumDetail(user.id, albumId);
  }

  @Get(':id/zip')
  async downloadAlbumZip(
    @CurrentUser() user: SessionUser,
    @Param('id') albumId: string,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const { filename, entries } = await this.albumsService.getAlbumZipEntries(
      user.id,
      albumId,
    );

    reply.header('Content-Type', 'application/zip');
    reply.header('Content-Disposition', contentDisposition(filename));
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Robots-Tag', 'noindex, nofollow');

    const zipStream = createZipStream(entries);
    reply.send(zipStream);
  }

  @Patch(':id')
  @UsePipes(new ZodValidationPipe(updateAlbumSchema))
  async updateAlbum(
    @CurrentUser() user: SessionUser,
    @Param('id') albumId: string,
    @Body() body: UpdateAlbumRequest,
  ): Promise<AlbumItem> {
    return this.albumsService.updateAlbum(user.id, albumId, body);
  }

  @Post(':id/move')
  @HttpCode(200)
  @UsePipes(new ZodValidationPipe(moveAlbumSchema))
  async moveAlbum(
    @CurrentUser() user: SessionUser,
    @Param('id') albumId: string,
    @Body() body: MoveAlbumRequest,
  ): Promise<AlbumItem> {
    return this.albumsService.moveAlbum(user.id, albumId, body);
  }

  @Delete(':id')
  @HttpCode(204)
  async deleteAlbum(
    @CurrentUser() user: SessionUser,
    @Param('id') albumId: string,
    @Query('mode') mode?: 'only' | 'subtree',
  ): Promise<void> {
    await this.albumsService.deleteAlbum(user.id, albumId, mode ?? 'only');
  }

  @Post(':id/files')
  @UsePipes(new ZodValidationPipe(addAlbumFilesSchema))
  async addFiles(
    @CurrentUser() user: SessionUser,
    @Param('id') albumId: string,
    @Body() body: AddAlbumFilesRequest,
  ): Promise<AlbumDetail> {
    return this.albumsService.addFilesToAlbum(user.id, albumId, body);
  }

  @Delete(':id/files/:fileId')
  async removeFile(
    @CurrentUser() user: SessionUser,
    @Param('id') albumId: string,
    @Param('fileId') fileId: string,
  ): Promise<AlbumDetail> {
    return this.albumsService.removeFileFromAlbum(user.id, albumId, fileId);
  }
}


import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UsePipes,
} from '@nestjs/common';
import type {
  AddAlbumFilesRequest,
  AlbumDetail,
  AlbumItem,
  AlbumsResponse,
  CreateAlbumRequest,
  UpdateAlbumRequest,
} from '@galeriku/contracts';
import {
  addAlbumFilesSchema,
  createAlbumSchema,
  updateAlbumSchema,
} from '@galeriku/contracts';
import { CurrentUser, type SessionUser } from '../auth/guards/auth.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
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
  async getAlbums(@CurrentUser() user: SessionUser): Promise<AlbumsResponse> {
    return this.albumsService.getAlbums(user.id);
  }

  @Get(':id')
  async getAlbumDetail(
    @CurrentUser() user: SessionUser,
    @Param('id') albumId: string,
  ): Promise<AlbumDetail> {
    return this.albumsService.getAlbumDetail(user.id, albumId);
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

  @Delete(':id')
  @HttpCode(204)
  async deleteAlbum(
    @CurrentUser() user: SessionUser,
    @Param('id') albumId: string,
  ): Promise<void> {
    await this.albumsService.deleteAlbum(user.id, albumId);
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


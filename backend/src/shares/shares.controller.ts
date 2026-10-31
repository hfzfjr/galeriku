import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UsePipes,
} from '@nestjs/common';
import type {
  CreateShareLinkRequest,
  ShareLinkItem,
  ShareLinksResponse,
} from '@galeriku/contracts';
import { createShareLinkSchema } from '@galeriku/contracts';
import { CurrentUser, type SessionUser } from '../auth/guards/auth.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { SharesService } from './shares.service';

@Controller('shares')
export class SharesController {
  constructor(private readonly sharesService: SharesService) {}

  @Post()
  @UsePipes(new ZodValidationPipe(createShareLinkSchema))
  async createShare(
    @CurrentUser() user: SessionUser,
    @Body() body: CreateShareLinkRequest,
  ): Promise<ShareLinkItem> {
    return this.sharesService.createShare(user.id, body);
  }

  @Get()
  async getShares(@CurrentUser() user: SessionUser): Promise<ShareLinksResponse> {
    return this.sharesService.getShares(user.id);
  }

  @Get(':id')
  async getShareDetail(
    @CurrentUser() user: SessionUser,
    @Param('id') shareId: string,
  ): Promise<ShareLinkItem> {
    return this.sharesService.getShareDetail(user.id, shareId);
  }
}


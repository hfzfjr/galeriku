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
  UseGuards,
} from '@nestjs/common';
import type {
  AdminUserItem,
  AdminUsersResponse,
} from '@galeriku/contracts';
import { updateQuotaRequestSchema } from '@galeriku/contracts';
import {
  CurrentUser,
  type SessionUser,
} from '../auth/guards/auth.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { AdminService } from './admin.service';
import { AdminGuard } from './guards/admin.guard';

// Kelola pengguna dan kuota (US-12). Seluruh rute khusus ADMIN:
// tanpa sesi -> 401 (guard global), bukan ADMIN -> 403 (AdminGuard).
// Mutasi memeriksa header Origin lewat OriginGuard global.
@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('users')
  listUsers(
    @Query() query: Record<string, unknown>,
  ): Promise<AdminUsersResponse> {
    return this.admin.listUsers(query);
  }

  @Post('users/:id/suspend')
  @HttpCode(200)
  suspendUser(
    @Param('id') id: string,
    @CurrentUser() admin: SessionUser,
  ): Promise<AdminUserItem> {
    return this.admin.suspendUser(id, admin.id);
  }

  @Post('users/:id/activate')
  @HttpCode(200)
  activateUser(@Param('id') id: string): Promise<AdminUserItem> {
    return this.admin.activateUser(id);
  }

  @Patch('users/:id/quota')
  @HttpCode(200)
  updateQuota(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateQuotaRequestSchema))
    body: { quotaBytes: string },
  ): Promise<AdminUserItem> {
    return this.admin.updateQuota(id, BigInt(body.quotaBytes));
  }

  @Delete('users/:id')
  @HttpCode(204)
  async deleteUser(
    @Param('id') id: string,
    @CurrentUser() admin: SessionUser,
  ): Promise<void> {
    await this.admin.deleteUser(id, admin.id);
  }
}

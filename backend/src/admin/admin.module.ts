import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminGuard } from './guards/admin.guard';

// Satu modul per domain (US-12): kelola pengguna dan kuota.
@Module({
  controllers: [AdminController],
  providers: [AdminService, AdminGuard],
})
export class AdminModule {}

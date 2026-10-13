import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/app-config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { AccountCleanupService } from './cleanup/account-cleanup.service';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [PrismaModule, AppConfigModule, AuthModule, AdminModule],
  controllers: [AppController, HealthController],
  providers: [AppService, AccountCleanupService],
})
export class AppModule {}

import { Module } from '@nestjs/common';
import { AppConfigModule } from './app-config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { AccountCleanupService } from './cleanup/account-cleanup.service';
import { HealthController } from './health.controller';
import { PrismaModule } from './prisma.module';

@Module({
  imports: [PrismaModule, AppConfigModule, AuthModule],
  controllers: [AppController, HealthController],
  providers: [AppService, AccountCleanupService],
})
export class AppModule {}

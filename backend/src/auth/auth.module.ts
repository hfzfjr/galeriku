import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { APP_CONFIG, loadAppConfig } from '../app-config';
import { SessionAuthGuard } from './auth.guard';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LoginEmailLimitGuard } from './login-email-limit.guard';
import { OriginGuard } from './origin.guard';
import { PasswordService } from './password.service';
import { RateLimitGuard } from './rate-limit.guard';
import { RateLimitService } from './rate-limit.service';
import { SessionService } from './session.service';
import { TurnstileService } from './turnstile.service';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordService,
    SessionService,
    TurnstileService,
    RateLimitService,
    OriginGuard,
    SessionAuthGuard,
    LoginEmailLimitGuard,
    RateLimitGuard,
    { provide: APP_GUARD, useClass: OriginGuard },
    { provide: APP_GUARD, useClass: SessionAuthGuard },
    {
      provide: APP_CONFIG,
      useFactory: () => loadAppConfig(process.env),
    },
  ],
})
export class AuthModule {}

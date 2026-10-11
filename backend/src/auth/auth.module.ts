import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { MailModule } from '../mail/mail.module';
import { SessionAuthGuard } from './auth.guard';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { EmailRateLimitGuard } from './email-rate-limit.guard';
import { OriginGuard } from './origin.guard';
import { OtpService } from './otp.service';
import { PasswordService } from './password.service';
import { RateLimitGuard } from './rate-limit.guard';
import { RateLimitService } from './rate-limit.service';
import { SessionService } from './session.service';
import { TurnstileService } from './turnstile.service';

@Module({
  imports: [MailModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    OtpService,
    PasswordService,
    SessionService,
    TurnstileService,
    RateLimitService,
    OriginGuard,
    SessionAuthGuard,
    EmailRateLimitGuard,
    RateLimitGuard,
    { provide: APP_GUARD, useClass: OriginGuard },
    { provide: APP_GUARD, useClass: SessionAuthGuard },
  ],
})
export class AuthModule {}

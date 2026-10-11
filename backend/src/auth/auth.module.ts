import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { MailModule } from '../mail/mail.module';
import { SessionAuthGuard } from './guards/auth.guard';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { EmailRateLimitGuard } from '../common/rate-limit/email-rate-limit.guard';
import { OriginGuard } from '../common/guards/origin.guard';
import { OtpService } from './services/otp.service';
import { PasswordService } from './services/password.service';
import { RateLimitGuard } from '../common/rate-limit/rate-limit.guard';
import { RateLimitService } from '../common/rate-limit/rate-limit.service';
import { SessionService } from './services/session.service';
import { TurnstileService } from './services/turnstile.service';

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

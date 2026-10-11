import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { normalizeEmail } from '@galeriku/contracts';
import { ApiError } from '../errors/api-error';
import {
  EMAIL_RATE_LIMIT_KEY,
  type EmailRateLimitOptions,
} from './rate-limit-email.decorator';
import { RateLimitService } from './rate-limit.service';

// Batas per email (kunci dari body.email, mis. login:email:...).
// Dievaluasi sebelum kerja berat. Kelebihan -> 429 RATE_LIMITED +
// header Retry-After (detik).
// Body belum divalidasi zod di tahap guard: email non-string dilewati
// (batas per IP tetap berlaku, validasi menolak setelahnya).
@Injectable()
export class EmailRateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly limiter: RateLimitService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const options =
      this.reflector.getAllAndOverride<EmailRateLimitOptions>(
        EMAIL_RATE_LIMIT_KEY,
        [context.getHandler(), context.getClass()],
      );
    if (!options) {
      return true;
    }
    const http = context.switchToHttp();
    const req = http.getRequest<{ body?: unknown }>();
    const res = http.getResponse<{
      header: (name: string, value: number) => void;
    }>();
    const rawEmail = (req.body as { email?: unknown } | undefined)?.email;
    if (typeof rawEmail !== 'string' || rawEmail.length === 0) {
      return true;
    }
    const result = this.limiter.checkAndRecord(
      `${options.keyPrefix}:${normalizeEmail(rawEmail)}`,
      options.limit,
      options.windowMs,
    );
    if (!result.allowed) {
      res.header('Retry-After', result.retryAfterSec);
      throw new ApiError(
        429,
        'RATE_LIMITED',
        'Terlalu banyak percobaan. Coba lagi beberapa menit lagi.',
      );
    }
    return true;
  }
}

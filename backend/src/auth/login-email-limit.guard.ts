import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { normalizeEmail } from '@galeriku/contracts';
import { ApiError } from './api-error';
import { LOGIN_EMAIL_LIMIT } from './auth.constants';
import { RateLimitService } from './rate-limit.service';

// Batas login per email (5 per 15 menit) memakai limiter memori kecil.
// Dievaluasi sebelum Turnstile dan argon2.
// Body belum divalidasi zod di tahap guard: email non-string dilewati
// (batas per IP tetap berlaku, validasi menolak setelahnya).
@Injectable()
export class LoginEmailLimitGuard implements CanActivate {
  constructor(private readonly limiter: RateLimitService) {}

  canActivate(context: ExecutionContext): boolean {
    const http = context.switchToHttp();
    const req = http.getRequest<{ body?: unknown }>();
    const res = http.getResponse<{ header: (name: string, value: number) => void }>();
    const rawEmail = (req.body as { email?: unknown } | undefined)?.email;
    if (typeof rawEmail !== 'string' || rawEmail.length === 0) {
      return true;
    }
    const result = this.limiter.checkAndRecord(
      `login:email:${normalizeEmail(rawEmail)}`,
      LOGIN_EMAIL_LIMIT.limit,
      LOGIN_EMAIL_LIMIT.windowMs,
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

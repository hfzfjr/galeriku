import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiError } from '../errors/api-error';
import { getClientIp } from '../utils/client-ip';
import {
  RATE_LIMIT_KEY,
  type RateLimitOptions,
} from './rate-limit.decorator';
import { RateLimitService } from './rate-limit.service';

// Batas per IP klien (dipakai method-level pada register/login).
// Dievaluasi sebelum Turnstile dan argon2. Kelebihan -> 429 RATE_LIMITED
// + header Retry-After (detik).
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly limiter: RateLimitService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const options =
      this.reflector.getAllAndOverride<RateLimitOptions>(RATE_LIMIT_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);
    if (!options) {
      return true;
    }
    const http = context.switchToHttp();
    const req = http.getRequest();
    const res = http.getResponse<{
      header: (name: string, value: number) => void;
    }>();
    const result = this.limiter.checkAndRecord(
      `${options.keyPrefix}:${getClientIp(req)}`,
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

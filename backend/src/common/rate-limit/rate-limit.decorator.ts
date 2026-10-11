import { SetMetadata } from '@nestjs/common';

export type RateLimitOptions = {
  limit: number;
  windowMs: number;
  keyPrefix: string;
};

// Batas rate limit per rute untuk RateLimitGuard (per IP klien).
export const RATE_LIMIT_KEY = 'galeriku:rate-limit';

export const RateLimit = (options: RateLimitOptions) =>
  SetMetadata(RATE_LIMIT_KEY, options);

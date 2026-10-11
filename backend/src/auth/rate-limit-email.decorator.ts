import { SetMetadata } from '@nestjs/common';

export type EmailRateLimitOptions = {
  limit: number;
  windowMs: number;
  keyPrefix: string;
};

// Batas rate limit per email (kunci dari body.email) untuk guard email.
export const EMAIL_RATE_LIMIT_KEY = 'galeriku:email-rate-limit';

export const RateLimitEmail = (options: EmailRateLimitOptions) =>
  SetMetadata(EMAIL_RATE_LIMIT_KEY, options);

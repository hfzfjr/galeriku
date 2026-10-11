import type { AuthErrorCode } from '@galeriku/contracts';

// Error operasional dengan bentuk respons seragam:
// { statusCode, code, message, details? }.
export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: AuthErrorCode | 'INTERNAL_ERROR';
  readonly details?: unknown;

  constructor(
    statusCode: number,
    code: AuthErrorCode | 'INTERNAL_ERROR',
    message: string,
    details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    if (details !== undefined) {
      this.details = details;
    }
  }
}

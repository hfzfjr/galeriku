import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { APP_CONFIG, type AppConfig } from '../../config/app-config';
import { ApiError } from '../errors/api-error';
import { SESSION_COOKIE } from '../../auth/auth.constants';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// Pemeriksaan Origin global untuk request yang mengubah data.
// - Bila header Origin ada: harus persis sama dengan FRONTEND_ORIGIN.
// - Bila tidak ada: izinkan hanya bila request tidak membawa cookie sesi
//   (klien non-browser seperti curl; browser selalu mengirim Origin).
@Injectable()
export class OriginGuard implements CanActivate {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<FastifyRequest>();
    const method = (req.method ?? 'GET').toUpperCase();
    if (!MUTATING_METHODS.has(method)) {
      return true;
    }
    const origin = req.headers.origin;
    if (typeof origin === 'string' && origin.length > 0) {
      if (origin !== this.config.frontendOrigin) {
        throw new ApiError(
          403,
          'FORBIDDEN_ORIGIN',
          'Request ditolak karena origin tidak dikenal.',
        );
      }
      return true;
    }
    const cookies = req.cookies as
      | Record<string, string | undefined>
      | undefined;
    if (cookies?.[SESSION_COOKIE]) {
      throw new ApiError(
        403,
        'FORBIDDEN_ORIGIN',
        'Request ditolak karena origin tidak dikenal.',
      );
    }
    return true;
  }
}

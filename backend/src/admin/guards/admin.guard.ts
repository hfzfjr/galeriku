import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Role } from '../../generated/prisma/client';
import { ApiError } from '../../common/errors/api-error';
import type { AuthenticatedRequest } from '../../auth/guards/auth.guard';

// Penegakan peran ADMIN di backend (US-12, default deny). Berjalan setelah
// guard global: SessionAuthGuard (sesi + status) dan OriginGuard.
// Tanpa sesi -> 401; sesi valid tapi bukan ADMIN -> 403.
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = req.authUser;
    if (!user) {
      throw new ApiError(
        401,
        'UNAUTHENTICATED',
        'Masuk dulu untuk melanjutkan.',
      );
    }
    if (user.role !== Role.ADMIN) {
      throw new ApiError(
        403,
        'FORBIDDEN',
        'Kamu tidak punya akses ke halaman ini.',
      );
    }
    return true;
  }
}

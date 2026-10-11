import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  createParamDecorator,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import { APP_CONFIG, type AppConfig } from '../app-config';
import { UserStatus } from '../generated/prisma/client';
import { PrismaService } from '../prisma.service';
import { ApiError } from './api-error';
import { SESSION_COOKIE } from './auth.constants';
import { IS_PUBLIC_KEY } from './public.decorator';
import { hashSessionToken, SessionService } from './session.service';

export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  role: string;
  status: string;
  quotaBytes: bigint;
  emailVerifiedAt: Date | null;
};

export type AuthenticatedRequest = FastifyRequest & {
  authUser?: SessionUser;
};

function unauthenticated(): ApiError {
  return new ApiError(401, 'UNAUTHENTICATED', 'Masuk dulu untuk melanjutkan.');
}

function suspended(contactEmail: string | undefined): ApiError {
  return new ApiError(
    403,
    'ACCOUNT_SUSPENDED',
    contactEmail
      ? `Akunmu sedang ditangguhkan. Hubungi admin lewat ${contactEmail}.`
      : 'Akunmu sedang ditangguhkan. Hubungi admin.',
    contactEmail ? { contactEmail } : undefined,
  );
}

// Guard autentikasi global (default-deny): semua rute dilindungi kecuali
// yang ditandai @Public(). Membaca cookie sesi, memuat user, menolak bila
// sesi tak ada/kedaluwarsa, dan mencabut sesi bila user SUSPENDED.
@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(
      IS_PUBLIC_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (isPublic) {
      return true;
    }
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = req.cookies?.[SESSION_COOKIE];
    if (typeof token !== 'string' || token.length === 0) {
      throw unauthenticated();
    }
    const session = await this.sessions.findValidSession(
      hashSessionToken(token),
    );
    if (!session) {
      throw unauthenticated();
    }
    const user = await this.prisma.user.findUnique({
      where: { id: session.userId },
    });
    if (!user) {
      await this.sessions.revokeSession(session.id);
      throw unauthenticated();
    }
    if (user.status === UserStatus.SUSPENDED) {
      await this.sessions.revokeSession(session.id);
      throw suspended(this.config.contactEmail);
    }
    req.authUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      role: user.role,
      status: user.status,
      quotaBytes: user.quotaBytes,
      emailVerifiedAt: user.emailVerifiedAt,
    };
    return true;
  }
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): SessionUser => {
    const req =
      context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!req.authUser) {
      throw unauthenticated();
    }
    return req.authUser;
  },
);

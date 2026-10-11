import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { SESSION_TTL_MS } from '../auth.constants';

// Token sesi 32 byte acak (base64url). Yang disimpan di DB hanyalah
// SHA-256 hex dari token; token mentah tidak pernah disimpan.
export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export type CreatedSession = {
  id: string;
  token: string;
  expiresAt: Date;
};

@Injectable()
export class SessionService {
  constructor(private readonly prisma: PrismaService) {}

  async createSession(
    userId: string,
    ipHash: string,
    userAgent: string,
  ): Promise<CreatedSession> {
    const token = randomBytes(32).toString('base64url');
    const id = hashSessionToken(token);
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    await this.prisma.session.create({
      data: { id, userId, expiresAt, ipHash, userAgent },
    });
    return { id, token, expiresAt };
  }

  // Sesi kedaluwarsa dihapus saat ditemukan (lazy).
  async findValidSession(id: string) {
    const session = await this.prisma.session.findUnique({ where: { id } });
    if (!session) {
      return null;
    }
    if (session.expiresAt.getTime() <= Date.now()) {
      await this.prisma.session.deleteMany({ where: { id } });
      return null;
    }
    return session;
  }

  async revokeSession(id: string): Promise<void> {
    await this.prisma.session.deleteMany({ where: { id } });
  }

  async revokeUserSessions(userId: string): Promise<void> {
    await this.prisma.session.deleteMany({ where: { userId } });
  }
}

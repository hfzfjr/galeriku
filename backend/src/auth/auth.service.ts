import { Inject, Injectable } from '@nestjs/common';
import type {
  LoginRequest,
  MeResponse,
  RegisterRequest,
  RegisterResponse,
} from '@galeriku/contracts';
import { APP_CONFIG, type AppConfig } from '../app-config';
import { Role, UserStatus } from '../generated/prisma/client';
import { PrismaService } from '../prisma.service';
import { ApiError } from './api-error';
import { hashIp } from './client-ip';
import { PasswordService } from './password.service';
import { hashSessionToken, SessionService } from './session.service';
import { TurnstileService } from './turnstile.service';

export type SessionUserRow = {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  role: string;
  status: string;
  quotaBytes: bigint;
  emailVerifiedAt: Date | null;
};

// BigInt tidak boleh dikirim mentah di JSON: selalu string.
export function toMeResponse(user: SessionUserRow): MeResponse {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    role: user.role,
    status: user.status,
    quotaBytes: user.quotaBytes.toString(),
    emailVerifiedAt: user.emailVerifiedAt
      ? user.emailVerifiedAt.toISOString()
      : null,
  };
}

function accountSuspended(contactEmail: string | undefined): ApiError {
  return new ApiError(
    403,
    'ACCOUNT_SUSPENDED',
    contactEmail
      ? `Akunmu sedang ditangguhkan. Hubungi admin lewat ${contactEmail}.`
      : 'Akunmu sedang ditangguhkan. Hubungi admin.',
    contactEmail ? { contactEmail } : undefined,
  );
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionService,
    private readonly turnstile: TurnstileService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async register(
    input: RegisterRequest,
    clientIp: string,
  ): Promise<RegisterResponse> {
    await this.turnstile.verify(input.turnstileToken, clientIp);
    const existing = await this.prisma.user.findUnique({
      where: { email: input.email },
    });
    const passwordHash = await this.passwords.hashPassword(input.password);
    if (existing) {
      if (existing.emailVerifiedAt !== null) {
        throw new ApiError(
          409,
          'EMAIL_TAKEN',
          'Email ini sudah terdaftar. Masuk atau atur ulang password.',
        );
      }
      // Email terdaftar tapi belum terverifikasi: timpa akun itu
      // (nama, hash baru, created_at diperbarui; kode dan sesi lama
      // dihapus; tanpa mewarisi apa pun, peran tetap USER).
      await this.prisma.emailCode.deleteMany({
        where: { email: existing.email },
      });
      await this.sessions.revokeUserSessions(existing.id);
      await this.prisma.user.update({
        where: { id: existing.id },
        data: {
          name: input.name,
          passwordHash,
          role: Role.USER,
          status: UserStatus.ACTIVE,
          createdAt: new Date(),
        },
      });
      return { email: existing.email, needsVerification: true };
    }
    // US-09: peran SELALU USER. ADMIN_EMAIL hanya dibaca ke konfigurasi
    // dan dipakai penetapan peran di US-09b setelah verifikasi.
    await this.prisma.user.create({
      data: {
        email: input.email,
        name: input.name,
        passwordHash,
        role: Role.USER,
        status: UserStatus.ACTIVE,
        quotaBytes: this.config.defaultQuotaBytes,
      },
    });
    return { email: input.email, needsVerification: true };
  }

  async login(
    input: LoginRequest,
    clientIp: string,
    userAgent: string,
  ): Promise<{ me: MeResponse; token: string }> {
    await this.turnstile.verify(input.turnstileToken, clientIp);
    const user = await this.prisma.user.findUnique({
      where: { email: input.email },
    });
    // Selalu verifikasi argon2 (hash dummy bila email tak ada) agar waktu
    // respons tak membocorkan keberadaan email. Status dan body 401 di
    // bawah IDENTIK untuk kedua kasus.
    const passwordOk = user
      ? await this.passwords.verifyPassword(
          user.passwordHash ?? '',
          input.password,
        )
      : await this.passwords.verifyUnknownEmail(input.password);
    if (!user || !passwordOk) {
      throw new ApiError(
        401,
        'INVALID_CREDENTIALS',
        'Email atau password tidak cocok.',
      );
    }
    // Hanya bila password benar status akun diperiksa.
    if (user.status === UserStatus.SUSPENDED) {
      throw accountSuspended(this.config.contactEmail);
    }
    if (user.emailVerifiedAt === null) {
      throw new ApiError(
        403,
        'EMAIL_NOT_VERIFIED',
        'Email kamu belum diverifikasi. Masukkan kode yang kami kirim.',
        { email: user.email },
      );
    }
    const session = await this.sessions.createSession(
      user.id,
      hashIp(clientIp, this.config.ipHashSecret),
      userAgent,
    );
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    return { me: toMeResponse(updated), token: session.token };
  }

  async logout(token: string | undefined): Promise<void> {
    if (typeof token === 'string' && token.length > 0) {
      await this.sessions.revokeSession(hashSessionToken(token));
    }
  }
}

import { Inject, Injectable, Logger } from '@nestjs/common';
import type {
  AcceptedResponse,
  ForgotPasswordRequest,
  LoginRequest,
  MeResponse,
  RegisterRequest,
  RegisterResponse,
  ResendCodeRequest,
  ResetPasswordRequest,
  VerifyEmailRequest,
} from '@galeriku/contracts';
import { APP_CONFIG, type AppConfig } from '../app-config';
import { EmailCodeKind, Role, UserStatus } from '../generated/prisma/client';
import { PrismaService } from '../prisma.service';
import { MAIL_SERVICE, type MailSender } from '../mail/mail.service';
import {
  resetPasswordTemplate,
  verifyEmailTemplate,
} from '../mail/templates';
import type { MailKind } from '../mail/mail.service';
import { ApiError } from './api-error';
import { RESEND_WINDOW_MS } from './auth.constants';
import { hashIp } from './client-ip';
import { OtpService } from './otp.service';
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

function invalidCode(): ApiError {
  // Satu kode untuk SEMUA kegagalan kode (salah, kedaluwarsa, hangus,
  // tidak ada, email tak dikenal) agar tak membocorkan apa pun.
  return new ApiError(
    400,
    'INVALID_CODE',
    'Kode salah atau sudah tidak berlaku. Minta kode baru jika perlu.',
  );
}

const ACCEPTED: AcceptedResponse = { accepted: true };

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionService,
    private readonly turnstile: TurnstileService,
    private readonly otp: OtpService,
    @Inject(MAIL_SERVICE) private readonly mail: MailSender,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  // Kirim email OTP; kegagalan TIDAK menggagalkan respons (dicatat tanpa
  // PII: tanpa kode, email, kunci, atau isi body).
  private async sendMailSafe(
    kind: MailKind,
    email: string,
    code: string,
    konteks: string,
  ): Promise<void> {
    const template =
      kind === 'verify-email'
        ? verifyEmailTemplate(code, this.config.contactEmail)
        : resetPasswordTemplate(code, this.config.contactEmail);
    try {
      await this.mail.send({
        to: email,
        subject: template.subject,
        text: template.text,
        html: template.html,
        kind,
        code,
      });
    } catch {
      this.logger.warn(
        `Gagal mengirim email ${kind} (${konteks} tetap berhasil)`,
      );
    }
  }

  async register(
    input: RegisterRequest,
    clientIp: string,
  ): Promise<RegisterResponse> {
    await this.turnstile.verify(input.turnstileToken, clientIp);
    const existing = await this.prisma.user.findUnique({
      where: { email: input.email },
    });
    const passwordHash = await this.passwords.hashPassword(input.password);
    let email: string;
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
      email = existing.email;
    } else {
      // US-09: peran SELALU USER. ADMIN_EMAIL hanya dibaca ke konfigurasi
      // dan dipakai penetapan peran di bawah setelah verifikasi.
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
      email = input.email;
    }
    const code = await this.otp.issueCode(
      email,
      EmailCodeKind.VERIFY_EMAIL,
    );
    await this.sendMailSafe('verify-email', email, code, 'pendaftaran');
    return { email, needsVerification: true };
  }

  async verifyEmail(
    input: VerifyEmailRequest,
    clientIp: string,
    userAgent: string,
  ): Promise<{ me: MeResponse; token: string }> {
    if ((await this.otp.consumeCode(input.email, EmailCodeKind.VERIFY_EMAIL, input.code)) !== 'ok') {
      throw invalidCode();
    }
    const user = await this.prisma.user.findUnique({
      where: { email: input.email },
    });
    if (
      !user ||
      user.status !== UserStatus.ACTIVE ||
      user.emailVerifiedAt !== null
    ) {
      throw invalidCode();
    }
    // ADMIN hanya di sini, SETELAH verifikasi. Email dibandingkan
    // lowercase (keduanya sudah ternormalisasi).
    const adminEmail = this.config.adminEmail;
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerifiedAt: new Date(),
        role: adminEmail && user.email === adminEmail ? Role.ADMIN : user.role,
        lastLoginAt: new Date(),
      },
    });
    const session = await this.sessions.createSession(
      user.id,
      hashIp(clientIp, this.config.ipHashSecret),
      userAgent,
    );
    return { me: toMeResponse(updated), token: session.token };
  }

  async resendCode(input: ResendCodeRequest): Promise<AcceptedResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email },
    });
    if (
      !user ||
      user.emailVerifiedAt !== null ||
      user.status !== UserStatus.ACTIVE
    ) {
      // Respons identik; tidak ada yang berubah (tanpa bocoran).
      return { ...ACCEPTED };
    }
    const existing = await this.prisma.emailCode.findFirst({
      where: { email: input.email, kind: EmailCodeKind.VERIFY_EMAIL },
    });
    if (
      existing &&
      Date.now() - existing.lastSentAt.getTime() < RESEND_WINDOW_MS
    ) {
      // Masih dalam jeda 60 detik: pengiriman dilewati diam-diam.
      return { ...ACCEPTED };
    }
    const code = await this.otp.issueCode(
      input.email,
      EmailCodeKind.VERIFY_EMAIL,
    );
    // Latar belakang agar waktu respons identik untuk semua input.
    void this.sendMailSafe(
      'verify-email',
      input.email,
      code,
      'kirim ulang',
    );
    return { ...ACCEPTED };
  }

  async forgotPassword(
    input: ForgotPasswordRequest,
    clientIp: string,
  ): Promise<AcceptedResponse> {
    await this.turnstile.verify(input.turnstileToken, clientIp);
    const user = await this.prisma.user.findUnique({
      where: { email: input.email },
    });
    if (
      user &&
      user.status === UserStatus.ACTIVE &&
      user.emailVerifiedAt !== null
    ) {
      const existing = await this.prisma.emailCode.findFirst({
        where: { email: input.email, kind: EmailCodeKind.RESET_PASSWORD },
      });
      if (
        !existing ||
        Date.now() - existing.lastSentAt.getTime() >= RESEND_WINDOW_MS
      ) {
        const code = await this.otp.issueCode(
          input.email,
          EmailCodeKind.RESET_PASSWORD,
        );
        // Latar belakang (tanpa await): waktu respons tak membedakan
        // email ada atau tidak. Error ditangkap di sendMailSafe.
        void this.sendMailSafe(
          'reset-password',
          input.email,
          code,
          'lupa password',
        );
      }
    }
    return { ...ACCEPTED };
  }

  async resetPassword(input: ResetPasswordRequest): Promise<void> {
    if (
      (await this.otp.consumeCode(
        input.email,
        EmailCodeKind.RESET_PASSWORD,
        input.code,
      )) !== 'ok'
    ) {
      throw invalidCode();
    }
    const user = await this.prisma.user.findUnique({
      where: { email: input.email },
    });
    if (
      !user ||
      user.status !== UserStatus.ACTIVE ||
      user.emailVerifiedAt === null
    ) {
      throw invalidCode();
    }
    const passwordHash = await this.passwords.hashPassword(input.newPassword);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });
    // Semua sesi dicabut; sesi baru TIDAK dibuat (masuk lagi manual).
    await this.sessions.revokeUserSessions(user.id);
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

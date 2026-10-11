import { Inject, Injectable } from '@nestjs/common';
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { APP_CONFIG, type AppConfig } from '../../config/app-config';
import { EmailCodeKind } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export const OTP_TTL_MS = 10 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;
export const RESEND_WINDOW_MS = 60 * 1000;

// Hash HMAC-SHA256 dengan kunci yang sama seperti hash IP; pemisahan
// lewat awalan konteks "otp:<kind>:<email>:<code>".
export function hashOtpCode(
  secret: string,
  kind: EmailCodeKind,
  email: string,
  code: string,
): Buffer {
  return createHmac('sha256', secret)
    .update(`otp:${kind}:${email}:${code}`, 'utf8')
    .digest();
}

// Hash pembanding dummy agar jalur email-tanpa-kode berbiaya wajar sama.
const DUMMY_OTP_HASH = Buffer.alloc(32, 7);

@Injectable()
export class OtpService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  private hash(kind: EmailCodeKind, email: string, code: string): string {
    return hashOtpCode(this.config.ipHashSecret, kind, email, code).toString(
      'hex',
    );
  }

  // Membuat kode baru (menghapus yang lama untuk pasangan email+kind).
  // Hanya hash yang disimpan; kode mentah dikembalikan untuk dikirim.
  async issueCode(email: string, kind: EmailCodeKind): Promise<string> {
    await this.prisma.emailCode.deleteMany({ where: { email, kind } });
    const code = String(randomInt(0, 1000000)).padStart(6, '0');
    const now = new Date();
    await this.prisma.emailCode.create({
      data: {
        email,
        kind,
        codeHash: this.hash(kind, email, code),
        expiresAt: new Date(now.getTime() + OTP_TTL_MS),
        attempts: 0,
        lastSentAt: now,
      },
    });
    return code;
  }

  // Memakai kode: 'ok' bila cocok dan berlaku (baris dihapus),
  // 'invalid' untuk semua kegagalan lain (salah, kedaluwarsa, hangus,
  // tidak ada). Percobaan salah menaikkan attempts; yang ke-5
  // menghanguskan kode (baris dihapus).
  async consumeCode(
    email: string,
    kind: EmailCodeKind,
    code: string,
  ): Promise<'ok' | 'invalid'> {
    const row = await this.prisma.emailCode.findFirst({
      where: { email, kind },
    });
    const candidate = hashOtpCode(
      this.config.ipHashSecret,
      kind,
      email,
      code,
    );
    if (!row) {
      timingSafeEqual(candidate, DUMMY_OTP_HASH);
      return 'invalid';
    }
    if (row.expiresAt.getTime() <= Date.now()) {
      await this.prisma.emailCode.deleteMany({
        where: { email, kind },
      });
      return 'invalid';
    }
    const expected = Buffer.from(row.codeHash, 'hex');
    const match =
      expected.length === candidate.length &&
      timingSafeEqual(expected, candidate);
    if (!match) {
      if (row.attempts + 1 >= OTP_MAX_ATTEMPTS) {
        await this.prisma.emailCode.deleteMany({
          where: { email, kind },
        });
      } else {
        await this.prisma.emailCode.update({
          where: { id: row.id },
          data: { attempts: row.attempts + 1 },
        });
      }
      return 'invalid';
    }
    await this.prisma.emailCode.deleteMany({ where: { email, kind } });
    return 'ok';
  }
}

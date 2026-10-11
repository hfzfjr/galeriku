import { loadAppConfig } from '../../config/app-config';
import type { PrismaService } from '../../prisma/prisma.service';
import { OtpService, hashOtpCode } from './otp.service';

const CONFIG = loadAppConfig({
  NODE_ENV: 'test',
  FRONTEND_ORIGIN: 'https://galeriku.hafizfajar.com',
  TURNSTILE_SECRET_KEY: 'kunci-uji',
  IP_HASH_SECRET: 'rahasia-uji-minimal-32-karakter-xxxx',
});

// Fake prisma minimal (objek polos) untuk OtpService.
function fakePrisma() {
  const rows: Array<Record<string, unknown>> = [];
  const emailCode = {
    deleteMany: async () => {
      const n = rows.length;
      rows.length = 0;
      return { count: n };
    },
    create: async ({ data }: { data: Record<string, unknown> }) => {
      const row = { id: `c-${rows.length + 1}`, ...data };
      rows.push(row);
      return { ...row };
    },
    findFirst: async () => {
      const row = rows[0];
      return row ? { ...row } : null;
    },
    update: async ({
      data,
    }: {
      where: unknown;
      data: Record<string, unknown>;
    }) => {
      const row = rows[0] as Record<string, unknown>;
      Object.assign(row, data);
      return { ...row };
    },
  };
  return { rows, emailCode };
}

function buatOtp(prisma: ReturnType<typeof fakePrisma>) {
  return new OtpService(
    prisma as unknown as PrismaService,
    CONFIG,
  );
}

describe('OtpService', () => {
  it('hanya hash yang disimpan, bukan kode mentah', async () => {
    const prisma = fakePrisma();
    const code = await buatOtp(prisma).issueCode(
      'saya@contoh.id',
      'VERIFY_EMAIL',
    );
    expect(code).toMatch(/^\d{6}$/);
    expect(prisma.rows).toHaveLength(1);
    const row = prisma.rows[0] as Record<string, unknown>;
    expect(row.codeHash).toBe(
      hashOtpCode(
        CONFIG.ipHashSecret,
        'VERIFY_EMAIL',
        'saya@contoh.id',
        code,
      ).toString('hex'),
    );
    expect(JSON.stringify(row)).not.toContain(`"${code}"`);
    expect(row.attempts).toBe(0);
  });

  it('salah menaikkan attempts, ke-5 menghanguskan', async () => {
    const prisma = fakePrisma();
    const otp = buatOtp(prisma);
    const code = await otp.issueCode('saya@contoh.id', 'VERIFY_EMAIL');
    const salah = code === '000000' ? '000001' : '000000';
    for (let i = 1; i <= 4; i += 1) {
      expect(
        await otp.consumeCode('saya@contoh.id', 'VERIFY_EMAIL', salah),
      ).toBe('invalid');
      expect(prisma.rows[0]?.attempts).toBe(i);
    }
    expect(
      await otp.consumeCode('saya@contoh.id', 'VERIFY_EMAIL', salah),
    ).toBe('invalid');
    expect(prisma.rows).toHaveLength(0);
    // Kode benar sesudahnya tetap invalid (sudah hangus).
    expect(
      await otp.consumeCode('saya@contoh.id', 'VERIFY_EMAIL', code),
    ).toBe('invalid');
  });

  it('kedaluwarsa invalid dan baris dibersihkan', async () => {
    const prisma = fakePrisma();
    const otp = buatOtp(prisma);
    const code = await otp.issueCode('saya@contoh.id', 'VERIFY_EMAIL');
    (prisma.rows[0] as Record<string, unknown>).expiresAt = new Date(
      Date.now() - 1000,
    );
    expect(
      await otp.consumeCode('saya@contoh.id', 'VERIFY_EMAIL', code),
    ).toBe('invalid');
    expect(prisma.rows).toHaveLength(0);
  });

  it('sukses menghapus baris; email tanpa kode invalid', async () => {
    const prisma = fakePrisma();
    const otp = buatOtp(prisma);
    const code = await otp.issueCode('saya@contoh.id', 'VERIFY_EMAIL');
    expect(
      await otp.consumeCode('saya@contoh.id', 'VERIFY_EMAIL', code),
    ).toBe('ok');
    expect(prisma.rows).toHaveLength(0);
    expect(
      await otp.consumeCode('tak-ada@contoh.id', 'VERIFY_EMAIL', '123456'),
    ).toBe('invalid');
  });
});

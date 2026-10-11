import { appConfigSchema, loadAppConfig } from './app-config';

const BASE_ENV: NodeJS.ProcessEnv = {
  NODE_ENV: 'test',
  FRONTEND_ORIGIN: 'https://galeriku.hafizfajar.com',
  TURNSTILE_SECRET_KEY: 'kunci-uji-dummy',
  IP_HASH_SECRET: 'rahasia-ip-hash-minimal-32-karakter',
};

describe('loadAppConfig', () => {
  it('memakai default aman di non-produksi', () => {
    const config = loadAppConfig({ ...BASE_ENV });
    expect(config.isProduction).toBe(false);
    expect(config.frontendOrigin).toBe('https://galeriku.hafizfajar.com');
    expect(config.defaultQuotaBytes).toBe(5368709120n);
    expect(config.adminEmail).toBeUndefined();
    expect(config.contactEmail).toBeUndefined();
  });

  it('memotong slash dan lowercase admin email', () => {
    const config = loadAppConfig({
      ...BASE_ENV,
      FRONTEND_ORIGIN: 'https://galeriku.hafizfajar.com///',
      ADMIN_EMAIL: '  Admin@Contoh.ID ',
      CONTACT_EMAIL: 'admin@contoh.id',
      DEFAULT_QUOTA_BYTES: '123',
    });
    expect(config.frontendOrigin).toBe('https://galeriku.hafizfajar.com');
    expect(config.adminEmail).toBe('admin@contoh.id');
    expect(config.contactEmail).toBe('admin@contoh.id');
    expect(config.defaultQuotaBytes).toBe(123n);
  });

  it('gagal cepat di produksi bila wajib kurang', () => {
    expect(() =>
      loadAppConfig({ NODE_ENV: 'production' } as NodeJS.ProcessEnv),
    ).toThrow('FRONTEND_ORIGIN');
    expect(() =>
      loadAppConfig({
        NODE_ENV: 'production',
        FRONTEND_ORIGIN: 'https://x.example',
      } as NodeJS.ProcessEnv),
    ).toThrow('ADMIN_EMAIL');
  });

  it('menolak kuota bukan angka dan secret pendek', () => {
    expect(() =>
      loadAppConfig({ ...BASE_ENV, DEFAULT_QUOTA_BYTES: 'lima' }),
    ).toThrow('DEFAULT_QUOTA_BYTES');
    expect(() =>
      loadAppConfig({ ...BASE_ENV, DEFAULT_QUOTA_BYTES: '0' }),
    ).toThrow('DEFAULT_QUOTA_BYTES');
    expect(() =>
      loadAppConfig({ ...BASE_ENV, IP_HASH_SECRET: 'pendek' }),
    ).toThrow('IP_HASH_SECRET');
    expect(() => loadAppConfig({ ...BASE_ENV, CONTACT_EMAIL: 'salah' })).toThrow(
      'CONTACT_EMAIL',
    );
  });

  it('TURNSTILE_SECRET_KEY selalu wajib', () => {
    const { TURNSTILE_SECRET_KEY: _drop, ...rest } = BASE_ENV;
    expect(() => loadAppConfig(rest)).toThrow('TURNSTILE_SECRET_KEY');
  });

  it('skema contoh tetap valid', () => {
    const config = loadAppConfig({ ...BASE_ENV });
    expect(() =>
      appConfigSchema.parse({
        frontendOrigin: config.frontendOrigin,
        defaultQuotaBytes: config.defaultQuotaBytes,
        ipHashSecret: config.ipHashSecret,
        turnstileSecretKey: config.turnstileSecretKey,
        mailProvider: config.mailProvider,
        mailFrom: config.mailFrom,
      }),
    ).not.toThrow();
  });

  it('aturan MAIL_PROVIDER: default log, resend butuh kunci+from', () => {
    expect(loadAppConfig({ ...BASE_ENV }).mailProvider).toBe('log');
    expect(
      loadAppConfig({
        ...BASE_ENV,
        MAIL_PROVIDER: 'resend',
        MAIL_API_KEY: 'kunci-uji',
        MAIL_FROM: 'Galeriku <noreply@contoh.id>',
      }).mailProvider,
    ).toBe('resend');
    expect(() =>
      loadAppConfig({ ...BASE_ENV, MAIL_PROVIDER: 'pos' }),
    ).toThrow('MAIL_PROVIDER');
    expect(() =>
      loadAppConfig({ ...BASE_ENV, MAIL_PROVIDER: 'resend' }),
    ).toThrow('MAIL_FROM');
  });

  it('produksi menolak log dan mewajibkan kunci+from', () => {
    const prod = {
      NODE_ENV: 'production',
      FRONTEND_ORIGIN: 'https://galeriku.hafizfajar.com',
      ADMIN_EMAIL: 'admin@contoh.id',
      IP_HASH_SECRET: 'rahasia-ip-hash-minimal-32-karakter',
      TURNSTILE_SECRET_KEY: 'kunci-uji',
    } as NodeJS.ProcessEnv;
    expect(() => loadAppConfig({ ...prod, MAIL_PROVIDER: 'log' })).toThrow(
      'MAIL_PROVIDER wajib resend',
    );
    expect(() => loadAppConfig({ ...prod })).toThrow(
      'MAIL_PROVIDER wajib resend',
    );
    expect(() =>
      loadAppConfig({
        ...prod,
        MAIL_PROVIDER: 'resend',
        MAIL_API_KEY: 'kunci-uji',
      }),
    ).toThrow('MAIL_FROM');
  });
});

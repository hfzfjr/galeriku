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
      }),
    ).not.toThrow();
  });
});

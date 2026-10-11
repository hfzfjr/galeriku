import { PasswordService } from './password.service';

describe('PasswordService', () => {
  const service = new PasswordService();

  it('hash lalu verifikasi benar, salah ditolak', async () => {
    const hash = await service.hashPassword('kata-sandi-yang-benar');
    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(hash).toContain('m=19456,t=2,p=1');
    expect(await service.verifyPassword(hash, 'kata-sandi-yang-benar')).toBe(
      true,
    );
    expect(await service.verifyPassword(hash, 'kata-sandi-yang-salah')).toBe(
      false,
    );
  });

  it('hash rusak dianggap salah, email tak dikenal selalu false', async () => {
    expect(await service.verifyPassword('bukan-hash', 'apa-saja')).toBe(false);
    expect(await service.verifyUnknownEmail('apa-saja')).toBe(false);
  });
});

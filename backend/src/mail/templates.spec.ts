import {
  resetPasswordTemplate,
  verifyEmailTemplate,
} from './templates';

describe('template verifikasi', () => {
  it('subjek, kode, masa berlaku, dan abaikan bila tak mendaftar', () => {
    const tpl = verifyEmailTemplate('482910', 'admin@contoh.id');
    expect(tpl.subject).toBe('Kode verifikasi Galeriku');
    for (const bagian of [tpl.text, tpl.html]) {
      expect(bagian).toContain('482910');
      expect(bagian).toContain('10 menit');
      expect(bagian).toContain('Jangan bagikan');
      expect(bagian).toContain('abaikan email ini');
      expect(bagian).toContain('admin@contoh.id');
    }
    expect(tpl.html).not.toMatch(/gradient/i);
  });

  it('tanpa baris kontak bila CONTACT_EMAIL kosong', () => {
    const tpl = verifyEmailTemplate('482910', undefined);
    expect(tpl.text).not.toContain('Hubungi');
    expect(tpl.html).not.toContain('Hubungi');
  });
});

describe('template reset', () => {
  it('subjek dan kalimat password tetap aman', () => {
    const tpl = resetPasswordTemplate('123456', undefined);
    expect(tpl.subject).toBe('Kode atur ulang password Galeriku');
    expect(tpl.text).toContain('mengatur ulang password-mu');
    expect(tpl.text).toContain('password-mu tetap aman');
    expect(tpl.html).toContain('123456');
  });
});

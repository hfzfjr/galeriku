import { contentDisposition } from './content-disposition';

describe('contentDisposition (RFC 6266 / RF-02)', () => {
  it('nama file ASCII standar', () => {
    const res = contentDisposition('liburan.jpg');
    expect(res).toBe('attachment; filename="liburan.jpg"; filename*=UTF-8\'\'liburan.jpg');
  });

  it('nama file dengan spasi', () => {
    const res = contentDisposition('foto liburan bromo.jpg');
    expect(res).toBe('attachment; filename="foto liburan bromo.jpg"; filename*=UTF-8\'\'foto%20liburan%20bromo.jpg');
  });

  it('nama file dengan karakter non-ASCII dan emoji', () => {
    const res = contentDisposition('foto 🌅 bromo.jpg');
    expect(res).toContain('filename*=UTF-8\'\'foto%20%F0%9F%8C%85%20bromo.jpg');
    // Fallback ASCII tidak boleh memuat karakter non-ASCII
    const match = res.match(/filename="([^"]+)"/);
    expect(match).toBeTruthy();
    expect(/^[ -~]+$/.test(match![1])).toBe(true);
  });

  it('nama file dengan tanda kutip ganda dan backslash dibersihkan dari fallback', () => {
    const res = contentDisposition('foto"jahat\\nama.jpg');
    expect(res).toContain('filename="foto_jahat_nama.jpg"');
    expect(res).toContain('filename*=UTF-8\'\'foto%22jahat%5Cnama.jpg');
  });

  it('fallback jika nama kosong', () => {
    const res = contentDisposition('');
    expect(res).toBe('attachment; filename="berkas"; filename*=UTF-8\'\'berkas');
  });

  it('mendukung type inline', () => {
    const res = contentDisposition('dokumen.pdf', 'inline');
    expect(res).toBe('inline; filename="dokumen.pdf"; filename*=UTF-8\'\'dokumen.pdf');
  });
});


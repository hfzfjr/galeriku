import { getClientIp, getUserAgent, hashIp } from './client-ip';

describe('getClientIp', () => {
  it('mengutamakan header cf-connecting-ip', () => {
    expect(
      getClientIp({
        headers: { 'cf-connecting-ip': '203.0.113.7' },
        ip: '127.0.0.1',
      }),
    ).toBe('203.0.113.7');
  });

  it('mengambil IP pertama bila header berisi daftar', () => {
    expect(
      getClientIp({ headers: { 'cf-connecting-ip': '203.0.113.7, 70.0.0.1' } }),
    ).toBe('203.0.113.7');
  });

  it('jatuh ke IP socket bila header tidak ada', () => {
    expect(getClientIp({ headers: {}, ip: '127.0.0.1' })).toBe('127.0.0.1');
  });

  it('unknown bila tidak ada informasi IP', () => {
    expect(getClientIp({ headers: {} })).toBe('unknown');
  });
});

describe('getUserAgent', () => {
  it('memotong maksimal 255 karakter', () => {
    expect(getUserAgent({ headers: { 'user-agent': 'x'.repeat(300) } })).toHaveLength(
      255,
    );
  });

  it('string kosong bila tidak ada header', () => {
    expect(getUserAgent({ headers: {} })).toBe('');
  });
});

describe('hashIp', () => {
  it('deterministik 64 heks dan beda per secret', () => {
    const a = hashIp('203.0.113.7', 'rahasia-satu-minimal-32-karakter-xx');
    const b = hashIp('203.0.113.7', 'rahasia-satu-minimal-32-karakter-xx');
    const c = hashIp('203.0.113.7', 'rahasia-dua-minimal-32-karakter-xxx');
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toBe(c);
    expect(a).not.toContain('203.0.113.7');
  });
});

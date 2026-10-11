import {
  LogMailService,
  ResendMailService,
  type MailInput,
} from './mail.service';

const INPUT: MailInput = {
  to: 'saya@contoh.id',
  subject: 'Kode verifikasi Galeriku',
  text: 'Kode: 482910',
  html: '<p>Kode: 482910</p>',
  kind: 'verify-email',
  code: '482910',
};

describe('ResendMailService', () => {
  const nyata = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = nyata;
  });

  it('POST api.resend.com dengan header dan JSON yang benar', async () => {
    const terkirim: Array<{ url: string; init: RequestInit }> = [];
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      terkirim.push({ url, init });
      return new Response(JSON.stringify({ id: 'mail-1' }), { status: 200 });
    }) as unknown as typeof fetch;
    const service = new ResendMailService(
      'kunci-rahasia-uji',
      'Galeriku <noreply@contoh.id>',
      'admin@contoh.id',
    );
    await service.send(INPUT);
    expect(terkirim).toHaveLength(1);
    const [{ url, init }] = terkirim;
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.method).toBe('POST');
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer kunci-rahasia-uji');
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body).toEqual({
      from: 'Galeriku <noreply@contoh.id>',
      to: ['saya@contoh.id'],
      subject: 'Kode verifikasi Galeriku',
      text: 'Kode: 482910',
      html: '<p>Kode: 482910</p>',
      reply_to: 'admin@contoh.id',
    });
  });

  it('tanpa reply_to bila contact tak diset; error tanpa PII', async () => {
    globalThis.fetch = (async () => {
      return new Response('gagal', { status: 500 });
    }) as unknown as typeof fetch;
    const service = new ResendMailService(
      'kunci-rahasia-uji',
      'Galeriku <noreply@contoh.id>',
      undefined,
    );
    const galat = await service.send(INPUT).catch((e: unknown) => e);
    expect(galat).toBeInstanceOf(Error);
    const pesan = (galat as Error).message;
    expect(pesan).toContain('500');
    expect(pesan).not.toContain('kunci-rahasia-uji');
    expect(pesan).not.toContain('saya@contoh.id');
    expect(pesan).not.toContain('482910');
  });

  it('error jaringan tanpa PII', async () => {
    globalThis.fetch = (async () => {
      throw new TypeError('fetch failed');
    }) as unknown as typeof fetch;
    const service = new ResendMailService(
      'kunci-rahasia-uji',
      'Galeriku <noreply@contoh.id>',
      undefined,
    );
    const galat = await service.send(INPUT).catch((e: unknown) => e);
    expect((galat as Error).message).not.toContain('saya@contoh.id');
  });
});

describe('LogMailService', () => {
  it('menolak di produksi agar kode tak pernah tercetak', async () => {
    const semula = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      await expect(new LogMailService().send(INPUT)).rejects.toThrow(
        'tidak diizinkan di production',
      );
    } finally {
      process.env.NODE_ENV = semula;
    }
  });

  it('mencetak baris [mail:dev] di non-produksi', async () => {
    const baris: unknown[][] = [];
    const cetak = console.log;
    console.log = (...args: unknown[]) => {
      baris.push(args);
    };
    try {
      await new LogMailService().send(INPUT);
    } finally {
      console.log = cetak;
    }
    expect(baris).toEqual([
      ['[mail:dev] verify-email untuk saya@contoh.id kode 482910'],
    ]);
  });
});

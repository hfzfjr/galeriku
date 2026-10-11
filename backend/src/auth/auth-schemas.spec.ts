import {
  loginRequestSchema,
  registerRequestSchema,
} from '@galeriku/contracts';

const VALID_REGISTER = {
  name: '  Hafiz  ',
  email: '  Hafiz@Contoh.ID ',
  password: 'kata-sandi-rahasia',
  turnstileToken: 'token-uji',
};

describe('skema register', () => {
  it('menerima dan menormalisasi input valid', () => {
    const parsed = registerRequestSchema.parse(VALID_REGISTER);
    expect(parsed).toEqual({
      name: 'Hafiz',
      email: 'hafiz@contoh.id',
      password: 'kata-sandi-rahasia',
      turnstileToken: 'token-uji',
    });
  });

  it('menolak nama kosong, email jelek, password pendek, token hilang', () => {
    expect(() =>
      registerRequestSchema.parse({ ...VALID_REGISTER, name: '   ' }),
    ).toThrow();
    expect(() =>
      registerRequestSchema.parse({ ...VALID_REGISTER, email: 'bukan-email' }),
    ).toThrow();
    expect(() =>
      registerRequestSchema.parse({ ...VALID_REGISTER, password: 'pendek7' }),
    ).toThrow();
    const { turnstileToken: _drop, ...tanpaToken } = VALID_REGISTER;
    expect(() => registerRequestSchema.parse(tanpaToken)).toThrow();
  });

  it('batas panjang: nama 60 ok/61 gagal, password 8/128 ok, email 254', () => {
    const nama60 = { ...VALID_REGISTER, name: 'a'.repeat(60) };
    expect(registerRequestSchema.parse(nama60).name).toHaveLength(60);
    expect(() =>
      registerRequestSchema.parse({ ...VALID_REGISTER, name: 'a'.repeat(61) }),
    ).toThrow();
    expect(
      registerRequestSchema.parse({ ...VALID_REGISTER, password: 'a'.repeat(8) })
        .password,
    ).toHaveLength(8);
    expect(
      registerRequestSchema.parse({
        ...VALID_REGISTER,
        password: 'a'.repeat(128),
      }).password,
    ).toHaveLength(128);
    expect(() =>
      registerRequestSchema.parse({
        ...VALID_REGISTER,
        password: 'a'.repeat(129),
      }),
    ).toThrow();
  });
});

describe('skema login', () => {
  it('menormalisasi email dan mewajibkan semua field', () => {
    const parsed = loginRequestSchema.parse({
      email: '  Saya@Contoh.ID ',
      password: 'kata-sandi-rahasia',
      turnstileToken: 'token-uji',
    });
    expect(parsed.email).toBe('saya@contoh.id');
    expect(() =>
      loginRequestSchema.parse({
        email: 'saya@contoh.id',
        password: 'x',
        turnstileToken: 't',
      }),
    ).toThrow();
  });
});

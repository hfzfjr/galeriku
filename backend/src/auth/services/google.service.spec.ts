import { Role } from '../../generated/prisma/client';
import {
  GOOGLE_AUTHORIZE_URL,
  buildAuthorizeUrl,
  deriveCodeChallenge,
  isValidState,
  parseOauthCookie,
} from './google.service';
import { resolveRoleAfterVerification } from '../auth.service';

describe('GoogleService (unit murni)', () => {
  it('deriveCodeChallenge cocok vektor uji RFC 7636', () => {
    expect(
      deriveCodeChallenge(
        'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk',
      ),
    ).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  });

  it('buildAuthorizeUrl memakai prompt select_account + PKCE S256', () => {
    const url = new URL(
      buildAuthorizeUrl({
        clientId: 'client-uji',
        redirectUri: 'https://api.uji/auth/google/callback',
        state: 'state-uji',
        challenge: 'tantangan-uji',
      }),
    );
    expect(`${url.origin}${url.pathname}`).toBe(GOOGLE_AUTHORIZE_URL);
    expect(url.searchParams.get('client_id')).toBe('client-uji');
    expect(url.searchParams.get('redirect_uri')).toBe(
      'https://api.uji/auth/google/callback',
    );
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('scope')).toBe('openid email profile');
    expect(url.searchParams.get('state')).toBe('state-uji');
    expect(url.searchParams.get('code_challenge')).toBe('tantangan-uji');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('prompt')).toBe('select_account');
  });

  it('parseOauthCookie hanya menerima bentuk state.verifier', () => {
    expect(parseOauthCookie(undefined)).toBeNull();
    expect(parseOauthCookie('')).toBeNull();
    expect(parseOauthCookie('tanpa-titik')).toBeNull();
    expect(parseOauthCookie('a.b.c')).toBeNull();
    expect(parseOauthCookie('.verifier')).toBeNull();
    expect(parseOauthCookie('state.')).toBeNull();
    expect(parseOauthCookie('abc123.uvw456')).toEqual({
      state: 'abc123',
      verifier: 'uvw456',
    });
  });

  it('isValidState waktu-konstan, menolak kosong dan beda panjang', () => {
    expect(isValidState('sama', 'sama')).toBe(true);
    expect(isValidState('beda', 'sama')).toBe(false);
    expect(isValidState('pendek', 'jauh-lebih-panjang')).toBe(false);
    expect(isValidState('', 'sama')).toBe(false);
    expect(isValidState(undefined, 'sama')).toBe(false);
    expect(isValidState(123, 'sama')).toBe(false);
  });

  it('resolveRoleAfterVerification: ADMIN hanya untuk ADMIN_EMAIL', () => {
    expect(
      resolveRoleAfterVerification('admin@contoh.id', 'admin@contoh.id', Role.USER),
    ).toBe(Role.ADMIN);
    expect(
      resolveRoleAfterVerification('admin@contoh.id', 'lain@contoh.id', Role.USER),
    ).toBe(Role.USER);
    expect(
      resolveRoleAfterVerification(undefined, 'admin@contoh.id', Role.USER),
    ).toBe(Role.USER);
    expect(
      resolveRoleAfterVerification('admin@contoh.id', 'admin@contoh.id', Role.ADMIN),
    ).toBe(Role.ADMIN);
  });
});

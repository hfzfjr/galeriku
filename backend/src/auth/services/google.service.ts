import { Inject, Injectable, Logger } from '@nestjs/common';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import {
  GOOGLE_ERROR_CODES,
  normalizeEmail,
  type GoogleErrorCode,
} from '@galeriku/contracts';
import { APP_CONFIG, type AppConfig } from '../../config/app-config';
import { GOOGLE_IP_LIMIT } from '../auth.constants';
import { RateLimitService } from '../../common/rate-limit/rate-limit.service';

// Login Google tanpa dependency baru (US-11): Authorization Code + PKCE
// (S256) + state acak, memakai fetch ke endpoint Google. Scope:
// openid email profile.
export const GOOGLE_AUTHORIZE_URL =
  'https://accounts.google.com/o/oauth2/v2/auth';
export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
export const GOOGLE_USERINFO_URL =
  'https://openidconnect.googleapis.com/v1/userinfo';
export const GOOGLE_SCOPE = 'openid email profile';
export const GOOGLE_FETCH_TIMEOUT_MS = 10_000;

// Cookie sekali pakai untuk state + code_verifier: umur 10 menit,
// SameSite=Lax agar selamat dari redirect top-level balik dari Google,
// Secure di produksi, host-only, Path=/auth/google.
export const GOOGLE_OAUTH_COOKIE = 'galeriku_oauth';
export const GOOGLE_OAUTH_COOKIE_PATH = '/auth/google';
export const GOOGLE_OAUTH_COOKIE_MAX_AGE_SEC = 10 * 60;

// Galat alur Google selalu berujung redirect 302 ke
// `${FRONTEND_ORIGIN}/login?error=<kode>` (bukan JSON).
export class GoogleAuthError extends Error {
  readonly code: GoogleErrorCode;

  constructor(code: GoogleErrorCode) {
    super(`Login Google gagal: ${code}`);
    this.name = 'GoogleAuthError';
    this.code = code;
  }
}

export type GoogleProfile = {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
  avatarUrl: string | null;
};

export function deriveCodeChallenge(verifier: string): string {
  return createHash('sha256').update(verifier, 'utf8').digest('base64url');
}

export function buildAuthorizeUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
  challenge: string;
}): string {
  const params = new URLSearchParams({
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    response_type: 'code',
    scope: GOOGLE_SCOPE,
    state: input.state,
    code_challenge: input.challenge,
    code_challenge_method: 'S256',
    prompt: 'select_account',
  });
  return `${GOOGLE_AUTHORIZE_URL}?${params.toString()}`;
}

// Nilai cookie `${state}.${verifier}` (keduanya base64url/hex: tanpa titik).
// Mengembalikan null bila bentuknya tak valid.
export function parseOauthCookie(
  value: string | undefined,
): { state: string; verifier: string } | null {
  if (typeof value !== 'string' || value.length === 0) {
    return null;
  }
  const parts = value.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return null;
  }
  return { state: parts[0], verifier: parts[1] };
}

export function isValidState(provided: unknown, expected: string): boolean {
  if (typeof provided !== 'string' || provided.length === 0) {
    return false;
  }
  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

@Injectable()
export class GoogleService {
  private readonly logger = new Logger(GoogleService.name);

  constructor(
    private readonly limiter: RateLimitService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  isConfigured(): boolean {
    return Boolean(
      this.config.googleClientId &&
        this.config.googleClientSecret &&
        this.config.googleCallbackUrl,
    );
  }

  private googleConfig(): {
    clientId: string;
    clientSecret: string;
    callbackUrl: string;
  } {
    const { googleClientId, googleClientSecret, googleCallbackUrl } =
      this.config;
    if (!googleClientId || !googleClientSecret || !googleCallbackUrl) {
      throw new GoogleAuthError(GOOGLE_ERROR_CODES.google_failed);
    }
    return {
      clientId: googleClientId,
      clientSecret: googleClientSecret,
      callbackUrl: googleCallbackUrl,
    };
  }

  // Batas per IP dengan limiter buatan sendiri (semantik sama dengan
  // RateLimitGuard). Kelebihan -> redirect ?error=rate_limited.
  checkRateLimit(clientIp: string): void {
    const result = this.limiter.checkAndRecord(
      `google:ip:${clientIp}`,
      GOOGLE_IP_LIMIT.limit,
      GOOGLE_IP_LIMIT.windowMs,
    );
    if (!result.allowed) {
      throw new GoogleAuthError(GOOGLE_ERROR_CODES.rate_limited);
    }
  }

  startLogin(): { redirectUrl: string; state: string; verifier: string } {
    const { clientId, callbackUrl } = this.googleConfig();
    const state = randomBytes(16).toString('hex');
    const verifier = randomBytes(32).toString('base64url');
    const redirectUrl = buildAuthorizeUrl({
      clientId,
      redirectUri: callbackUrl,
      state,
      challenge: deriveCodeChallenge(verifier),
    });
    return { redirectUrl, state, verifier };
  }

  // Tukar code + ambil profil. Jaringan/timeout Google -> google_unavailable;
  // respons tak valid -> google_failed; email Google tak terverifikasi ->
  // google_unverified. Tidak pernah me-log code, token, atau email.
  async fetchProfile(code: string, verifier: string): Promise<GoogleProfile> {
    if (!code || !verifier) {
      throw new GoogleAuthError(GOOGLE_ERROR_CODES.google_failed);
    }
    const { clientId, clientSecret, callbackUrl } = this.googleConfig();
    let tokenBody: unknown;
    try {
      const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: callbackUrl,
          grant_type: 'authorization_code',
          code_verifier: verifier,
        }),
        signal: AbortSignal.timeout(GOOGLE_FETCH_TIMEOUT_MS),
      });
      tokenBody = await tokenRes.json();
      if (!tokenRes.ok) {
        throw new GoogleAuthError(GOOGLE_ERROR_CODES.google_failed);
      }
    } catch (error) {
      if (error instanceof GoogleAuthError) {
        throw error;
      }
      this.logger.warn('Token Google tidak terjangkau.');
      throw new GoogleAuthError(GOOGLE_ERROR_CODES.google_unavailable);
    }
    const accessToken = (tokenBody as { access_token?: unknown })
      ?.access_token;
    if (typeof accessToken !== 'string' || accessToken.length === 0) {
      throw new GoogleAuthError(GOOGLE_ERROR_CODES.google_failed);
    }
    let infoBody: unknown;
    try {
      const infoRes = await fetch(GOOGLE_USERINFO_URL, {
        headers: { authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(GOOGLE_FETCH_TIMEOUT_MS),
      });
      infoBody = await infoRes.json();
      if (!infoRes.ok) {
        throw new GoogleAuthError(GOOGLE_ERROR_CODES.google_failed);
      }
    } catch (error) {
      if (error instanceof GoogleAuthError) {
        throw error;
      }
      this.logger.warn('Userinfo Google tidak terjangkau.');
      throw new GoogleAuthError(GOOGLE_ERROR_CODES.google_unavailable);
    }
    return toGoogleProfile(infoBody);
  }
}

// Validasi bentuk userinfo. WAJIB email_verified === true dari Google;
// selain itu tolak (google_unverified). Bentuk lain yang tak valid ->
// google_failed.
function toGoogleProfile(body: unknown): GoogleProfile {
  const record =
    typeof body === 'object' && body !== null
      ? (body as Record<string, unknown>)
      : null;
  const sub = record?.sub;
  const email = record?.email;
  if (
    typeof sub !== 'string' ||
    sub.length === 0 ||
    typeof email !== 'string' ||
    email.length === 0
  ) {
    throw new GoogleAuthError(GOOGLE_ERROR_CODES.google_failed);
  }
  if (record?.email_verified !== true) {
    throw new GoogleAuthError(GOOGLE_ERROR_CODES.google_unverified);
  }
  const nameRaw = record?.name;
  const name =
    typeof nameRaw === 'string' && nameRaw.trim().length > 0
      ? nameRaw.trim().slice(0, 60)
      : null;
  const pictureRaw = record?.picture;
  const avatarUrl =
    typeof pictureRaw === 'string' && pictureRaw.length > 0
      ? pictureRaw
      : null;
  return {
    sub,
    email: normalizeEmail(email),
    emailVerified: true,
    name,
    avatarUrl,
  };
}

import { Inject, Injectable } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../../config/app-config';
import { ApiError } from '../../common/errors/api-error';

const VERIFY_URL =
  'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const VERIFY_TIMEOUT_MS = 5000;

// Verifikasi Cloudflare Turnstile lewat fetch (tanpa dependency).
// Fail closed: tidak ada bypass untuk non-produksi. Di tes pakai mock,
// di dev lokal pakai kunci uji Cloudflare dari env. Token tidak di-log.
@Injectable()
export class TurnstileService {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  async verify(token: string, remoteIp: string): Promise<void> {
    const failed = new ApiError(
      400,
      'TURNSTILE_FAILED',
      'Verifikasi keamanan gagal. Coba lagi.',
    );
    const unavailable = new ApiError(
      503,
      'TURNSTILE_UNAVAILABLE',
      'Layanan verifikasi keamanan sedang gangguan. Coba lagi nanti.',
    );
    let response: Response;
    try {
      const body = new URLSearchParams({
        secret: this.config.turnstileSecretKey,
        response: token,
        remoteip: remoteIp,
      });
      response = await fetch(VERIFY_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body,
        signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS),
      });
    } catch {
      throw unavailable;
    }
    let data: { success?: unknown } | null = null;
    try {
      data = (await response.json()) as { success?: unknown };
    } catch {
      throw unavailable;
    }
    if (data?.success === true) {
      return;
    }
    if (response.ok) {
      throw failed;
    }
    throw unavailable;
  }
}

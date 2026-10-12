import type {
  AcceptedResponse,
  ForgotPasswordRequest,
  LoginRequest,
  MeResponse,
  RegisterRequest,
  RegisterResponse,
  ResendCodeRequest,
  ResetPasswordRequest,
  VerifyEmailRequest,
} from "@galeriku/contracts";

/**
 * Klien API tipis (US-10). fetch + credentials:'include' ke host API,
 * base dari NEXT_PUBLIC_API_URL. Cookie sesi HttpOnly diurus browser;
 * JavaScript tidak pernah menyimpan token.
 */

export const NETWORK_ERROR_CODE = "NETWORK_ERROR";
export const UNKNOWN_ERROR_CODE = "UNKNOWN_ERROR";

export class ApiRequestError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;
  readonly retryAfterSec?: number;

  constructor(
    statusCode: number,
    code: string,
    message: string,
    options?: { details?: unknown; retryAfterSec?: number },
  ) {
    super(message);
    this.name = "ApiRequestError";
    this.statusCode = statusCode;
    this.code = code;
    if (options?.details !== undefined) {
      this.details = options.details;
    }
    if (options?.retryAfterSec !== undefined) {
      this.retryAfterSec = options.retryAfterSec;
    }
  }
}

function getApiBase(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/+$/, "");
  // Bawaan dev lokal bila env belum diisi.
  return raw && raw.length > 0 ? raw : "http://localhost:4000";
}

// URL mulai login Google (US-11): navigasi penuh, bukan fetch.
export function getGoogleLoginUrl(): string {
  return `${getApiBase()}/auth/google`;
}

function isErrorBodyShape(value: unknown): value is {
  statusCode: number;
  code: string;
  message: string;
  details?: unknown;
} {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const body = value as Record<string, unknown>;
  return (
    typeof body.statusCode === "number" &&
    typeof body.code === "string" &&
    typeof body.message === "string"
  );
}

function parseRetryAfter(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }
  const seconds = Number.parseInt(value, 10);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : undefined;
}

async function request<T>(
  path: string,
  options?: { method?: string; body?: unknown },
): Promise<T> {
  const method = options?.method ?? "GET";
  const hasBody = options?.body !== undefined;
  let response: Response;
  try {
    response = await fetch(`${getApiBase()}${path}`, {
      method,
      credentials: "include",
      // Fastify menolak body kosong ber-Content-Type JSON (400), jadi
      // header ini hanya dikirim bila request benar-benar punya body.
      headers: hasBody ? { "content-type": "application/json" } : undefined,
      body: hasBody ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    // Jaringan putus / server mati: tanpa kode HTTP, tanpa stack trace.
    throw new ApiRequestError(
      0,
      NETWORK_ERROR_CODE,
      "Tidak bisa terhubung ke Galeriku. Coba lagi.",
    );
  }

  const retryAfterSec = parseRetryAfter(response.headers.get("retry-after"));

  if (response.status === 204) {
    return undefined as T;
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    if (isErrorBodyShape(payload)) {
      throw new ApiRequestError(payload.statusCode, payload.code, payload.message, {
        details: payload.details,
        retryAfterSec,
      });
    }
    // Galat bawaan Fastify / bentuk tak dikenal (bug tertunda yang
    // diketahui): galat generik, tanpa crash.
    throw new ApiRequestError(
      response.status,
      UNKNOWN_ERROR_CODE,
      "Terjadi kesalahan. Muat ulang halaman lalu coba lagi.",
      { retryAfterSec },
    );
  }

  return payload as T;
}

export function fetchMe(): Promise<MeResponse> {
  return request<MeResponse>("/auth/me");
}

export function registerAccount(body: RegisterRequest): Promise<RegisterResponse> {
  return request<RegisterResponse>("/auth/register", { method: "POST", body });
}

export function loginAccount(body: LoginRequest): Promise<MeResponse> {
  return request<MeResponse>("/auth/login", { method: "POST", body });
}

export function logoutAccount(): Promise<void> {
  return request<void>("/auth/logout", { method: "POST" });
}

export function verifyEmail(body: VerifyEmailRequest): Promise<MeResponse> {
  return request<MeResponse>("/auth/verify-email", { method: "POST", body });
}

export function resendCode(body: ResendCodeRequest): Promise<AcceptedResponse> {
  return request<AcceptedResponse>("/auth/resend-code", {
    method: "POST",
    body,
  });
}

export function forgotPassword(body: ForgotPasswordRequest): Promise<AcceptedResponse> {
  return request<AcceptedResponse>("/auth/forgot-password", {
    method: "POST",
    body,
  });
}

export function resetPassword(body: ResetPasswordRequest): Promise<void> {
  return request<void>("/auth/reset-password", { method: "POST", body });
}

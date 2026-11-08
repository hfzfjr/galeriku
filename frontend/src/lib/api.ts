import type {
  AcceptedResponse,
  AddAlbumFilesRequest,
  AdminUserItem,
  AdminUsersResponse,
  AlbumDetail,
  AlbumItem,
  AlbumsResponse,
  CreateAlbumRequest,
  CreateShareLinkRequest,
  FileDetail,
  FileItem,
  FilesResponse,
  FilesTimelineResponse,
  ForgotPasswordRequest,
  LoginRequest,
  MeResponse,
  PublicShareResponse,
  RegisterRequest,
  RegisterResponse,
  ResendCodeRequest,
  ResetPasswordRequest,
  ShareLinkItem,
  ShareLinksResponse,
  TrashFilesResponse,
  UnlockShareRequest,
  UpdateAlbumRequest,
  UpdateCapturedAtRequest,
  UpdateQuotaRequest,
  UpdateShareLinkRequest,
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

// Dashboard admin (US-12). Semua butuh peran ADMIN di backend.
export function fetchAdminUsers(params?: {
  q?: string;
  limit?: number;
  cursor?: string;
}): Promise<AdminUsersResponse> {
  const search = new URLSearchParams();
  if (params?.q) {
    search.set("q", params.q);
  }
  if (params?.limit !== undefined) {
    search.set("limit", String(params.limit));
  }
  if (params?.cursor) {
    search.set("cursor", params.cursor);
  }
  const suffix = search.size > 0 ? `?${search.toString()}` : "";
  return request<AdminUsersResponse>(`/admin/users${suffix}`);
}

export function suspendUser(id: string): Promise<AdminUserItem> {
  return request<AdminUserItem>(`/admin/users/${encodeURIComponent(id)}/suspend`, {
    method: "POST",
  });
}

export function activateUser(id: string): Promise<AdminUserItem> {
  return request<AdminUserItem>(`/admin/users/${encodeURIComponent(id)}/activate`, {
    method: "POST",
  });
}

export function updateUserQuota(
  id: string,
  body: UpdateQuotaRequest,
): Promise<AdminUserItem> {
  return request<AdminUserItem>(`/admin/users/${encodeURIComponent(id)}/quota`, {
    method: "PATCH",
    body,
  });
}

export function deleteUser(id: string): Promise<void> {
  return request<void>(`/admin/users/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

// Galeri & Files (US-20, RF-40, RF-41). Sesi login + pemilik.
export function fetchFiles(params?: {
  limit?: number;
  cursor?: string;
  anchor?: string;
  sort?: "taken" | "uploaded" | "name" | "size";
  order?: "desc" | "asc";
  kind?: "image" | "video";
  live?: boolean;
  hasLocation?: boolean;
  favorite?: boolean;
  unalbumed?: boolean;
  place?: string;
  duplicates?: boolean;
  q?: string;
  from?: string;
  to?: string;
}): Promise<FilesResponse> {
  const search = new URLSearchParams();
  if (params?.limit !== undefined) search.set("limit", String(params.limit));
  if (params?.cursor) search.set("cursor", params.cursor);
  if (params?.anchor) search.set("anchor", params.anchor);
  if (params?.sort) search.set("sort", params.sort);
  if (params?.order) search.set("order", params.order);
  if (params?.kind) search.set("kind", params.kind);
  if (params?.live !== undefined) search.set("live", String(params.live));
  if (params?.hasLocation !== undefined) search.set("hasLocation", String(params.hasLocation));
  if (params?.favorite !== undefined) search.set("favorite", String(params.favorite));
  if (params?.unalbumed !== undefined) search.set("unalbumed", String(params.unalbumed));
  if (params?.place) search.set("place", params.place);
  if (params?.duplicates !== undefined) search.set("duplicates", String(params.duplicates));
  if (params?.q) search.set("q", params.q);
  if (params?.from) search.set("from", params.from);
  if (params?.to) search.set("to", params.to);
  const suffix = search.size > 0 ? `?${search.toString()}` : "";
  return request<FilesResponse>(`/files${suffix}`);
}

export function fetchTimeline(params?: {
  kind?: "image" | "video";
  live?: boolean;
  hasLocation?: boolean;
  favorite?: boolean;
  unalbumed?: boolean;
  place?: string;
  duplicates?: boolean;
  q?: string;
  from?: string;
  to?: string;
}): Promise<FilesTimelineResponse> {
  const search = new URLSearchParams();
  if (params?.kind) search.set("kind", params.kind);
  if (params?.live !== undefined) search.set("live", String(params.live));
  if (params?.hasLocation !== undefined) search.set("hasLocation", String(params.hasLocation));
  if (params?.favorite !== undefined) search.set("favorite", String(params.favorite));
  if (params?.unalbumed !== undefined) search.set("unalbumed", String(params.unalbumed));
  if (params?.place) search.set("place", params.place);
  if (params?.duplicates !== undefined) search.set("duplicates", String(params.duplicates));
  if (params?.q) search.set("q", params.q);
  if (params?.from) search.set("from", params.from);
  if (params?.to) search.set("to", params.to);
  const suffix = search.size > 0 ? `?${search.toString()}` : "";
  return request<FilesTimelineResponse>(`/files/timeline${suffix}`);
}

export function toggleFavoriteFile(
  id: string,
  isFavorite: boolean,
): Promise<FileItem> {
  return request<FileItem>(`/files/${encodeURIComponent(id)}/favorite`, {
    method: "PATCH",
    body: { isFavorite },
  });
}

export function fetchTrashFiles(): Promise<TrashFilesResponse> {
  return request<TrashFilesResponse>("/files/trash");
}

export function restoreFile(id: string): Promise<FileItem> {
  return request<FileItem>(`/files/${encodeURIComponent(id)}/restore`, {
    method: "POST",
  });
}

export function deletePermanentFile(id: string): Promise<void> {
  return request<void>(`/files/${encodeURIComponent(id)}/permanent`, {
    method: "DELETE",
  });
}

export function emptyTrash(): Promise<{ count: number }> {
  return request<{ count: number }>("/files/trash", {
    method: "DELETE",
  });
}

export function getThumbnailUrl(fileId: string): string {
  return `${getApiBase()}/files/${encodeURIComponent(fileId)}/thumb`;
}

export function getFilePreviewUrl(fileId: string): string {
  return `${getApiBase()}/files/${encodeURIComponent(fileId)}/preview`;
}

export function getFileContentUrl(fileId: string, download = false): string {
  const base = `${getApiBase()}/files/${encodeURIComponent(fileId)}/content`;
  return download ? `${base}?download=1` : base;
}

export function deleteFile(id: string): Promise<void> {
  return request<void>(`/files/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export function getFileDetail(fileId: string): Promise<FileDetail> {
  return request<FileDetail>(`/files/${encodeURIComponent(fileId)}`);
}

export function updateFileCapturedAt(
  fileId: string,
  payload: UpdateCapturedAtRequest,
): Promise<FileItem> {
  return request<FileItem>(
    `/files/${encodeURIComponent(fileId)}/captured-at`,
    {
      method: "PATCH",
      body: payload,
    },
  );
}

export function batchDeleteFiles(ids: string[]): Promise<{ count: number }> {
  return request<{ count: number }>("/files/batch-delete", {
    method: "POST",
    body: { ids },
  });
}

// Akun Google menambahkan password (US-15)
export function setPassword(password: string): Promise<MeResponse> {
  return request<MeResponse>("/auth/set-password", {
    method: "POST",
    body: { password },
  });
}

// Album (US-23)
export function fetchAlbums(): Promise<AlbumsResponse> {
  return request<AlbumsResponse>("/albums");
}

export function createAlbum(body: CreateAlbumRequest): Promise<AlbumItem> {
  return request<AlbumItem>("/albums", {
    method: "POST",
    body,
  });
}

export function fetchAlbumDetail(id: string): Promise<AlbumDetail> {
  return request<AlbumDetail>(`/albums/${encodeURIComponent(id)}`);
}

export function updateAlbum(
  id: string,
  body: UpdateAlbumRequest,
): Promise<AlbumItem> {
  return request<AlbumItem>(`/albums/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body,
  });
}

export function deleteAlbum(id: string): Promise<void> {
  return request<void>(`/albums/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export function addFilesToAlbum(
  id: string,
  body: AddAlbumFilesRequest,
): Promise<AlbumDetail> {
  return request<AlbumDetail>(`/albums/${encodeURIComponent(id)}/files`, {
    method: "POST",
    body,
  });
}

export function removeFileFromAlbum(
  id: string,
  fileId: string,
): Promise<AlbumDetail> {
  return request<AlbumDetail>(
    `/albums/${encodeURIComponent(id)}/files/${encodeURIComponent(fileId)}`,
    {
      method: "DELETE",
    },
  );
}

// Share Links (US-24, US-26, US-27)
export function createShareLink(
  body: CreateShareLinkRequest,
): Promise<ShareLinkItem> {
  return request<ShareLinkItem>("/shares", {
    method: "POST",
    body,
  });
}

export function updateShareLink(
  id: string,
  body: UpdateShareLinkRequest,
): Promise<ShareLinkItem> {
  return request<ShareLinkItem>(`/shares/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body,
  });
}

export function revokeShareLink(id: string): Promise<ShareLinkItem> {
  return request<ShareLinkItem>(`/shares/${encodeURIComponent(id)}/revoke`, {
    method: "POST",
  });
}

export function fetchShares(): Promise<ShareLinksResponse> {
  return request<ShareLinksResponse>("/shares");
}

// Public View & Download (US-25, US-26)
export function fetchPublicShare(token: string): Promise<PublicShareResponse> {
  return request<PublicShareResponse>(`/public/s/${encodeURIComponent(token)}`);
}

export function unlockPublicShare(
  token: string,
  body: UnlockShareRequest,
): Promise<{ unlocked: boolean; unlockToken: string }> {
  return request<{ unlocked: boolean; unlockToken: string }>(
    `/public/s/${encodeURIComponent(token)}/unlock`,
    {
      method: "POST",
      body,
    },
  );
}

export function getPublicThumbnailUrl(token: string, fileId: string): string {
  return `${getApiBase()}/public/s/${encodeURIComponent(token)}/files/${encodeURIComponent(fileId)}/thumb`;
}

export function getPublicFilePreviewUrl(token: string, fileId: string): string {
  return `${getApiBase()}/public/s/${encodeURIComponent(token)}/files/${encodeURIComponent(fileId)}/preview`;
}

export function getPublicFileContentUrl(
  token: string,
  fileId: string,
  download = false,
): string {
  const base = `${getApiBase()}/public/s/${encodeURIComponent(token)}/files/${encodeURIComponent(fileId)}`;
  return download ? `${base}?download=1` : base;
}

export function getPublicAlbumZipUrl(token: string): string {
  return `${getApiBase()}/public/s/${encodeURIComponent(token)}/zip`;
}

export function getFileMotionUrl(fileId: string): string {
  return `${getApiBase()}/files/${encodeURIComponent(fileId)}/motion`;
}

export function getPublicFileMotionUrl(token: string, fileId: string): string {
  return `${getApiBase()}/public/s/${encodeURIComponent(token)}/files/${encodeURIComponent(fileId)}/motion`;
}






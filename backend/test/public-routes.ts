// Daftar putih route PUBLIK backend (US-13). Satu berkas, eksplisit:
// setiap route di sini boleh diakses tanpa sesi; SEMUA route lain yang
// terdaftar wajib menjawab 401 tanpa sesi (default-deny, diuji otomatis
// di access-matrix.e2e-spec.ts).
// Diperiksa terhadap controller: /auth/logout dan /auth/me BUKAN publik
// (butuh sesi). GET / SENGAJA tidak ada di sini: AppController.getHello
// tidak bertanda @Public sehingga ikut default-deny (401); bila suatu
// saat dijadikan publik, daftarkan di sini.
// Tidak ada route publik berparameter.
export type PublicRoute = {
  method: 'GET' | 'POST';
  path: string;
};

export const PUBLIC_ROUTES: PublicRoute[] = [
  { method: 'GET', path: '/health' },
  { method: 'POST', path: '/auth/register' },
  { method: 'POST', path: '/auth/login' },
  { method: 'POST', path: '/auth/verify-email' },
  { method: 'POST', path: '/auth/resend-code' },
  { method: 'POST', path: '/auth/forgot-password' },
  { method: 'POST', path: '/auth/reset-password' },
  { method: 'GET', path: '/auth/google' },
  { method: 'GET', path: '/auth/google/callback' },
];

export function isPublicRoute(method: string, path: string): boolean {
  return PUBLIC_ROUTES.some(
    (r) => r.method === method.toUpperCase() && r.path === path,
  );
}

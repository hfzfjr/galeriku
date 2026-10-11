import { SetMetadata } from '@nestjs/common';

// Penanda rute publik untuk guard autentikasi global (default-deny).
// Hanya dipakai register, login, dan GET /health.
export const IS_PUBLIC_KEY = 'galeriku:is-public';

export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

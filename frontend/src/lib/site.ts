/**
 * Alamat publik situs untuk metadata (canonical, Open Graph, sitemap).
 * Di Vercel diisi lewat NEXT_PUBLIC_SITE_URL; lokal fallback ke :3000.
 */
export function getSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");
  if (raw && raw.length > 0) {
    return raw;
  }
  return "http://localhost:3000";
}

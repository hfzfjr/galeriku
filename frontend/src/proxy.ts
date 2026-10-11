import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// Gerbang halaman pratinjau /dev/* (US-07). Berjalan sebelum render,
// sehingga status 404 sejati bisa dikembalikan — memanggil notFound()
// dari dalam page saja tidak cukup di era cacheComponents karena shell
// statis sudah terlanjur terkirim dengan status 200.
// Tampil bila NODE_ENV bukan production ATAU VERCEL_ENV = preview.
function isDevUiAllowed(): boolean {
  return (
    process.env.NODE_ENV !== "production" ||
    process.env.VERCEL_ENV === "preview"
  );
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/dev" || pathname.startsWith("/dev/")) {
    if (!isDevUiAllowed()) {
      return new NextResponse("Halaman tidak ditemukan.", { status: 404 });
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dev", "/dev/:path*"],
};

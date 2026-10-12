import type { Metadata } from "next";
import type { ReactNode } from "react";

// PRD §11: layar auth tidak diindeks. Halaman klien ada di dalamnya.
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function AuthLayout({ children }: { children: ReactNode }) {
  return children;
}

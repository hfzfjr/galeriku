import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app/app-shell";

// PRD §11: area /app tidak diindeks.
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

// Segmen privat dirender di client (aturan arsitektur #6).
// Nonaktifkan validasi instant navigation untuk segmen yang di-gate oleh auth client.
export const instant = false;

export default function AppLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}

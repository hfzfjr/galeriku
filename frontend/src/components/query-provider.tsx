"use client";

import {
  QueryClient,
  QueryClientProvider,
  type QueryClientConfig,
} from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

const QUERY_CONFIG: QueryClientConfig = {
  defaultOptions: {
    queries: {
      // Layar auth memakai refetch manual ("Coba lagi"); hindari
      // percobaan ulang otomatis yang mengaburkan status.
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
};

function createQueryClient(): QueryClient {
  return new QueryClient(QUERY_CONFIG);
}

/**
 * Penyedia TanStack Query. Satu instance per sesi browser (singleton
 * modul di klien) agar cache /auth/me dipakai bersama layar auth dan /app.
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(createQueryClient);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

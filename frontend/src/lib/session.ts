"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { MeResponse } from "@galeriku/contracts";
import { ApiRequestError, fetchMe } from "./api";

export const ME_QUERY_KEY = ["me"] as const;

/**
 * Status sesi dari GET /auth/me. 401 = belum login (data null, bukan
 * galat). Galat jaringan/5xx dilempar agar pemanggil menampilkan layar
 * "Galeriku lagi istirahat".
 */
export function useSession(): UseQueryResult<MeResponse | null, Error> {
  return useQuery({
    queryKey: ME_QUERY_KEY,
    queryFn: async (): Promise<MeResponse | null> => {
      try {
        return await fetchMe();
      } catch (error) {
        if (error instanceof ApiRequestError && error.statusCode === 401) {
          return null;
        }
        throw error;
      }
    },
    staleTime: 60 * 1000,
  });
}

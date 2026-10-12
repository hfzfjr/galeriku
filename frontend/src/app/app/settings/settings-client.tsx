"use client";

import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { logoutAccount } from "@/lib/api";
import { toIndonesianMessage } from "@/lib/auth-errors";
import { useSession } from "@/lib/session";
import { FormError } from "@/components/auth/form-message";

/**
 * Pengaturan sementara (US-10): nama, email, dan tombol Keluar.
 * POST /auth/logout, bersihkan cache query, lalu ke /login.
 */
export function SettingsClient() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const session = useSession();
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogout() {
    if (leaving) {
      return;
    }
    setLeaving(true);
    setError(null);
    try {
      await logoutAccount();
    } catch (requestError) {
      // Logout gagal (mis. jaringan): tetap beri tahu, jangan diam.
      setError(toIndonesianMessage(requestError));
      setLeaving(false);
      return;
    }
    queryClient.clear();
    router.replace("/login");
  }

  const name = session.data?.name ?? "—";
  const email = session.data?.email ?? "—";

  return (
    <main className="flex flex-col gap-4">
      <h1 className="text-h1 text-ink">Akun</h1>
      <Card heading={name} description={email}>
        <div className="mt-4 flex flex-col gap-4">
          {error ? <FormError message={error} /> : null}
          <Button
            type="button"
            variant="secondary"
            loading={leaving}
            onClick={handleLogout}
            className="w-full sm:w-auto"
          >
            Keluar
          </Button>
        </div>
      </Card>
    </main>
  );
}

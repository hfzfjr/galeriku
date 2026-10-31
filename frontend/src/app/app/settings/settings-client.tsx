"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Check,
  HardDrive,
  KeyRound,
  LogOut,
  Shield,
  User as UserIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getButtonClassName } from "@/components/ui/button-styles";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { FormError, FormInfo } from "@/components/auth/form-message";
import { logoutAccount, setPassword } from "@/lib/api";
import { toIndonesianMessage } from "@/lib/auth-errors";
import { formatBytes } from "@/lib/format-bytes";
import { useSession } from "@/lib/session";

export function SettingsClient() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const session = useSession();

  // State logout
  const [leaving, setLeaving] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  // State tambah password (akun Google)
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  async function handleLogout() {
    if (leaving) return;
    setLeaving(true);
    setLogoutError(null);
    try {
      await logoutAccount();
    } catch (requestError) {
      setLogoutError(toIndonesianMessage(requestError));
      setLeaving(false);
      return;
    }
    queryClient.clear();
    router.replace("/login");
  }

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (newPassword.length < 8) {
      setPasswordError("Password minimal 8 karakter.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Konfirmasi password tidak cocok.");
      return;
    }

    setSavingPassword(true);
    try {
      await setPassword(newPassword);
      setPasswordSuccess("Kata sandi berhasil ditambahkan!");
      setNewPassword("");
      setConfirmPassword("");
      queryClient.invalidateQueries({ queryKey: ["session"] });
    } catch (err) {
      setPasswordError(toIndonesianMessage(err));
    } finally {
      setSavingPassword(false);
    }
  }

  const name = session.data?.name?.trim() || "Pengguna";
  const email = session.data?.email ?? "—";
  const avatarUrl = session.data?.avatarUrl;
  const initial = (name.charAt(0) || email.charAt(0) || "?").toUpperCase();

  const quotaBytes = BigInt(session.data?.quotaBytes ?? "0");
  const usedBytes = BigInt(session.data?.usedBytes ?? "0");
  const percentUsed =
    quotaBytes > BigInt(0)
      ? Math.min(100, Math.round(Number((usedBytes * BigInt(100)) / quotaBytes)))
      : 0;

  const hasPassword = session.data?.hasPassword ?? true;
  const isAdmin = session.data?.role === "ADMIN";

  return (
    <main className="flex flex-col gap-6 pb-24">
      <div>
        <h1 className="text-h1 font-serif text-ink">Akun</h1>
        <p className="text-body text-ink-muted">
          Profil, pemakaian penyimpanan, dan pengaturan akunmu.
        </p>
      </div>

      {/* Profil Pengguna */}
      <Card>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          {avatarUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={avatarUrl}
              alt={name}
              className="h-16 w-16 rounded-full object-cover border border-line"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent-soft text-accent text-2xl font-serif font-semibold">
              {initial}
            </div>
          )}

          <div className="flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-h2 font-serif text-ink">{name}</h2>
              {isAdmin ? (
                <Badge variant="accent" icon={Shield}>
                  Admin
                </Badge>
              ) : (
                <Badge variant="neutral" icon={UserIcon}>
                  Pengguna
                </Badge>
              )}
            </div>
            <p className="text-body text-ink-muted">{email}</p>
          </div>
        </div>
      </Card>

      {/* Pemakaian Penyimpanan */}
      <Card heading="Penyimpanan">
        <div className="mt-3 space-y-3">
          <div className="flex items-center justify-between text-body">
            <span className="flex items-center gap-2 text-ink font-medium">
              <HardDrive size={18} className="text-ink-muted" strokeWidth={1.5} />
              {formatBytes(usedBytes)} dari {formatBytes(quotaBytes)}
            </span>
            <span className="text-caption text-ink-muted">{percentUsed}%</span>
          </div>

          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percentUsed}
            aria-label="Pemakaian penyimpanan"
            className="h-2 w-full overflow-hidden rounded-full bg-line"
          >
            <div
              className={`h-full rounded-full transition-[width] ${
                percentUsed > 90
                  ? "bg-danger"
                  : percentUsed > 75
                  ? "bg-warning"
                  : "bg-accent"
              }`}
              style={{ width: `${percentUsed}%` }}
            />
          </div>

          <p className="text-caption text-ink-muted">
            Kuota penyimpanan ini dihitung dari seluruh foto dan video asli yang kamu simpan di Galeriku.
          </p>
        </div>
      </Card>

      {/* Keamanan & Kata Sandi */}
      <Card heading="Keamanan">
        <div className="mt-3 space-y-4">
          {hasPassword ? (
            <div className="flex items-center justify-between py-1">
              <div className="flex items-center gap-2">
                <KeyRound size={18} className="text-ink-muted" strokeWidth={1.5} />
                <span className="text-body text-ink">Kata sandi akun</span>
              </div>
              <Badge variant="success" icon={Check}>
                Aktif
              </Badge>
            </div>
          ) : (
            <form onSubmit={handleSetPassword} className="space-y-4">
              <div className="space-y-1">
                <p className="text-body font-medium text-ink">
                  Tambahkan Kata Sandi
                </p>
                <p className="text-caption text-ink-muted">
                  Akunmu terdaftar lewat Google. Pasang kata sandi agar bisa masuk menggunakan email dan kata sandi langsung.
                </p>
              </div>

              {passwordError ? <FormError message={passwordError} /> : null}
              {passwordSuccess ? <FormInfo message={passwordSuccess} /> : null}

              <div className="space-y-3 max-w-sm">
                <Input
                  id="input-new-password"
                  label="Kata Sandi Baru"
                  type="password"
                  placeholder="Minimal 8 karakter"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />

                <Input
                  id="input-confirm-password"
                  label="Ulangi Kata Sandi"
                  type="password"
                  placeholder="Ketik ulang kata sandi"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />

                <Button
                  type="submit"
                  variant="primary"
                  loading={savingPassword}
                  className="w-full sm:w-auto"
                >
                  Simpan Kata Sandi
                </Button>
              </div>
            </form>
          )}
        </div>
      </Card>

      {/* Aksi & Keluar */}
      <Card>
        <div className="flex flex-col gap-4">
          {logoutError ? <FormError message={logoutError} /> : null}

          {isAdmin ? (
            <Link
              href="/app/admin"
              aria-label="Buka dashboard admin"
              className={getButtonClassName("secondary", "w-full sm:w-auto flex items-center justify-center gap-2")}
            >
              <Shield size={18} strokeWidth={1.5} />
              Kelola Pengguna
            </Link>
          ) : null}

          <Button
            type="button"
            variant="secondary"
            loading={leaving}
            onClick={handleLogout}
            className="w-full sm:w-auto flex items-center justify-center gap-2 text-danger hover:border-danger"
          >
            <LogOut size={18} strokeWidth={1.5} />
            Keluar dari Akun
          </Button>
        </div>
      </Card>
    </main>
  );
}

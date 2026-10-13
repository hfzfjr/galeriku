"use client";

import Link from "next/link";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import type { AdminUserItem } from "@galeriku/contracts";
import { Ban, Check, Clock } from "lucide-react";
import { useEffect, useState } from "react";
import { FormError } from "@/components/auth/form-message";
import { AuthLoadingSkeleton } from "@/components/auth/guest-only";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getButtonClassName } from "@/components/ui/button-styles";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import {
  activateUser,
  deleteUser,
  fetchAdminUsers,
  suspendUser,
  updateUserQuota,
} from "@/lib/api";
import {
  isApiRequestError,
  toIndonesianMessage,
} from "@/lib/auth-errors";
import { formatBytes, parseGbInput } from "@/lib/format-bytes";
import { useSession } from "@/lib/session";
import { cn } from "@/lib/cn";

const HALAMAN = 20;

function useDebouncedValue(value: string, delayMs = 300): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

function inisial(nama: string | null, email: string): string {
  const sumber = nama?.trim() || email;
  return sumber.charAt(0).toUpperCase() || "?";
}

function StatusChip({ user }: { user: AdminUserItem }) {
  if (user.status === "SUSPENDED") {
    return (
      <Badge variant="danger" icon={Ban}>
        Ditangguhkan
      </Badge>
    );
  }
  if (!user.emailVerified) {
    return (
      <Badge variant="warning" icon={Clock}>
        Belum terverifikasi
      </Badge>
    );
  }
  return (
    <Badge variant="success" icon={Check}>
      Aktif
    </Badge>
  );
}

function persenPakai(usedBytes: string, quotaBytes: string): number {
  const pakai = BigInt(usedBytes);
  const kuota = BigInt(quotaBytes);
  const nol = BigInt(0);
  if (kuota <= nol) {
    return pakai > nol ? 100 : 0;
  }
  return Number((pakai * BigInt(10000)) / kuota) / 100;
}

function UsageBar({ user }: { user: AdminUserItem }) {
  const persen = persenPakai(user.usedBytes, user.quotaBytes);
  const lebar = Math.min(persen, 100);
  return (
    <div className="flex flex-col gap-1">
      <div
        role="img"
        aria-label={`Pemakaian ${formatBytes(user.usedBytes)} dari ${formatBytes(user.quotaBytes)}`}
        className="h-1 w-full overflow-hidden rounded-full bg-line"
      >
        <div
          className={cn(
            "h-full rounded-full",
            persen >= 100
              ? "bg-danger"
              : persen > 80
                ? "bg-warning"
                : "bg-accent",
          )}
          style={{ width: `${lebar}%` }}
        />
      </div>
      <p className="text-caption text-ink-muted">
        {formatBytes(user.usedBytes)} dari {formatBytes(user.quotaBytes)}
      </p>
    </div>
  );
}

function TidakAdaAkses() {
  return (
    <main className="flex flex-col items-start gap-3">
      <h1 className="text-h1 text-ink">Tidak ada akses</h1>
      <p className="text-body text-ink-muted">
        Halaman ini khusus admin. Kamu bisa kembali ke galeri.
      </p>
      <Link
        href="/app"
        className={getButtonClassName("secondary", "mt-2 w-full sm:w-auto")}
      >
        Ke galeri
      </Link>
    </main>
  );
}

function bytesKeGb(quotaBytes: string): string {
  const gb = Number(BigInt(quotaBytes)) / (1024 * 1024 * 1024);
  return String(Math.round(gb * 100) / 100);
}

type Mutations = {
  suspend: ReturnType<typeof useMutation<AdminUserItem, Error, string>>;
  activate: ReturnType<typeof useMutation<AdminUserItem, Error, string>>;
  quota: ReturnType<
    typeof useMutation<AdminUserItem, Error, { id: string; quotaBytes: string }>
  >;
  hapus: ReturnType<typeof useMutation<void, Error, string>>;
};

function UserDetailSheet({
  user,
  akuId,
  mutations,
  onClose,
  onChanged,
  onDeleted,
}: {
  user: AdminUserItem;
  akuId: string;
  mutations: Mutations;
  onClose: () => void;
  onChanged: (updated: AdminUserItem) => void;
  onDeleted: () => void;
}) {
  const milikSendiri = user.id === akuId;
  const ditangguhkan = user.status === "SUSPENDED";
  const [gb, setGb] = useState(() => bytesKeGb(user.quotaBytes));
  const [gbError, setGbError] = useState<string | null>(null);
  const [aksiError, setAksiError] = useState<string | null>(null);
  const [konfirmasiTangguh, setKonfirmasiTangguh] = useState(false);
  const [ketikEmail, setKetikEmail] = useState("");

  // Sheet di-mount ulang per pengguna (key=user.id di pemanggil),
  // jadi state awal dari prop selalu segar tanpa effect.

  function simpanKuota() {
    setGbError(null);
    const byte = parseGbInput(gb);
    if (byte === null) {
      setGbError("Masukkan angka yang valid, misalnya 5 atau 1,5.");
      return;
    }
    mutations.quota.mutate(
      { id: user.id, quotaBytes: byte.toString() },
      {
        onSuccess: (updated) => {
          onChanged(updated);
        },
        onError: (error) => {
          setGbError(toIndonesianMessage(error));
        },
      },
    );
  }

  function jalankanTangguh() {
    setAksiError(null);
    mutations.suspend.mutate(user.id, {
      onSuccess: (updated) => {
        setKonfirmasiTangguh(false);
        onChanged(updated);
      },
      onError: (error) => {
        setAksiError(toIndonesianMessage(error));
      },
    });
  }

  function jalankanAktif() {
    setAksiError(null);
    mutations.activate.mutate(user.id, {
      onSuccess: (updated) => {
        onChanged(updated);
      },
      onError: (error) => {
        setAksiError(toIndonesianMessage(error));
      },
    });
  }

  function jalankanHapus() {
    setAksiError(null);
    mutations.hapus.mutate(user.id, {
      onSuccess: () => {
        onDeleted();
      },
      onError: (error) => {
        setAksiError(toIndonesianMessage(error));
      },
    });
  }

  const sibuk =
    mutations.suspend.isPending ||
    mutations.activate.isPending ||
    mutations.quota.isPending ||
    mutations.hapus.isPending;

  return (
    <Sheet open onClose={onClose} title={user.name ?? user.email}>
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sunken text-body font-semibold text-ink"
          >
            {inisial(user.name, user.email)}
          </span>
          <div className="flex min-w-0 flex-col gap-1">
            <p className="truncate text-body text-ink">{user.email}</p>
            <StatusChip user={user} />
          </div>
        </div>
        <UsageBar user={user} />

        <section aria-labelledby="kuota-judul" className="flex flex-col gap-2">
          <h3 id="kuota-judul" className="text-h3 text-ink">
            Ubah kuota
          </h3>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Input
                label="Kuota (GB)"
                inputMode="decimal"
                autoComplete="off"
                placeholder="5"
                value={gb}
                onChange={(event) => setGb(event.target.value)}
                error={gbError ?? undefined}
                disabled={sibuk}
              />
            </div>
            <Button
              type="button"
              variant="primary"
              loading={mutations.quota.isPending}
              disabled={sibuk && !mutations.quota.isPending}
              onClick={simpanKuota}
              className="shrink-0 px-4"
            >
              Simpan
            </Button>
          </div>
        </section>

        <section aria-labelledby="status-judul" className="flex flex-col gap-2">
          <h3 id="status-judul" className="text-h3 text-ink">
            Status akun
          </h3>
          {milikSendiri ? (
            <p className="text-body text-ink-muted">
              Ini akunmu sendiri. Kamu tidak bisa menangguhkan atau
              menghapusnya.
            </p>
          ) : ditangguhkan ? (
            <Button
              type="button"
              variant="secondary"
              loading={mutations.activate.isPending}
              disabled={sibuk}
              onClick={jalankanAktif}
              className="w-full"
            >
              Aktifkan
            </Button>
          ) : konfirmasiTangguh ? (
            <div className="flex flex-col gap-2">
              <p className="text-body text-ink">
                Tangguhkan {user.name ?? user.email}? Dia akan keluar dari
                semua perangkat dan link publiknya tidak aktif sampai akunnya
                diaktifkan lagi.
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  loading={mutations.suspend.isPending}
                  disabled={sibuk}
                  onClick={jalankanTangguh}
                  className="flex-1"
                >
                  Ya, tangguhkan
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={sibuk}
                  onClick={() => setKonfirmasiTangguh(false)}
                  className="flex-1"
                >
                  Batal
                </Button>
              </div>
            </div>
          ) : (
            <Button
              type="button"
              variant="secondary"
              disabled={sibuk}
              onClick={() => setKonfirmasiTangguh(true)}
              className="w-full"
            >
              Tangguhkan
            </Button>
          )}
        </section>

        <section aria-labelledby="hapus-judul" className="flex flex-col gap-2">
          <h3 id="hapus-judul" className="text-h3 text-ink">
            Hapus pengguna
          </h3>
          <p className="text-body text-ink">
            Hapus {user.name ?? user.email}? Semua file, album, dan link
            miliknya ikut terhapus dan tidak bisa dikembalikan.
          </p>
          <Input
            label="Ketik email pengguna untuk konfirmasi"
            type="text"
            autoComplete="off"
            placeholder={user.email}
            value={ketikEmail}
            onChange={(event) => setKetikEmail(event.target.value)}
            disabled={sibuk || milikSendiri}
          />
          <Button
            type="button"
            variant="danger"
            loading={mutations.hapus.isPending}
            disabled={milikSendiri || sibuk || ketikEmail !== user.email}
            onClick={jalankanHapus}
            className="w-full"
          >
            Hapus pengguna
          </Button>
        </section>

        {aksiError ? <FormError message={aksiError} /> : null}
      </div>
    </Sheet>
  );
}

export function AdminClient() {
  const session = useSession();
  const queryClient = useQueryClient();
  const [cari, setCari] = useState("");
  const [terpilih, setTerpilih] = useState<AdminUserItem | null>(null);
  const tunda = useDebouncedValue(cari);

  const daftar = useInfiniteQuery({
    queryKey: ["admin-users", tunda],
    queryFn: ({ pageParam }: { pageParam?: string }) =>
      fetchAdminUsers({
        q: tunda || undefined,
        limit: HALAMAN,
        cursor: pageParam,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (halaman) => halaman.nextCursor ?? undefined,
    retry: false,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["admin-users"] });

  const suspend = useMutation({
    mutationFn: (id: string) => suspendUser(id),
    onSuccess: invalidate,
  });
  const activate = useMutation({
    mutationFn: (id: string) => activateUser(id),
    onSuccess: invalidate,
  });
  const quota = useMutation({
    mutationFn: (input: { id: string; quotaBytes: string }) =>
      updateUserQuota(input.id, { quotaBytes: input.quotaBytes }),
    onSuccess: invalidate,
  });
  const hapus = useMutation({
    mutationFn: (id: string) => deleteUser(id),
    onSuccess: invalidate,
  });

  const aku = session.data;
  if (!aku) {
    // Shell /app hanya merender anak bila sesi ada; kerangka di sini
    // untuk keamanan tipe dan transisi.
    return <AuthLoadingSkeleton />;
  }
  if (aku.role !== "ADMIN") {
    return <TidakAdaAkses />;
  }

  const semua = (daftar.data?.pages ?? []).flatMap((p) => p.items);

  return (
    <main className="flex flex-col gap-4">
      <h1 className="text-h1 text-ink">Pengguna</h1>
      <Input
        label="Cari pengguna"
        type="search"
        autoComplete="off"
        placeholder="Nama atau email"
        value={cari}
        onChange={(event) => setCari(event.target.value)}
      />

      {daftar.isPending ? (
        <div
          aria-busy="true"
          aria-label="Memuat daftar pengguna"
          className="flex flex-col gap-3"
        >
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-24 w-full animate-pulse rounded-lg bg-sunken"
            />
          ))}
        </div>
      ) : daftar.isError ? (
        isApiRequestError(daftar.error) && daftar.error.code === "FORBIDDEN" ? (
          <TidakAdaAkses />
        ) : (
          <Card>
            <div className="flex flex-col items-start gap-4">
              <FormError message={toIndonesianMessage(daftar.error)} />
              <Button
                type="button"
                variant="primary"
                onClick={() => daftar.refetch()}
              >
                Coba lagi
              </Button>
            </div>
          </Card>
        )
      ) : semua.length === 0 ? (
        <Card>
          <p className="text-body text-ink-muted">
            {tunda
              ? `Tidak ada pengguna yang cocok dengan "${tunda}".`
              : "Belum ada pengguna."}
          </p>
        </Card>
      ) : (
        <>
          <ul className="flex flex-col gap-3 md:hidden">
            {semua.map((user) => (
              <li key={user.id}>
                <button
                  type="button"
                  onClick={() => setTerpilih(user)}
                  aria-label={`Detail ${user.name ?? user.email}`}
                  className="flex w-full items-center gap-3 rounded-lg border border-line bg-surface p-4 text-left transition-transform duration-150 motion-safe:active:scale-[0.99]"
                >
                  <span
                    aria-hidden="true"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sunken text-body font-semibold text-ink"
                  >
                    {inisial(user.name, user.email)}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="truncate text-body font-medium text-ink">
                      {user.name ?? user.email}
                    </span>
                    <span className="truncate text-caption text-ink-muted">
                      {user.email}
                    </span>
                    <UsageBar user={user} />
                    <span>
                      <StatusChip user={user} />
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-line">
                  <th scope="col" className="px-3 py-3 text-label text-ink">
                    Nama
                  </th>
                  <th scope="col" className="px-3 py-3 text-label text-ink">
                    Email
                  </th>
                  <th scope="col" className="px-3 py-3 text-label text-ink">
                    Pemakaian
                  </th>
                  <th scope="col" className="px-3 py-3 text-label text-ink">
                    Status
                  </th>
                  <th scope="col" className="px-3 py-3 text-label text-ink">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody>
                {semua.map((user) => (
                  <tr key={user.id} className="border-b border-line">
                    <td className="px-3 py-3 text-body text-ink">
                      {user.name ?? "—"}
                    </td>
                    <td className="px-3 py-3 text-body text-ink-muted">
                      {user.email}
                    </td>
                    <td className="px-3 py-3">
                      <div className="min-w-36">
                        <UsageBar user={user} />
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <StatusChip user={user} />
                    </td>
                    <td className="px-3 py-3">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setTerpilih(user)}
                        aria-label={`Detail ${user.name ?? user.email}`}
                        className="px-4"
                      >
                        Detail
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {daftar.hasNextPage ? (
            <Button
              type="button"
              variant="secondary"
              loading={daftar.isFetchingNextPage}
              disabled={!daftar.hasNextPage || daftar.isFetchingNextPage}
              onClick={() => daftar.fetchNextPage()}
              className="w-full sm:w-auto sm:self-center"
            >
              Muat lagi
            </Button>
          ) : null}
        </>
      )}

      {terpilih ? (
        <UserDetailSheet
          key={terpilih.id}
          user={terpilih}
          akuId={aku.id}
          mutations={{ suspend, activate, quota, hapus }}
          onClose={() => setTerpilih(null)}
          onChanged={(updated) => setTerpilih(updated)}
          onDeleted={() => setTerpilih(null)}
        />
      ) : null}
    </main>
  );
}

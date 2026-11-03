import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { Ban, Check, Clock, Lock } from "lucide-react";
import { BottomNav } from "@/components/layout/bottom-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/ui/theme-toggle";

// Keputusan gerbang diambil saat request, bukan saat build.
// Proyek memakai cacheComponents sehingga segmen force-dynamic tidak
// berlaku; await connection() menghentikan prerender di sini, dan
// instant = false mengizinkan rute ini dirender per request.
export const instant = false;
export const metadata: Metadata = {
  title: "Pratinjau UI",
  robots: {
    index: false,
    follow: false,
  },
};

function isPreviewAllowed(): boolean {
  return (
    process.env.NODE_ENV !== "production" ||
    process.env.VERCEL_ENV === "preview"
  );
}

const COLOR_TOKENS: Array<{
  name: string;
  swatch: string;
  usage: string;
}> = [
  { name: "paper", swatch: "bg-paper", usage: "Latar halaman" },
  { name: "surface", swatch: "bg-surface", usage: "Kartu, sheet, input" },
  {
    name: "sunken",
    swatch: "bg-sunken",
    usage: "Area cekung, placeholder",
  },
  { name: "ink", swatch: "bg-ink", usage: "Teks utama" },
  { name: "ink-muted", swatch: "bg-ink-muted", usage: "Teks sekunder" },
  { name: "line", swatch: "bg-line", usage: "Garis dan border" },
  { name: "accent", swatch: "bg-accent", usage: "Tombol utama, tautan" },
  { name: "accent-hover", swatch: "bg-accent-hover", usage: "Tekan tombol" },
  { name: "accent-soft", swatch: "bg-accent-soft", usage: "Chip, terpilih" },
  { name: "on-accent", swatch: "bg-on-accent", usage: "Teks di atas aksen" },
  { name: "success", swatch: "bg-success", usage: "Status aktif" },
  { name: "warning", swatch: "bg-warning", usage: "Status peringatan" },
  { name: "danger", swatch: "bg-danger", usage: "Status bahaya" },
  { name: "scrim", swatch: "bg-scrim", usage: "Lapisan di atas foto" },
];

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-h2 text-ink">{title}</h2>
      {children}
    </section>
  );
}

function PhoneFrame({
  label,
  activeRoute,
}: {
  label: string;
  activeRoute: string;
}) {
  return (
    <div className="flex w-full max-w-[360px] flex-col gap-2">
      <p className="text-label text-ink-muted">{label}</p>
      <div className="flex min-h-64 flex-col overflow-hidden rounded-lg border border-line bg-paper">
        <div className="flex h-14 items-center border-b border-line bg-paper px-4">
          <p className="text-h3 text-ink">Galeri</p>
        </div>
        <div className="grid flex-1 grid-cols-3 gap-0.5 p-0.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="aspect-square bg-sunken" />
          ))}
        </div>
        <BottomNav activeRoute={activeRoute} />
      </div>
    </div>
  );
}

export default async function DevUiPage() {
  await connection();
  if (!isPreviewAllowed()) {
    notFound();
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-8">
      <header className="flex flex-col gap-3">
        <h1 className="text-h1 text-ink">Pratinjau Komponen</h1>
        <p className="text-body text-ink-muted">
          Halaman ini hanya tampil di pengembangan dan pratinjau Vercel. Ganti
          tema untuk melihat token terang dan gelap.
        </p>
        <ThemeToggle className="w-full max-w-[360px]" />
      </header>

      <Section title="Warna">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {COLOR_TOKENS.map((token) => (
            <div
              key={token.name}
              className="flex flex-col gap-2 rounded-md border border-line bg-surface p-3"
            >
              <div
                className={`h-16 w-full rounded-sm border border-line ${token.swatch}`}
                aria-hidden="true"
              />
              <p className="text-label text-ink">{token.name}</p>
              <p className="text-caption text-ink-muted">{token.usage}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Tipografi">
        <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
          <p className="text-display text-ink">Display 36/40</p>
          <p className="text-h1 text-ink">Judul H1 28/34</p>
          <p className="text-h2 text-ink">Judul bagian H2 22/28</p>
          <p className="text-h3 text-ink">Judul kartu H3 18/24</p>
          <p className="text-body text-ink">
            Teks isi 16/24. Dipakai untuk paragraf, input, dan tombol utama.
          </p>
          <p className="text-label text-ink">Label 14/20 untuk form</p>
          <p className="text-caption text-ink-muted">
            METADATA 12/16 UNTUK TANGGAL DAN UKURAN
          </p>
        </div>
      </Section>

      <Section title="Tombol">
        <div className="flex flex-col gap-3">
          <Button variant="primary">Unggah</Button>
          <Button variant="secondary">Bagikan</Button>
          <Button variant="ghost">Batal</Button>
          <Button variant="danger">Hapus</Button>
          <Button variant="primary" loading>
            Mengunggah
          </Button>
          <Button variant="primary" disabled>
            Nonaktif
          </Button>
          <p className="text-caption text-ink-muted">
            Status ditekan: tekan dan tahan tombol untuk melihat warna
            accent-hover.
          </p>
        </div>
      </Section>

      <Section title="Input">
        <div className="flex flex-col gap-4">
          <Input
            label="Nama"
            name="nama"
            placeholder="cth. Liburan ke Dieng"
            hint="Nama ini hanya terlihat olehmu."
          />
          <Input
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="nama@contoh.id"
          />
          <Input
            label="Password"
            name="password"
            type="password"
            defaultValue="salah-sandi"
            error="Email atau password tidak cocok."
          />
          <Input
            label="Nonaktif"
            name="nonaktif"
            disabled
            defaultValue="Tidak bisa diubah"
          />
          <p className="text-caption text-ink-muted">
            Ketuk kolom Email untuk melihat ring fokus 2px.
          </p>
        </div>
      </Section>

      <Section title="Kartu">
        <Card heading="Liburan ke Dieng" description="12 foto · 10–12 Okt 2026">
          <div className="mt-3 aspect-video w-full rounded-sm bg-sunken" />
        </Card>
      </Section>

      <Section title="Grid Galeri (US-20 — 3 Kolom di HP)">
        <div className="flex flex-col gap-4">
          <div className="flex items-baseline justify-between px-1">
            <h3 className="text-h3 font-serif text-ink">Sabtu, 31 Oktober 2026</h3>
            <span className="text-caption text-ink-muted">3 item</span>
          </div>

          <div className="grid grid-cols-3 gap-[2px]">
            {/* Foto 1 */}
            <div className="relative aspect-square overflow-hidden bg-sunken">
              <div className="flex h-full w-full items-center justify-center text-ink-muted">
                <span className="text-caption">Foto 1</span>
              </div>
            </div>

            {/* Video dengan durasi dan ikon putar */}
            <div className="relative aspect-square overflow-hidden bg-sunken">
              <div className="flex h-full w-full items-center justify-center text-ink-muted">
                <span className="text-caption">Video 1</span>
              </div>
              <div className="absolute top-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-scrim text-on-accent">
                <span className="text-[10px]">▶</span>
              </div>
              <div className="absolute bottom-1.5 left-1.5 rounded-[4px] bg-scrim px-1 py-0.5 text-caption text-on-accent">
                0:42
              </div>
            </div>

            {/* Foto 2 */}
            <div className="relative aspect-square overflow-hidden bg-sunken">
              <div className="flex h-full w-full items-center justify-center text-ink-muted">
                <span className="text-caption">Foto 2</span>
              </div>
            </div>
          </div>
        </div>
      </Section>

      <Section title="Badge">
        <div className="flex flex-wrap gap-2">
          <Badge variant="accent">Baru</Badge>
          <Badge variant="neutral">Arsip</Badge>
          <Badge variant="success" icon={Check}>
            Aktif
          </Badge>
          <Badge variant="warning" icon={Clock}>
            Kedaluwarsa
          </Badge>
          <Badge variant="danger" icon={Ban}>
            Dicabut
          </Badge>
          <Badge variant="neutral" icon={Lock}>
            Berpassword
          </Badge>
        </div>
      </Section>

      <Section title="Navigasi Bawah">
        <div className="grid gap-6 sm:grid-cols-2">
          <PhoneFrame label="Tab Galeri aktif" activeRoute="/galeri" />
          <PhoneFrame label="Tab Album aktif" activeRoute="/album" />
          <PhoneFrame label="Tab Link aktif" activeRoute="/shares" />
          <PhoneFrame label="Tab Akun aktif" activeRoute="/settings" />
        </div>
        <p className="text-caption text-ink-muted">
          Tautan di bingkai memakai rute asli dan bisa membuka halaman
          kosong. Di layar ≥1024px navigasi berubah menjadi sidebar kiri 240px
          — periksa dengan melebarkan jendela, bukan di bingkai 360 ini.
        </p>
      </Section>

      <Section title="Sidebar Desktop">
        <div className="overflow-hidden rounded-lg border border-line bg-paper">
          <div className="lg:flex lg:min-h-120">
            <BottomNav activeRoute="/shares" />
            <div className="hidden flex-1 items-center justify-center p-6 lg:flex">
              <p className="text-body text-ink-muted">
                Area konten. Sidebar hanya muncul di lebar jendela ≥1024px.
              </p>
            </div>
          </div>
        </div>
      </Section>
    </main>
  );
}

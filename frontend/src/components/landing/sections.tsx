import {
  ArrowDown,
  ArrowRight,
  Layers,
  ShieldCheck,
  Smartphone,
  Sparkles,
} from "lucide-react";
import { ButtonLink } from "@/components/ui/button-link";
import { Logo } from "./logo";
import { AlbumMock, LinkMock, UploadMock } from "./mocks";
import { PhotoStack } from "./photo-card";

/**
 * Bagian-bagian landing page (Server Component, statis).
 * Desain bersih editorial, tanpa jargon teknis, standar industri modern.
 */

export function SiteHeader() {
  return (
    <header className="mx-auto flex w-full max-w-[560px] items-center justify-between px-4 pt-[calc(env(safe-area-inset-top,0px)+1rem)] pb-3 md:max-w-[960px] md:px-6 md:py-5">
      <Logo />
      <ButtonLink
        variant="secondary"
        href="/login"
        className="h-11 px-[18px] text-[15px] md:px-5"
      >
        Masuk
      </ButtonLink>
    </header>
  );
}

export function Hero() {
  return (
    <section className="mx-auto w-full max-w-[560px] px-4 pt-4 md:max-w-[960px] md:px-6 md:pt-8">
      <div className="md:flex md:items-center md:gap-10">
        <div className="md:w-[420px] md:shrink-0">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-line bg-surface/80 px-3.5 py-1 text-xs font-medium text-ink-muted backdrop-blur-sm">
            <Sparkles size={13} className="text-accent" />
            <span>Ruang Berbagi Foto & Video Resolusi Penuh</span>
          </div>

          <h1 className="text-display tracking-[-0.01em] text-ink">
            Abadikan perjalananmu. Bagikan dalam{" "}
            <em className="font-medium italic text-accent">satu tautan indah</em>.
          </h1>

          <p className="mt-4 text-body text-ink md:mt-5 leading-relaxed">
            Simpan foto dan video resolusi penuh tanpa kompresi buram. Kumpulkan
            momen berharga ke dalam album elegan dan kirimkan ke siapa saja.
            Penerima dapat langsung menikmati tayangan layar penuh dan menyimpan
            koleksi tanpa perlu membuat akun.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 md:mt-7">
            <ButtonLink href="/login">
              Mulai Sekarang
              <ArrowRight
                size={18}
                strokeWidth={1.5}
                aria-hidden="true"
              />
            </ButtonLink>
            <a
              href="#cara"
              className="inline-flex min-h-11 items-center gap-1.5 text-[15px] font-medium text-ink underline underline-offset-4"
            >
              Cara kerjanya
              <ArrowDown size={18} strokeWidth={1.5} aria-hidden="true" />
            </a>
          </div>

          <p className="mt-4 text-label text-ink-muted">
            Belum punya akun?{" "}
            <a
              href="/register"
              className="text-accent underline underline-offset-[3px]"
            >
              Daftar gratis
            </a>
          </p>
          <p className="mt-1.5 text-[13px] leading-[18px] text-ink-muted">
            Kenanganmu sepenuhnya milikmu. Hanya orang yang memiliki tautan yang
            dapat membukanya.
          </p>
        </div>
        <div className="mt-10 min-w-0 flex-1 md:mt-0">
          <PhotoStack />
        </div>
      </div>
    </section>
  );
}

const STEPS = [
  {
    number: "1",
    title: "Pilih & Simpan Seketika",
    text: "Pilih puluhan foto dan video perjalanan langsung dari ponselmu. Unggahan tetap aman dan otomatis dilanjutkan jika koneksi internet terputus di jalan.",
    mock: <UploadMock />,
  },
  {
    number: "2",
    title: "Satu Tautan untuk Semua",
    text: "Kumpulkan momen ke dalam album cantik. Atur masa berlaku, pasang kata sandi jika diinginkan, dan bagikan tautannya dengan satu sentuhan mudah.",
    mock: <LinkMock />,
  },
  {
    number: "3",
    title: "Buka & Nikmati Tanpa Ribet",
    text: "Teman dan kerabatmu cukup membuka tautan di layar ponsel mereka. Tonton video dalam layar penuh dan simpan seluruh album tanpa harus memasang aplikasi.",
    mock: <AlbumMock />,
  },
] as const;

export function HowItWorks() {
  return (
    <section
      id="cara"
      className="mx-auto w-full max-w-[560px] scroll-mt-4 px-4 pt-[72px] md:max-w-[960px] md:px-6 md:pt-[104px]"
    >
      <div className="md:flex md:items-baseline md:justify-between md:gap-8 md:pb-6">
        <div>
          <h2 className="text-h2 text-ink md:text-h1">Cara kerjanya</h2>
          <p className="mt-2 text-body text-ink-muted">
            Tiga langkah sederhana, seluruhnya selesai langsung dari ponselmu.
          </p>
        </div>
      </div>
      <div className="mt-6 md:mt-0">
        {STEPS.map((step, index) => (
          <div
            key={step.number}
            className={
              "border-t border-line py-6 md:flex md:items-start md:gap-6 md:py-8 " +
              (index === STEPS.length - 1 ? "max-md:pb-2 md:border-b" : "")
            }
          >
            <div className="w-7 shrink-0 font-serif text-[40px] font-semibold leading-[40px] text-accent md:w-12 md:text-5xl md:leading-[48px]">
              {step.number}
            </div>
            <div className="mt-3 md:mt-0 md:w-[300px] md:shrink-0">
              <h3 className="text-h3 text-ink">{step.title}</h3>
              <p className="mt-1.5 text-body text-ink leading-relaxed md:mt-2">
                {step.text}
              </p>
            </div>
            <div className="mt-4 min-w-0 md:ml-auto md:mt-0 md:w-full md:max-w-[420px] md:flex-1">
              {step.mock}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

const HIGHLIGHTS = [
  {
    icon: Sparkles,
    title: "Resolusi Penuh Tanpa Kompresi",
    desc: "Setiap foto dan video tersimpan dalam ketajaman aslinya tanpa penurunan kualitas atau warna seperti pada aplikasi perpesanan.",
  },
  {
    icon: ShieldCheck,
    title: "Kendali Privasi Berada di Tanganmu",
    desc: "Lindungi tautan dengan kata sandi, tentukan batas waktu berbagi, atau tutup akses kapan saja dengan satu sentuhan.",
  },
  {
    icon: Layers,
    title: "Simpan Seluruh Koleksi Sekaligus",
    desc: "Penerima dapat mengunduh seluruh isi album secara bersamaan ke ponsel mereka tanpa perlu repot menyimpan satu per satu.",
  },
  {
    icon: Smartphone,
    title: "Buka di Mana Saja Tanpa Aplikasi",
    desc: "Bekerja mulus di iPhone, Android, tablet, maupun komputer tanpa mewajibkan siapa pun mengunduh aplikasi tambahan.",
  },
] as const;

export function RulesSection() {
  return (
    <section className="mx-auto w-full max-w-[560px] px-4 pt-[72px] md:max-w-[960px] md:px-6 md:pt-[104px]">
      <div className="md:flex md:items-start md:gap-12">
        <div className="min-w-0 flex-1">
          <h2 className="text-h2 text-ink md:text-h1">
            Pengalaman Berbagi yang Lebih Menyenangkan
          </h2>
          <p className="mt-2 text-body text-ink-muted md:mt-3">
            Dirancang dengan kesederhanaan, privasi ketat, dan tampilan visual yang memanjakan mata.
          </p>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 md:mt-8">
            {HIGHLIGHTS.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  className="rounded-lg border border-line bg-surface p-4 transition-shadow hover:shadow-xs"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-accent-soft text-accent">
                    <Icon size={18} strokeWidth={1.75} />
                  </div>
                  <h3 className="mt-3 font-serif text-[16px] font-semibold text-ink">
                    {item.title}
                  </h3>
                  <p className="mt-1.5 text-label text-ink-muted leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-10 md:mt-12 md:w-[320px] md:shrink-0">
          <div className="relative rounded-lg border border-line bg-surface px-5 pb-6 pt-7 shadow-float motion-safe:rotate-[-1deg] md:motion-safe:rotate-[-1.5deg]">
            <div
              aria-hidden="true"
              className="absolute -top-[10px] left-1/2 -ml-[40px] h-[20px] w-[80px] rotate-2 bg-accent-soft opacity-90 motion-reduce:rotate-0"
            />
            <div className="text-xs font-semibold uppercase tracking-[0.04em] text-ink-muted">
              Komitmen Privasi
            </div>
            <p className="mt-2.5 font-serif text-[17px] font-medium italic leading-[25px] text-ink">
              “Kenanganmu sepenuhnya milikmu. Galeriku dirancang tanpa pelacakan data, tanpa iklan, dan tautan hanya dapat dibuka oleh orang yang kamu tuju.”
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export function CtaSection() {
  return (
    <section
      id="daftar"
      className="mx-auto w-full max-w-[560px] px-4 pt-[72px] md:max-w-[960px] md:px-6 md:pt-[104px]"
    >
      <div className="rounded-2xl border border-line bg-surface p-6 sm:p-10 shadow-sm md:flex md:items-center md:justify-between md:gap-8">
        <div className="min-w-0">
          <h2 className="text-h2 text-ink md:text-h1">
            Siap menyimpan perjalananmu?
          </h2>
          <p className="mt-2 text-body text-ink-muted">
            Daftar gratis dalam hitungan detik dan nikmati kemudahan berbagi foto serta video tanpa batas kompresi.
          </p>
        </div>
        <div className="mt-6 flex flex-col items-start gap-3 sm:flex-row sm:items-center md:mt-0 md:shrink-0">
          <ButtonLink href="/register" className="w-full sm:w-auto px-7">
            Buat Akun Gratis
            <ArrowRight size={18} strokeWidth={1.5} aria-hidden="true" />
          </ButtonLink>
        </div>
      </div>
      <p className="mt-4 text-center text-label text-ink-muted">
        Sudah punya akun?{" "}
        <a
          href="/login"
          className="text-accent underline underline-offset-[3px]"
        >
          Masuk di sini
        </a>
      </p>
    </section>
  );
}

export function SiteFooter() {
  return (
    <footer className="mx-auto w-full max-w-[560px] px-4 pb-10 pt-14 md:flex md:max-w-[960px] md:items-center md:justify-between md:gap-6 md:px-6 md:pb-12 md:pt-[72px]">
      <Logo small />
      <p className="mt-3 text-caption text-ink-muted md:mt-0">
        © 2026 Galeriku. Simpan foto dan video perjalananmu.
      </p>
      <a
        href="/privasi"
        className="mt-1 inline-flex min-h-11 items-center text-caption text-ink-muted underline underline-offset-4 md:mt-0"
      >
        Kebijakan privasi
      </a>
    </footer>
  );
}

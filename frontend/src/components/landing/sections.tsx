import { ArrowDown, ArrowRight } from "lucide-react";
import { ButtonLink } from "@/components/ui/button-link";
import { Logo } from "./logo";
import { AlbumMock, LinkMock, UploadMock } from "./mocks";
import { PhotoStack } from "./photo-card";

/**
 * Bagian-bagian landing page (Server Component, statis).
 * Copy persis dari acuan visual docs/design/landing/.
 */

export function SiteHeader() {
  return (
    <header className="mx-auto flex w-full max-w-[560px] items-center justify-between px-4 py-3 md:max-w-[960px] md:px-6 md:py-5">
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
    <section className="mx-auto w-full max-w-[560px] px-4 pt-6 md:max-w-[960px] md:px-6 md:pt-10">
      <div className="md:flex md:items-center md:gap-10">
        <div className="md:w-[400px] md:shrink-0">
          <h1 className="text-display tracking-[-0.01em] text-ink">
            Simpan foto perjalananmu. Kirim{" "}
            <em className="font-medium italic text-accent">satu link</em> ke
            teman.
          </h1>
          <p className="mt-4 text-body text-ink md:mt-5">
            Foto dan video dari HP disimpan di server pribadi, bukan di kuota
            Google Drive. Pilih banyak file, buat satu link, kirim. Temanmu
            tinggal buka dan unduh, tanpa daftar.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-1 md:mt-7">
            <ButtonLink href="/login">
              Masuk
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
          <p className="mt-3 text-label text-ink-muted">
            Belum punya akun?{" "}
            <a
              href="/register"
              className="text-accent underline underline-offset-[3px]"
            >
              Daftar
            </a>
          </p>
          <p className="mt-2 text-[13px] leading-[18px] text-ink-muted">
            Fotomu tetap milikmu. Hanya link yang kamu buat yang bisa dibuka
            orang lain.
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
    title: "Unggah dari HP",
    text: "Pilih puluhan foto dan video sekaligus. Kalau sinyal putus di jalan, unggahan dilanjutkan sendiri dari bagian terakhir.",
    mock: <UploadMock />,
  },
  {
    number: "2",
    title: "Bagikan lewat link",
    text: "Satu link untuk satu foto atau satu album. Atur masa berlakunya, pasang password kalau perlu, dan cabut kapan saja.",
    mock: <LinkMock />,
  },
  {
    number: "3",
    title: "Teman tanpa login",
    text: "Temanmu membuka link di browser HP, melihat foto, memutar video, lalu mengunduh. Tidak perlu akun, tidak perlu pasang aplikasi.",
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
        <h2 className="text-h2 text-ink md:text-h1">Cara kerjanya</h2>
        <p className="mt-2 text-body text-ink-muted md:mt-0">
          Tiga langkah, semuanya bisa dari HP.
        </p>
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
              <p className="mt-1.5 text-body text-ink md:mt-2">{step.text}</p>
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

const RULES: Array<{ label: string; value: string }> = [
  { label: "Kuota awal per akun", value: "5 GB" },
  { label: "Ukuran foto maksimum", value: "25 MB" },
  { label: "Ukuran video maksimum", value: "2 GB" },
  { label: "Masa berlaku link", value: "30 hari" },
];

export function RulesSection() {
  return (
    <section className="mx-auto w-full max-w-[560px] px-4 pt-[72px] md:max-w-[960px] md:px-6 md:pt-[104px]">
      <div className="md:flex md:items-start md:gap-16">
        <div className="min-w-0 flex-1">
          <h2 className="text-h2 text-ink md:text-h1">Aturan mainnya</h2>
          <p className="mt-2 text-body text-ink-muted md:mt-3">
            Galeriku jalan di server pribadi, jadi ada batasnya. Ini yang perlu
            kamu tahu sebelum mulai.
          </p>
          <div className="mt-5 md:mt-6">
            {RULES.map((rule) => (
              <div
                key={rule.label}
                className="flex items-baseline gap-2 py-2.5"
              >
                <span className="text-[15px] leading-[22px] text-ink">
                  {rule.label}
                </span>
                <span
                  aria-hidden="true"
                  className="min-w-3 flex-1 border-b border-dotted border-line"
                />
                <span className="font-serif text-[18px] font-semibold leading-6 text-ink">
                  {rule.value}
                </span>
              </div>
            ))}
            <p className="pb-2.5 text-[13px] leading-[18px] text-ink-muted">
              Bawaan 30 hari. Bisa diganti 1 hari, 7 hari, atau tanpa batas.
            </p>
            <div className="pt-2.5">
              <div className="text-[15px] leading-[22px] text-ink">
                Format yang diterima
              </div>
              <div className="mt-0.5 text-label text-ink-muted">
                JPEG, PNG, WebP, GIF, HEIC, MP4, MOV, WebM
              </div>
            </div>
          </div>
        </div>
        <div className="mt-11 md:mt-6 md:w-[340px] md:shrink-0">
          <div className="relative rounded-[4px] border border-line bg-surface px-5 pb-[22px] pt-[26px] shadow-float motion-safe:rotate-[-1deg] md:px-6 md:pb-[26px] md:pt-[30px] md:motion-safe:rotate-[-1.5deg]">
            <div
              aria-hidden="true"
              className="absolute -top-[11px] left-1/2 -ml-[42px] h-[22px] w-[84px] rotate-2 bg-accent-soft opacity-90 motion-reduce:rotate-0"
            />
            <div className="text-xs font-semibold uppercase tracking-[0.04em] text-ink-muted">
              Catatan
            </div>
            <p className="mt-2 font-serif text-[18px] font-medium italic leading-[26px] text-ink md:mt-2.5 md:text-[20px] md:leading-7">
              Server Galeriku ada di rumah. Kalau listrik atau internetnya mati,
              Galeriku ikut istirahat. Anggap isinya salinan, dan file aslinya
              tetap simpan di HP.
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
      <div className="border-t border-line pt-10 md:flex md:items-center md:justify-between md:gap-8 md:pt-12">
        <div className="min-w-0">
          <h2 className="text-h2 text-ink md:text-h1">
            Siap menyimpan perjalananmu?
          </h2>
          <p className="mt-2 text-body text-ink-muted md:hidden">
            Daftar dengan email atau akun Google, lalu mulai unggah dari HP.
          </p>
          <p className="mt-2 hidden text-body text-ink-muted md:block">
            Daftar dengan email atau akun Google, lalu mulai unggah dari HP.
            Sudah punya akun?{" "}
            <a
              href="/login"
              className="text-accent underline underline-offset-[3px]"
            >
              Masuk
            </a>
          </p>
        </div>
        <ButtonLink href="/register" className="mt-5 w-full md:mt-0 md:w-auto md:shrink-0 md:px-7">
          Daftar
          <ArrowRight size={18} strokeWidth={1.5} aria-hidden="true" />
        </ButtonLink>
      </div>
      <p className="mt-3 text-label text-ink-muted md:hidden">
        Sudah punya akun?{" "}
        <a
          href="/login"
          className="text-accent underline underline-offset-[3px]"
        >
          Masuk
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

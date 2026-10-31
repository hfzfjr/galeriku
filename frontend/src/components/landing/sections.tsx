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
    <section className="mx-auto w-full max-w-[560px] px-4 pt-6 md:max-w-[960px] md:px-6 md:pt-10">
      <div className="md:flex md:items-center md:gap-10">
        <div className="md:w-[400px] md:shrink-0">
          <h1 className="text-display tracking-[-0.01em] text-ink">
            Simpan foto perjalananmu. Kirim{" "}
            <em className="font-medium italic text-accent">satu link</em> ke
            teman.
          </h1>
          <p className="mt-4 text-body text-ink md:mt-5">
            Ruang simpan berkelas untuk foto dan video resolusi penuh langsung
            dari ponselmu. Buat satu tautan elegan, bagikan ke siapa saja, dan
            biarkan kerabatmu membuka serta mengunduh tanpa perlu membuat akun.
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
            Fotomu sepenuhnya milikmu. Hanya orang dengan tautan yang dapat
            membukanya.
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
    title: "Unggah dari Ponsel",
    text: "Pilih banyak foto dan video sekaligus dengan mulus. Tetap aman dan otomatis dilanjutkan jika koneksi internet terputus di jalan.",
    mock: <UploadMock />,
  },
  {
    number: "2",
    title: "Bagikan Lewat Satu Tautan",
    text: "Satu tautan untuk satu foto atau seluruh album. Atur masa berlaku, pasang kata sandi jika perlu, dan cabut akses kapan saja.",
    mock: <LinkMock />,
  },
  {
    number: "3",
    title: "Buka & Unduh Tanpa Ribet",
    text: "Temanmu cukup membuka tautan di browser apa pun, menikmati tayangan layar penuh, lalu mengunduh tanpa harus memasang aplikasi.",
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

const HIGHLIGHTS = [
  {
    title: "Kualitas Asli Tanpa Kompresi",
    desc: "Foto dan video tersimpan dalam resolusi penuh tanpa penurunan ketajaman atau warna seperti pada aplikasi perpesanan.",
  },
  {
    title: "Kendali Privasi Penuh",
    desc: "Lindungi tautan dengan kata sandi, atur masa berlaku sesuai kebutuhan, atau cabut akses kapan pun kamu menginginkannya.",
  },
  {
    title: "Unduh Koleksi Sekaligus",
    desc: "Penerima dapat mengunduh seluruh isi album dalam satu berkas ZIP instan tanpa perlu repot menyimpan satu per satu.",
  },
  {
    title: "Pengalaman Bersih & Tenang",
    desc: "Tanpa algoritma linimasa, tanpa iklan yang mengganggu, dan tanpa kompresi paksa. Hanya ruang tenang untuk karya dan kenanganmu.",
  },
] as const;

export function RulesSection() {
  return (
    <section className="mx-auto w-full max-w-[560px] px-4 pt-[72px] md:max-w-[960px] md:px-6 md:pt-[104px]">
      <div className="md:flex md:items-start md:gap-16">
        <div className="min-w-0 flex-1">
          <h2 className="text-h2 text-ink md:text-h1">Mengapa Galeriku?</h2>
          <p className="mt-2 text-body text-ink-muted md:mt-3">
            Semua kemudahan berbagi foto dan video, dirancang dengan standar kenyamanan dan privasi tertinggi.
          </p>
          <div className="mt-6 space-y-5 md:mt-8 md:space-y-6">
            {HIGHLIGHTS.map((item) => (
              <div
                key={item.title}
                className="border-b border-line pb-4 last:border-b-0 last:pb-0"
              >
                <h3 className="font-serif text-[17px] font-semibold text-ink md:text-[19px]">
                  {item.title}
                </h3>
                <p className="mt-1 text-body text-ink-muted leading-relaxed">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-11 md:mt-6 md:w-[340px] md:shrink-0">
          <div className="relative rounded-[4px] border border-line bg-surface px-5 pb-[22px] pt-[26px] shadow-float motion-safe:rotate-[-1deg] md:px-6 md:pb-[26px] md:pt-[30px] md:motion-safe:rotate-[-1.5deg]">
            <div
              aria-hidden="true"
              className="absolute -top-[11px] left-1/2 -ml-[42px] h-[22px] w-[84px] rotate-2 bg-accent-soft opacity-90 motion-reduce:rotate-0"
            />
            <div className="text-xs font-semibold uppercase tracking-[0.04em] text-ink-muted">
              Privasi & Kepercayaan
            </div>
            <p className="mt-2 font-serif text-[18px] font-medium italic leading-[26px] text-ink md:mt-2.5 md:text-[20px] md:leading-7">
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

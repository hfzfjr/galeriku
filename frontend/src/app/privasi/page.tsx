import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/landing/logo";

export const metadata: Metadata = {
  title: "Kebijakan Privasi",
  description:
    "Kebijakan privasi Galeriku: data apa yang disimpan, untuk apa, dan berapa lama.",
  robots: {
    index: false,
    follow: false,
  },
};

// Alamat email kontak dari env (bukan hardcode). Bila kosong, build tetap
// lolos dan kalimat berisi email disembunyikan.
const KONTAK = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() ?? "";

function Bagian({ judul, children }: { judul: string; children: ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-h2 text-ink">{judul}</h2>
      <div className="mt-2 flex flex-col gap-3 text-body text-ink">
        {children}
      </div>
    </section>
  );
}

// Halaman statis (prerender saat build), Server Component, tanpa JS klien.
// Isi hanya mengklaim yang didukung kode (lihat laporan penutupan Sprint 2
// untuk daftar verifikasi per kalimat).
export default function PrivasiPage() {
  return (
    <>
      <header className="mx-auto flex w-full max-w-[560px] items-center px-4 py-3 md:px-6 md:py-5">
        <Link href="/" aria-label="Galeriku, kembali ke beranda">
          <Logo />
        </Link>
      </header>
      <main className="mx-auto w-full max-w-[560px] px-4 pb-16 pt-6 md:px-6 md:pt-10">
        <h1 className="text-h1 text-ink">Kebijakan Privasi</h1>
        <p className="mt-2 text-body text-ink-muted">
          Terakhir diperbarui: 13 Oktober 2026
        </p>

        <Bagian judul="Data yang kami simpan">
          <p>
            Akun: alamat email, nama, dan foto profil (hanya bila kamu masuk
            dengan Google).
          </p>
          <p>
            File: foto dan video yang kamu unggah beserta nama file aslinya,
            ukuran, jenis, dan tanggalnya.
          </p>
          <p>
            Keamanan: hash alamat IP dan info perangkat untuk setiap sesi
            masuk dan setiap akses link publik. Kode verifikasi email hanya
            disimpan sebagai hash dan bersifat sementara.
          </p>
        </Bagian>

        <Bagian judul="Untuk apa datanya dipakai">
          <p>
            Untuk membuat kamu tetap masuk, menghitung kuota, menjalankan
            link berbagi, mengirim kode verifikasi, dan mencegah penyalahgunaan
            seperti spam pendaftaran atau akun yang ditangguhkan.
          </p>
        </Bagian>

        <Bagian judul="Cookie dan pelacak">
          <p>
            Hanya ada cookie sesi masuk (HttpOnly, kedaluwarsa 30 hari) dan
            cookie sekali pakai berumur 10 menit saat proses login Google.
            Tidak ada analytics, pelacak, atau iklan. Huruf tampilan dimuat
            dari server kami sendiri.
          </p>
        </Bagian>

        <Bagian judul="Pihak ketiga">
          <p>
            Sebagian pemrosesan memakai layanan pihak ketiga: Google,
            Cloudflare, Resend, dan Vercel. Mereka memproses data sesuai
            kebijakan privasi mereka masing-masing.
          </p>
        </Bagian>

        <Bagian judul="Di mana data berada">
          <p>
            Di server milik pengelola Galeriku. Anggap salinan di sini
            sebagai cadangan dan simpan file aslimu di HP.
          </p>
        </Bagian>

        <Bagian judul="Link publik">
          <p>
            Siapa pun yang memegang link publik bisa membuka dan mengunduh
            isinya sesuai opsi yang dipasang pemilik (masa berlaku, password,
            izin unduh). Pemilik bisa mencabut link kapan saja.
          </p>
        </Bagian>

        <Bagian judul="Berapa lama disimpan">
          <p>
            Data akunmu tersimpan sampai akun dihapus dari database. Akun yang
            tidak selesai verifikasi email dihapus otomatis setelah 24 jam,
            dan kode kedaluwarsa dibersihkan setelah sehari. Pembersihan
            berjalan setiap jam.
          </p>
        </Bagian>

        <Bagian judul="Hak kamu">
          {KONTAK ? (
            <p>
              Kamu bisa meminta penghapusan akun dan seluruh datamu kapan saja
              lewat email ke {KONTAK}.
            </p>
          ) : (
            <p>
              Kamu bisa meminta penghapusan akun dan seluruh datamu kapan saja
              lewat email kontak pengelola.
            </p>
          )}
        </Bagian>
      </main>
    </>
  );
}

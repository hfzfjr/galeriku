import { CircleAlert, Info } from "lucide-react";

/** Pesan galat form: ikon + teks, diumumkan ke pembaca layar. */
export function FormError({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="flex items-start gap-1.5 text-sm font-medium text-danger"
    >
      <CircleAlert
        size={16}
        strokeWidth={1.5}
        className="mt-0.5 shrink-0"
        aria-hidden="true"
      />
      <span>{message}</span>
    </p>
  );
}

/** Pesan info netral di atas form (mis. reset sukses, kode terkirim). */
export function FormInfo({ message }: { message: string }) {
  return (
    <p
      role="status"
      className="flex items-start gap-1.5 rounded-md border border-line bg-sunken px-3 py-2 text-sm text-ink"
    >
      <Info
        size={16}
        strokeWidth={1.5}
        className="mt-0.5 shrink-0"
        aria-hidden="true"
      />
      <span>{message}</span>
    </p>
  );
}

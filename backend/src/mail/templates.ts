// Template email OTP, Bahasa Indonesia gaya DESIGN.md §8.
// Nilai heks di berkas ini disengaja: HTML email wajib inline dan tidak
// bisa membaca variabel CSS. Disalin dari token terang DESIGN.md §2:
// paper #F6F0E4, ink #2A2420, ink-muted #6B6054, line #DDD2BC,
// accent #A9502E, accent-soft #EBD3C4. Tanpa gradien.

export type MailTemplate = {
  subject: string;
  text: string;
  html: string;
};

function contactLine(contactEmail: string | undefined): string {
  if (!contactEmail) {
    return '';
  }
  return ` Butuh bantuan? Hubungi ${contactEmail}.`;
}

function shell(bodyHtml: string): string {
  return (
    `<div style="background-color:#F6F0E4;padding:32px 16px;">` +
    `<div style="max-width:480px;margin:0 auto;background-color:#FBF7EE;` +
    `border:1px solid #DDD2BC;border-radius:10px;padding:28px 24px;` +
    `font-family:system-ui,-apple-system,'Segoe UI',sans-serif;` +
    `color:#2A2420;font-size:16px;line-height:24px;">` +
    bodyHtml +
    `</div></div>`
  );
}

export function verifyEmailTemplate(
  code: string,
  contactEmail: string | undefined,
): MailTemplate {
  const subject = 'Kode verifikasi Galeriku';
  const text =
    `Masukkan kode ini untuk mengaktifkan akunmu: ${code}. ` +
    `Berlaku 10 menit. Jangan bagikan kode ini ke siapa pun. ` +
    `Kalau kamu tidak mendaftar di Galeriku, abaikan email ini.` +
    contactLine(contactEmail);
  const html = shell(
    `<div style="font-size:22px;font-weight:600;">Kode verifikasi Galeriku</div>` +
      `<p>Masukkan kode ini untuk mengaktifkan akunmu:</p>` +
      `<div style="display:inline-block;background-color:#EBD3C4;color:#A9502E;` +
      `font-size:28px;font-weight:700;letter-spacing:6px;border-radius:6px;` +
      `padding:12px 20px;">${code}</div>` +
      `<p>Berlaku 10 menit. Jangan bagikan kode ini ke siapa pun.</p>` +
      `<p style="color:#6B6054;font-size:14px;line-height:20px;">` +
      `Kalau kamu tidak mendaftar di Galeriku, abaikan email ini.` +
      (contactEmail
        ? ` Butuh bantuan? Hubungi ${contactEmail}.`
        : '') +
      `</p>`,
  );
  return { subject, text, html };
}

export function resetPasswordTemplate(
  code: string,
  contactEmail: string | undefined,
): MailTemplate {
  const subject = 'Kode atur ulang password Galeriku';
  const text =
    `Masukkan kode ini untuk mengatur ulang password-mu: ${code}. ` +
    `Berlaku 10 menit. Jangan bagikan kode ini ke siapa pun. ` +
    `Kalau kamu tidak memintanya, abaikan email ini dan password-mu tetap aman.` +
    contactLine(contactEmail);
  const html = shell(
    `<div style="font-size:22px;font-weight:600;">Kode atur ulang password Galeriku</div>` +
      `<p>Masukkan kode ini untuk mengatur ulang password-mu:</p>` +
      `<div style="display:inline-block;background-color:#EBD3C4;color:#A9502E;` +
      `font-size:28px;font-weight:700;letter-spacing:6px;border-radius:6px;` +
      `padding:12px 20px;">${code}</div>` +
      `<p>Berlaku 10 menit. Jangan bagikan kode ini ke siapa pun.</p>` +
      `<p style="color:#6B6054;font-size:14px;line-height:20px;">` +
      `Kalau kamu tidak memintanya, abaikan email ini dan password-mu tetap aman.` +
      (contactEmail
        ? ` Butuh bantuan? Hubungi ${contactEmail}.`
        : '') +
      `</p>`,
  );
  return { subject, text, html };
}

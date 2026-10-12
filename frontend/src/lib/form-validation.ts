/**
 * Validasi form sisi klien memakai skema zod dari packages/contracts.
 * Pesan diterjemahkan ke Bahasa Indonesia yang pendek (DESIGN.md §8).
 */

type IssueLike = {
  path: (string | number | symbol)[];
  code: string;
};

function fieldMessage(field: string, code: string): string {
  switch (field) {
    case "email":
      return "Masukkan alamat email yang valid.";
    case "name":
      return "Masukkan namamu.";
    case "code":
      return "Kode terdiri dari 6 digit angka.";
    case "password":
    case "newPassword":
      if (code === "too_big") {
        return "Password maksimal 128 karakter.";
      }
      return "Password minimal 8 karakter.";
    default:
      return "Isian ini tidak valid.";
  }
}

export function zodToFieldErrors(issues: readonly IssueLike[]): {
  fields: Record<string, string>;
  turnstileMissing: boolean;
} {
  const fields: Record<string, string> = {};
  let turnstileMissing = false;
  for (const issue of issues) {
    const top = issue.path[0];
    if (top === "turnstileToken") {
      turnstileMissing = true;
      continue;
    }
    if (typeof top !== "string" || fields[top] !== undefined) {
      continue;
    }
    fields[top] = fieldMessage(top, issue.code);
  }
  return { fields, turnstileMissing };
}

export const TURNSTILE_REQUIRED_MESSAGE = "Selesaikan pemeriksaan keamanan dulu.";

/**
 * Placeholder netral untuk halaman /app yang fiturnya menyusul di story
 * berikutnya. Jujur: tanpa fitur palsu, hanya judul + satu kalimat.
 * Server Component.
 */
export function AppPlaceholder({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <main className="flex flex-col gap-2">
      <h1 className="text-h1 text-ink">{title}</h1>
      <p className="text-body text-ink-muted">{message}</p>
    </main>
  );
}

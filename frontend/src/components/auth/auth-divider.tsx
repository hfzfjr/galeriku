/**
 * Pemisah "atau" antara tombol Google dan form (DESIGN.md §7).
 * Server Component.
 */
export function AuthDivider() {
  return (
    <div aria-hidden="true" className="flex items-center gap-3">
      <span className="h-px flex-1 bg-line" />
      <span className="text-label text-ink-muted">atau</span>
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

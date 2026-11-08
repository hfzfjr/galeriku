/**
 * Ekstraksi Apple ContentIdentifier dari Apple MakerNote untuk pairing Live Photo iOS (RF-32).
 */
export function extractAppleContentIdentifier(makerNote: unknown): string | null {
  if (!makerNote) return null;

  // Jika makerNote sudah berbentuk objek atau string langsung
  if (typeof makerNote === 'string') {
    const uuidDirect = makerNote.match(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
    );
    if (uuidDirect) return uuidDirect[0].toUpperCase();
  }

  const buf = Buffer.isBuffer(makerNote)
    ? makerNote
    : makerNote instanceof Uint8Array
      ? Buffer.from(makerNote)
      : null;

  if (!buf || buf.length < 16) return null;

  const str = buf.toString('latin1');
  if (!str.includes('Apple iOS')) return null;

  const uuidMatch = str.match(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
  );
  return uuidMatch ? uuidMatch[0].toUpperCase() : null;
}


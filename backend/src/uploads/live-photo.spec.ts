import { extractAppleContentIdentifier } from './live-photo';

describe('extractAppleContentIdentifier (RF-32)', () => {
  it('mengekstrak ContentIdentifier UUID dari Apple MakerNote binary buffer', () => {
    const uuid = '46E2070F-B829-4B5E-AC6A-78D7CDDCAC30';
    const fakeMakerNote = Buffer.concat([
      Buffer.from('Apple iOS\0\0\x01MM\0\x01\0\x11\0\x02\0\0\0%\0\0\0\x1a'),
      Buffer.from(`${uuid}\0`),
    ]);

    const res = extractAppleContentIdentifier(fakeMakerNote);
    expect(res).toBe(uuid);
  });

  it('mengembalikan null jika bukan Apple MakerNote', () => {
    const fakeCanon = Buffer.from('Canon EOS 80D MakerNote data without uuid');
    const res = extractAppleContentIdentifier(fakeCanon);
    expect(res).toBeNull();
  });

  it('mengembalikan null jika input undefined atau null', () => {
    expect(extractAppleContentIdentifier(undefined)).toBeNull();
    expect(extractAppleContentIdentifier(null)).toBeNull();
  });
});


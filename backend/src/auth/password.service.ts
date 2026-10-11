import { Injectable } from '@nestjs/common';
import {
  hash as argonHash,
  verify as argonVerify,
  type Algorithm,
} from '@node-rs/argon2';

// argon2id = 2 (nilai numerik dipakai eksplisit karena Algorithm adalah
// const enum yang terhapus saat runtime; parameter ditulis eksplisit di
// sini dan tidak mengandalkan default library).
const ARGON2ID = 2 as Algorithm;

export const ARGON2_OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
  algorithm: ARGON2ID,
} as const;

// Hash argon2id valid untuk penyetaraan waktu saat email tidak dikenal
// (dibuat dengan parameter yang sama). Bukan rahasia.
const DUMMY_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$lZnmkz6LOojECD+CjpLGMw$cftIU+JJRzoC4B+EpiK4m4lISCBWWXBXL8DahTZnw4Q';

@Injectable()
export class PasswordService {
  hashPassword(password: string): Promise<string> {
    return argonHash(password, { ...ARGON2_OPTIONS });
  }

  async verifyPassword(
    passwordHash: string,
    password: string,
  ): Promise<boolean> {
    try {
      return await argonVerify(passwordHash, password, {
        ...ARGON2_OPTIONS,
      });
    } catch {
      // Hash rusak/tak dikenal dianggap password salah (aman).
      return false;
    }
  }

  // Selalu jalankan verifikasi berbiaya sama walau email tidak ada,
  // agar waktu respons tak membocorkan keberadaan email.
  async verifyUnknownEmail(password: string): Promise<boolean> {
    try {
      await argonVerify(DUMMY_HASH, password, { ...ARGON2_OPTIONS });
    } catch {
      // Diabaikan: hasilnya selalu false.
    }
    return false;
  }
}

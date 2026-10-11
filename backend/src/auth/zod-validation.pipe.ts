import {
  ArgumentMetadata,
  Injectable,
  PipeTransform,
} from '@nestjs/common';
import type { ZodType } from 'zod';
import { ApiError } from './api-error';

// Validasi body request memakai skema zod dari packages/contracts.
// Gagal -> 400 VALIDATION_ERROR; details hanya berisi path+pesan
// (tidak memantulkan nilai body).
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodType) {}

  transform(value: unknown, metadata: ArgumentMetadata) {
    if (metadata.type !== 'body') {
      return value;
    }
    const parsed = this.schema.safeParse(value);
    if (!parsed.success) {
      throw new ApiError(
        400,
        'VALIDATION_ERROR',
        'Data yang dikirim tidak valid.',
        {
          fields: parsed.error.issues.map((issue) => ({
            field:
              issue.path.length > 0 ? issue.path.join('.') : '(body)',
            message: issue.message,
          })),
        },
      );
    }
    return parsed.data;
  }
}

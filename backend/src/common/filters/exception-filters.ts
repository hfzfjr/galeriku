import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  NotFoundException,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { ApiError } from '../errors/api-error';

// Hanya ApiError yang diformat di sini. Error lain (mis. 503 dari /health,
// 404 bawaan) dibiarkan ke handler default Nest agar tidak berubah.
@Catch(ApiError)
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: ApiError, host: ArgumentsHost) {
    const reply = host.switchToHttp().getResponse<FastifyReply>();
    const body: Record<string, unknown> = {
      statusCode: exception.statusCode,
      code: exception.code,
      message: exception.message,
    };
    if (exception.details !== undefined) {
      body.details = exception.details;
    }
    reply.status(exception.statusCode).send(body);
  }
}

// Route tak dikenal: not-found handler bawaan Nest melempar
// NotFoundException lewat rantai filter global (bukan lewat error handler
// adapter). Dipetakan ke bentuk standar 404 tanpa membocorkan path
// ("Cannot GET /x" asli Nest dibuang).
@Catch(NotFoundException)
export class NotFoundExceptionFilter implements ExceptionFilter {
  catch(_exception: NotFoundException, host: ArgumentsHost) {
    const reply = host.switchToHttp().getResponse<FastifyReply>();
    reply.status(404).send({
      statusCode: 404,
      code: 'NOT_FOUND',
      message: 'Tidak ditemukan.',
    });
  }
}

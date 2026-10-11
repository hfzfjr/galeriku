import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
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

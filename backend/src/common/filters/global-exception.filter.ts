import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * One response shape for every error, and no internals on the wire.
 *
 * Without this, an unhandled error returns Nest's default 500 containing the
 * exception message — which for a TypeORM failure can include SQL, column
 * names and parameter values. Those go to the log instead; the client gets a
 * generic message.
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttp = exception instanceof HttpException;
    const status = isHttp
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    // HttpExceptions are ours and safe to relay — they carry validation
    // messages and things like "Incorrect email or password". Anything else
    // is unexpected and its text is not for public consumption.
    let message: string | string[] = 'Something went wrong';
    if (isHttp) {
      const body = exception.getResponse();
      message =
        typeof body === 'string'
          ? body
          : ((body as { message?: string | string[] }).message ??
            exception.message);
    }

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} -> ${status}`,
        exception instanceof Error ? exception.stack : String(exception)
      );
    } else {
      this.logger.warn(`${request.method} ${request.url} -> ${status}`);
    }

    response.status(status).json({
      statusCode: status,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}

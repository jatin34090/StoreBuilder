import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { captureException } from '../monitoring/error-tracker';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let error = 'INTERNAL_SERVER_ERROR';
    let message = 'An unexpected error occurred';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
        error = exceptionResponse.toUpperCase().replace(/\s+/g, '_');
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const resp = exceptionResponse as Record<string, unknown>;
        message = Array.isArray(resp['message'])
          ? (resp['message'] as string[]).join(', ')
          : String(resp['message'] ?? message);
        error = String(resp['error'] ?? error).toUpperCase().replace(/\s+/g, '_');
      }
    } else if (exception instanceof Error) {
      // Log unexpected errors but don't expose internals
      this.logger.error(`Unhandled exception: ${exception.message}`, exception.stack);
    }

    // Structured log for server-side failures + forward to error tracking.
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      const requestId = (request.headers['x-request-id'] as string) ?? undefined;
      this.logger.error(
        JSON.stringify({
          level: 'error',
          status,
          method: request.method,
          path: request.url,
          requestId,
          message,
          timestamp: new Date().toISOString(),
        }),
      );
      captureException(exception, { status, method: request.method, path: request.url, requestId });
    }

    response.status(status).json({
      success: false,
      error,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}

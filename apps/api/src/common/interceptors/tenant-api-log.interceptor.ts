import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import type { Request, Response } from 'express';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Logs every API request with tenant context for billing/monitoring.
 * Writes asynchronously — never blocks the response.
 */
@Injectable()
export class TenantApiLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger(TenantApiLogInterceptor.name);

  constructor(private prisma: PrismaService) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req  = ctx.switchToHttp().getRequest<Request>();
    const res  = ctx.switchToHttp().getResponse<Response>();
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => this.log(req, res.statusCode, Date.now() - start),
        error: (err: { status?: number }) =>
          this.log(req, err?.status ?? 500, Date.now() - start),
      }),
    );
  }

  private log(req: Request, statusCode: number, durationMs: number): void {
    const storeId = req.storeId;
    if (!storeId) return;

    // Fire-and-forget — don't block response
    this.prisma.tenantApiLog
      .create({
        data: {
          storeId,
          path:       req.path,
          method:     req.method,
          statusCode,
          durationMs,
        },
      })
      .catch((e: Error) => this.logger.error('Failed to write tenant API log', e.message));
  }
}

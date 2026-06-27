import { Logger } from '@nestjs/common';

/**
 * Optional error-tracking hook. If SENTRY_DSN is set AND @sentry/node is
 * installed, exceptions are forwarded to Sentry. Otherwise this is a safe
 * no-op, so the platform runs without the dependency. Install with:
 *   pnpm --filter @jewellery/api add @sentry/node
 */
const logger = new Logger('ErrorTracker');

interface SentryLike {
  init: (opts: Record<string, unknown>) => void;
  captureException: (err: unknown, ctx?: Record<string, unknown>) => void;
}

let sentry: SentryLike | null = null;
let initialised = false;

export function initErrorTracking(): void {
  if (initialised) return;
  initialised = true;

  const dsn = process.env['SENTRY_DSN'];
  if (!dsn) return;

  try {
    // Lazy require so the app builds/runs without @sentry/node present.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('@sentry/node') as SentryLike;
    mod.init({
      dsn,
      environment: process.env['NODE_ENV'] ?? 'development',
      release: process.env['SENTRY_RELEASE'] ?? process.env['GIT_SHA'],
      tracesSampleRate: process.env['NODE_ENV'] === 'production' ? 0.1 : 0,
      serverName: process.env['HOSTNAME'] ?? 'api',
      ignoreErrors: ['ECONNRESET', 'EPIPE', 'ECONNABORTED'],
    });
    sentry = mod;
    logger.log(`Sentry error tracking enabled (env=${process.env['NODE_ENV']})`);
  } catch {
    logger.warn('SENTRY_DSN is set but @sentry/node is not installed — error tracking disabled');
  }
}

export function captureException(err: unknown, context?: Record<string, unknown>): void {
  if (sentry) {
    try {
      sentry.captureException(err, context ? { extra: context } : undefined);
    } catch {
      /* never let tracking break the request path */
    }
  }
}

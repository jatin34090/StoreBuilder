// Next.js server + edge instrumentation file.
// @sentry/nextjs v10+ requires Sentry.init to be called here instead of
// sentry.server.config.ts / sentry.edge.config.ts (which are deprecated).
export { onRequestError } from '@sentry/nextjs';

export async function register() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;

  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { init } = await import('@sentry/nextjs');
    init({
      dsn,
      environment: process.env.NEXT_PUBLIC_ENV ?? 'production',
      release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,
      tracesSampleRate: 0.1,
      ignoreErrors: [/ECONNRESET/, /EPIPE/],
    });
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    const { init } = await import('@sentry/nextjs');
    init({
      dsn,
      environment: process.env.NEXT_PUBLIC_ENV ?? 'production',
      release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,
      tracesSampleRate: 0.05,
    });
  }
}

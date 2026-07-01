// Next.js server + edge instrumentation (Sentry v10+).
// All imports are dynamic so Turbopack only compiles Sentry when a DSN is set.

export async function onRequestError(
  ...args: Parameters<Awaited<typeof import('@sentry/nextjs')>['captureRequestError']>
) {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;
  const { captureRequestError } = await import('@sentry/nextjs');
  return captureRequestError(...args);
}

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

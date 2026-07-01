// Next.js client instrumentation (Sentry v10+).
// Dynamic import so Turbopack skips compiling Sentry when no DSN is set.

export async function onRouterTransitionStart(
  ...args: Parameters<Awaited<typeof import('@sentry/nextjs')>['captureRouterTransitionStart']>
) {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;
  const { captureRouterTransitionStart } = await import('@sentry/nextjs');
  return captureRouterTransitionStart(...args);
}

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  import('@sentry/nextjs').then(({ init, replayIntegration }) => {
    init({
      dsn,
      environment: process.env.NEXT_PUBLIC_ENV ?? 'production',
      release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,
      tracesSampleRate: 0.1,
      replaysSessionSampleRate: 0.05,
      replaysOnErrorSampleRate: 1.0,
      integrations: [
        replayIntegration({
          maskAllText: true,
          blockAllMedia: true,
        }),
      ],
      beforeBreadcrumb(breadcrumb) {
        if (
          (breadcrumb.category === 'xhr' || breadcrumb.category === 'fetch') &&
          breadcrumb.data?.url?.includes('/auth/')
        ) {
          delete breadcrumb.data.body;
        }
        return breadcrumb;
      },
    });
  });
}

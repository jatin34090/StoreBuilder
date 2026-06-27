// Next.js client instrumentation file (replaces sentry.client.config.ts).
// Loaded once in the browser bundle.
import * as Sentry from '@sentry/nextjs';

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_ENV ?? 'production',
    release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,

    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0.05,
    replaysOnErrorSampleRate: 1.0,

    integrations: [
      Sentry.replayIntegration({
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
}

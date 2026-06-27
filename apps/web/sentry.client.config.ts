// Client-side Sentry initialisation (browser bundle).
// Runs in every browser session; keep tracesSampleRate low in prod.
import * as Sentry from '@sentry/nextjs';

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

    // Strip PII from breadcrumbs automatically.
    beforeBreadcrumb(breadcrumb) {
      if (breadcrumb.category === 'xhr' || breadcrumb.category === 'fetch') {
        // Don't log auth request bodies.
        if (breadcrumb.data?.url?.includes('/auth/')) {
          delete breadcrumb.data.body;
        }
      }
      return breadcrumb;
    },
  });
}

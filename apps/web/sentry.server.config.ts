import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  enabled: !!process.env.SENTRY_DSN,

  beforeSend(event) {
    // Never forward authentication or payment secrets to Sentry
    if (event.request?.headers) {
      delete event.request.headers['Authorization'];
      delete event.request.headers['Cookie'];
      delete event.request.headers['x-razorpay-signature'];
    }
    if (event.extra) {
      delete event.extra['password'];
      delete event.extra['token'];
    }
    return event;
  },
});

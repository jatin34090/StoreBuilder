// Next.js App Router instrumentation hook — called once per server process.
// Required for @sentry/nextjs to instrument server-side code.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    // Edge runtime: server config is not needed (no Node APIs), but Sentry
    // still needs to initialise for edge-function error capture.
    await import('./sentry.server.config');
  }
}

import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Emit a self-contained server bundle for small, fast Docker images.
  output: 'standalone',
  // ESLint runs in a dedicated CI step — skip during `next build` to avoid
  // the root eslint.config.mjs @eslint/js resolution issue in the build worker.
  eslint: { ignoreDuringBuilds: true },
  typedRoutes: false,
  // Turbopack + @sentry/nextjs: these OpenTelemetry packages use dynamic
  // require() and cannot be bundled — mark them external so Node resolves them
  // at runtime from the monorepo node_modules instead.
  serverExternalPackages: ['import-in-the-middle', 'require-in-the-middle'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        pathname: '/**',
      },
    ],
    formats: ['image/avif', 'image/webp'],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

const sentryConfig = {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
  silent: !process.env.CI,
  // Skip all Sentry instrumentation in dev — no DSN configured and it adds
  // ~10s to every first-compile via OpenTelemetry/import-in-the-middle.
  disableLogger: true,
  automaticVercelMonitors: false,
};

// In dev: export nextConfig directly — @sentry/nextjs is never imported,
// so Node.js doesn't load the entire OTel chain at startup (saves ~2-3s).
// In production: dynamically import withSentryConfig and wrap.
export default process.env.NODE_ENV === 'development'
  ? nextConfig
  : (async () => {
      const { withSentryConfig } = await import('@sentry/nextjs');
      return withSentryConfig(nextConfig, sentryConfig);
    })();

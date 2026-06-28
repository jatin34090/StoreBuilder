import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

const nextConfig: NextConfig = {
  // Emit a self-contained server bundle for small, fast Docker images.
  output: 'standalone',
  // ESLint runs in a dedicated CI step — skip during `next build` to avoid
  // the root eslint.config.mjs @eslint/js resolution issue in the build worker.
  eslint: { ignoreDuringBuilds: true },
  typedRoutes: false,
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

export default withSentryConfig(nextConfig, {
  // Sentry build-time options — safe no-op when SENTRY_AUTH_TOKEN is unset.
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Upload source maps only when auth token is present (i.e. production CI).
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },

  // Suppress noisy Sentry CLI output outside CI.
  silent: !process.env.CI,
});

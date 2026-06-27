'use client';
import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          fontFamily: 'sans-serif',
          gap: '16px',
          backgroundColor: '#0a0a0a',
          color: '#ededed',
        }}
      >
        <h2 style={{ fontSize: '20px', fontWeight: 700 }}>Something went wrong</h2>
        <button
          onClick={reset}
          style={{
            padding: '10px 24px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: '#7c3aed',
            color: '#fff',
            cursor: 'pointer',
            fontSize: '14px',
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}

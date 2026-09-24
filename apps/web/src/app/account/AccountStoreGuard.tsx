'use client';

import { useEffect, useState } from 'react';

function getStoreIdCookie(): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const match = document.cookie.match(/(?:^|;\s*)store-id=([^;]+)/);
  return match?.[1];
}

/**
 * Client-side guard: blocks account pages from rendering when there is
 * no store context (cookie absent). Shows a helpful dev message on
 * localhost; on production the middleware always sets the cookie so
 * this block is unreachable for real visitors.
 */
export function AccountStoreGuard({ children }: { children: React.ReactNode }) {
  const [storeId, setStoreId] = useState<string | undefined>(undefined);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    setStoreId(getStoreIdCookie());
    setChecked(true);
  }, []);

  if (!checked) return null;

  if (!storeId) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-16">
        <div className="max-w-md text-center space-y-4">
          <div className="text-5xl mb-2">🏪</div>
          <h1 className="text-xl font-bold">Open via your store URL</h1>
          <p className="text-sm text-muted-foreground">
            Customer account pages belong to a specific store. In development,
            access them via the path-based store URL:
          </p>
          <code className="block bg-muted rounded-lg px-4 py-3 text-sm font-mono text-left">
            localhost:3000/store/<em>your-slug</em>/account/orders
          </code>
          <p className="text-xs text-muted-foreground">
            Replace <strong>your-slug</strong> with your store&apos;s slug.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

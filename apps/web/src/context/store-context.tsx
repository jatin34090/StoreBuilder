'use client';

import { createContext, useContext } from 'react';

export interface StoreTenantContext {
  id: string;
  name: string;
  slug: string;
  plan: string;
  logoUrl: string | null;
}

const StoreContext = createContext<StoreTenantContext | null>(null);

export function StoreProvider({
  store,
  children,
}: {
  store: StoreTenantContext | null;
  children: React.ReactNode;
}) {
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

/** Returns the current store tenant, or null on the root platform domain. */
export function useStore(): StoreTenantContext | null {
  return useContext(StoreContext);
}

/** Throws if called outside a store tenant context. */
export function useRequiredStore(): StoreTenantContext {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useRequiredStore must be used within a store tenant page');
  return store;
}

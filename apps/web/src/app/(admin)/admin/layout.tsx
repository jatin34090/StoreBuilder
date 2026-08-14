'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAdminAuthStore, type StoreRole, type Permission } from '../../../store/adminAuthStore';
import { AdminSidebar } from '../../../components/admin/AdminSidebar';
import { AdminTopbar } from '../../../components/admin/AdminTopbar';
import { Sheet, SheetContent } from '../../../components/ui/sheet';
import { api, setAdminStoreSlug } from '../../../lib/api';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAdminAuthenticated, setAdminAuth, setAdminStore, setAdminRoleData, clearAdminAuth } = useAdminAuthStore();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [verified, setVerified] = useState(false);

  const isLoginPage = pathname === '/admin/login';

  useEffect(() => {
    if (isLoginPage) {
      setVerified(true);
      return;
    }

    // 1. Verify the JWT belongs to an ADMIN role
    api.get('/users/me')
      .then(async (res) => {
        const user = res.data?.data ?? res.data;
        if (user?.role !== 'ADMIN') {
          clearAdminAuth();
          router.replace('/admin/login');
          return;
        }

        setAdminAuth({
          id:     user.id,
          name:   user.name,
          email:  user.email,
          role:   'ADMIN',
          avatar: user.avatar ?? undefined,
        });

        // 2. Bootstrap store context + role + permissions from /admin/store/me
        //    This endpoint uses JWT storeId directly (no x-store-slug needed).
        if (user.storeId) {
          try {
            const meRes = await api.get('/admin/store/me');
            const me = meRes.data?.data ?? meRes.data;
            if (me?.store?.slug) {
              setAdminStore({
                id:          me.store.id,
                name:        me.store.name,
                slug:        me.store.slug,
                status:      me.store.status,
                plan:        me.store.plan,
                businessName: me.store.businessName ?? null,
                industry:    me.store.industry ?? null,
                logoUrl:     me.store.logoUrl ?? null,
              });
              setAdminRoleData(me.role as StoreRole, (me.permissions ?? []) as Permission[]);
              // From this point, all /admin/* API calls include x-store-slug
              setAdminStoreSlug(me.store.slug);
            }
          } catch {
            // Store fetch failed — still allow layout to render (user may not have a store yet)
          }
        }

        setVerified(true);
      })
      .catch(() => {
        clearAdminAuth();
        router.replace('/admin/login');
      });
  }, [isLoginPage, clearAdminAuth, setAdminAuth, setAdminStore, router]);

  // Re-sync the module-level slug whenever the adminStore changes in Zustand
  // (e.g. after a store settings update that changes the slug).
  const adminStore = useAdminAuthStore((s) => s.adminStore);
  useEffect(() => {
    if (adminStore?.slug) setAdminStoreSlug(adminStore.slug);
  }, [adminStore?.slug]);

  if (isLoginPage) {
    return <>{children}</>;
  }

  if (!verified) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 text-sm">Verifying session…</p>
        </div>
      </div>
    );
  }

  if (!isAdminAuthenticated) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Desktop sidebar */}
      <div className="hidden lg:block">
        <AdminSidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
      </div>

      {/* Mobile sidebar via Sheet */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="p-0 w-64 bg-[#1a1a2e] border-0">
          <AdminSidebar collapsed={false} onToggle={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Main content area */}
      <div className={`transition-all duration-300 ${sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'}`}>
        <AdminTopbar onMobileMenuToggle={() => setMobileOpen(true)} />
        <main className="p-4 sm:p-6 min-h-[calc(100vh-4rem)] scrollbar-thin">{children}</main>
      </div>
    </div>
  );
}

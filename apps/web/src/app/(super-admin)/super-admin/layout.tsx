'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useSuperAdminAuthStore } from '@/store/superAdminAuthStore';
import { SuperAdminSidebar } from '@/components/super-admin/SuperAdminSidebar';
import { SuperAdminTopbar } from '@/components/super-admin/SuperAdminTopbar';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { api } from '@/lib/api';

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const { isSuperAdminAuthenticated, clearSuperAdminAuth } = useSuperAdminAuthStore();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen]             = useState(false);
  const [verified, setVerified]                 = useState(false);

  const isLoginPage = pathname === '/super-admin/login';

  useEffect(() => {
    if (isLoginPage) { setVerified(true); return; }

    api.get('/users/me')
      .then((res) => {
        const user = res.data?.data ?? res.data;
        if (user?.role !== 'SUPER_ADMIN') {
          clearSuperAdminAuth();
          router.replace('/super-admin/login');
        } else {
          setVerified(true);
        }
      })
      .catch(() => {
        clearSuperAdminAuth();
        router.replace('/super-admin/login');
      });
  }, [isLoginPage, clearSuperAdminAuth, router]);

  if (isLoginPage) return <>{children}</>;

  if (!verified) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-violet-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 text-sm">Verifying session…</p>
        </div>
      </div>
    );
  }

  if (!isSuperAdminAuthenticated) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Desktop sidebar */}
      <div className="hidden lg:block">
        <SuperAdminSidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
      </div>

      {/* Mobile sidebar */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="p-0 w-64 bg-[#0f172a] border-0">
          <SuperAdminSidebar collapsed={false} onToggle={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className={`transition-all duration-300 ${sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'}`}>
        <SuperAdminTopbar onMobileMenuToggle={() => setMobileOpen(true)} />
        <main className="p-4 sm:p-6 min-h-[calc(100vh-4rem)]">{children}</main>
      </div>
    </div>
  );
}

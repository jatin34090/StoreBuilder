'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAdminAuthStore } from '../../../store/adminAuthStore';
import { AdminSidebar } from '../../../components/admin/AdminSidebar';
import { AdminTopbar } from '../../../components/admin/AdminTopbar';
import { Sheet, SheetContent } from '../../../components/ui/sheet';
import { api } from '../../../lib/api';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAdminAuthenticated, clearAdminAuth } = useAdminAuthStore();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [verified, setVerified] = useState(false);

  const isLoginPage = pathname === '/admin/login';

  useEffect(() => {
    if (isLoginPage) {
      setVerified(true);
      return;
    }

    // Verify the current cookie actually belongs to an ADMIN — Zustand state
    // can be stale if the user logged in as a customer in another tab.
    api.get('/users/me')
      .then((res) => {
        const user = res.data?.data ?? res.data;
        if (user?.role !== 'ADMIN') {
          clearAdminAuth();
          router.replace('/admin/login');
        } else {
          setVerified(true);
        }
      })
      .catch(() => {
        clearAdminAuth();
        router.replace('/admin/login');
      });
  }, [isLoginPage, clearAdminAuth, router]);


  // Login page: render without admin chrome
  if (isLoginPage) {
    return <>{children}</>;
  }

  // Show spinner while verifying the JWT role against the API
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

  if (!isAdminAuthenticated) {
    return null;
  }

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
      <div
        className={`transition-all duration-300 ${
          sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'
        }`}
      >
        <AdminTopbar onMobileMenuToggle={() => setMobileOpen(true)} />
        <main className="p-4 sm:p-6 min-h-[calc(100vh-4rem)] scrollbar-thin">{children}</main>
      </div>
    </div>
  );
}

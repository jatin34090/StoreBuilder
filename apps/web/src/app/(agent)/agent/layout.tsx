'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { LayoutDashboard, LogOut, Truck, Banknote } from 'lucide-react';
import { useAuthStore } from '../../../store/authStore';
import { Button } from '../../../components/ui/button';

export default function AgentLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, user, clearUser } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  const isLoginPage = pathname === '/agent/login';

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;
    if (!isLoginPage && (!isAuthenticated || user?.role !== 'DELIVERY_AGENT')) {
      router.replace('/agent/login');
    }
  }, [mounted, isAuthenticated, user, isLoginPage, router]);

  if (isLoginPage) return <>{children}</>;

  if (!mounted || !isAuthenticated || user?.role !== 'DELIVERY_AGENT') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const handleLogout = () => {
    clearUser();
    router.replace('/agent/login');
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top nav */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 px-4 h-14 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
            <Truck className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-slate-800">Agent Portal</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500 hidden sm:block">{user?.name}</span>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="text-slate-500 hover:text-red-600">
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* Bottom nav for mobile */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 flex sm:hidden">
        <Link href="/agent" className="flex-1 flex flex-col items-center justify-center py-2 text-xs text-slate-500 hover:text-orange-500">
          <LayoutDashboard className="w-5 h-5 mb-0.5" />
          Deliveries
        </Link>
        <Link href="/agent/remittances" className="flex-1 flex flex-col items-center justify-center py-2 text-xs text-slate-500 hover:text-orange-500">
          <Banknote className="w-5 h-5 mb-0.5" />
          Remittances
        </Link>
        <button onClick={handleLogout} className="flex-1 flex flex-col items-center justify-center py-2 text-xs text-slate-500 hover:text-red-500">
          <LogOut className="w-5 h-5 mb-0.5" />
          Logout
        </button>
      </nav>

      <main className="max-w-2xl mx-auto px-4 py-6 pb-20 sm:pb-6">{children}</main>
    </div>
  );
}

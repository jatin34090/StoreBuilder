'use client';

import { useRouter, usePathname } from 'next/navigation';
import { Menu, LogOut, Shield } from 'lucide-react';
import { useSuperAdminAuthStore } from '@/store/superAdminAuthStore';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const PAGE_TITLES: Record<string, string> = {
  '/super-admin':        'Platform Overview',
  '/super-admin/stores': 'Stores',
};

interface Props { onMobileMenuToggle: () => void }

export function SuperAdminTopbar({ onMobileMenuToggle }: Props) {
  const router   = useRouter();
  const pathname = usePathname();
  const { superAdminUser, clearSuperAdminAuth } = useSuperAdminAuthStore();

  const title = Object.entries(PAGE_TITLES)
    .reverse()
    .find(([path]) => pathname.startsWith(path))?.[1] ?? 'Super Admin';

  const handleLogout = () => {
    clearSuperAdminAuth();
    toast.success('Logged out');
    router.push('/super-admin/login');
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 sticky top-0 z-20">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMobileMenuToggle}>
          <Menu className="h-5 w-5" />
        </Button>
        <h1 className="text-base font-semibold text-slate-800">{title}</h1>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-2 text-sm text-slate-600">
          <div className="w-6 h-6 rounded-full bg-violet-600 flex items-center justify-center">
            <Shield className="w-3 h-3 text-white" />
          </div>
          <span>{superAdminUser?.name ?? superAdminUser?.email ?? 'Super Admin'}</span>
        </div>
        <Button variant="ghost" size="icon" onClick={handleLogout} aria-label="Logout">
          <LogOut className="h-4 w-4 text-slate-500" />
        </Button>
      </div>
    </header>
  );
}

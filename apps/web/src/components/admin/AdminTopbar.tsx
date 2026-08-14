'use client';

import { useRouter, usePathname } from 'next/navigation';
import { Bell, Menu, LogOut, User, ChevronDown, ExternalLink, Store } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { useAdminAuthStore } from '../../store/adminAuthStore';
import { api, setAdminStoreSlug } from '../../lib/api';

interface AdminTopbarProps {
  onMobileMenuToggle: () => void;
}

const pageTitles: Record<string, string> = {
  '/admin':                 'Dashboard',
  '/admin/products':        'Products',
  '/admin/categories':      'Categories',
  '/admin/orders':          'Orders',
  '/admin/users':           'Customers',
  '/admin/inventory':       'Inventory',
  '/admin/coupons':         'Coupons',
  '/admin/notifications':   'Notifications',
  '/admin/delivery':        'Shipping',
  '/admin/reviews':         'Reviews',
  '/admin/customize':       'Theme',
  '/admin/profile':         'My Profile',
  '/admin/settings':        'Settings',
  '/admin/settings/store':  'Store Settings',
  '/admin/remittances':     'Payments',
  '/admin/analytics':       'Analytics',
};

function getPageTitle(pathname: string): string {
  if (pageTitles[pathname]) return pageTitles[pathname];
  const base = '/' + pathname.split('/').slice(1, 4).join('/');
  if (pageTitles[base]) return pageTitles[base];
  return '/' + pathname.split('/').slice(1, 3).join('/');
}

export function AdminTopbar({ onMobileMenuToggle }: AdminTopbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { adminUser, adminStore, clearAdminAuth } = useAdminAuthStore();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const handleLogout = async () => {
    try { await api.post('/auth/logout'); } catch { /* ignore */ }
    setAdminStoreSlug(undefined);
    clearAdminAuth();
    toast.success('Logged out successfully');
    router.push('/admin/login');
  };

  const storeUrl = adminStore?.slug
    ? (process.env['NEXT_PUBLIC_ROOT_DOMAIN']
        ? `https://${adminStore.slug}.${process.env['NEXT_PUBLIC_ROOT_DOMAIN']}`
        : `http://${adminStore.slug}.localhost:3000`)
    : null;

  const title = getPageTitle(pathname);
  const initials = adminUser?.name
    ? adminUser.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'AD';

  return (
    <header className="sticky top-0 z-30 h-16 bg-white border-b border-slate-200 flex items-center px-4 gap-4">
      <Button variant="ghost" size="sm" className="lg:hidden h-9 w-9 p-0" onClick={onMobileMenuToggle}>
        <Menu className="w-5 h-5 text-slate-600" />
      </Button>

      {/* Page title */}
      <div className="flex-1 min-w-0">
        <h2 className="text-lg font-semibold text-slate-900 truncate">{title}</h2>
        {adminStore && (
          <p className="text-xs text-slate-400 leading-none mt-0.5 truncate hidden sm:block">
            {adminStore.businessName ?? adminStore.name}
            {adminStore.status !== 'ACTIVE' && (
              <span className="ml-1.5 text-amber-500 font-medium">
                · {adminStore.status === 'SETUP' ? 'Setup mode' : adminStore.status}
              </span>
            )}
          </p>
        )}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2">
        {/* View Store button */}
        {storeUrl && (
          <a
            href={storeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            View Store
          </a>
        )}

        {/* Notification bell */}
        <Button variant="ghost" size="sm" className="h-9 w-9 p-0 relative">
          <Bell className="w-5 h-5 text-slate-500" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
        </Button>

        {/* User dropdown */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground text-xs font-bold overflow-hidden">
              {adminUser?.avatar
                ? <img src={adminUser.avatar} alt={adminUser.name} className="w-8 h-8 object-cover" />
                : initials}
            </div>
            <span className="text-sm font-medium text-slate-700 hidden sm:block">{adminUser?.name ?? 'Admin'}</span>
            <ChevronDown className="w-4 h-4 text-slate-400 hidden sm:block" />
          </button>

          {dropdownOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)} />
              <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl border border-slate-200 shadow-xl z-20 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100">
                  <p className="text-sm font-semibold text-slate-900 truncate">{adminUser?.name}</p>
                  <p className="text-xs text-slate-500 truncate">{adminUser?.email}</p>
                  {adminStore && (
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <Store className="w-3 h-3 text-slate-400" />
                      <p className="text-xs text-slate-500 truncate">{adminStore.name}</p>
                    </div>
                  )}
                </div>
                <div className="p-1">
                  <button
                    onClick={() => { setDropdownOpen(false); router.push('/admin/profile'); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-lg transition-colors"
                  >
                    <User className="w-4 h-4 text-slate-400" />
                    Profile
                  </button>
                  <button
                    onClick={() => { setDropdownOpen(false); router.push('/admin/settings/store'); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-lg transition-colors"
                  >
                    <Store className="w-4 h-4 text-slate-400" />
                    Store Settings
                  </button>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

'use client';

import { useRouter, usePathname } from 'next/navigation';
import { Bell, Menu, LogOut, User, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { useAdminAuthStore } from '../../store/adminAuthStore';

interface AdminTopbarProps {
  onMobileMenuToggle: () => void;
}

const pageTitles: Record<string, string> = {
  '/admin': 'Dashboard',
  '/admin/products': 'Products',
  '/admin/categories': 'Categories',
  '/admin/orders': 'Orders',
  '/admin/users': 'Users',
  '/admin/inventory': 'Inventory',
  '/admin/coupons': 'Coupons',
  '/admin/notifications': 'Notifications',
  '/admin/delivery': 'Delivery',
  '/admin/reviews': 'Reviews',
  '/admin/theme': 'Website Theme',
  '/admin/profile': 'My Profile',
  '/admin/settings': 'Site Settings',
  '/admin/remittances': 'Remittances',
};

function getPageTitle(pathname: string): string {
  if (pageTitles[pathname]) return pageTitles[pathname];
  const base = '/' + pathname.split('/').slice(1, 3).join('/');
  return pageTitles[base] ?? 'Admin';
}

export function AdminTopbar({ onMobileMenuToggle }: AdminTopbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { adminUser, clearAdminAuth } = useAdminAuthStore();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const handleLogout = () => {
    clearAdminAuth();
    toast.success('Logged out successfully');
    router.push('/admin/login');
  };

  const title = getPageTitle(pathname);
  const initials = adminUser?.name
    ? adminUser.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'AD';

  return (
    <header className="sticky top-0 z-30 h-16 bg-white border-b border-slate-200 flex items-center px-4 gap-4">
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="sm"
        className="lg:hidden h-9 w-9 p-0"
        onClick={onMobileMenuToggle}
      >
        <Menu className="w-5 h-5 text-slate-600" />
      </Button>

      {/* Page title */}
      <div className="flex-1">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2">
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
            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground text-xs font-bold">
              {adminUser?.avatar ? (
                <img
                  src={adminUser.avatar}
                  alt={adminUser.name}
                  className="w-8 h-8 rounded-full object-cover"
                />
              ) : (
                initials
              )}
            </div>
            <span className="text-sm font-medium text-slate-700 hidden sm:block">
              {adminUser?.name ?? 'Admin'}
            </span>
            <ChevronDown className="w-4 h-4 text-slate-400 hidden sm:block" />
          </button>

          {dropdownOpen && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-10"
                onClick={() => setDropdownOpen(false)}
              />
              {/* Dropdown menu */}
              <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-xl border border-slate-200 shadow-xl z-20 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100">
                  <p className="text-sm font-semibold text-slate-900 truncate">
                    {adminUser?.name}
                  </p>
                  <p className="text-xs text-slate-500 truncate">{adminUser?.email}</p>
                </div>
                <div className="p-1">
                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      router.push('/admin/profile');
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-lg transition-colors"
                  >
                    <User className="w-4 h-4 text-slate-400" />
                    Profile
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
